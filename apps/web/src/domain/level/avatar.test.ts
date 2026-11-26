import { describe, expect, it } from 'vitest';
import { acquiredPieces, AVATAR_PIECES, cleanInitials, DEFAULT_AVATAR, levelStars, readAvatar, unlockedNow, unlockText, withPiece, wornAvatar } from './avatar';
import { announcement, readSeen, seenFrom } from './history';
import type { LevelState } from './level';

const state = (level: number, badges: string[] = []) =>
  ({
    progress: { level, totalXp: 0, floor: 0, next: null, progress: 0 },
    unlocks: badges.map((id) => ({ id, date: '2026-11-20', detail: '' })),
    events: [],
    levelUps: [],
  }) as unknown as LevelState;

describe('avatar', () => {
  it('pièces de départ, par niveau, par badge et par spécialisation', () => {
    const start = unlockedNow(state(1), null);
    expect([...start].sort()).toEqual(
      AVATAR_PIECES.filter((p) => p.unlock.kind === 'base')
        .map((p) => p.id)
        .sort(),
    );
    expect(unlockedNow(state(5), null).has('forme:bouclier')).toBe(true);
    expect(unlockedNow(state(4), null).has('forme:bouclier')).toBe(false);
    expect(unlockedNow(state(1, ['seances-100']), null).has('couleur:or')).toBe(true);
    const power = unlockedNow(state(1), 'POWER');
    expect(power.has('centre:eclair')).toBe(true);
    expect(power.has('ornement:bandeau')).toBe(true);
    expect(power.has('centre:haltere')).toBe(false);
  });

  it('une pièce gagnée reste acquise, même si le niveau baisse', () => {
    expect(acquiredPieces(state(3), null, ['forme:bouclier', 'inconnue']).has('forme:bouclier')).toBe(true);
    expect(acquiredPieces(state(3), null, ['forme:bouclier']).has('inconnue')).toBe(false);
  });

  it('relit une composition abîmée, et n’affiche que des pièces acquises', () => {
    expect(readAvatar(null)).toEqual(DEFAULT_AVATAR);
    const r = readAvatar({ forme: 'bouclier', cadre: 'zigzag', couleur: 'or', initiales: 'c3p<o', etoiles: true, bandeau: 'oui' });
    expect(r).toEqual({ ...DEFAULT_AVATAR, forme: 'bouclier', couleur: 'or', initiales: 'CP', etoiles: true });
    expect(wornAvatar(r, unlockedNow(state(5), null))).toEqual({ ...r, couleur: 'bleu', etoiles: false });
  });

  it('initiales, aperçu d’une pièce, étoiles et conditions', () => {
    expect(cleanInitials('élodie')).toBe('ÉL');
    expect(cleanInitials('3 x')).toBe('X');
    expect(
      withPiece(
        DEFAULT_AVATAR,
        AVATAR_PIECES.find((p) => p.id === 'cadre:rivets')!,
      ).cadre,
    ).toBe('rivets');
    expect(
      withPiece(
        DEFAULT_AVATAR,
        AVATAR_PIECES.find((p) => p.id === 'ornement:etoiles')!,
      ).etoiles,
    ).toBe(true);
    expect([1, 10, 34, 50, 60].map(levelStars)).toEqual([0, 1, 3, 5, 5]);
    expect(unlockText(AVATAR_PIECES.find((p) => p.id === 'cadre:rivets')!)).toBe('Badge « 12 semaines actives ».');
    expect(unlockText(AVATAR_PIECES.find((p) => p.id === 'couleur:platine')!)).toBe('Niveau 50.');
  });

  it('annonce les pièces gagnées par un niveau ou un badge, pas celles de la spécialisation ; rien avant le suivi', () => {
    const before = state(4);
    const seen = seenFrom(before, '2026-11-20', 'x', unlockedNow(before, null));
    const after = state(5);
    const a = announcement(after, seen, '2026-11-20', acquiredPieces(after, 'POWER', seen.pieces))!;
    expect(a.pieces.map((p) => p.id)).toEqual(['forme:bouclier']);
    const legacy = readSeen({ level: 4, badges: [], records: [], at: '' })!;
    expect(announcement(after, legacy, '2026-11-20', acquiredPieces(after, null, null))!.pieces).toEqual([]);
  });
});
