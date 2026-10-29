# Windy Proxy

Standalone allowlisted reverse proxy for the Windy Map Forecast API. The
browser uses one same-origin `/windy` endpoint while this service talks to the
Windy SDK, authentication, forecast, tile, radar, and satellite hosts.
The service replaces Windy's credential-bearing JWT with an opaque browser
session and translates it back only when forwarding data and refresh requests.

## Configuration

- `WINDY_API_KEY` (required): injected into Windy's authentication request.
- `WINDY_AUTH_HOSTNAME` (recommended for a public proxy): hostname sent to
  Windy during authentication instead of the browser application's hostname.
- `WINDY_ALLOWED_APP_HOSTS` (optional): comma-separated application
  hostnames accepted during Windy authentication. Leave empty to allow any app
  hostname.
- `WINDY_PROXY_ADDR`: listen address, defaults to `:3002`.
- `WINDY_PROXY_PREFIX`: public path prefix, defaults to `/windy`.
- `WINDY_PROXY_MAX_TEXT_MB`: maximum rewritten text response, defaults to 64.

## Run locally

```bash
WINDY_API_KEY=your-key go run .
```

Health check: `GET http://127.0.0.1:3002/health`.

The generic endpoint is deliberately not an open proxy. Only aliases compiled
into `defaultUpstreams` are accepted.

Opaque sessions are held in memory for 24 hours. Run one proxy replica, or use
sticky routing if the service is scaled horizontally.

## Windy connectivity notifications

Set `ALERT_FEISHU_WEBHOOK` to use a Feishu custom robot instead of email.
When set, Feishu takes precedence over SMTP. The same failure-only and cooldown
rules apply. Keep the webhook in a private `.env`, not an example or Git.
HTTP success and the Feishu result code are both checked. No recovery or
healthy-state messages are sent. Signed robots are not currently supported.

Configure `ALERT_SMTP_HOST`, `ALERT_SMTP_PORT` (465 by default),
`ALERT_SMTP_TLS` (`implicit` for SSL or `starttls` for STARTTLS),
`ALERT_SMTP_USER`, `ALERT_SMTP_PASSWORD`, and `ALERT_MAIL_TO` (comma-separated).
`ALERT_MAIL_FROM` defaults to the SMTP username. An empty SMTP host disables
notifications; incomplete enabled configuration fails startup.

The proxy actively downloads Windy's boot script once at startup and every hour, following
allowlisted redirects with a 15-second timeout. It checks HTTP 200, JavaScript
content type, minimum size, and the `windyInit` marker. Three consecutive failed
probes trigger a notification; a successful probe resets the failure counter.
Business request failures (including refresh EOF, HTTP errors and canceled
requests) never trigger notifications. Healthy probes and recovery send no
messages. Tests use local servers and never send real notifications.
Notifications run asynchronously with a bounded queue and SMTP deadlines.
The same upstream/error is limited to one notification per
`ALERT_COOLDOWN_SECONDS` (default 600); failed mail attempts are logged and use
the same cooldown. Credentials, response bodies and URL query tokens are not
included in emails. Throttling state resets when the proxy restarts.

Probes run independently of browser traffic when a notification channel is
configured. They verify connectivity from the proxy to `api.windy.com` and the
script's redirect destination (normally `www.windy.com`); they do not validate
API-key authentication or every forecast/tile endpoint. They cannot detect a
stopped proxy itself or an intranet client unable to connect to the proxy.
The configured notification service must also be reachable.

Keep SMTP credentials in a private environment file, never source control.
With Compose, pass it after the main environment file, for example:
`docker compose --env-file .env --env-file .env.alerts -f docker-compose.yml -f docker-compose.proxy.yml up -d --build windy-proxy`.
For systemd, add the variables to the service's existing EnvironmentFile and
restart after installing the rebuilt binary. This feature belongs on the
external proxy, not the intranet dashboard container.
