import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urljoin, urlparse

import requests
import urllib3

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

# 申能单点登录（SSO）配置 — 与 device 项目保持一致
SSO_ENABLED = os.environ.get("SSO_ENABLED", "yes")
SHENNER_FGCAPI_HOST = os.environ.get("SHENNER_FGCAPI_HOST", "https://fgcapi.shenergy.net.cn")
SHENNER_FGCAM_HOST = os.environ.get("SHENNER_FGCAM_HOST", "https://fgcam.shenergy.net.cn")
SHENNER_BASE_URL = os.environ.get("SHENNER_BASE_URL", "")
SHENNER_USERNAME = os.environ.get("SHENNER_USERNAME", "")
SHENNER_IOA_SECRET = os.environ.get("SHENNER_IOA_SECRET", "")
SHENNER_JWT_SECRET = os.environ.get("SHENNER_JWT_SECRET", "")
SHENNER_FGCAM_COOKIE = os.environ.get("SHENNER_FGCAM_COOKIE", "")
SHENNER_REQUEST_TIMEOUT_SECONDS = int(os.environ.get("SHENNER_REQUEST_TIMEOUT_SECONDS", "30"))
SSO_TIMEOUT_SECONDS = int(os.environ.get("SSO_TIMEOUT_SECONDS", "10"))
SSO_ANALYSIS_TOKEN_PATH = "/api/SsoTokenApi/analysisToken"
SSO_GET_TOKEN_PATH = "/api/SsoTokenApi/getToken"
SSO_TRANSIENT_STATUSES = {429, 500, 502, 503, 504}

# 本系统会话 Cookie 配置（无状态 HMAC-SHA256 签名）
AUTH_SESSION_COOKIE = "weather_session"
AUTH_SESSION_HOURS = int(os.environ.get("AUTH_SESSION_HOURS", "8"))
_FALLBACK_SESSION_SECRET = secrets.token_hex(32)

# 禁用 SSL 证书警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ==================== 申能单点登录（SSO）与会话签名 ====================

class SsoLoginError(Exception):
    pass

def is_sso_enabled() -> bool:
    raw = os.environ.get("SSO_ENABLED", SSO_ENABLED).strip().lower()
    return raw not in {"no", "false", "0", "off"}

def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")

def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def _get_session_secret() -> str:
    return (
        os.environ.get("AUTH_SECRET_KEY", "").strip()
        or os.environ.get("SHENNER_JWT_SECRET", "").strip()
        or SHENNER_JWT_SECRET.strip()
        or _FALLBACK_SESSION_SECRET
    )

def sign_session_token(user: dict) -> str:
    now = int(time.time())
    payload = {
        "username": user["username"],
        "displayName": user["displayName"],
        "roles": user.get("roles", []),
        "iat": now,
        "exp": now + AUTH_SESSION_HOURS * 3600,
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    payload_b64 = _b64url_encode(payload_bytes)
    sig = hmac.new(
        _get_session_secret().encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{payload_b64}.{_b64url_encode(sig)}"

def verify_session_token(token: str):
    if not token or "." not in token:
        return None
    try:
        payload_b64, sig_b64 = token.split(".", 1)
        expected_sig = hmac.new(
            _get_session_secret().encode("utf-8"),
            payload_b64.encode("ascii"),
            hashlib.sha256,
        ).digest()
        actual_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(actual_sig, expected_sig):
            return None
        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        if not isinstance(payload, dict):
            return None
        if int(payload.get("exp", 0)) <= int(time.time()):
            return None
        username = str(payload.get("username", "")).strip()
        if not username:
            return None
        return {
            "username": username,
            "displayName": str(payload.get("displayName") or username),
            "roles": payload.get("roles") if isinstance(payload.get("roles"), list) else [],
        }
    except Exception:
        return None

def _require_shenner_setting(value: str, name: str) -> str:
    configured = (value or "").strip()
    if not configured:
        raise SsoLoginError(f"{name} 未配置，无法调用申能认证接口")
    return configured

def generate_ioa_auth_value(ioa_secret: str = None) -> str:
    secret = _require_shenner_setting(
        ioa_secret if ioa_secret is not None else os.environ.get("SHENNER_IOA_SECRET", SHENNER_IOA_SECRET),
        "SHENNER_IOA_SECRET",
    )
    tm = int(time.time())
    sign = hashlib.sha256(f"{secret}{tm}".encode("utf-8")).hexdigest()
    auth_json_str = json.dumps({"tm": tm, "sign": sign}, separators=(",", ":"))
    return base64.b64encode(auth_json_str.encode("utf-8")).decode("utf-8")

def generate_shenner_jwt_token(username: str = None, jwt_secret: str = None) -> str:
    user = _require_shenner_setting(
        username if username is not None else os.environ.get("SHENNER_USERNAME", SHENNER_USERNAME),
        "SHENNER_USERNAME",
    )
    secret = _require_shenner_setting(
        jwt_secret if jwt_secret is not None else os.environ.get("SHENNER_JWT_SECRET", SHENNER_JWT_SECRET),
        "SHENNER_JWT_SECRET",
    )
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "name": user,
        "iat": now,
        "exp": now + 30 * 60,
    }
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(signature)}"

def fetch_shenner_system_token(session, base_url, headers, timeout):
    url = base_url.rstrip("/") + SSO_GET_TOKEN_PATH
    for attempt in range(3):
        try:
            response = session.get(
                url=url,
                params={"name": generate_shenner_jwt_token()},
                headers=headers,
                timeout=timeout,
                allow_redirects=False,
            )
        except requests.exceptions.SSLError:
            raise SsoLoginError("申能单点登录连接失败：TLS证书或握手异常，请检查网络和证书") from None
        except (requests.Timeout, requests.ConnectionError):
            if attempt < 2:
                time.sleep(0.2 * (attempt + 1))
                continue
            raise SsoLoginError("申能单点登录服务暂不可用：连接失败或超时，请稍后重试") from None
        except requests.RequestException:
            raise SsoLoginError("申能单点登录请求失败，请检查源系统连接") from None

        status = response.status_code
        if status in SSO_TRANSIENT_STATUSES and attempt < 2:
            time.sleep(0.2 * (attempt + 1))
            continue
        if status != 200:
            raise SsoLoginError(f"申能单点登录接口返回HTTP {status}，请检查源系统访问或网络代理")
        try:
            payload = response.json()
        except ValueError:
            raise SsoLoginError("申能单点登录接口返回非JSON内容，请检查源系统或网络代理") from None
        if not isinstance(payload, dict):
            raise SsoLoginError("申能单点登录响应格式无效")
        if (
            "success" in payload
            and payload["success"] is not True
            or "code" in payload
            and str(payload["code"]) not in {"0", "200"}
        ):
            raise SsoLoginError("申能单点登录被源系统拒绝，请核查接入账号及认证配置")
        token = payload.get("data")
        if not isinstance(token, str) or not token.strip():
            raise SsoLoginError("申能单点登录未返回有效令牌，请核查源系统认证状态")
        return token.strip()
    raise SsoLoginError("申能单点登录重试次数已耗尽")

def _sanitize_sso_error_message(value, *secrets_to_hide) -> str:
    if not value:
        return "SSO token 无效"
    message = str(value).replace("\r", " ").replace("\n", " ").strip()[:200]
    for secret in secrets_to_hide:
        if secret:
            message = message.replace(secret, "***")
    return message or "SSO token 无效"

def _is_sso_response_success(payload: dict) -> bool:
    if "success" in payload:
        return bool(payload.get("success"))
    if "code" in payload:
        return str(payload.get("code")) in {"0", "200"}
    return True

def _text_value(value) -> str:
    if value is None:
        return ""
    return str(value).strip()

def _first_text_value(data: dict, keys) -> str:
    for key in keys:
        val = _text_value(data.get(key))
        if val:
            return val
    return ""

def _extract_role_list(data: dict) -> list:
    for key in ("userRoleList", "roleList", "roles", "roleNames", "authorities", "permissions"):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            raw = value
            for sep in ("，", "、", ";", "；", "|"):
                raw = raw.replace(sep, ",")
            return [item.strip() for item in raw.split(",") if item.strip()]
        if isinstance(value, list):
            roles = []
            for item in value:
                if isinstance(item, str) and item.strip():
                    roles.append(item.strip())
                elif isinstance(item, dict):
                    name = _first_text_value(
                        item,
                        ("roleName", "name", "role", "role_name", "authority", "permission"),
                    )
                    if name:
                        roles.append(name)
            if roles:
                return roles
    single = _first_text_value(data, ("roleName", "role", "role_name", "userRole"))
    if not single:
        return []
    for sep in ("，", "、", ";", "；", "|"):
        single = single.replace(sep, ",")
    return [item.strip() for item in single.split(",") if item.strip()]

def _is_external_user_active(status) -> bool:
    if status is None or status == "":
        return True
    return str(status).strip().lower() not in {"0", "false", "disabled", "inactive", "停用", "禁用"}

def parse_sso_user_info_response(payload: dict) -> dict:
    data = payload.get("data", payload)
    if not isinstance(data, dict):
        raise SsoLoginError("SSO 用户信息服务返回格式错误")

    username = _first_text_value(
        data,
        ("userAccount", "username", "userName", "user_name", "loginName", "account", "name"),
    )
    if not username:
        raise SsoLoginError("SSO 用户信息未返回有效用户账号")

    status = _first_text_value(data, ("status", "userStatus", "enabled", "active")) or None
    if not _is_external_user_active(status):
        raise SsoLoginError("该账号已被禁用")

    display_name = (
        _first_text_value(
            data,
            ("realName", "real_name", "nickName", "nickname", "displayName", "userName", "name"),
        )
        or username
    )
    roles = _extract_role_list(data)
    return {
        "username": username,
        "displayName": display_name,
        "roles": roles,
    }

def resolve_sso_user(frontend_token: str) -> dict:
    token = (frontend_token or "").strip()
    if not token:
        raise SsoLoginError("SSO token 不能为空")

    fgcam_host = os.environ.get("SHENNER_FGCAM_HOST", SHENNER_FGCAM_HOST).strip().rstrip("/")
    fgcapi_host = os.environ.get("SHENNER_FGCAPI_HOST", SHENNER_FGCAPI_HOST).strip().rstrip("/")
    base_url = (os.environ.get("SHENNER_BASE_URL", SHENNER_BASE_URL).strip() or fgcapi_host).rstrip("/")
    configured_cookie = os.environ.get("SHENNER_FGCAM_COOKIE", SHENNER_FGCAM_COOKIE).strip()

    session = requests.Session()
    headers = {
        "Proxy-Authentication": generate_ioa_auth_value(),
        "Web-Sign": "web",
        "X-Requested-With": "XMLHttpRequest",
    }

    user_token = ""
    if configured_cookie:
        cookie_str = configured_cookie
    else:
        user_token = fetch_shenner_system_token(
            session,
            base_url,
            headers,
            SHENNER_REQUEST_TIMEOUT_SECONDS,
        )
        session_id = session.cookies.get("JSESSIONID") or session.cookies.get("SESSION")
        cookie_str = (
            f"JSESSIONID={session_id}; AM_CROSS_JWT={user_token};"
            "i18n_browser_Lang=zh-cn; JEECGINDEXSTYLE=fineui; ZINDEXNUMBER=1990"
        )

    headers["cookie"] = cookie_str
    headers["Origin"] = fgcam_host
    headers["Referer"] = f"{fgcam_host}/"
    headers["AM_CROSS_JWT"] = generate_ioa_auth_value()

    url = urljoin(base_url + "/", SSO_ANALYSIS_TOKEN_PATH.lstrip("/"))
    try:
        response = session.post(
            url,
            json={"token": token},
            headers=headers,
            timeout=SSO_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        try:
            payload = response.json()
        except ValueError as exc:
            raise SsoLoginError("SSO 用户信息服务返回格式错误") from exc
    except SsoLoginError:
        raise
    except requests.RequestException as exc:
        resp = exc.response
        if resp is None:
            raise SsoLoginError(f"SSO 用户信息服务暂不可用: {exc.__class__.__name__}") from exc
        raise SsoLoginError(f"SSO 用户信息服务请求失败: HTTP {resp.status_code}") from exc

    if not isinstance(payload, dict):
        raise SsoLoginError("SSO 用户信息服务返回格式错误")

    if not _is_sso_response_success(payload):
        raw_message = payload.get("message") or payload.get("msg")
        raise SsoLoginError(_sanitize_sso_error_message(raw_message, token, user_token))

    return parse_sso_user_info_response(payload)

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

def send_json(handler, status_code, data, extra_headers=None):
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(payload)))
    handler.send_header("Cache-Control", "no-store")
    origin = handler.headers.get("Origin")
    if origin:
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Access-Control-Allow-Credentials", "true")
        handler.send_header("Vary", "Origin")
    else:
        handler.send_header("Access-Control-Allow-Origin", "*")
    if extra_headers:
        for header_name, header_value in extra_headers:
            handler.send_header(header_name, header_value)
    handler.end_headers()
    handler.wfile.write(payload)

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

    def read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return {}
        body_str = self.rfile.read(length).decode("utf-8")
        if not body_str.strip():
            return {}
        return json.loads(body_str)

    def get_client_ip(self):
        forwarded = self.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = self.headers.get("X-Real-IP", "")
        if real_ip:
            return real_ip.strip()
        return self.client_address[0] if self.client_address else ""

    def is_https_request(self):
        proto = self.headers.get("X-Forwarded-Proto", "").lower()
        return proto == "https"

    def build_session_cookie(self, token, max_age):
        parts = [
            f"{AUTH_SESSION_COOKIE}={token}",
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            f"Max-Age={max_age}",
        ]
        if self.is_https_request():
            parts.append("Secure")
        return "; ".join(parts)

    def extract_session_token(self):
        auth_header = self.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            if token:
                return token
        cookie_header = self.headers.get("Cookie", "")
        if cookie_header:
            cookie = SimpleCookie()
            try:
                cookie.load(cookie_header)
                if AUTH_SESSION_COOKIE in cookie:
                    return cookie[AUTH_SESSION_COOKIE].value
            except Exception:
                pass
        return ""

    def drain_request_body(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            length = 0
        if 0 < length <= 65536:
            self.rfile.read(length)

    def require_auth(self):
        if not is_sso_enabled():
            return {"username": "guest", "displayName": "访客", "roles": []}
        token = self.extract_session_token()
        user = verify_session_token(token)
        if not user:
            self.drain_request_body()
            send_json(self, 401, {"error": "未登录或登录已过期，请重新通过单点登录进入"})
            return None
        return user

    def do_OPTIONS(self):
        self.send_response(204)
        origin = self.headers.get("Origin")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Vary", "Origin")
        else:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return send_json(self, 200, {"status": "ok"})
        if path == "/api/auth/me":
            if not is_sso_enabled():
                return send_json(self, 200, {"authenticated": True, "ssoEnabled": False, "user": None})
            user = self.require_auth()
            if not user:
                return
            return send_json(self, 200, {"authenticated": True, "ssoEnabled": True, "user": user})
        send_json(self, 404, {"error": "Not Found"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/auth/sso-login":
            return self.handle_sso_login()
        if path == "/api/auth/logout":
            return self.handle_logout()
        if path == "/api/realtime":
            return self.handle_tianrun_request()
        send_json(self, 404, {"error": "Not Found"})

    def handle_sso_login(self):
        try:
            params = self.read_json_body()
        except (ValueError, json.JSONDecodeError):
            return send_json(self, 400, {"error": "请求格式无效"})

        frontend_token = str(params.get("token", "")).strip()
        if not frontend_token:
            return send_json(self, 400, {"error": "缺少 SSO 登录凭证"})

        try:
            user = resolve_sso_user(frontend_token)
        except SsoLoginError as exc:
            return send_json(self, 403, {"error": str(exc)})

        session_token = sign_session_token(user)
        cookie_header = self.build_session_cookie(session_token, AUTH_SESSION_HOURS * 3600)
        send_json(
            self,
            200,
            {"authenticated": True, "user": user},
            extra_headers=[("Set-Cookie", cookie_header)],
        )

    def handle_logout(self):
        cookie_header = self.build_session_cookie("", 0)
        send_json(
            self,
            200,
            {"ok": True},
            extra_headers=[("Set-Cookie", cookie_header)],
        )

    def handle_tianrun_request(self):
        user = self.require_auth()
        if not user:
            return

        cache_key = None
        allow_stale = True
        try:
            # 1. 接收前端参数
            params = self.read_json_body()

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
    print(f"🚀 服务运行中: http://localhost:{PORT} (申能 SSO 已启用)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
