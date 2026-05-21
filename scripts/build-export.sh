#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

IMAGE_REF="${1:-${IMAGE_REF:-agent_spaces-server:latest}}"
OUTPUT_PATH="${2:-${OUTPUT_PATH:-"$ROOT_DIR/agent_spaces-server.latest.tar"}}"
DOCKERFILE="$ROOT_DIR/Dockerfile.server"

if [ ! -f "$DOCKERFILE" ]; then
  echo "Dockerfile not found: $DOCKERFILE" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"
rm -f "$OUTPUT_PATH"

echo "[build-export] Building image $IMAGE_REF"
docker build --file "$DOCKERFILE" --tag "$IMAGE_REF" "$ROOT_DIR"

echo "[build-export] Exporting image to $OUTPUT_PATH"
docker save --output "$OUTPUT_PATH" "$IMAGE_REF"

BYTES="$(wc -c < "$OUTPUT_PATH" | tr -d ' ')"
echo "[build-export] Done: $OUTPUT_PATH ($BYTES bytes)"
