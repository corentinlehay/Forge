import { describe, expect, it } from 'vitest';
import { audioInCategory, audioWithTheme, clockText, durationText, isFinished, parseCatalog, resumePosition, sizeText, themesOf, type AudioItem } from './audio';

const item = (over: Partial<AudioItem> = {}): AudioItem => ({
  id: 'a1b2c3d4e5f60718',
  title: 'Lâcher prise',
  description: '',
  format: 'hypnose',
  themes: ['lacher-prise', 'stress'],
  categories: ['apaiser'],
  goal: '',
  level: 'tous',
  audience: '',
  tags: [],
  author: 'Coz',
  durationSec: 1200,
  published: true,
  order: 0,
  file: { size: 1000, mime: 'audio/mp4', version: 'abcd1234', chunks: 1 },
  cover: null,
  createdAt: '2026-11-23T20:00:00Z',
  updatedAt: '2026-11-23T20:00:00Z',
  ...over,
});

describe('catalogue', () => {
  it('garde les séances valides et ignore les autres', () => {
    expect(parseCatalog({ items: [item(), { id: 'x', title: 3 }] }).map((i) => i.title)).toEqual(['Lâcher prise']);
    expect(parseCatalog(null)).toEqual([]);
    expect(parseCatalog({ items: 'non' })).toEqual([]);
  });

  it('filtre par catégorie et par thème d’hypnose', () => {
    const list = [item(), item({ id: 'b1b2c3d4e5f60718', format: 'relaxation', categories: ['dormir'], themes: ['sommeil'] })];
    expect(audioInCategory(list, 'dormir')).toHaveLength(1);
    expect(audioWithTheme(list, 'sommeil')).toHaveLength(0);
    expect(audioWithTheme(list, 'stress')).toHaveLength(1);
    expect(themesOf(item({ themes: ['stress', 'inconnu', 'confiance'] }))).toEqual(['stress', 'confiance']);
  });
});

describe('reprise', () => {
  it('reprend au milieu, recommence au début ou à la fin', () => {
    expect(resumePosition(5, 1200)).toBe(0);
    expect(resumePosition(600, 1200)).toBe(600);
    expect(resumePosition(1190, 1200)).toBe(0);
    expect(isFinished(1150, 1200)).toBe(true);
    expect(isFinished(1000, 1200)).toBe(false);
  });
});

describe('formats', () => {
  it('affiche durées et tailles', () => {
    expect(clockText(245)).toBe('4:05');
    expect(clockText(3723)).toBe('1:02:03');
    expect(durationText(1080)).toBe('18 min');
    expect(durationText(3900)).toBe('1 h 05');
    expect(sizeText(24 * 1024 * 1024)).toBe('24,0 Mo');
  });
});
