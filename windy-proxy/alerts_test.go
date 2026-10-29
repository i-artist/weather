package main

import (
	"context"
	"encoding/json"
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
	t.Setenv("ALERT_FEISHU_WEBHOOK", "")
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

func TestFeishuResponseAndPayload(t *testing.T) {
	for _, body := range []string{`{"code":0}`, `{"StatusCode":0}`, `{"code":19024}`, `{}`, `bad json`} {
		t.Run(body, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var payload struct {
					MsgType string `json:"msg_type"`
					Content struct {
						Text string `json:"text"`
					} `json:"content"`
				}
				if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
					t.Error(err)
				}
				if payload.MsgType != "text" || !strings.Contains(payload.Content.Text, "故障测试") {
					t.Error("wrong payload")
				}
				w.Write([]byte(body))
			}))
			defer server.Close()
			err := sendFeishuAlert(server.Client(), server.URL, "故障测试")
			wantOK := body == `{"code":0}` || body == `{"StatusCode":0}`
			if (err == nil) != wantOK {
				t.Fatalf("unexpected result: %v", err)
			}
		})
	}
}
