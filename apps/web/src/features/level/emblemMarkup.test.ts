import { describe, expect, it } from 'vitest';
import { AVATAR_PIECES, DEFAULT_AVATAR, withPiece } from '../../domain/level/avatar';
import { emblemMarkup } from './emblemMarkup';

describe('dessin de l’emblème', () => {
  it('dessine chaque pièce, et n’injecte jamais de texte brut', () => {
    for (const p of AVATAR_PIECES) {
      const svg = emblemMarkup(withPiece({ ...DEFAULT_AVATAR, etoiles: true, bandeau: true }, p), { text: 'CL', level: 34, specialization: 'POWER' });
      expect(svg).toContain('<path');
      expect(svg).not.toContain('NaN');
    }
    expect(emblemMarkup(DEFAULT_AVATAR, { text: '<b>', level: 1 })).toContain('&#60;b&#62;');
    expect(emblemMarkup({ ...DEFAULT_AVATAR, etoiles: true }, { text: 'C', level: 34 }).match(/<path d="M[^"]*Z" fill="#69bdeb"\/>/g)).toHaveLength(3);
  });
});
