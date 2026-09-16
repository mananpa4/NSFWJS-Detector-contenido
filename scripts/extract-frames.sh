#!/usr/bin/env bash
# Extrae frames clave de un video (1 fps por defecto) para batch de moderación.
# Uso: ./scripts/extract-frames.sh input.mp4 out-dir/ [fps]
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Uso: $0 input.mp4 out-dir/ [fps=1]" >&2
  exit 1
fi

INPUT="$1"
OUT="$2"
FPS="${3:-1}"

mkdir -p "$OUT"
ffmpeg -y -i "$INPUT" -vf "fps=$FPS" -q:v 3 "$OUT/frame-%04d.jpg"
echo "Frames en $OUT (fps=$FPS): $(ls "$OUT"/frame-*.jpg 2>/dev/null | wc -l)"
