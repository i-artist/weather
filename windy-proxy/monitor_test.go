package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestMonitorRequiresConsecutiveFailuresAndNeverNotifiesRecovery(t *testing.T) {
	a := testAlerts()
	m := &connectivityMonitor{alerts: a}
	failure := errors.New("offline")
	m.observe(failure)
	m.observe(failure)
	if len(a.queue) != 0 {
		t.Fatal("isolated failures alerted")
	}
	m.observe(nil)
	m.observe(failure)
	m.observe(failure)
	if len(a.queue) != 0 {
		t.Fatal("success did not reset count")
	}
	m.observe(failure)
	if len(a.queue) != 1 {
		t.Fatal("missing outage alert")
	}
	m.observe(failure)
	if len(a.queue) != 1 {
		t.Fatal("cooldown ignored")
	}
	m.observe(nil)
	if len(a.queue) != 1 || m.failures != 0 {
		t.Fatal("recovery notified or did not reset")
	}
	a.last["api/www:connectivity"] = time.Now().Add(-2 * time.Minute)
	m.observe(failure)
	m.observe(failure)
	if len(a.queue) != 1 {
		t.Fatal("new incident alerted early")
	}
	m.observe(failure)
	if len(a.queue) != 2 {
		t.Fatal("missing new incident")
	}
}

func TestProbeChecksRedirectStatusAndScriptContent(t *testing.T) {
	for _, kind := range []string{"healthy", "redirect", "http_error", "html", "truncated", "bad_script"} {
		t.Run(kind, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if kind == "redirect" && r.URL.Path == "/" {
					http.Redirect(w, r, "/script", 302)
					return
				}
				if kind == "http_error" {
					w.WriteHeader(503)
					return
				}
				w.Header().Set("Content-Type", "text/javascript")
				if kind == "html" {
					w.Header().Set("Content-Type", "text/html")
				}
				if kind == "truncated" {
					w.Header().Set("Content-Length", "99999")
				}
				if kind == "bad_script" {
					w.Write([]byte("error"))
					return
				}
				w.Write([]byte("window.windyInit=" + strings.Repeat("x", 1100)))
			}))
			defer server.Close()
			err := probeWindy(context.Background(), server.Client(), server.URL)
			if (err == nil) != (kind == "healthy" || kind == "redirect") {
				t.Fatalf("unexpected probe: %v", err)
			}
		})
	}
}
