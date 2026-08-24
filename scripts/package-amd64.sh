#!/bin/sh

set -eu

project_dir=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
image=${IMAGE:-weather-pro:latest}
output=${OUTPUT:-dist/weather-pro-linux-amd64.tar}
node_image=${NODE_IMAGE:-docker.m.daocloud.io/library/node:22-alpine}
nginx_image=${NGINX_IMAGE:-docker.m.daocloud.io/library/nginx:alpine}

if command -v docker >/dev/null 2>&1; then
    docker_cli=$(command -v docker)
elif [ -x /Applications/Docker.app/Contents/Resources/bin/docker ]; then
    docker_bin=/Applications/Docker.app/Contents/Resources/bin
    PATH="$docker_bin:$PATH"
    export PATH
    docker_cli="$docker_bin/docker"
else
    echo "Docker CLI was not found. Install or start Docker Desktop first." >&2
    exit 1
fi

case "$output" in
    /*) ;;
    *) output="$project_dir/$output" ;;
esac

if ! "$docker_cli" buildx version >/dev/null 2>&1; then
    echo "Docker Buildx is required to package a linux/amd64 image." >&2
    exit 1
fi

output_dir=$(dirname "$output")
mkdir -p "$output_dir"

temporary="$output.tmp.$$"
cleanup() {
    rm -f "$temporary"
}
trap cleanup EXIT INT TERM

set -- "$docker_cli" buildx build \
    --platform linux/amd64 \
    --tag "$image" \
    --load \
    --build-arg "NODE_IMAGE=$node_image" \
    --build-arg "NGINX_IMAGE=$nginx_image"

if [ -n "${VITE_MAPTILER_API_KEY:-}" ]; then
    set -- "$@" --build-arg "MAPTILER_PUBLIC_VALUE=$VITE_MAPTILER_API_KEY"
fi
if [ -n "${NPM_REGISTRY:-}" ]; then
    set -- "$@" --build-arg "NPM_REGISTRY=$NPM_REGISTRY"
fi
if [ -n "${ALPINE_MIRROR:-}" ]; then
    set -- "$@" --build-arg "ALPINE_MIRROR=$ALPINE_MIRROR"
fi
if [ -n "${PIP_INDEX_URL:-}" ]; then
    set -- "$@" --build-arg "PIP_INDEX_URL=$PIP_INDEX_URL"
fi

"$@" "$project_dir"

platform=$("$docker_cli" image inspect "$image" --format '{{.Os}}/{{.Architecture}}')
if [ "$platform" != "linux/amd64" ]; then
    echo "Expected linux/amd64 image, got: $platform" >&2
    exit 1
fi

"$docker_cli" save --output "$temporary" "$image"
mv "$temporary" "$output"
trap - EXIT INT TERM

output_name=$(basename "$output")
if command -v sha256sum >/dev/null 2>&1; then
    (cd "$output_dir" && sha256sum "$output_name" > "$output_name.sha256")
else
    (cd "$output_dir" && shasum -a 256 "$output_name" > "$output_name.sha256")
fi
chmod 0644 "$output" "$output.sha256"
cp "$project_dir/docker-compose.intranet.yml" "$output_dir/docker-compose.intranet.yml"
sed "s#^WEATHER_IMAGE=.*#WEATHER_IMAGE=$image#" \
    "$project_dir/.env.intranet.example" > "$output_dir/.env.intranet.example"
cp "$project_dir/nginx.intranet.conf" "$output_dir/nginx.intranet.conf"
cp "$project_dir/server.py" "$output_dir/server.py"

echo "Created linux/amd64 image: $output"
echo "Image tag: $image"
echo "Checksum: $output.sha256"
echo "Compose file: $output_dir/docker-compose.intranet.yml"
echo "Nginx config: $output_dir/nginx.intranet.conf"
echo "Python API: $output_dir/server.py"
echo "Environment template: $output_dir/.env.intranet.example"
echo "Load it with: docker load -i $output"
