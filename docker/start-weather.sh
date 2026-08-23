#!/bin/sh

set -eu

upstream="${WINDY_PROXY_UPSTREAM:-}"
if ! printf '%s' "$upstream" | grep -Eq '^https?://[A-Za-z0-9._-]+(:[0-9]{1,5})?$'; then
    echo "WINDY_PROXY_UPSTREAM must be an http(s) origin without a path, got: $upstream" >&2
    exit 1
fi

authority="${upstream#*://}"
case "$authority" in
    *:*)
        port="${authority##*:}"
        if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
            echo "WINDY_PROXY_UPSTREAM port must be between 1 and 65535, got: $port" >&2
            exit 1
        fi
        ;;
esac

envsubst '${WINDY_PROXY_UPSTREAM}' \
    < /etc/nginx/templates/default.conf.template \
    > /etc/nginx/conf.d/default.conf

exec "$@"
