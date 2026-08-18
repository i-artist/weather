import os

import requests
from flask import Flask, jsonify, request

app = Flask(__name__)

SHENERGY_MONITOR_URL = "https://fgc.shenergy.net.cn/portal/monitor/data"
MONITOR_FORM_DATA = (
    "mdid=ModelData"
    "&ModelData_scid=_snFirstBigScreenView_00_"
    "&dhs=UISys"
    "&ModelData_guid="
    "&ModelData_gadp=0"
    "&ModelData_cpv=1"
    "&systemKey=soam"
    "&crossDomain=false"
    "&Zip=false"
)


def parse_cookie_value(cookie_string: str, name: str) -> str:
    """从 cookie 字符串中提取指定字段，如 token=xxx"""
    if not cookie_string:
        return ""
    for part in cookie_string.split(";"):
        part = part.strip()
        if part.startswith(f"{name}="):
            return part[len(name) + 1 :]
    return ""


def build_auth_cookies() -> dict[str, str]:
    """
    提取 token / scada 等认证 cookie，优先级：
    1. 环境变量 SCADA_TOKEN / SCADA_ID
    2. 环境变量 SCADA_COOKIE（完整 cookie 字符串）
    3. 当前请求的 cookie
    """
    cookie_string = os.environ.get("SCADA_COOKIE", "")

    token = (
        os.environ.get("SCADA_TOKEN")
        or request.cookies.get("token")
        or parse_cookie_value(cookie_string, "token")
    )
    scada = (
        os.environ.get("SCADA_ID")
        or request.cookies.get("scada")
        or parse_cookie_value(cookie_string, "scada")
    )

    cookies: dict[str, str] = {
        "token": token,
        "scada": scada,
        "from": "soam",
        "language": "zh",
        "theme": "dark",
        "style": "default",
    }

    optional_keys = ("userId", "username", "logname")
    for key in optional_keys:
        value = request.cookies.get(key) or parse_cookie_value(cookie_string, key)
        if value:
            cookies[key] = value

    return {key: value for key, value in cookies.items() if value}


def fetch_monitor_data():
    cookies = build_auth_cookies()
    if not cookies.get("token"):
        return {"code": "401", "msg": "missing token", "data": None}, 401

    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://fgc.shenergy.net.cn",
        "Referer": "https://fgc.shenergy.net.cn/?withoutLoginIndex=1&indexPageIdentifier=caseShshennengBigScreen",
    }

    response = requests.post(
        SHENERGY_MONITOR_URL,
        headers=headers,
        cookies=cookies,
        data=MONITOR_FORM_DATA,
        timeout=30,
    )
    response.raise_for_status()
    return response.json(), 200


@app.route("/api/monitor-data", methods=["GET"])
def api_monitor_data():
    try:
        data, status = fetch_monitor_data()
        return jsonify(data), status
    except requests.RequestException as exc:
        return jsonify({"code": "500", "msg": str(exc), "data": None}), 500


@app.route("/proxy/monitor/data", methods=["GET", "POST"])
def proxy_monitor_data():
    try:
        data, status = fetch_monitor_data()
        return jsonify(data), status
    except requests.RequestException as exc:
        return jsonify({"code": "500", "msg": str(exc), "data": None}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
