#!/bin/bash

# 设置镜像名称
IMAGE_NAME="dockerhub.theonly.vip:16666/olop/map_box"
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
TAG="${IMAGE_NAME}:${TIMESTAMP}"
TAR_FILE="${TIMESTAMP}_map_box_amd64.tar"

# 构建 x86_64(amd64) 架构镜像 + 禁用缓存
echo "正在构建 x86_64 架构 Docker 镜像..."
docker buildx build --platform linux/amd64 --no-cache -t ${TAG} . --load

if [ $? -ne 0 ]; then
    echo "镜像构建失败！"
    exit 1
fi

# 导出镜像为 tar 包
echo "正在导出镜像为 tar 包: ${TAR_FILE}"
docker save -o ${TAR_FILE} ${TAG}

if [ $? -ne 0 ]; then
    echo "镜像打包失败！"
    exit 1
fi

echo "操作完成！"
echo "镜像标签: ${TAG}"
echo "架构: linux/amd64 (x86_64)"
echo "打包文件: ${TAR_FILE}"