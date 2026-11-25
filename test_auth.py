import base64
import json
import os
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest import mock
import urllib.error
import urllib.request

import server as weather_server


class FakeResponse:
    def __init__(self, status_code=200, json_data=None, headers=None):
        self.status_code = status_code
        self._json_data = json_data
        self.headers = headers or {"Content-Type": "application/json"}
        self.url = "https://fgcapi.shenergy.net.cn/api/SsoTokenApi/analysisToken"

    def json(self):
        if isinstance(self._json_data, Exception):
            raise self._json_data
        return self._json_data

    def raise_for_status(self):
        if self.status_code >= 400:
            err = weather_server.requests.HTTPError(f"HTTP {self.status_code}")
            err.response = self
            raise err


class FakeSession:
    def __init__(self, get_resp, post_resp):
        self._get_resp = get_resp
        self._post_resp = post_resp
        self.cookies = {"JSESSIONID": "mock-jsessionid"}
        self.get_calls = []
        self.post_calls = []

    def get(self, url, params=None, headers=None, timeout=None, allow_redirects=False):
        self.get_calls.append({"url": url, "params": params, "headers": dict(headers or {}), "timeout": timeout})
        return self._get_resp

    def post(self, url, json=None, headers=None, timeout=None):
        self.post_calls.append({"url": url, "json": json, "headers": dict(headers or {}), "timeout": timeout})
        return self._post_resp


class SsoServerTestCase(unittest.TestCase):
    def setUp(self):
        self.env_patcher = mock.patch.dict(
            os.environ,
            {
                "SHENNER_BASE_URL": "https://fgcapi.shenergy.net.cn",
                "SHENNER_FGCAPI_HOST": "https://fgcapi.shenergy.net.cn",
                "SHENNER_FGCAM_HOST": "https://fgcam.shenergy.net.cn",
                "SHENNER_USERNAME": "50tanyt",
                "SHENNER_IOA_SECRET": "test-ioa-secret",
                "SHENNER_JWT_SECRET": "test-jwt-secret",
                "SHENNER_FGCAM_COOKIE": "",
            },
            clear=False,
        )
        self.env_patcher.start()

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), weather_server.APIHandler)
        self.port = self.httpd.server_address[1]
        self.base_url = f"http://127.0.0.1:{self.port}"
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=2)
        self.env_patcher.stop()

    def request(self, method, path, body=None, cookie=None):
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"}
        if cookie:
            headers["Cookie"] = cookie
        req = urllib.request.Request(
            f"{self.base_url}{path}",
            data=data,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw = resp.read().decode("utf-8")
                return resp.status, json.loads(raw) if raw else {}, resp.headers
        except urllib.error.HTTPError as err:
            with err:
                raw = err.read().decode("utf-8")
                return err.code, json.loads(raw) if raw else {}, err.headers

    def extract_cookie(self, headers):
        set_cookie = headers.get("Set-Cookie", "")
        return set_cookie.split(";", 1)[0] if set_cookie else ""

    def test_ioa_and_jwt_format(self):
        ioa_val = weather_server.generate_ioa_auth_value()
        decoded = json.loads(base64.b64decode(ioa_val).decode("utf-8"))
        self.assertIn("tm", decoded)
        self.assertIn("sign", decoded)
        self.assertEqual(len(decoded["sign"]), 64)

        jwt_token = weather_server.generate_shenner_jwt_token()
        parts = jwt_token.split(".")
        self.assertEqual(len(parts), 3)
        payload = json.loads(weather_server._b64url_decode(parts[1]).decode("utf-8"))
        self.assertEqual(payload["name"], "50tanyt")
        self.assertGreater(payload["exp"], payload["iat"])

    def test_sso_login_and_auth_flow(self):
        # 1. /health 公开，/api/auth/me 和 /api/realtime 未登录返回 401
        status, data, _ = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertEqual(data["status"], "ok")

        status, _, _ = self.request("GET", "/api/auth/me")
        self.assertEqual(status, 401)

        status, _, _ = self.request("POST", "/api/realtime", {"windIds": ["140929"]})
        self.assertEqual(status, 401)

        # 2. 缺少 token 返回 400
        status, _, _ = self.request("POST", "/api/auth/sso-login", {"token": ""})
        self.assertEqual(status, 400)

        # 3. 申能 SSO 登录成功，签发 HttpOnly Cookie
        fake_session = FakeSession(
            get_resp=FakeResponse(200, {"success": True, "data": "sys-token-xyz"}),
            post_resp=FakeResponse(
                200,
                {
                    "success": True,
                    "data": {
                        "userAccount": "zhangsan",
                        "realName": "张三",
                        "userRoleList": [{"roleName": "运维值班员"}],
                        "status": "1",
                    },
                },
            ),
        )
        with mock.patch.object(weather_server.requests, "Session", return_value=fake_session):
            status, data, headers = self.request("POST", "/api/auth/sso-login", {"token": "frontend-sso-token"})

        self.assertEqual(status, 200)
        self.assertTrue(data["authenticated"])
        self.assertEqual(data["user"]["username"], "zhangsan")
        self.assertEqual(data["user"]["displayName"], "张三")
        self.assertEqual(data["user"]["roles"], ["运维值班员"])
        self.assertIn("HttpOnly", headers.get("Set-Cookie", ""))

        # 验证调用了申能 getToken 和 analysisToken
        self.assertEqual(len(fake_session.get_calls), 1)
        self.assertTrue(fake_session.get_calls[0]["url"].endswith("/api/SsoTokenApi/getToken"))
        self.assertEqual(len(fake_session.post_calls), 1)
        self.assertTrue(fake_session.post_calls[0]["url"].endswith("/api/SsoTokenApi/analysisToken"))
        self.assertEqual(fake_session.post_calls[0]["json"], {"token": "frontend-sso-token"})
        self.assertIn("AM_CROSS_JWT=sys-token-xyz", fake_session.post_calls[0]["headers"]["cookie"])

        session_cookie = self.extract_cookie(headers)
        self.assertTrue(session_cookie.startswith("weather_session="))

        # 4. 携带 Cookie 访问 /api/auth/me 成功
        status, data, _ = self.request("GET", "/api/auth/me", cookie=session_cookie)
        self.assertEqual(status, 200)
        self.assertEqual(data["user"]["username"], "zhangsan")

        # 5. 篡改 Cookie 被拒绝
        status, _, _ = self.request("GET", "/api/auth/me", cookie=session_cookie + "tampered")
        self.assertEqual(status, 401)

        # 6. 禁用账号被拒绝
        disabled_session = FakeSession(
            get_resp=FakeResponse(200, {"success": True, "data": "sys-token-xyz"}),
            post_resp=FakeResponse(
                200,
                {
                    "success": True,
                    "data": {
                        "userAccount": "lisi",
                        "realName": "李四",
                        "status": "0",
                    },
                },
            ),
        )
        with mock.patch.object(weather_server.requests, "Session", return_value=disabled_session):
            status, data, _ = self.request("POST", "/api/auth/sso-login", {"token": "disabled-token"})
        self.assertEqual(status, 403)
        self.assertIn("禁用", data["error"])

        # 7. 退出登录返回清空 Cookie
        status, _, headers = self.request("POST", "/api/auth/logout", cookie=session_cookie)
        self.assertEqual(status, 200)
        self.assertIn("Max-Age=0", headers.get("Set-Cookie", ""))

    def test_sso_disabled_mode(self):
        with mock.patch.dict(os.environ, {"SSO_ENABLED": "no"}, clear=False):
            status, data, _ = self.request("GET", "/api/auth/me")
            self.assertEqual(status, 200)
            self.assertTrue(data["authenticated"])
            self.assertFalse(data["ssoEnabled"])
            self.assertIsNone(data["user"])

            # 关闭 SSO 时 /api/realtime 不再返回 401（空参数返回 400 说明已通过鉴权）
            status, _, _ = self.request("POST", "/api/realtime", {})
            self.assertEqual(status, 400)


if __name__ == "__main__":
    unittest.main()
