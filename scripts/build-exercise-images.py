#!/usr/bin/env python3
"""
Illustrations de la bibliothèque d'exercices FORGE.

Source : Free Exercise DB (https://github.com/yuhonas/free-exercise-db), domaine public (licence Unlicense).
Pour chaque exercice de apps/web/src/data/exerciseLibrary.ts, télécharge les deux photos (départ et fin du mouvement)
et les convertit en WebP 480 px de large, qualité 70 : apps/web/public/exercices/<id>_0.webp et _1.webp.

Usage : python3 scripts/build-exercise-images.py   (nécessite Pillow)
"""
import io
import json
import pathlib
import re
import urllib.request

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIBRARY = ROOT / 'apps/web/src/data/exerciseLibrary.ts'
OUT = ROOT / 'apps/web/public/exercices'
BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main'


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read()


def main() -> None:
    ids = re.findall(r"^\s+\['([^']+)', '", LIBRARY.read_text(encoding='utf-8'), re.M)
    catalog = {e['id'].lower(): e for e in json.loads(fetch(f'{BASE}/dist/exercises.json'))}
    OUT.mkdir(parents=True, exist_ok=True)
    for key in ids:
        entry = catalog[key]
        for i, path in enumerate(entry['images'][:2]):
            img = Image.open(io.BytesIO(fetch(f'{BASE}/exercises/{path}'))).convert('RGB')
            img.thumbnail((480, 480))
            img.save(OUT / f'{key}_{i}.webp', 'WEBP', quality=70, method=6)
        print('ok', key)
    print(f'{len(ids)} exercices, {2 * len(ids)} images')


if __name__ == '__main__':
    main()
