import os
import json
import urllib3
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

# ==================== 配置区域 ====================

PORT = int(os.environ.get("PORT", "3001"))
# 天润 IP 固定，端口由前端参数 remotePort 控制
TIANRUN_HOST_IP = "172.21.4.10"
REALTIME_CACHE = {}
IRRADIANCE_CACHE = {}
IGNORED_POWER_POINT_IDS = {"361002657"}
TERRAQT_URL = os.environ.get("TERRAQT_URL", "https://api-pro-openet.terraqt.com/v1/gfs_surface/point")
TERRAQT_TOKEN = os.environ.get("TERRAQT_TOKEN", "jBDMwQGZmNzM1ADMwEGMwQmNkBzYkVWM")
TERRAQT_TIMEOUT = float(os.environ.get("TERRAQT_TIMEOUT", "3"))
TERRAQT_CACHE_SECONDS = int(os.environ.get("TERRAQT_CACHE_SECONDS", "300"))

# 禁用 SSL 证书警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ==================== 核心逻辑 ====================

def load_station_locations():
    candidates = [
        os.path.join(os.path.dirname(__file__), "public", "marker2.json"),
        os.path.join(os.path.dirname(__file__), "dist", "marker2.json"),
        "/usr/share/nginx/html/marker2.json",
    ]
    for path in candidates:
        if not os.path.exists(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        locations = {}
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            coords = feature.get("geometry", {}).get("coordinates", [])
            if len(coords) < 2:
                continue
            station_id = str(props.get("id", ""))
            if station_id:
                locations[station_id] = {"lon": coords[0], "lat": coords[1]}
        return locations
    return {}

STATION_LOCATIONS = load_station_locations()

def send_json(handler, status_code, data):
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

def parse_metric_float(metric):
    unit = ""
    if isinstance(metric, dict):
        unit = str(metric.get("unit", "")).strip().lower()
        metric = metric.get("value")
    try:
        value = float(metric)
    except (TypeError, ValueError):
        return 0.0, False
    if unit in ("w", "瓦", "瓦特"):
        value = value / 1000
    elif unit in ("mw", "兆瓦"):
        value = value * 1000
    elif not unit and abs(value) > 100000:
        value = value / 1000
    return value, True

def format_metric(value):
    try:
        return f"{float(value):.4f}"
    except (TypeError, ValueError):
        return "0.0000"

def current_terraqt_hour():
    now = datetime.now(timezone(timedelta(hours=8))).replace(minute=0, second=0, microsecond=0)
    return now

def parse_time(value):
    if not isinstance(value, str):
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(value[:19], fmt)
        except ValueError:
            continue
    return None

def extract_time_bucket_value(body, target_time, var_name):
    data = body.get("data", body) if isinstance(body, dict) else {}
    timestamps = data.get("timestamp")
    rows = data.get("data")
    mete_vars = data.get("mete_var") or data.get("mete_vars")
    if not isinstance(timestamps, list) or not isinstance(rows, list) or not isinstance(mete_vars, list):
        return None

    var_index = None
    for index, name in enumerate(mete_vars):
        if str(name).lower() == var_name.lower():
            var_index = index
            break
    if var_index is None:
        return None

    values = rows[0].get("values") if rows and isinstance(rows[0], dict) else None
    if not isinstance(values, list):
        return None

    target_naive = target_time.replace(tzinfo=None)
    target_key = target_naive.strftime("%Y-%m-%d %H:00:00")
    previous_value = None
    next_value = None

    for index, timestamp in enumerate(timestamps):
        ts_time = parse_time(timestamp)
        if ts_time is None or index >= len(values):
            continue
        row = values[index]
        if not isinstance(row, list) or var_index >= len(row):
            continue
        value = row[var_index]
        if ts_time.strftime("%Y-%m-%d %H:00:00") == target_key:
            return value
        if ts_time <= target_naive:
            previous_value = value
        elif next_value is None:
            next_value = value

    return previous_value if previous_value is not None else next_value

def fetch_station_irradiance(station_id):
    location = STATION_LOCATIONS.get(str(station_id))
    if not location:
        return "0.0000"

    request_hour = current_terraqt_hour()
    request_time = request_hour.strftime("%Y-%m-%d %H:%M:%S")
    cache_key = f"{station_id}:{request_time}"
    now_ts = datetime.now().timestamp()
    cached = IRRADIANCE_CACHE.get(cache_key)
    if cached and now_ts - cached["time"] < TERRAQT_CACHE_SECONDS:
        return cached["value"]

    payload = {
        "lon": location["lon"],
        "lat": location["lat"],
        "setting": {"utc": 8},
        "mete_vars": ["dswrf"],
    }
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "origin": "https://openet.terraqt.com",
        "referer": "https://openet.terraqt.com/",
        "token": TERRAQT_TOKEN,
    }
    try:
        resp = requests.post(TERRAQT_URL, headers=headers, json=payload, timeout=TERRAQT_TIMEOUT)
        resp.raise_for_status()
        value = extract_time_bucket_value(resp.json(), request_hour, "dswrf")
        if value is None:
            return "0.0000"
        formatted = format_metric(value)
    except Exception:
        return "0.0000"

    IRRADIANCE_CACHE[cache_key] = {"time": now_ts, "value": formatted}
    return formatted

def fetch_pv_irradiance_map(pv_station_ids):
    station_ids = [str(station_id) for station_id in pv_station_ids]
    result = {}
    with ThreadPoolExecutor(max_workers=8) as executor:
        future_map = {
            executor.submit(fetch_station_irradiance, station_id): station_id
            for station_id in station_ids
        }
        for future in as_completed(future_map):
            station_id = future_map[future]
            try:
                result[station_id] = future.result()
            except Exception:
                result[station_id] = "0.0000"
    return result

def sum_station_wt_power(station_id, wt_info):
    total = 0.0
    count = 0
    station_id = str(station_id)
    for device_id, device_info in wt_info.items():
        device_id = str(device_id)
        if device_id in IGNORED_POWER_POINT_IDS:
            continue
        if not str(device_id).startswith(station_id):
            continue
        if device_info.get("standStateId") == 510 or device_info.get("standStateName") == "通讯中断":
            continue
        value, ok = parse_metric_float(device_info.get("WTUR.PwrAt.Ra.F32", {}))
        if not ok:
            continue
        total += value
        count += 1
    return total, count

def transform_to_map_style(raw_data, wind_ids_set, pv_ids_set, include_irradiance=False):
    """
    数据转换与分类计算
    """
    formatted_map = {}

    # 统计变量初始化
    total_power = 0.0
    total_field = 0
    wind_power = 0.0
    wind_field = 0
    pv_power = 0.0
    pv_field = 0

    wf_info = raw_data.get("wfInfo", {})
    wt_info = raw_data.get("wtInfo", {})
    station_ids = sorted(wind_ids_set | pv_ids_set) or sorted(wf_info.keys())
    irradiance_map = fetch_pv_irradiance_map(pv_ids_set) if include_irradiance else {}
    if station_ids:
        for fid in station_ids:
            info = wf_info.get(fid, {})
            total_field += 1

            # 1. 取电场级已汇总实际功率；抚州科电+旭阳的电场级值异常，改用设备测点求和。
            if fid == "361002":
                val, point_count = sum_station_wt_power(fid, wt_info)
                if point_count == 0:
                    val = 0.0
            else:
                val, ok = parse_metric_float(info.get("WTUR.PwrAt.Ra.F32", {}))
                if not ok:
                    val = 0.0

            speed = info.get("WTUR.WSpd.Ra.F32", {}).get("value", "0.0000")
            irradiance = irradiance_map.get(fid, "0.0000")

            # 2. 累加总功率
            total_power += val

            # 3. 根据前端传来的分类进行处理
            if fid in wind_ids_set:
                # === 风电逻辑 ===
                wind_power += val
                wind_field += 1
                formatted_map[fid] = {
                    "sn_top_ActivePower_wf": f"{val:.2f}",
                    "sn_top_TrendWindSpeed_wf": speed
                }
            elif fid in pv_ids_set:
                # === 光伏逻辑 ===
                pv_power += val
                pv_field += 1
                formatted_map[fid] = {
                    "sn_top_ActivePower_pvf": f"{val:.2f}",
                    "sn_top_TrendAvgIrradiance_pvf": irradiance
                }
            else:
                # === 未知类型逻辑 (兜底) ===
                formatted_map[fid] = {
                    "sn_top_ActivePower_wf": f"{val:.2f}",
                    "sn_top_TrendWindSpeed_wf": speed
                }

    # 4. 构建汇总 (00)
    formatted_map["00"] = {
        "sn_top_CurrentPower": f"{total_power:.2f}",
        "sn_top_FieldNum": str(total_field),
        "sn_top_DeviceNum": "0", "sn_top_EquUtilHours": "0.0000", "sn_top_YearPwr": "0.0000",
        "sn_top_AnnualPower": "0.000000", "sn_top_MonthPower": "0.000000", "sn_top_TotalPower": "0.000000",
        "sn_top_CO2": "0.0000", "sn_top_Capacity": "0.0", "sn_top_SaveCoal": "0.0000",
        "sn_top_DayPower": "0.000000", "sn_top_YearPwrRate": "0.0000"
    }

    # 5. 构建风电汇总 (wfsIndex)
    formatted_map["wfsIndex"] = {
        "sn_top_CurrentPower_wfs": f"{wind_power:.2f}",
        "sn_top_FieldNum_wfs": str(wind_field),
        "sn_top_AnnualPower_wfs": "0.000000", "sn_top_SaveCoal_wfs": "0.0000", "sn_top_DeviceNum_wfs": "0",
        "sn_top_YearPwr_wfs": "0.000000", "sn_top_YearPwrRate_wfs": "0.0000", "sn_top_Capacity_wfs": "0.0",
        "sn_top_CO2_wfs": "0.0000", "sn_top_DayPower_wfs": "0.000000", "sn_top_MonthPower_wfs": "0.000000",
        "sn_top_TotalPower_wfs": "0.000000", "sn_top_EquUtilHours_wfs": "0.0000"
    }

    # 6. 构建光伏汇总 (pvfsIndex)
    formatted_map["pvfsIndex"] = {
        "sn_top_CurrentPower_pvfs": f"{pv_power:.2f}",
        "sn_top_FieldNum_pvfs": str(pv_field),
        "sn_top_DayPower_pvfs": "0.000000", "sn_top_MonthPower_pvfs": "0.000000", "sn_top_EquUtilHours_pvfs": "0.0000",
        "sn_top_AnnualPower_pvfs": "0.000000", "sn_top_TotalPower_pvfs": "0.000000", "sn_top_YearPwrRate_pvfs": "0.0000",
        "sn_top_Capacity_pvfs": "0.0", "sn_top_SaveCoal_pvfs": "0.0000", "sn_top_CO2_pvfs": "0.0000",
        "sn_top_YearPwr_pvfs": "0.000000", "sn_top_DeviceNum_pvfs": "0"
    }

    return formatted_map

# ==================== 请求处理类 ====================

class APIHandler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return send_json(self, 200, {"status": "ok"})
        send_json(self, 404, {"error": "Not Found"})

    def do_POST(self):
        self.handle_tianrun_request()

    def handle_tianrun_request(self):
        if urlparse(self.path).path != "/api/realtime":
            return send_json(self, 404, {"error": "Not Found"})

        cache_key = None
        allow_stale = True
        try:
            # 1. 接收前端参数
            params = {}
            length = int(self.headers.get('Content-Length', 0))
            if length > 0:
                body_str = self.rfile.read(length).decode('utf-8')
                params = json.loads(body_str)

            # 2. 提取配置
            remote_port = str(params.get("remotePort", "8102"))
            allow_stale = params.get("allowStale", True)
            upstream_timeout = float(params.get("upstreamTimeout", 10))

            # 3. 获取两组 ID
            wind_ids_list = params.get("windIds", [])
            pv_ids_list = params.get("pvIds", [])

            # 转为集合方便查找，合并用于请求
            wind_ids_set = set(wind_ids_list)
            pv_ids_set = set(pv_ids_list)
            all_ids = list(wind_ids_set | pv_ids_set)
            cache_key = f"{remote_port}:{','.join(sorted(all_ids))}"

            if not all_ids:
                return send_json(self, 400, {"error": "请提供 windIds 或 pvIds 参数"})

            # 4. 构造请求 Payload
            payload = {
                "wfIds": all_ids,
                "wtIecpathList": ["WTUR.WSpd.Ra.F32","WTUR.PwrAt.Ra.F32","WTUR.TotEgyAt.Wt.F32","EMSD.PwrAt.Ra.F32.PlannedValue","WTUR.PwrAt.Ra.F32.Theory"],
                "wfIecpathList": ["WTUR.WSpd.Ra.F32","WTUR.PwrAt.Ra.F32"],
                "colTypeList": ["avg","sum"]
            }

            # 5. 发送请求到天润
            target_url = f"https://{TIANRUN_HOST_IP}:{remote_port}/api/TRCustomizedController/getRealTimeData"

            resp = requests.post(
                target_url,
                files={'parameterInfo': (None, json.dumps(payload))},
                verify=False,
                timeout=upstream_timeout
            )

            if resp.status_code == 200:
                # 6. 转换数据
                result = transform_to_map_style(
                    resp.json(),
                    wind_ids_set,
                    pv_ids_set,
                    include_irradiance=params.get("purpose") == "stationDetail"
                )
                REALTIME_CACHE[cache_key] = result
                send_json(self, 200, result)
            else:
                cached = REALTIME_CACHE.get(cache_key) if allow_stale else None
                if cached:
                    send_json(self, 200, {**cached, "_stale": True, "_error": "Upstream Error"})
                else:
                    send_json(self, resp.status_code, {"error": "Upstream Error"})

        except Exception as e:
            cached = REALTIME_CACHE.get(cache_key) if cache_key and allow_stale else None
            if cached:
                send_json(self, 200, {**cached, "_stale": True, "_error": str(e)})
            else:
                send_json(self, 504, {"error": str(e)})

if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), APIHandler)
    print(f"🚀 服务运行中: http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
