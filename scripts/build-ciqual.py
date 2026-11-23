#!/usr/bin/env python3
"""
Construit apps/web/public/data/ciqual.json à partir de la table Ciqual 2025 officielle (ANSES).

Source : Anses. 2025. Ciqual French food composition table 2025. Zenodo, record 17550133.
Licence : CC BY 4.0 (citation de la source obligatoire, reprise dans l'app).

Règles de lecture (rien n'est inventé) :
- valeur « traces » ou « < x » (sous le seuil de détection) : 0 ;
- valeur absente (« - ») : inconnue ;
- un aliment sans calories, protéines, glucides ou lipides connus est écarté ;
- fibres inconnues : null.

Usage : python3 scripts/build-ciqual.py [dossier-de-travail]
"""
import hashlib
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

RECORD = '17550133'
VERSION = 'Ciqual 2025 (ANSES, 3 novembre 2025)'
FILES = {
    'alim_2025_11_03.xml': '8e1171d63cee4b6010cfce25dd29243d',
    'alim_grp_2025_11_03.xml': 'c31aeea90349c3aab86f98ef5f4f10da',
    'compo_2025_11_03.xml': '2da725585946434df320d8041631998b',
}
CONSTITUENTS = {'328': 'kcal', '25000': 'protein', '31000': 'carbs', '40000': 'fat', '34100': 'fiber'}

work = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/ciqual')
work.mkdir(parents=True, exist_ok=True)
root = Path(__file__).resolve().parent.parent
out = root / 'apps/web/public/data/ciqual.json'


def fetch(name: str, md5: str) -> Path:
    path = work / name
    if not path.exists() or hashlib.md5(path.read_bytes()).hexdigest() != md5:
        url = f'https://zenodo.org/api/records/{RECORD}/files/{name}/content'
        print('Téléchargement', url)
        urllib.request.urlretrieve(url, path)
    digest = hashlib.md5(path.read_bytes()).hexdigest()
    if digest != md5:
        sys.exit(f'Somme de contrôle invalide pour {name} : {digest}')
    return path


def text(el, tag):
    node = el.find(tag)
    return (node.text or '').strip() if node is not None and node.text else ''


def value(raw: str):
    raw = raw.strip()
    if not raw or raw == '-':
        return None
    if raw.lower() == 'traces' or raw.startswith('<'):
        return 0.0
    try:
        return float(raw.replace(',', '.'))
    except ValueError:
        return None


paths = {name: fetch(name, md5) for name, md5 in FILES.items()}

groups = {}
for g in ET.parse(paths['alim_grp_2025_11_03.xml']).getroot():
    groups[text(g, 'alim_ssgrp_code') or text(g, 'alim_grp_code')] = text(g, 'alim_ssgrp_nom_fr') or text(g, 'alim_grp_nom_fr')

foods = {}
for a in ET.parse(paths['alim_2025_11_03.xml']).getroot():
    foods[text(a, 'alim_code')] = {'name': text(a, 'alim_nom_fr'), 'group': groups.get(text(a, 'alim_ssgrp_code'), '')}

values = {}
for c in ET.iterparse(paths['compo_2025_11_03.xml'], events=('end',)):
    el = c[1]
    if el.tag != 'COMPO':
        continue
    key = CONSTITUENTS.get(text(el, 'const_code'))
    if key:
        values.setdefault(text(el, 'alim_code'), {})[key] = value(text(el, 'teneur'))
    el.clear()

rows, skipped = [], 0
for code, food in foods.items():
    v = values.get(code, {})
    core = [v.get('kcal'), v.get('protein'), v.get('carbs'), v.get('fat')]
    if any(x is None for x in core) or not food['name']:
        skipped += 1
        continue
    r1 = lambda x: round(x, 1)
    fiber = v.get('fiber')
    rows.append([code, re.sub(r'\s+', ' ', food['name']), food['group'], round(core[0]), r1(core[1]), r1(core[2]), r1(core[3]), None if fiber is None else r1(fiber)])

rows.sort(key=lambda r: r[1])
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(
    json.dumps(
        {
            'version': VERSION,
            'source': 'Anses. 2025. Table de composition nutritionnelle des aliments Ciqual. https://doi.org/10.5281/zenodo.17550133',
            'licence': 'CC BY 4.0',
            'columns': ['code', 'nom', 'groupe', 'kcal', 'proteines', 'glucides', 'lipides', 'fibres'],
            'foods': rows,
        },
        ensure_ascii=False,
        separators=(',', ':'),
    ),
    encoding='utf-8',
)
print(f'{len(rows)} aliments écrits dans {out} ({out.stat().st_size // 1024} Ko), {skipped} écartés faute de valeurs essentielles.')
