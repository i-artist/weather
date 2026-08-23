#!/bin/sh

set -eu

project_dir=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
image=${IMAGE:-weather-pro:latest}
output=${OUTPUT:-dist/weather-pro-linux-amd64.tar}

case "$output" in
    /*) ;;
    *) output="$project_dir/$output" ;;
esac

if ! docker buildx version >/dev/null 2>&1; then
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

set -- docker buildx build \
    --platform linux/amd64 \
    --tag "$image" \
    --load

if [ -n "${VITE_MAPTILER_API_KEY:-}" ]; then
    set -- "$@" --build-arg "VITE_MAPTILER_API_KEY=$VITE_MAPTILER_API_KEY"
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

platform=$(docker image inspect "$image" --format '{{.Os}}/{{.Architecture}}')
if [ "$platform" != "linux/amd64" ]; then
    echo "Expected linux/amd64 image, got: $platform" >&2
    exit 1
fi

docker save --output "$temporary" "$image"
mv "$temporary" "$output"
trap - EXIT INT TERM

output_name=$(basename "$output")
if command -v sha256sum >/dev/null 2>&1; then
    (cd "$output_dir" && sha256sum "$output_name" > "$output_name.sha256")
else
    (cd "$output_dir" && shasum -a 256 "$output_name" > "$output_name.sha256")
fi

echo "Created linux/amd64 image: $output"
echo "Checksum: $output.sha256"
echo "Load it with: docker load -i $output"
