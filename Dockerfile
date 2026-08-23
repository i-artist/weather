ARG NODE_IMAGE="node:22-alpine"
ARG NGINX_IMAGE="nginx:alpine"

FROM ${NODE_IMAGE} AS frontend-build

WORKDIR /app

COPY package.json package-lock.json ./

ARG NPM_REGISTRY="https://registry.npmmirror.com"
RUN registry="${NPM_REGISTRY%/}" \
    && sed -i \
        -e "s#https://registry.npmjs.org#${registry}#g" \
        -e "s#https://registry.npmmirror.com#${registry}#g" \
        package-lock.json \
    && npm ci --registry="${registry}" --no-audit --no-fund

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public/ ./public/
COPY src/ ./src/

ARG VITE_MAPTILER_API_KEY=""
ENV VITE_MAPTILER_API_KEY=${VITE_MAPTILER_API_KEY}
RUN npm run build

FROM ${NGINX_IMAGE}

ARG ALPINE_MIRROR="https://mirrors.aliyun.com/alpine"
ARG PIP_INDEX_URL="https://mirrors.aliyun.com/pypi/simple"
ENV WINDY_PROXY_UPSTREAM="http://windy-proxy:3002"
RUN sed -i "s#https://dl-cdn.alpinelinux.org/alpine#${ALPINE_MIRROR%/}#g" /etc/apk/repositories \
    && apk add --no-cache python3 py3-pip supervisor \
    && python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --index-url "${PIP_INDEX_URL}" --upgrade pip

COPY requirements.txt /app/requirements.txt
RUN /opt/venv/bin/pip install --no-cache-dir --index-url "${PIP_INDEX_URL}" -r /app/requirements.txt

COPY server.py /app/server.py
COPY --from=frontend-build /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker/start-weather.sh /usr/local/bin/start-weather
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN chmod +x /usr/local/bin/start-weather

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
    CMD wget -q -O - http://127.0.0.1/ >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/start-weather"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
