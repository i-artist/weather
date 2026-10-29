package main

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	defaultAddr        = ":3002"
	defaultPrefix      = "/windy"
	defaultMaxTextBody = int64(64 << 20)
	maxSessions        = 10000
)

type upstream struct {
	alias  string
	origin string
	base   *url.URL
}

type proxyServer struct {
	prefix          string
	apiKey          string
	authHostname    string
	allowedAppHosts map[string]struct{}
	upstreams       map[string]upstream
	client          *http.Client
	maxTextBody     int64
	sessions        map[string]tokenSession
	sessionMu       sync.RWMutex
	alerts          *mailAlerts
}

type tokenSession struct {
	token     string
	expiresAt time.Time
}

func main() {
	server, err := newProxyServer()
	if err != nil {
		log.Fatal(err)
	}

	addr := envOrDefault("WINDY_PROXY_ADDR", defaultAddr)
	httpServer := &http.Server{
		Addr:              addr,
		Handler:           server.routes(),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       90 * time.Second,
	}

	log.Printf("windy proxy listening on %s", addr)
	if err := httpServer.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func newProxyServer() (*proxyServer, error) {
	upstreams, err := defaultUpstreams()
	if err != nil {
		return nil, err
	}

	prefix := strings.TrimRight(envOrDefault("WINDY_PROXY_PREFIX", defaultPrefix), "/")
	if prefix == "" || !strings.HasPrefix(prefix, "/") {
		return nil, errors.New("WINDY_PROXY_PREFIX must start with /")
	}

	maxTextBody := defaultMaxTextBody
	if value := os.Getenv("WINDY_PROXY_MAX_TEXT_MB"); value != "" {
		megabytes, err := strconv.ParseInt(value, 10, 64)
		if err != nil || megabytes < 1 {
			return nil, errors.New("WINDY_PROXY_MAX_TEXT_MB must be a positive integer")
		}
		maxTextBody = megabytes << 20
	}
	alerts, err := newMailAlerts()
	if err != nil {
		return nil, err
	}

	return &proxyServer{
		prefix:          prefix,
		apiKey:          os.Getenv("WINDY_API_KEY"),
		authHostname:    strings.TrimSpace(os.Getenv("WINDY_AUTH_HOSTNAME")),
		allowedAppHosts: parseAllowedHosts(os.Getenv("WINDY_ALLOWED_APP_HOSTS")),
		upstreams:       upstreams,
		client: &http.Client{
			Timeout: 90 * time.Second,
			Transport: &http.Transport{
				Proxy:                 http.ProxyFromEnvironment,
				ForceAttemptHTTP2:     true,
				MaxIdleConns:          100,
				MaxIdleConnsPerHost:   20,
				IdleConnTimeout:       90 * time.Second,
				TLSHandshakeTimeout:   20 * time.Second,
				ResponseHeaderTimeout: 45 * time.Second,
			},
			CheckRedirect: func(request *http.Request, via []*http.Request) error {
				if len(via) >= 5 || !isAllowedUpstreamHost(request.URL.Hostname(), upstreams) {
					return http.ErrUseLastResponse
				}
				return nil
			},
		},
		maxTextBody: maxTextBody,
		sessions:    make(map[string]tokenSession),
		alerts:      alerts,
	}, nil
}

func defaultUpstreams() (map[string]upstream, error) {
	origins := map[string]string{
		"account":        "https://account.windy.com",
		"ai":             "https://ai4.windy.com",
		"api":            "https://api.windy.com",
		"community":      "https://community.windy.com",
		"here-aerial":    "https://aerial.maps.api.here.com",
		"ims":            "https://ims-s.windy.com",
		"ims-main":       "https://ims.windy.com",
		"img":            "https://img.windy.com",
		"mapy-mapserver": "https://mapserver.mapy.cz",
		"mapy-tiles":     "https://windytiles.mapy.cz",
		"node":           "https://node.windy.com",
		"radar":          "https://rdr.windy.com",
		"satellite":      "https://sat.windy.com",
		"tiles":          "https://tiles-s.windy.com",
		"tiles-main":     "https://tiles.windy.com",
		"www":            "https://www.windy.com",
	}

	result := make(map[string]upstream, len(origins))
	for alias, origin := range origins {
		base, err := url.Parse(origin)
		if err != nil {
			return nil, fmt.Errorf("parse upstream %s: %w", alias, err)
		}
		result[alias] = upstream{alias: alias, origin: origin, base: base}
	}
	return result, nil
}

func buildReplacer(publicOrigin, prefix string, upstreams map[string]upstream) *strings.Replacer {
	pairs := make([]string, 0, len(upstreams)*6+4)
	for _, target := range upstreams {
		proxyOrigin := publicOrigin + prefix + "/upstream/" + target.alias
		host := target.base.Host
		pairs = append(pairs,
			"https://"+host, proxyOrigin,
			"http://"+host, proxyOrigin,
			"//"+host, proxyOrigin,
		)
	}

	// Windy keeps this Leaflet subdomain template in the SDK. The proxy uses one
	// fixed HERE endpoint, so the browser never resolves a HERE hostname itself.
	pairs = append(pairs,
		"https://{s}.aerial.maps.api.here.com", publicOrigin+prefix+"/upstream/here-aerial",
		"//{s}.aerial.maps.api.here.com", publicOrigin+prefix+"/upstream/here-aerial",
	)
	return strings.NewReplacer(pairs...)
}

func (p *proxyServer) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", p.handleHealth)
	mux.HandleFunc(p.prefix+"/health", p.handleHealth)
	mux.HandleFunc(p.prefix+"/libBoot.js", p.handleLibBoot)
	mux.HandleFunc(p.prefix+"/upstream/", p.handleProxy)
	mux.HandleFunc("/", p.handleRoot)
	return p.withRequestLog(p.withCORS(mux))
}

func (p *proxyServer) handleRoot(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/" {
		p.handleServiceInfo(w)
		return
	}
	if r.URL.Path == p.prefix || strings.HasPrefix(r.URL.Path, p.prefix+"/") {
		http.NotFound(w, r)
		return
	}
	p.proxy(w, r, p.upstreams["api"], r.URL.Path)
}

func (p *proxyServer) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p.setCORSHeaders(w.Header(), r)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (p *proxyServer) setCORSHeaders(headers http.Header, request *http.Request) {
	origin := strings.TrimSpace(request.Header.Get("Origin"))
	if origin == "" || !p.isAllowedCORSOrigin(origin) {
		return
	}
	headers.Set("Access-Control-Allow-Origin", origin)
	headers.Set("Access-Control-Allow-Credentials", "true")
	headers.Set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS")
	if requestedHeaders := strings.TrimSpace(request.Header.Get("Access-Control-Request-Headers")); requestedHeaders != "" {
		headers.Set("Access-Control-Allow-Headers", requestedHeaders)
	} else {
		headers.Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type")
	}
	headers.Set("Access-Control-Max-Age", "600")
	headers.Add("Vary", "Origin")
}

func (p *proxyServer) isAllowedCORSOrigin(origin string) bool {
	parsed, err := url.Parse(origin)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.Path != "" {
		return false
	}
	if len(p.allowedAppHosts) == 0 {
		return isSafePublicHost(parsed.Host)
	}
	hostname := strings.ToLower(parsed.Hostname())
	_, allowed := p.allowedAppHosts[hostname]
	return allowed
}

func (p *proxyServer) handleServiceInfo(w http.ResponseWriter) {
	status := http.StatusOK
	if p.apiKey == "" {
		status = http.StatusServiceUnavailable
	}
	writeJSON(w, status, map[string]any{
		"service":       "Windy API Proxy",
		"status":        "ok",
		"keyConfigured": p.apiKey != "",
		"apiBase":       "/",
		"health":        p.prefix + "/health",
	})
}

func (p *proxyServer) handleHealth(w http.ResponseWriter, _ *http.Request) {
	status := http.StatusOK
	if p.apiKey == "" {
		status = http.StatusServiceUnavailable
	}
	writeJSON(w, status, map[string]any{
		"status":        "ok",
		"keyConfigured": p.apiKey != "",
	})
}

func (p *proxyServer) handleLibBoot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	p.proxy(w, r, p.upstreams["api"], "/assets/map-forecast/libBoot.js")
}

func (p *proxyServer) handleProxy(w http.ResponseWriter, r *http.Request) {
	remainder := strings.TrimPrefix(r.URL.Path, p.prefix+"/upstream/")
	alias, path, found := strings.Cut(remainder, "/")
	if !found || alias == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing upstream alias or path"})
		return
	}

	target, ok := p.upstreams[alias]
	if !ok {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "upstream is not allowed"})
		return
	}
	p.proxy(w, r, target, "/"+path)
}

func (p *proxyServer) proxy(w http.ResponseWriter, incoming *http.Request, target upstream, path string) {
	body := incoming.Body
	sessionID := ""
	if target.alias == "api" && path == "/api/map-forecast/v2/auth" {
		injected, err := p.injectAPIKey(incoming)
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
			return
		}
		body = io.NopCloser(bytes.NewReader(injected))
	} else if target.alias == "api" && path == "/api/map-forecast/v2/refresh" {
		injected, opaqueToken, err := p.injectRefreshToken(incoming)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
			return
		}
		body = io.NopCloser(bytes.NewReader(injected))
		sessionID = opaqueToken
	}

	upstreamURL := *target.base
	upstreamURL.Path = path
	upstreamURL.RawPath = ""
	query := incoming.URL.Query()
	if opaqueToken := query.Get("api"); opaqueToken != "" {
		realToken, ok := p.resolveSession(opaqueToken)
		if !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired Windy session"})
			return
		}
		query.Set("api", realToken)
	}
	upstreamURL.RawQuery = query.Encode()

	request, err := http.NewRequestWithContext(incoming.Context(), incoming.Method, upstreamURL.String(), body)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to create upstream request"})
		return
	}
	copyRequestHeaders(request.Header, incoming.Header)
	request.Header.Del("Accept-Encoding")
	appendForwardedHeaders(request.Header, incoming)

	response, err := p.doUpstream(request)
	if err != nil {
		log.Printf("upstream request failed alias=%s path=%s error=%v", target.alias, path, err)
		if incoming.Context().Err() == nil {
			// Do not include errors/URLs containing Windy tokens in email.
			p.alerts.report(target.alias, "network", "上游连接、TLS 或响应超时；详细原因请查看代理日志")
		}
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Windy upstream is unavailable"})
		return
	}
	defer response.Body.Close()
	if response.StatusCode >= 400 && response.StatusCode != http.StatusNotFound {
		p.alerts.report(target.alias, strconv.Itoa(response.StatusCode), "上游返回 HTTP "+strconv.Itoa(response.StatusCode))
	}

	copyResponseHeaders(w.Header(), response.Header)
	if location := response.Header.Get("Location"); location != "" {
		w.Header().Set("Location", p.rewrite(incoming, location))
	}

	if shouldRewrite(response.Header.Get("Content-Type")) {
		p.writeRewrittenResponse(w, incoming, response, target.alias, path, sessionID)
		return
	}

	w.WriteHeader(response.StatusCode)
	if incoming.Method != http.MethodHead {
		_, _ = io.Copy(w, response.Body)
	}
}

func (p *proxyServer) doUpstream(request *http.Request) (*http.Response, error) {
	attempts := 1
	if request.Method == http.MethodGet || request.Method == http.MethodHead {
		attempts = 3
	}

	var lastErr error
	for attempt := 1; attempt <= attempts; attempt++ {
		current := request
		if attempt > 1 {
			current = request.Clone(request.Context())
		}
		response, err := p.client.Do(current)
		if err == nil {
			return response, nil
		}
		lastErr = err
		if attempt < attempts {
			time.Sleep(time.Duration(attempt) * 250 * time.Millisecond)
		}
	}
	return nil, lastErr
}

func (p *proxyServer) injectAPIKey(request *http.Request) ([]byte, error) {
	if p.apiKey == "" {
		return nil, errors.New("WINDY_API_KEY is not configured")
	}
	if request.Body == nil {
		return nil, errors.New("missing Windy authentication request")
	}

	body, err := io.ReadAll(io.LimitReader(request.Body, 1<<20))
	if err != nil {
		return nil, errors.New("failed to read Windy authentication request")
	}
	payload := make(map[string]any)
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, errors.New("invalid Windy authentication request")
	}

	hostname, _ := payload["hostname"].(string)
	if len(p.allowedAppHosts) > 0 {
		if _, allowed := p.allowedAppHosts[strings.ToLower(hostname)]; !allowed {
			return nil, errors.New("application hostname is not allowed")
		}
	}
	payload["key"] = p.apiKey
	if p.authHostname != "" {
		payload["hostname"] = p.authHostname
	}
	return json.Marshal(payload)
}

func (p *proxyServer) injectRefreshToken(request *http.Request) ([]byte, string, error) {
	if request.Body == nil {
		return nil, "", errors.New("missing Windy refresh request")
	}
	body, err := io.ReadAll(io.LimitReader(request.Body, 1<<20))
	if err != nil {
		return nil, "", errors.New("failed to read Windy refresh request")
	}
	payload := make(map[string]any)
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, "", errors.New("invalid Windy refresh request")
	}

	opaqueToken, _ := payload["token"].(string)
	realToken, ok := p.resolveSession(opaqueToken)
	if !ok {
		return nil, "", errors.New("invalid or expired Windy session")
	}
	payload["token"] = realToken
	injected, err := json.Marshal(payload)
	return injected, opaqueToken, err
}

func (p *proxyServer) writeRewrittenResponse(
	w http.ResponseWriter,
	request *http.Request,
	response *http.Response,
	alias string,
	path string,
	sessionID string,
) {
	body, err := io.ReadAll(io.LimitReader(response.Body, p.maxTextBody+1))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "failed to read Windy response"})
		return
	}
	if int64(len(body)) > p.maxTextBody {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Windy text response exceeds proxy limit"})
		return
	}

	if alias == "api" && path == "/api/map-forecast/v2/auth" && response.StatusCode >= 200 && response.StatusCode < 300 {
		body, err = p.createBrowserSession(body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "invalid Windy authentication response"})
			return
		}
	} else if alias == "api" && path == "/api/map-forecast/v2/refresh" && response.StatusCode >= 200 && response.StatusCode < 300 {
		body, err = p.refreshBrowserSession(sessionID, body)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "invalid Windy refresh response"})
			return
		}
	}

	rewritten := []byte(p.rewrite(request, string(body)))
	w.Header().Del("Content-Length")
	w.Header().Del("Content-Encoding")
	w.Header().Del("ETag")
	w.Header().Del("Content-MD5")
	w.Header().Del("Age")
	w.Header().Del("Expires")
	if request.Method == http.MethodGet || request.Method == http.MethodHead {
		if strings.Contains(strings.ToLower(response.Header.Get("Content-Type")), "json") {
			w.Header().Set("Cache-Control", "private, max-age=30")
		} else {
			w.Header().Set("Cache-Control", "private, max-age=300")
		}
	} else {
		w.Header().Set("Cache-Control", "no-store")
	}
	w.WriteHeader(response.StatusCode)
	_, _ = w.Write(rewritten)
}

func (p *proxyServer) createBrowserSession(body []byte) ([]byte, error) {
	payload := make(map[string]any)
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	realToken, _ := payload["auth"].(string)
	if realToken == "" {
		return nil, errors.New("missing Windy authentication token")
	}

	opaqueToken, err := randomToken()
	if err != nil {
		return nil, err
	}
	p.storeSession(opaqueToken, realToken)
	payload["auth"] = opaqueToken
	delete(payload, "key")
	return json.Marshal(payload)
}

func (p *proxyServer) refreshBrowserSession(opaqueToken string, body []byte) ([]byte, error) {
	payload := make(map[string]any)
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	realToken, _ := payload["auth"].(string)
	if opaqueToken == "" || realToken == "" {
		return nil, errors.New("missing Windy refresh token")
	}

	p.storeSession(opaqueToken, realToken)
	payload["auth"] = opaqueToken
	delete(payload, "key")
	return json.Marshal(payload)
}

func (p *proxyServer) storeSession(opaqueToken, realToken string) {
	p.sessionMu.Lock()
	defer p.sessionMu.Unlock()
	if len(p.sessions) >= maxSessions {
		now := time.Now()
		for token, session := range p.sessions {
			if now.After(session.expiresAt) {
				delete(p.sessions, token)
			}
		}
		if len(p.sessions) >= maxSessions {
			for token := range p.sessions {
				delete(p.sessions, token)
				break
			}
		}
	}
	p.sessions[opaqueToken] = tokenSession{
		token:     realToken,
		expiresAt: time.Now().Add(24 * time.Hour),
	}
}

func (p *proxyServer) resolveSession(opaqueToken string) (string, bool) {
	p.sessionMu.RLock()
	session, ok := p.sessions[opaqueToken]
	p.sessionMu.RUnlock()
	if !ok || time.Now().After(session.expiresAt) {
		if ok {
			p.sessionMu.Lock()
			delete(p.sessions, opaqueToken)
			p.sessionMu.Unlock()
		}
		return "", false
	}
	return session.token, true
}

func randomToken() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func (p *proxyServer) rewrite(request *http.Request, value string) string {
	return buildReplacer(publicOrigin(request), p.prefix, p.upstreams).Replace(value)
}

func publicOrigin(request *http.Request) string {
	proto := firstForwardedValue(request.Header.Get("X-Forwarded-Proto"))
	if proto != "http" && proto != "https" {
		proto = "http"
		if request.TLS != nil {
			proto = "https"
		}
	}

	host := firstForwardedValue(request.Header.Get("X-Forwarded-Host"))
	if !isSafePublicHost(host) {
		host = request.Host
	}
	if !isSafePublicHost(host) {
		host = "localhost"
	}
	return proto + "://" + host
}

func firstForwardedValue(value string) string {
	value, _, _ = strings.Cut(value, ",")
	return strings.TrimSpace(value)
}

func isSafePublicHost(host string) bool {
	if host == "" || strings.ContainsAny(host, "\\/\"'<> \t\r\n") {
		return false
	}
	parsed, err := url.Parse("http://" + host)
	return err == nil && parsed.Host == host && parsed.Path == ""
}

func isAllowedUpstreamHost(host string, upstreams map[string]upstream) bool {
	for _, target := range upstreams {
		if strings.EqualFold(host, target.base.Hostname()) {
			return true
		}
	}
	return false
}

func (p *proxyServer) withRequestLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s duration=%s", r.Method, r.URL.RequestURI(), time.Since(started).Round(time.Millisecond))
	})
}

func copyRequestHeaders(destination, source http.Header) {
	for name, values := range source {
		if isHopByHopHeader(name) || strings.EqualFold(name, "Host") || strings.EqualFold(name, "Content-Length") {
			continue
		}
		for _, value := range values {
			destination.Add(name, value)
		}
	}
}

func copyResponseHeaders(destination, source http.Header) {
	for name, values := range source {
		if isHopByHopHeader(name) || isCORSHeader(name) {
			continue
		}
		for _, value := range values {
			destination.Add(name, value)
		}
	}
}

func appendForwardedHeaders(headers http.Header, request *http.Request) {
	if host, _, found := strings.Cut(request.RemoteAddr, ":"); found {
		headers.Add("X-Forwarded-For", host)
	}
	if request.Host != "" {
		headers.Set("X-Forwarded-Host", request.Host)
	}
	proto := "http"
	if request.TLS != nil {
		proto = "https"
	}
	headers.Set("X-Forwarded-Proto", proto)
}

func shouldRewrite(contentType string) bool {
	contentType = strings.ToLower(contentType)
	return strings.HasPrefix(contentType, "text/") ||
		strings.Contains(contentType, "javascript") ||
		strings.Contains(contentType, "json") ||
		strings.Contains(contentType, "xml") ||
		strings.Contains(contentType, "svg")
}

func isHopByHopHeader(name string) bool {
	switch strings.ToLower(name) {
	case "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "proxy-connection", "te", "trailer", "transfer-encoding", "upgrade":
		return true
	default:
		return false
	}
}

func isCORSHeader(name string) bool {
	return strings.HasPrefix(strings.ToLower(name), "access-control-")
}

func parseAllowedHosts(value string) map[string]struct{} {
	result := make(map[string]struct{})
	for _, host := range strings.Split(value, ",") {
		host = strings.ToLower(strings.TrimSpace(host))
		if host != "" {
			result[host] = struct{}{}
		}
	}
	return result
}

func envOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Del("Content-Length")
	w.Header().Del("Content-Encoding")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
