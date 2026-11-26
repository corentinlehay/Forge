import type { AvatarConfig, Specialization } from '../../db/types';
import { levelStars } from '../../domain/level/avatar';

/**
 * Dessin de l'emblème en SVG, à partir de la composition. Une seule source pour l'écran et pour l'image exportée :
 * les couleurs sont donc écrites en clair (une image n'a pas accès aux variables CSS de l'app).
 * Tout ce qui entre dans le dessin vient du catalogue ou de lettres filtrées : rien d'arbitraire n'y est injecté.
 */

export const EMBLEM_PALETTE = {
  bg: '#08090b',
  surface: '#181a1e',
  surface2: '#292c32',
  text: '#f4f4ef',
  muted: '#a0a3aa',
} as const;

export const EMBLEM_COLORS: Record<string, string> = {
  bleu: '#69bdeb',
  citron: '#d5fa45',
  violet: '#a99af5',
  cuivre: '#d08a5c',
  argent: '#c4cad3',
  or: '#e6c15a',
  platine: '#e9eef5',
};

const CX = 60;
const CY = 64;
const R = 46;
export const EMBLEM_VIEWBOX = { width: 120, height: 132 };
/** Centre du texte dans le repère du dessin, pour l'image exportée. */
export const EMBLEM_TEXT_CENTER = { x: CX, y: CY + 2 };

const pt = (deg: number, r = R): [number, number] => [CX + Math.cos((deg * Math.PI) / 180) * r, CY + Math.sin((deg * Math.PI) / 180) * r];
const poly = (points: [number, number][]) => `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}Z`;

const SHIELD: [number, number][] = [
  [60, 18],
  [101, 30],
  [101, 70],
  [60, 112],
  [19, 70],
  [19, 30],
];
const shieldPath = 'M60 18L101 30L101 70Q101 98 60 112Q19 98 19 70L19 30Z';

function shape(forme: string): { d: string; vertices: [number, number][]; circle?: boolean; innerLine?: boolean } {
  switch (forme) {
    case 'cercle':
      return { d: `M${CX - R} ${CY}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`, vertices: [0, 45, 90, 135, 180, 225, 270, 315].map((a) => pt(a)), circle: true };
    case 'bouclier':
      return { d: shieldPath, vertices: SHIELD };
    case 'bouclier-double':
      return { d: shieldPath, vertices: SHIELD, innerLine: true };
    case 'losange': {
      const v: [number, number][] = [
        [60, 14],
        [108, 64],
        [60, 114],
        [12, 64],
      ];
      return { d: poly(v), vertices: v };
    }
    case 'octogone': {
      const v = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => pt(22.5 + 45 * k));
      return { d: poly(v), vertices: v };
    }
    default: {
      const v = [0, 1, 2, 3, 4, 5].map((k) => pt(-90 + 60 * k));
      return { d: poly(v), vertices: v };
    }
  }
}

/** Symboles du centre, dessinés au trait dans un carré de 24 (comme les icônes de l'app). */
const SYMBOLS: Record<string, string> = {
  trophee: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z',
  eclair: 'M13 2.5L4.5 13.5H12L11 21.5l8.5-11H12z',
  haltere: 'M3 9.5v5M6.5 6.5v11M17.5 6.5v11M21 9.5v5M6.5 12h11',
  lune: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  etoile: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  onde: 'M2.5 12c1.6-3.2 3.2-3.2 4.75 0s3.15 3.2 4.75 0 3.2-3.2 4.75 0 3.15 3.2 4.75 0',
  flamme: 'M12 2.5c.8 3.2 4.8 5.3 4.8 10a4.8 4.8 0 0 1-9.6 0c0-2.4 1.3-3.6 2-5.6 1 1 1.6 2.1 1.9 3.4.9-2.6.3-5.3.9-7.8z',
  boucle: 'M12 12c-1.8-2.4-3.4-3.6-5-3.6a3.6 3.6 0 0 0 0 7.2c1.6 0 3.2-1.2 5-3.6zm0 0c1.8 2.4 3.4 3.6 5 3.6a3.6 3.6 0 0 0 0-7.2c-1.6 0-3.2 1.2-5 3.6z',
  sommet: 'M2.5 19.5l6.5-11 4 6.2 2.2-3.2 6.3 8z',
};

/** Mélange deux couleurs hexadécimales (part de `a`, de 0 à 1). */
function mix(a: string, b: string, share: number): string {
  const n = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [n(a), n(b)];
  return `#${x
    .map((v, i) =>
      Math.round(v * share + y[i]! * (1 - share))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

const star = (cx: number, cy: number, r: number) =>
  poly(
    Array.from({ length: 10 }, (_, i) => {
      const a = ((-90 + i * 36) * Math.PI) / 180;
      const rr = i % 2 ? r * 0.45 : r;
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as [number, number];
    }),
  );

export interface EmblemOptions {
  /** Texte du centre (initiales, ou le niveau dans l'historique) ; ignoré si un symbole est choisi, sauf `label`. */
  text: string;
  /** Remplace le centre par ce texte (le chiffre du niveau dans une annonce). */
  label?: string;
  level: number;
  specialization?: Specialization | null;
  /** Sans ornements (petites tailles). */
  bare?: boolean;
  /** Sans texte : l'image exportée le dessine elle-même avec la police de l'app. */
  withoutText?: boolean;
}

export function emblemMarkup(config: AvatarConfig, o: EmblemOptions): string {
  const tone = EMBLEM_COLORS[config.couleur] ?? EMBLEM_COLORS.bleu!;
  const fill = config.fond === 'noir' ? EMBLEM_PALETTE.bg : config.fond === 'teinte' ? mix(tone, EMBLEM_PALETTE.surface, 0.24) : EMBLEM_PALETTE.surface2;
  const s = shape(config.forme);
  const parts: string[] = [];
  const inner = `transform="translate(${CX} ${CY}) scale(0.8) translate(${-CX} ${-CY})"`;
  parts.push(`<path d="${s.d}" fill="${fill}"/>`);
  if (s.innerLine) parts.push(`<path d="${s.d}" ${inner} fill="none" stroke="${tone}" stroke-opacity="0.5" stroke-width="1.8" stroke-linejoin="round"/>`);
  switch (config.cadre) {
    case 'double':
      parts.push(`<path d="${s.d}" fill="none" stroke="${tone}" stroke-width="4" stroke-linejoin="round"/>`);
      parts.push(
        `<path d="${s.d}" transform="translate(${CX} ${CY}) scale(0.86) translate(${-CX} ${-CY})" fill="none" stroke="${tone}" stroke-opacity="0.45" stroke-width="1.6" stroke-linejoin="round"/>`,
      );
      break;
    case 'crante':
      parts.push(`<path d="${s.d}" fill="none" stroke="${tone}" stroke-width="5.5" stroke-dasharray="7 4" stroke-linejoin="round"/>`);
      break;
    case 'biseaute':
      parts.push(`<path d="${s.d}" fill="none" stroke="${tone}" stroke-width="8" stroke-linejoin="round"/>`);
      parts.push(`<path d="${s.d}" fill="none" stroke="${fill}" stroke-width="2.2" stroke-linejoin="round"/>`);
      break;
    case 'rivets':
      parts.push(`<path d="${s.d}" fill="none" stroke="${tone}" stroke-width="4" stroke-linejoin="round"/>`);
      for (const [x, y] of s.vertices) parts.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.8" fill="${tone}" stroke="${EMBLEM_PALETTE.bg}" stroke-width="1.4"/>`);
      break;
    default:
      parts.push(`<path d="${s.d}" fill="none" stroke="${tone}" stroke-width="4" stroke-linejoin="round"/>`);
  }
  const symbol = !o.label && config.centre !== 'initiales' ? SYMBOLS[config.centre] : undefined;
  if (symbol) {
    parts.push(
      `<g transform="translate(${CX - 20.4} ${CY - 20.4}) scale(1.7)" fill="none" stroke="${tone}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${symbol}"/></g>`,
    );
  } else if (!o.withoutText) {
    const text = (o.label ?? o.text).slice(0, 3);
    const size = text.length > 1 ? 34 : 42;
    parts.push(
      `<text x="${EMBLEM_TEXT_CENTER.x}" y="${EMBLEM_TEXT_CENTER.y}" text-anchor="middle" dominant-baseline="central" font-family="Archivo Variable, -apple-system, sans-serif" font-weight="800" font-stretch="75%" font-size="${size}" fill="${EMBLEM_PALETTE.text}">${escape(text)}</text>`,
    );
  }
  if (!o.bare && config.etoiles) {
    const n = levelStars(o.level);
    for (let i = 0; i < n; i++) parts.push(`<path d="${star(CX + (i - (n - 1) / 2) * 13, 7.5, 5.2)}" fill="${tone}"/>`);
  }
  if (!o.bare && config.bandeau && o.specialization) {
    parts.push(`<rect x="27" y="112" width="66" height="17" rx="3" fill="${tone}" stroke="${EMBLEM_PALETTE.bg}" stroke-width="1.5"/>`);
    parts.push(
      `<text x="60" y="120.8" text-anchor="middle" dominant-baseline="central" font-family="-apple-system, sans-serif" font-weight="700" font-size="9.5" letter-spacing="1.2" fill="${EMBLEM_PALETTE.bg}">${o.specialization}</text>`,
    );
  }
  return parts.join('');
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Le SVG complet, pour l'image exportée. */
export function emblemSvg(config: AvatarConfig, o: EmblemOptions, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round((size * EMBLEM_VIEWBOX.height) / EMBLEM_VIEWBOX.width)}" viewBox="0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}">${emblemMarkup(config, o)}</svg>`;
}
