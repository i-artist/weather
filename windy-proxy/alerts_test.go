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

type failingTransport struct{}

func (failingTransport) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, errors.New("connection unavailable?api=secret")
}

func testAlerts() *mailAlerts {
	return &mailAlerts{last: make(map[string]time.Time), cooldown: time.Minute, queue: make(chan string, 16)}
}

func TestFailureEmailOnlyAndCooldown(t *testing.T) {
	for _, status := range []int{200, 404, 401, 403, 429, 500, 502, 504} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(status) }))
			defer upstream.Close()
			proxy := testProxyServer(t, upstream.URL)
			proxy.alerts = testAlerts()
			for i := 0; i < 2; i++ {
				response := httptest.NewRecorder()
				proxy.routes().ServeHTTP(response, httptest.NewRequest("GET", "/windy/libBoot.js", nil))
				if response.Code != status {
					t.Fatalf("status changed: %d", response.Code)
				}
			}
			want := 1
			if status == 200 || status == 404 {
				want = 0
			}
			if len(proxy.alerts.queue) != want {
				t.Fatalf("got %d emails, want %d", len(proxy.alerts.queue), want)
			}
		})
	}
}

func TestNetworkFailureAndCanceledRequest(t *testing.T) {
	for _, canceled := range []bool{false, true} {
		proxy := testProxyServer(t, "https://upstream.invalid")
		proxy.client = &http.Client{Transport: failingTransport{}}
		proxy.alerts = testAlerts()
		request := httptest.NewRequest("POST", "/windy/upstream/api/test", nil)
		if canceled {
			ctx, cancel := context.WithCancel(request.Context())
			cancel()
			request = request.WithContext(ctx)
		}
		response := httptest.NewRecorder()
		proxy.routes().ServeHTTP(response, request)
		if response.Code != 502 {
			t.Fatalf("unexpected status %d", response.Code)
		}
		if canceled && len(proxy.alerts.queue) != 0 {
			t.Fatal("canceled request sent alert")
		}
		if !canceled {
			select {
			case body := <-proxy.alerts.queue:
				if strings.Contains(body, "secret") {
					t.Fatal("credentials leaked")
				}
			default:
				t.Fatal("missing network alert")
			}
		}
	}
}

func TestMailConfiguration(t *testing.T) {
	t.Setenv("ALERT_SMTP_HOST", "")
	a, err := newMailAlerts()
	if err != nil || a != nil {
		t.Fatal("empty host should disable alerts")
	}
	t.Setenv("ALERT_SMTP_HOST", "smtp.example.com")
	t.Setenv("ALERT_SMTP_USER", "")
	if _, err := newMailAlerts(); err == nil {
		t.Fatal("incomplete SMTP config accepted")
	}
}
