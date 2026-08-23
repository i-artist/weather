FROM node:22-alpine AS frontend-build

WORKDIR /app

COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public/ ./public/
COPY src/ ./src/

ARG VITE_MAPTILER_API_KEY=""
ENV VITE_MAPTILER_API_KEY=${VITE_MAPTILER_API_KEY}
RUN yarn build

FROM nginx:alpine

RUN apk add --no-cache python3 py3-pip supervisor \
    && python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip

COPY requirements.txt /app/requirements.txt
RUN /opt/venv/bin/pip install --no-cache-dir -r /app/requirements.txt

COPY server.py /app/server.py
COPY --from=frontend-build /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --retries=5 \
    CMD wget -q -O - http://127.0.0.1/ >/dev/null || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
