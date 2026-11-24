import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ForgeDB } from './schema';
import { createPulseDayRepo, DataError } from './repositories/entities';

let db: ForgeDB;

beforeEach(async () => {
  db = new ForgeDB(`test-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

const D = '2026-11-24';
const snapshot = {
  date: D,
  engineVersion: 2,
  readiness: 48,
  confidence: 'moyenne' as const,
  mode: 'allege' as const,
  components: [],
  nutritionKind: 'sans-objectif' as const,
  nutritionScore: null,
  rules: [],
  plannedTemplateId: 'legs',
  trainingKind: 'lighten',
};
const at = (h: number) => new Date(`${D}T${String(h).padStart(2, '0')}:00:00.000Z`);

describe('journal PULSE : décisions et bilan', () => {
  it('garde la trace de chaque décision, annulations comprises', async () => {
    const repo = createPulseDayRepo(db);
    await repo.saveSnapshot(snapshot, at(8));
    await repo.decide(D, 'accepter', 'alleger', { source: 'pulse', setsDelta: -1, rirDelta: 2 }, at(9));
    let day = await repo.decide(D, 'modifier', 'alleger', { source: 'pulse', setsDelta: 0, rirDelta: 1 }, at(10));
    expect(day.adjustment).toEqual({ source: 'pulse', setsDelta: 0, rirDelta: 1 });
    day = await repo.undo(D, at(11));
    expect(day.choice).toBeNull();
    expect(day.adjustment).toBeNull();
    day = await repo.decide(D, 'refuser', 'garder', { source: 'pulse', setsDelta: -1, rirDelta: 2 }, at(12));
    expect(day.adjustment).toBeNull();
    expect(day.decisions?.map((d) => [d.action, d.choice])).toEqual([
      ['accepter', 'alleger'],
      ['modifier', 'alleger'],
      ['annuler', null],
      ['refuser', 'garder'],
    ]);
  });

  it('ne réécrit ni les décisions ni le bilan quand le résultat du jour change', async () => {
    const repo = createPulseDayRepo(db);
    await repo.saveSnapshot(snapshot, at(8));
    await repo.choose(D, 'deplacer', at(9));
    await repo.saveReview(D, { followed: 'partiel', changes: ['deplacee'], sessionFeel: null, dayFeel: 4, useful: 'oui', done: [] }, at(20));
    const day = await repo.saveSnapshot({ ...snapshot, readiness: 52 }, at(21));
    expect(day.readiness).toBe(52);
    expect(day.choice).toBe('deplacer');
    expect(day.decisions).toHaveLength(1);
    expect(day.decisions?.[0]?.action).toBe('reporter');
    expect(day.review).toMatchObject({ followed: 'partiel', dayFeel: 4, at: at(20).toISOString() });
  });

  it('refuse une décision sans journal, une annulation sans choix et un ajustement hors limites', async () => {
    const repo = createPulseDayRepo(db);
    await expect(repo.decide(D, 'accepter', 'alleger')).rejects.toBeInstanceOf(DataError);
    await repo.saveSnapshot(snapshot);
    await expect(repo.undo(D)).rejects.toBeInstanceOf(DataError);
    await expect(repo.decide(D, 'modifier', 'alleger', { source: 'pulse', setsDelta: 1, rirDelta: 0 })).rejects.toBeInstanceOf(DataError);
    await expect(repo.saveReview('2026-11-20', { followed: 'oui', changes: [], sessionFeel: null, dayFeel: null, useful: null, done: [] })).rejects.toBeInstanceOf(DataError);
  });
});
