import type { AvatarConfig, Specialization } from '../../db/types';
import type { LevelState } from './level';

/**
 * Avatar FORGE (V1) : un emblème composé de pièces, débloquées par les niveaux, les badges et la spécialisation.
 * Purement cosmétique : aucune pièce ne change une note ni l'XP, et rien ne s'achète.
 * Une pièce débloquée reste acquise, même si le niveau baisse ensuite (données supprimées).
 */

export type AvatarLayer = 'forme' | 'cadre' | 'couleur' | 'fond' | 'centre' | 'ornement';

export type PieceUnlock = { kind: 'base' } | { kind: 'niveau'; level: number } | { kind: 'badge'; badgeId: string } | { kind: 'specialisation'; spec: Specialization | 'toutes' };

export interface AvatarPiece {
  /** Identifiant unique, préfixé par sa couche : « forme:bouclier ». */
  id: string;
  layer: AvatarLayer;
  value: string;
  name: string;
  unlock: PieceUnlock;
}

const base = { kind: 'base' } as const;
const lvl = (level: number) => ({ kind: 'niveau', level }) as const;
const badge = (badgeId: string) => ({ kind: 'badge', badgeId }) as const;
const spec = (s: Specialization | 'toutes') => ({ kind: 'specialisation', spec: s }) as const;
const piece = (layer: AvatarLayer, value: string, name: string, unlock: PieceUnlock): AvatarPiece => ({ id: `${layer}:${value}`, layer, value, name, unlock });

export const AVATAR_PIECES: readonly AvatarPiece[] = [
  piece('forme', 'hexagone', 'Hexagone', base),
  piece('forme', 'cercle', 'Cercle', base),
  piece('forme', 'bouclier', 'Bouclier', lvl(5)),
  piece('forme', 'losange', 'Losange', lvl(15)),
  piece('forme', 'octogone', 'Octogone', lvl(30)),
  piece('forme', 'bouclier-double', 'Bouclier double', badge('premier-cycle')),

  piece('cadre', 'simple', 'Simple', base),
  piece('cadre', 'double', 'Double', lvl(2)),
  piece('cadre', 'crante', 'Cranté', lvl(20)),
  piece('cadre', 'biseaute', 'Biseauté', lvl(40)),
  piece('cadre', 'rivets', 'Rivets', badge('actif-12')),

  piece('couleur', 'bleu', 'Bleu', base),
  piece('couleur', 'citron', 'Citron', base),
  piece('couleur', 'violet', 'Violet', base),
  piece('couleur', 'cuivre', 'Cuivre', badge('tonnes-seance')),
  piece('couleur', 'argent', 'Argent', badge('tonnes-total')),
  piece('couleur', 'or', 'Or', badge('seances-100')),
  piece('couleur', 'platine', 'Platine', lvl(50)),

  piece('fond', 'anthracite', 'Anthracite', base),
  piece('fond', 'noir', 'Noir', base),
  piece('fond', 'teinte', 'Teinté', badge('programme-respecte')),

  piece('centre', 'initiales', 'Initiales', base),
  piece('centre', 'trophee', 'Trophée', badge('premier-record')),
  piece('centre', 'sommet', 'Sommet', badge('charge-140')),
  piece('centre', 'etoile', 'Étoile', badge('serie-mind')),
  piece('centre', 'eclair', 'Éclair', spec('POWER')),
  piece('centre', 'haltere', 'Haltère', spec('BUILDER')),
  piece('centre', 'onde', 'Onde', spec('ENGINE')),
  piece('centre', 'flamme', 'Flamme', spec('DISCIPLINE')),
  piece('centre', 'boucle', 'Boucle', spec('MOBILITY')),
  piece('centre', 'lune', 'Lune', spec('RECOVERY')),

  piece('ornement', 'etoiles', 'Étoiles de palier', lvl(10)),
  piece('ornement', 'bandeau', 'Bandeau de spécialisation', spec('toutes')),
];

export const AVATAR_LAYERS: readonly { layer: AvatarLayer; label: string }[] = [
  { layer: 'forme', label: 'Forme' },
  { layer: 'cadre', label: 'Cadre' },
  { layer: 'couleur', label: 'Couleur' },
  { layer: 'fond', label: 'Fond' },
  { layer: 'centre', label: 'Centre' },
  { layer: 'ornement', label: 'Ornements' },
];

export const DEFAULT_AVATAR: AvatarConfig = {
  forme: 'hexagone',
  cadre: 'simple',
  couleur: 'bleu',
  fond: 'anthracite',
  centre: 'initiales',
  initiales: '',
  etoiles: false,
  bandeau: false,
};

const BADGE_NAMES: Record<string, string> = {
  'premier-cycle': 'Premier cycle terminé',
  'actif-12': '12 semaines actives',
  'tonnes-seance': '10 tonnes en une séance',
  'tonnes-total': '100 tonnes au total',
  'seances-100': '100 séances',
  'programme-respecte': 'Programme respecté',
  'premier-record': 'Premier record',
  'charge-140': '140 kg',
  'serie-mind': 'Série Mind',
};

/** Ce qui débloque une pièce, en une phrase. */
export function unlockText(p: AvatarPiece): string {
  switch (p.unlock.kind) {
    case 'base':
      return 'Disponible dès le départ.';
    case 'niveau':
      return `Niveau ${p.unlock.level}.`;
    case 'badge':
      return `Badge « ${BADGE_NAMES[p.unlock.badgeId] ?? p.unlock.badgeId} ».`;
    case 'specialisation':
      return p.unlock.spec === 'toutes' ? 'Choisis une spécialisation.' : `Spécialisation ${p.unlock.spec}.`;
  }
}

/** Pièces débloquées maintenant par les règles (niveau, badges, spécialisation choisie). */
export function unlockedNow(state: Pick<LevelState, 'progress' | 'unlocks'>, specialization: Specialization | null | undefined): Set<string> {
  const badges = new Set(state.unlocks.map((u) => u.id));
  const out = new Set<string>();
  for (const p of AVATAR_PIECES) {
    const u = p.unlock;
    if (
      u.kind === 'base' ||
      (u.kind === 'niveau' && state.progress.level >= u.level) ||
      (u.kind === 'badge' && badges.has(u.badgeId)) ||
      (u.kind === 'specialisation' && specialization && (u.spec === 'toutes' || u.spec === specialization))
    )
      out.add(p.id);
  }
  return out;
}

/** Pièces acquises : celles débloquées maintenant, plus celles déjà gagnées et notées. */
export function acquiredPieces(
  state: Pick<LevelState, 'progress' | 'unlocks'>,
  specialization: Specialization | null | undefined,
  kept: readonly string[] | null | undefined,
): Set<string> {
  const now = unlockedNow(state, specialization);
  for (const id of kept ?? []) if (AVATAR_PIECES.some((p) => p.id === id)) now.add(id);
  return now;
}

/** Les pièces qui ne s'annoncent pas d'elles-mêmes : de base, ou liées à la spécialisation qu'on vient de choisir. */
export const isAnnounced = (p: AvatarPiece) => p.unlock.kind === 'niveau' || p.unlock.kind === 'badge';

const VALUES: Record<Exclude<keyof AvatarConfig, 'initiales' | 'etoiles' | 'bandeau'>, AvatarLayer> = {
  forme: 'forme',
  cadre: 'cadre',
  couleur: 'couleur',
  fond: 'fond',
  centre: 'centre',
};

/** Deux lettres au plus, en majuscules. */
export function cleanInitials(text: string): string {
  return [...text.normalize('NFC').replace(/[^\p{L}]/gu, '')].slice(0, 2).join('').toLocaleUpperCase('fr-FR');
}

/** Relit une composition (profil, sauvegarde) : une valeur inconnue revient à celle par défaut. */
export function readAvatar(v: unknown): AvatarConfig {
  if (!v || typeof v !== 'object') return { ...DEFAULT_AVATAR };
  const r = v as Record<string, unknown>;
  const out: AvatarConfig = { ...DEFAULT_AVATAR };
  for (const [key, layer] of Object.entries(VALUES) as [keyof typeof VALUES, AvatarLayer][]) {
    const value = r[key];
    if (typeof value === 'string' && AVATAR_PIECES.some((p) => p.layer === layer && p.value === value)) out[key] = value;
  }
  out.initiales = typeof r.initiales === 'string' ? cleanInitials(r.initiales) : '';
  out.etoiles = r.etoiles === true;
  out.bandeau = r.bandeau === true;
  return out;
}

/** Ce que l'emblème montre, une fois les pièces non acquises remplacées par celles par défaut. */
export function wornAvatar(config: AvatarConfig, acquired: ReadonlySet<string>): AvatarConfig {
  const out = { ...config };
  for (const [key, layer] of Object.entries(VALUES) as [keyof typeof VALUES, AvatarLayer][]) if (!acquired.has(`${layer}:${out[key]}`)) out[key] = DEFAULT_AVATAR[key];
  if (!acquired.has('ornement:etoiles')) out.etoiles = false;
  if (!acquired.has('ornement:bandeau')) out.bandeau = false;
  return out;
}

/** La composition avec une pièce en plus (aperçu d'une pièce dans l'atelier ou dans une annonce). */
export function withPiece(config: AvatarConfig, piece: AvatarPiece): AvatarConfig {
  if (piece.layer === 'ornement') return { ...config, [piece.value === 'etoiles' ? 'etoiles' : 'bandeau']: true };
  return { ...config, [piece.layer]: piece.value };
}

/** Étoiles de palier : une par dizaine de niveaux, cinq au plus. */
export const levelStars = (level: number) => Math.min(5, Math.floor(level / 10));
