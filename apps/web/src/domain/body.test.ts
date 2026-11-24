import { describe, expect, it } from 'vitest';
import type { Measurement, Pain } from '../db/types';
import { compareDates, measureSummaries, PAIN_ZONES, painStatus, upsertLog, weightAverage } from './body';

const sync = { createdAt: 'a', updatedAt: 'a', deletedAt: null };
const m = (date: string, v: Partial<Measurement>): Measurement => ({ ...sync, id: date, date, ...v });
const pain = (over: Partial<Pain>): Pain => ({ ...sync, id: 'p', zone: 'genou-g', startedOn: '2026-11-01', resolvedOn: null, activities: [], logs: [], ...over });

describe('poids', () => {
  it('fait la moyenne des 7 derniers jours', () => {
    const w = [
      { date: '2026-11-10', weightKg: 80 },
      { date: '2026-11-18', weightKg: 81 },
      { date: '2026-11-20', weightKg: 82 },
      { date: '2026-11-24', weightKg: 82.6 },
    ];
    expect(weightAverage(w, '2026-11-24')).toEqual({ kg: 81.9, count: 3 });
    expect(weightAverage(w, '2026-11-05')).toBeNull();
  });
});

describe('mensurations', () => {
  const list = [m('2026-09-01', { waistCm: 84, armCm: 36 }), m('2026-10-01', { waistCm: 83.5 }), m('2026-11-01', { waistCm: 83, armCm: 37.2 })];

  it('résume la dernière valeur et les écarts', () => {
    const s = measureSummaries(list);
    expect(s.find((x) => x.key === 'waistCm')).toMatchObject({ latest: { date: '2026-11-01', value: 83 }, sincePrevious: -0.5, sinceFirst: -1 });
    expect(s.find((x) => x.key === 'armCm')).toMatchObject({ sincePrevious: 1.2, sinceFirst: 1.2 });
    expect(s.find((x) => x.key === 'thighCm')?.latest).toBeNull();
  });

  it('compare deux dates avec la mesure connue la plus proche avant chacune', () => {
    const c = compareDates(
      [
        { date: '2026-09-01', weightKg: 80 },
        { date: '2026-11-01', weightKg: 82 },
      ],
      list,
      '2026-09-02',
      '2026-11-03',
    );
    expect(c.weight).toEqual([80, 82]);
    expect(c.measures.find((x) => x.key === 'waistCm')).toEqual({ key: 'waistCm', a: 84, b: 83, delta: -1 });
    expect(c.measures.find((x) => x.key === 'thighCm')?.delta).toBeNull();
  });
});

describe('douleurs', () => {
  it('a des zones uniques, chacune visible sur au moins une vue', () => {
    expect(new Set(PAIN_ZONES.map((z) => z.key)).size).toBe(PAIN_ZONES.length);
    for (const z of PAIN_ZONES) expect(z.face || z.dos, z.key).toBeTruthy();
    const d = PAIN_ZONES.find((z) => z.key === 'genou-d')!;
    expect(d.face![0]).toBeLessThan(80);
    expect(d.dos![0]).toBeGreaterThan(80);
  });

  it('suit la tendance et la durée', () => {
    const s = painStatus(
      pain({
        logs: [
          { date: '2026-11-01', intensity: 6 },
          { date: '2026-11-05', intensity: 3 },
        ],
      }),
      '2026-11-06',
    );
    expect(s).toMatchObject({ current: 3, first: 6, trend: 'mieux', days: 6, alerts: [] });
  });

  it('signale les situations qui demandent un avis médical', () => {
    expect(painStatus(pain({ logs: [{ date: '2026-11-05', intensity: 8 }] }), '2026-11-06').alerts).toEqual(['intense']);
    expect(painStatus(pain({ logs: [{ date: '2026-11-05', intensity: 3, flags: ['gonflement'] }] }), '2026-11-06').alerts).toEqual(['signes']);
    expect(painStatus(pain({ zone: 'poitrine', logs: [{ date: '2026-11-05', intensity: 2 }] }), '2026-11-06').alerts).toContain('poitrine');
    expect(
      painStatus(
        pain({
          logs: [
            { date: '2026-11-01', intensity: 4 },
            { date: '2026-11-20', intensity: 4 },
          ],
        }),
        '2026-11-20',
      ).alerts,
    ).toEqual(['persistante']);
    expect(painStatus(pain({ resolvedOn: '2026-11-03', logs: [{ date: '2026-11-01', intensity: 9 }] }), '2026-11-20').alerts).toEqual([]);
  });

  it('remplace l’entrée du même jour', () => {
    const logs = upsertLog(
      [
        { date: '2026-11-01', intensity: 5 },
        { date: '2026-11-02', intensity: 4 },
      ],
      { date: '2026-11-02', intensity: 2 },
    );
    expect(logs).toEqual([
      { date: '2026-11-01', intensity: 5 },
      { date: '2026-11-02', intensity: 2 },
    ]);
  });
});
