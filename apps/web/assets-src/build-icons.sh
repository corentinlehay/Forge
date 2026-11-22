#!/bin/sh
# Génère les icônes PNG de l'app à partir de icon.svg (rsvg-convert requis).
# Les PNG sont versionnés : la mise en ligne n'a pas besoin de cet outil.
set -e
cd "$(dirname "$0")"
out=../public/icons
mkdir -p "$out"
rsvg-convert -w 180 -h 180 icon.svg -o "$out/apple-touch-icon.png"
rsvg-convert -w 192 -h 192 icon.svg -o "$out/icon-192.png"
rsvg-convert -w 512 -h 512 icon.svg -o "$out/icon-512.png"
cp icon.svg "$out/icon.svg"
