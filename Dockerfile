# 多阶段构建：先构建 Python 环境
FROM python:3.11-slim as python-base

WORKDIR /app

# 复制依赖文件并安装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制 Python 服务文件
COPY server.py .

# 最终阶段：使用 nginx + Python
FROM nginx:alpine

# 安装 Python、pip 和 supervisor
RUN apk add --no-cache python3 py3-pip supervisor

# 创建虚拟环境并安装依赖
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir requests

# 复制 Python 服务文件
COPY --from=python-base /app/server.py /app/server.py

# 复制构建好的静态文件到 nginx 的默认目录
COPY dist/ /usr/share/nginx/html/

# 复制 nginx 配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 创建 supervisor 配置文件
RUN mkdir -p /etc/supervisor/conf.d
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# 暴露 80 端口
EXPOSE 80

# 使用 supervisor 启动 nginx 和 Python 服务
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
