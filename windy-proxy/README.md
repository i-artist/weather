# Windy Proxy

Standalone allowlisted reverse proxy for the Windy Map Forecast API. The
browser uses one same-origin `/windy` endpoint while this service talks to the
Windy SDK, authentication, forecast, tile, radar, and satellite hosts.
The service replaces Windy's credential-bearing JWT with an opaque browser
session and translates it back only when forwarding data and refresh requests.

## Configuration

- `WINDY_API_KEY` (required): injected into Windy's authentication request.
- `WINDY_ALLOWED_APP_HOSTS` (recommended): comma-separated application
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
