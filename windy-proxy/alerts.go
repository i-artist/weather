package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"mime"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Only failures send email. A bounded worker keeps SMTP off the request path.
type mailAlerts struct {
	mu       sync.Mutex
	last     map[string]time.Time
	cooldown time.Duration
	queue    chan string
	send     func(string) error
}

func newMailAlerts() (*mailAlerts, error) {
	if webhook := os.Getenv("ALERT_FEISHU_WEBHOOK"); webhook != "" {
		u, err := url.Parse(webhook)
		if err != nil || u.Scheme != "https" || u.Host != "open.feishu.cn" || !strings.HasPrefix(u.Path, "/open-apis/bot/v2/hook/") || u.User != nil || u.RawQuery != "" {
			return nil, fmt.Errorf("invalid ALERT_FEISHU_WEBHOOK")
		}
		seconds, err := strconv.Atoi(envOrDefault("ALERT_COOLDOWN_SECONDS", "600"))
		if err != nil || seconds < 1 {
			return nil, fmt.Errorf("ALERT_COOLDOWN_SECONDS must be positive")
		}
		a := &mailAlerts{last: make(map[string]time.Time), cooldown: time.Duration(seconds) * time.Second, queue: make(chan string, 16)}
		client := &http.Client{Timeout: 15 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
		a.send = func(body string) error { return sendFeishuAlert(client, webhook, body) }
		a.start()
		return a, nil
	}
	host := os.Getenv("ALERT_SMTP_HOST")
	if host == "" {
		return nil, nil
	}
	port := envOrDefault("ALERT_SMTP_PORT", "465")
	n, err := strconv.Atoi(port)
	if err != nil || n < 1 || n > 65535 {
		return nil, fmt.Errorf("invalid ALERT_SMTP_PORT")
	}
	user, password := os.Getenv("ALERT_SMTP_USER"), os.Getenv("ALERT_SMTP_PASSWORD")
	if user == "" || password == "" {
		return nil, fmt.Errorf("ALERT_SMTP_USER and ALERT_SMTP_PASSWORD are required")
	}
	from, err := mail.ParseAddress(envOrDefault("ALERT_MAIL_FROM", user))
	if err != nil {
		return nil, fmt.Errorf("invalid ALERT_MAIL_FROM")
	}
	recipients, err := mail.ParseAddressList(os.Getenv("ALERT_MAIL_TO"))
	if err != nil || len(recipients) == 0 {
		return nil, fmt.Errorf("invalid ALERT_MAIL_TO")
	}
	to := make([]string, 0, len(recipients))
	for _, recipient := range recipients {
		to = append(to, recipient.Address)
	}
	mode := envOrDefault("ALERT_SMTP_TLS", "implicit")
	if mode != "implicit" && mode != "starttls" {
		return nil, fmt.Errorf("ALERT_SMTP_TLS must be implicit or starttls")
	}
	seconds, err := strconv.Atoi(envOrDefault("ALERT_COOLDOWN_SECONDS", "600"))
	if err != nil || seconds < 1 {
		return nil, fmt.Errorf("ALERT_COOLDOWN_SECONDS must be positive")
	}
	a := &mailAlerts{last: make(map[string]time.Time), cooldown: time.Duration(seconds) * time.Second, queue: make(chan string, 16)}
	a.send = func(body string) error {
		return sendAlertMail(host, port, mode, user, password, from.Address, to, body)
	}
	a.start()
	return a, nil
}

func (a *mailAlerts) start() {
	go func() {
		for body := range a.queue {
			if err := a.send(body); err != nil {
				// HTTP client errors may contain the private webhook URL.
				log.Print("alert notification delivery failed; check notification network and configuration")
			}
		}
	}()
}

func sendFeishuAlert(client *http.Client, webhook, body string) error {
	payload, err := json.Marshal(map[string]any{"msg_type": "text", "content": map[string]string{"text": "【天气大屏告警】\n" + body}})
	if err != nil {
		return err
	}
	response, err := client.Post(webhook, "application/json", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("Feishu request failed")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("Feishu HTTP %d", response.StatusCode)
	}
	var result struct {
		Code       *int `json:"code"`
		StatusCode *int `json:"StatusCode"`
	}
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return fmt.Errorf("invalid Feishu response")
	}
	if result.Code == nil && result.StatusCode == nil {
		return fmt.Errorf("missing Feishu result code")
	}
	if result.Code != nil && *result.Code != 0 || result.StatusCode != nil && *result.StatusCode != 0 {
		return fmt.Errorf("Feishu rejected notification")
	}
	return nil
}

func (a *mailAlerts) report(alias, kind, detail string) {
	if a == nil {
		return
	}
	key := alias + ":" + kind
	now := time.Now()
	a.mu.Lock()
	defer a.mu.Unlock()
	if last, ok := a.last[key]; ok && now.Sub(last) < a.cooldown {
		return
	}
	hostname, _ := os.Hostname()
	body := fmt.Sprintf("Windy 代理请求异常\r\n服务器：%s\r\n上游：%s\r\n原因：%s\r\n时间：%s\r\n请检查代理日志和上游网络。\r\n", hostname, alias, detail, now.UTC().Format(time.RFC3339))
	select {
	case a.queue <- body:
		a.last[key] = now
	default:
		log.Print("alert notification queue full; skipping notification")
	}
}

func sendAlertMail(host, port, mode, user, password, from string, to []string, body string) error {
	dialer := &net.Dialer{Timeout: 15 * time.Second}
	tlsConfig := &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}
	var conn net.Conn
	var err error
	if mode == "implicit" {
		conn, err = tls.DialWithDialer(dialer, "tcp", net.JoinHostPort(host, port), tlsConfig)
	} else {
		conn, err = dialer.Dial("tcp", net.JoinHostPort(host, port))
	}
	if err != nil {
		return err
	}
	defer conn.Close()
	if err := conn.SetDeadline(time.Now().Add(15 * time.Second)); err != nil {
		return err
	}
	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return err
	}
	defer client.Close()
	if mode == "starttls" {
		if err := client.StartTLS(tlsConfig); err != nil {
			return err
		}
	}
	if err := client.Auth(smtp.PlainAuth("", user, password, host)); err != nil {
		return err
	}
	if err := client.Mail(from); err != nil {
		return err
	}
	for _, recipient := range to {
		if err := client.Rcpt(recipient); err != nil {
			return err
		}
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	message := "From: " + (&mail.Address{Address: from}).String() + "\r\nTo: " + strings.Join(to, ", ") + "\r\nSubject: " + mime.QEncoding.Encode("UTF-8", "[天气大屏] Windy 请求失败") + "\r\nDate: " + time.Now().UTC().Format(time.RFC1123Z) + "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" + body
	if _, err := writer.Write([]byte(message)); err != nil {
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	return client.Quit()
}
