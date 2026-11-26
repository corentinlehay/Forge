import type { AvatarConfig, Specialization } from '../../db/types';
import { CHARACTERISTIC_LABELS, type Characteristic } from '../../domain/level/characteristics';
import { formatDayMonthLong, formatNumber } from '../../lib/format';
import { EMBLEM_COLORS, EMBLEM_PALETTE, EMBLEM_TEXT_CENTER, EMBLEM_VIEWBOX, emblemSvg } from './emblemMarkup';

/**
 * Carte joueur en image (PNG, 1080 × 1350, format portrait des réseaux) : emblème, niveau, XP, six notes, badges.
 * Dessinée sur un canvas, sans serveur : rien ne quitte le téléphone tant que l'utilisateur ne partage pas l'image.
 */

export interface PlayerCardData {
  config: AvatarConfig;
  initials: string;
  firstName: string | null;
  specialization: Specialization | null;
  level: number;
  totalXp: number;
  toNext: number | null;
  progress: number;
  characteristics: readonly Characteristic[];
  badges: number;
  badgesTotal: number;
  today: string;
}

const W = 1080;
const H = 1350;
const DISPLAY = '"Archivo Variable", -apple-system, sans-serif';
const SANS = '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Police d'affichage condensée quand le navigateur sait le faire ; sinon la même police, plus large. */
function display(ctx: CanvasRenderingContext2D, size: number) {
  ctx.font = `800 ${size}px ${DISPLAY}`;
  try {
    (ctx as unknown as { fontStretch: string }).fontStretch = 'condensed';
  } catch {
    // Sans réglage de largeur : la police reste lisible.
  }
}
function sans(ctx: CanvasRenderingContext2D, size: number, weight = 400) {
  ctx.font = `${weight} ${size}px ${SANS}`;
  try {
    (ctx as unknown as { fontStretch: string }).fontStretch = 'normal';
  } catch {
    // idem
  }
}

async function loadImage(svg: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return img;
}

export async function renderPlayerCard(d: PlayerCardData): Promise<Blob> {
  try {
    await document.fonts?.load(`800 100px ${DISPLAY}`);
  } catch {
    // Police indisponible : celle du système prend le relais.
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image impossible à créer sur cet appareil.');
  const tone = EMBLEM_COLORS[d.config.couleur] ?? EMBLEM_COLORS.bleu!;

  ctx.fillStyle = EMBLEM_PALETTE.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = EMBLEM_PALETTE.surface;
  roundRect(ctx, 48, 48, W - 96, H - 96, 56);
  ctx.fill();

  ctx.textBaseline = 'alphabetic';
  sans(ctx, 30, 600);
  ctx.fillStyle = EMBLEM_PALETTE.muted;
  ctx.textAlign = 'left';
  ctx.fillText('FORGE LEVEL', 110, 132);
  ctx.textAlign = 'right';
  sans(ctx, 28);
  ctx.fillText(formatDayMonthLong(d.today), W - 110, 132);

  // Emblème : le dessin vient du même code que l'écran ; les lettres sont posées ensuite avec la police de l'app.
  const size = 320;
  const ex = (W - size) / 2;
  const ey = 160;
  const scale = size / EMBLEM_VIEWBOX.width;
  const img = await loadImage(emblemSvg(d.config, { text: d.initials, level: d.level, specialization: d.specialization, withoutText: true }, size));
  ctx.drawImage(img, ex, ey, size, (size * EMBLEM_VIEWBOX.height) / EMBLEM_VIEWBOX.width);
  if (d.config.centre === 'initiales') {
    display(ctx, (d.initials.length > 1 ? 34 : 42) * scale);
    ctx.fillStyle = EMBLEM_PALETTE.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.initials, ex + EMBLEM_TEXT_CENTER.x * scale, ey + EMBLEM_TEXT_CENTER.y * scale);
    ctx.textBaseline = 'alphabetic';
  }

  ctx.textAlign = 'center';
  let y = 586;
  if (d.firstName) {
    sans(ctx, 52, 700);
    ctx.fillStyle = EMBLEM_PALETTE.text;
    ctx.fillText(d.firstName, W / 2, y);
  }
  if (d.specialization) {
    sans(ctx, 28, 700);
    ctx.fillStyle = tone;
    ctx.fillText(d.specialization.split('').join(String.fromCharCode(8202)), W / 2, y + 46);
  }

  // Niveau : « Niveau » puis le chiffre, centrés ensemble.
  y = 770;
  sans(ctx, 34);
  const word = 'Niveau ';
  const wordWidth = ctx.measureText(word).width;
  display(ctx, 150);
  const numberWidth = ctx.measureText(String(d.level)).width;
  const start = W / 2 - (wordWidth + numberWidth) / 2;
  ctx.textAlign = 'left';
  sans(ctx, 34);
  ctx.fillStyle = EMBLEM_PALETTE.muted;
  ctx.fillText(word, start, y);
  display(ctx, 150);
  ctx.fillStyle = EMBLEM_PALETTE.text;
  ctx.fillText(String(d.level), start + wordWidth, y);

  ctx.fillStyle = EMBLEM_PALETTE.surface2;
  roundRect(ctx, 168, 806, W - 336, 16, 8);
  ctx.fill();
  ctx.fillStyle = tone;
  roundRect(ctx, 168, 806, Math.max(16, (W - 336) * d.progress), 16, 8);
  ctx.fill();
  ctx.textAlign = 'center';
  sans(ctx, 26);
  ctx.fillStyle = EMBLEM_PALETTE.muted;
  ctx.fillText(`${formatNumber(d.totalXp, 0)} XP${d.toNext !== null ? `, encore ${formatNumber(d.toNext, 0)} pour le niveau ${d.level + 1}` : ', niveau maximal'}`, W / 2, 862);

  ctx.fillStyle = EMBLEM_PALETTE.surface2;
  ctx.fillRect(110, 902, W - 220, 2);

  // Six notes, sur deux lignes de trois.
  d.characteristics.forEach((c, i) => {
    const x = 200 + (i % 3) * 340;
    const top = i < 3 ? 962 : 1098;
    ctx.textAlign = 'center';
    sans(ctx, 26);
    ctx.fillStyle = EMBLEM_PALETTE.muted;
    ctx.fillText(CHARACTERISTIC_LABELS[c.key], x, top);
    display(ctx, 66);
    ctx.fillStyle = c.score === null ? EMBLEM_PALETTE.muted : EMBLEM_PALETTE.text;
    ctx.fillText(c.score === null ? '–' : String(c.score), x, top + 70);
  });

  ctx.textAlign = 'left';
  sans(ctx, 26);
  ctx.fillStyle = EMBLEM_PALETTE.muted;
  ctx.fillText(`${d.badges} badge${d.badges > 1 ? 's' : ''} sur ${d.badgesTotal}`, 110, 1238);
  ctx.textAlign = 'right';
  display(ctx, 40);
  ctx.fillStyle = EMBLEM_PALETTE.text;
  ctx.fillText('FORGE', W - 110, 1240);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image impossible à créer.'))), 'image/png'));
}

/** Partage l'image (feuille de partage de l'iPhone), ou la télécharge quand le partage de fichiers n'existe pas. */
export async function sharePlayerCard(blob: Blob): Promise<'partage' | 'telechargement' | 'annule'> {
  const file = new File([blob], 'carte-forge.png', { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Ma carte FORGE' });
      return 'partage';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'annule';
      throw e;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'carte-forge.png';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'telechargement';
}
