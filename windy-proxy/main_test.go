package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func testProxyServer(t *testing.T, upstreamURL string) *proxyServer {
	t.Helper()
	base, err := url.Parse(upstreamURL)
	if err != nil {
		t.Fatal(err)
	}
	targets, err := defaultUpstreams()
	if err != nil {
		t.Fatal(err)
	}
	targets["api"] = upstream{alias: "api", origin: upstreamURL, base: base}
	return &proxyServer{
		prefix:          "/windy",
		apiKey:          "server-side-key",
		allowedAppHosts: map[string]struct{}{"localhost": {}},
		upstreams:       targets,
		client:          http.DefaultClient,
		maxTextBody:     defaultMaxTextBody,
		sessions:        make(map[string]tokenSession),
	}
}

func TestAuthRequestInjectsServerKeyAndRewritesResponse(t *testing.T) {
	var received map[string]any
	upstreamServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/map-forecast/v2/auth" {
			t.Fatalf("unexpected upstream path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"auth":"windy-jwt-with-key","key":"server-side-key","asset":"https://www.windy.com/v/test.css"}`)
	}))
	defer upstreamServer.Close()

	proxy := testProxyServer(t, upstreamServer.URL)
	request := httptest.NewRequest(http.MethodPost, "/windy/upstream/api/api/map-forecast/v2/auth", strings.NewReader(`{"key":"browser-key","hostname":"localhost"}`))
	response := httptest.NewRecorder()
	proxy.routes().ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("unexpected status %d: %s", response.Code, response.Body.String())
	}
	if received["key"] != "server-side-key" {
		t.Fatalf("server key was not injected: %#v", received)
	}
	if received["hostname"] != "localhost" {
		t.Fatalf("hostname changed unexpectedly: %#v", received)
	}
	if !strings.Contains(response.Body.String(), "http://example.com/windy/upstream/www/v/test.css") {
		t.Fatalf("response URL was not rewritten: %s", response.Body.String())
	}
	if strings.Contains(response.Body.String(), "server-side-key") || strings.Contains(response.Body.String(), "windy-jwt-with-key") {
		t.Fatalf("Windy credentials leaked to browser: %s", response.Body.String())
	}

	var browserPayload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &browserPayload); err != nil {
		t.Fatal(err)
	}
	opaqueToken, _ := browserPayload["auth"].(string)
	if len(opaqueToken) < 32 {
		t.Fatalf("missing opaque browser session: %#v", browserPayload)
	}
	if token, ok := proxy.resolveSession(opaqueToken); !ok || token != "windy-jwt-with-key" {
		t.Fatal("opaque browser session does not resolve to the Windy token")
	}
}

func TestUnknownUpstreamIsRejected(t *testing.T) {
	proxy := testProxyServer(t, "http://127.0.0.1:1")
	request := httptest.NewRequest(http.MethodGet, "/windy/upstream/example.com/path", nil)
	response := httptest.NewRecorder()
	proxy.routes().ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", response.Code)
	}
}

func TestRootReturnsProxyHealth(t *testing.T) {
	proxy := testProxyServer(t, "http://127.0.0.1:1")
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	response := httptest.NewRecorder()
	proxy.routes().ServeHTTP(response, request)

	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"keyConfigured":true`) {
		t.Fatalf("unexpected root response: status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestUnknownRootPathReturnsNotFound(t *testing.T) {
	proxy := testProxyServer(t, "http://127.0.0.1:1")
	request := httptest.NewRequest(http.MethodGet, "/missing", nil)
	response := httptest.NewRecorder()
	proxy.routes().ServeHTTP(response, request)

	if response.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", response.Code)
	}
}

func TestOpaqueSessionIsTranslatedForDataRequests(t *testing.T) {
	receivedAPI := ""
	upstreamServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAPI = r.URL.Query().Get("api")
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = io.WriteString(w, "tile-data")
	}))
	defer upstreamServer.Close()

	proxy := testProxyServer(t, upstreamServer.URL)
	proxy.storeSession("opaque-session", "real-windy-jwt")
	request := httptest.NewRequest(http.MethodGet, "/windy/upstream/api/forecast/tile?api=opaque-session", nil)
	response := httptest.NewRecorder()
	proxy.routes().ServeHTTP(response, request)

	if response.Code != http.StatusOK || receivedAPI != "real-windy-jwt" {
		t.Fatalf("session was not translated: status=%d api=%q", response.Code, receivedAPI)
	}
}

func TestRefreshKeepsOpaqueSessionAndRotatesWindyToken(t *testing.T) {
	upstreamServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["token"] != "old-windy-jwt" {
			t.Fatalf("unexpected refresh token: %#v", payload)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"auth":"new-windy-jwt","key":"must-not-leak"}`)
	}))
	defer upstreamServer.Close()

	proxy := testProxyServer(t, upstreamServer.URL)
	proxy.storeSession("opaque-session", "old-windy-jwt")
	request := httptest.NewRequest(http.MethodPost, "/windy/upstream/api/api/map-forecast/v2/refresh", strings.NewReader(`{"token":"opaque-session"}`))
	response := httptest.NewRecorder()
	proxy.routes().ServeHTTP(response, request)

	if response.Code != http.StatusOK || strings.Contains(response.Body.String(), "new-windy-jwt") || strings.Contains(response.Body.String(), "must-not-leak") {
		t.Fatalf("refresh response leaked credentials: status=%d body=%s", response.Code, response.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["auth"] != "opaque-session" {
		t.Fatalf("opaque session changed: %#v", payload)
	}
	if token, ok := proxy.resolveSession("opaque-session"); !ok || token != "new-windy-jwt" {
		t.Fatal("Windy refresh token was not rotated")
	}
}

func TestRewriteUsesForwardedPublicOrigin(t *testing.T) {
	proxy := testProxyServer(t, "http://127.0.0.1:1")
	request := httptest.NewRequest(http.MethodGet, "/windy/libBoot.js", nil)
	request.Header.Set("X-Forwarded-Proto", "https")
	request.Header.Set("X-Forwarded-Host", "weather.example.com")

	rewritten := proxy.rewrite(request, "https://node.windy.com/node/connection")
	expected := "https://weather.example.com/windy/upstream/node/node/connection"
	if rewritten != expected {
		t.Fatalf("expected %q, got %q", expected, rewritten)
	}
}

func TestRewritePreservesForwardedPublicPort(t *testing.T) {
	proxy := testProxyServer(t, "http://127.0.0.1:1")
	request := httptest.NewRequest(http.MethodGet, "/windy/libBoot.js", nil)
	request.Header.Set("X-Forwarded-Proto", "https")
	request.Header.Set("X-Forwarded-Host", "weather-proxy.theonly.vip:16666")

	rewritten := proxy.rewrite(request, "https://node.windy.com/node/connection")
	expected := "https://weather-proxy.theonly.vip:16666/windy/upstream/node/node/connection"
	if rewritten != expected {
		t.Fatalf("expected %q, got %q", expected, rewritten)
	}
}

func TestAuthRejectsUnapprovedApplicationHost(t *testing.T) {
	proxy := testProxyServer(t, "http://127.0.0.1:1")
	request := httptest.NewRequest(http.MethodPost, "/windy/upstream/api/api/map-forecast/v2/auth", strings.NewReader(`{"hostname":"not-allowed.example"}`))
	response := httptest.NewRecorder()
	proxy.routes().ServeHTTP(response, request)
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", response.Code)
	}
}

func TestUnsafeForwardedHostIsIgnored(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/windy/libBoot.js", nil)
	request.Host = "weather.example.com"
	request.Header.Set("X-Forwarded-Host", `bad.example/\";alert(1)//`)
	if origin := publicOrigin(request); origin != "http://weather.example.com" {
		t.Fatalf("unsafe forwarded host was accepted: %s", origin)
	}
}
