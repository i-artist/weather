FROM golang:1.24-alpine AS build

WORKDIR /src
COPY go.mod ./
COPY main.go ./
COPY alerts.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/windy-proxy .

FROM alpine:3.21

RUN apk add --no-cache ca-certificates
COPY --from=build /out/windy-proxy /usr/local/bin/windy-proxy

ENV WINDY_PROXY_ADDR=:3002
EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3002/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/windy-proxy"]
