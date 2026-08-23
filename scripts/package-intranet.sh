#!/bin/sh

set -eu

project_dir=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
image_tar=${IMAGE_TAR:-dist/weather-pro-linux-amd64.tar}
bundle=${BUNDLE_OUTPUT:-dist/weather-pro-intranet-linux-amd64.tar.gz}

case "$image_tar" in
    /*) ;;
    *) image_tar="$project_dir/$image_tar" ;;
esac
case "$bundle" in
    /*) ;;
    *) bundle="$project_dir/$bundle" ;;
esac

image_dir=$(dirname "$image_tar")
image_name=$(basename "$image_tar")
bundle_dir=$(dirname "$bundle")
bundle_name=$(basename "$bundle")

for required in \
    "$image_tar" \
    "$image_tar.sha256" \
    "$image_dir/docker-compose.intranet.yml" \
    "$image_dir/.env.intranet.example"
do
    if [ ! -f "$required" ]; then
        echo "Missing package file: $required" >&2
        exit 1
    fi
done

mkdir -p "$bundle_dir"
temporary="$bundle.tmp.$$"
cleanup() {
    rm -f "$temporary"
}
trap cleanup EXIT INT TERM

COPYFILE_DISABLE=1 tar --no-xattrs -czf "$temporary" -C "$image_dir" \
    "$image_name" \
    "$image_name.sha256" \
    docker-compose.intranet.yml \
    .env.intranet.example

mv "$temporary" "$bundle"
trap - EXIT INT TERM

if command -v sha256sum >/dev/null 2>&1; then
    (cd "$bundle_dir" && sha256sum "$bundle_name" > "$bundle_name.sha256")
else
    (cd "$bundle_dir" && shasum -a 256 "$bundle_name" > "$bundle_name.sha256")
fi
chmod 0644 "$bundle" "$bundle.sha256"

echo "Created intranet deployment bundle: $bundle"
echo "Checksum: $bundle.sha256"
