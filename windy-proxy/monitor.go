package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

const monitorInterval = time.Hour

type connectivityMonitor struct {
	failures int
	alerts   *mailAlerts
}

// Business traffic never affects this counter. Only completed active probes do.
func (m *connectivityMonitor) observe(err error) {
	if err == nil {
		if m.failures > 0 {
			log.Print("Windy connectivity probe recovered")
		}
		m.failures = 0
		return
	}
	m.failures++
	log.Printf("Windy connectivity probe failed consecutive=%d reason=%v", m.failures, err)
	if m.failures >= 3 {
		m.alerts.report("api/www", "connectivity", "Windy 主动连通性检查连续至少 3 次失败（每小时检查一次），启动脚本无法正常加载；请检查代理到 Windy 的网络。")
	}
}

func (p *proxyServer) monitorWindy() {
	if p.alerts == nil {
		return
	}
	client := &http.Client{Transport: p.client.Transport, Timeout: 15 * time.Second, CheckRedirect: p.client.CheckRedirect}
	endpoint := p.upstreams["api"].origin + "/assets/map-forecast/libBoot.js"
	m := &connectivityMonitor{alerts: p.alerts}
	ticker := time.NewTicker(monitorInterval)
	defer ticker.Stop()
	log.Print("Windy connectivity monitor enabled: interval=1h threshold=3; business request errors do not alert")
	for {
		m.observe(probeWindy(context.Background(), client, endpoint))
		<-ticker.C
	}
}

func probeWindy(ctx context.Context, client *http.Client, endpoint string) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return fmt.Errorf("invalid probe request")
	}
	request.Header.Set("Cache-Control", "no-cache")
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("connection, TLS or response timeout")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("script HTTP %d", response.StatusCode)
	}
	if !strings.Contains(strings.ToLower(response.Header.Get("Content-Type")), "javascript") {
		return fmt.Errorf("script is not JavaScript")
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, 4<<20))
	if err != nil {
		return fmt.Errorf("script download incomplete")
	}
	if len(body) < 1000 || !bytes.Contains(body, []byte("windyInit")) {
		return fmt.Errorf("invalid Windy script content")
	}
	return nil
}
