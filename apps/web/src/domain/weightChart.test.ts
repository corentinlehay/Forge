import { describe, expect, it } from 'vitest';
import { addDays } from '../lib/dates';
import { computeTrend, type DailyWeight } from './weight';
import { buildWeightChart, gainCone, nearestPoint, niceTicks } from './weightChart';

const RATE = { lowPctPerWeek: 0.25, highPctPerWeek: 0.5 };

function trendFrom(start: string, values: (number | null)[]) {
  const daily: DailyWeight[] = [];
  values.forEach((v, i) => {
    if (v !== null) daily.push({ date: addDays(start, i), weightKg: v, measured: true });
  });
  return computeTrend(daily);
}

describe('graduations', () => {
  it('choisit un pas rond et englobe les valeurs', () => {
    const scale = niceTicks(86.3, 91.2);
    expect(scale.ticks).toEqual([86, 88, 90, 92]);
    expect(scale.min).toBeLessThanOrEqual(86.3);
    expect(scale.max).toBeGreaterThanOrEqual(91.2);
  });

  it("garde au moins 2 kg d'écart pour ne pas grossir les variations", () => {
    const scale = niceTicks(90.1, 90.2);
    expect(scale.max - scale.min).toBeGreaterThanOrEqual(2);
  });
});

describe('fourchette visée', () => {
  it('suit 0,25 à 0,5 % par semaine depuis le poids de départ', () => {
    const cone = gainCone('2026-11-01', 90, '2026-11-08', RATE);
    expect(cone).toHaveLength(8);
    expect(cone[0]).toMatchObject({ lowKg: 90, highKg: 90 });
    expect(cone[7]!.lowKg).toBeCloseTo(90.225, 6);
    expect(cone[7]!.highKg).toBeCloseTo(90.45, 6);
  });
});

describe('modèle du graphique', () => {
  const start = '2026-08-01';
  const values = Array.from({ length: 115 }, (_, i) => 86 + i * 0.03);
  const points = trendFrom(start, values);
  const today = addDays(start, 114);

  it('limite la fenêtre à la période choisie', () => {
    const model = buildWeightChart(points, '1m', RATE, today)!;
    expect(model.startDate).toBe(addDays(today, -29));
    expect(model.points).toHaveLength(30);
    expect(model.xLabels).toEqual([model.startDate, addDays(model.startDate, 15), today]);
  });

  it("ne remonte pas avant la première pesée", () => {
    const model = buildWeightChart(points, '1y', RATE, today)!;
    expect(model.startDate).toBe(start);
    expect(model.spanDays).toBe(114);
  });

  it("prolonge l'axe jusqu'à aujourd'hui même sans pesée récente", () => {
    const model = buildWeightChart(points, '3m', RATE, addDays(today, 5))!;
    expect(model.endDate).toBe(addDays(today, 5));
    expect(model.band.at(-1)!.date).toBe(addDays(today, 5));
  });

  it('compte seulement les jours réellement pesés', () => {
    const sparse = trendFrom(start, [90, null, null, 90.4]);
    const model = buildWeightChart(sparse, 'all', RATE, addDays(start, 3))!;
    expect(model.points).toHaveLength(4);
    expect(model.measuredCount).toBe(2);
  });

  it('retrouve le jour le plus proche du doigt', () => {
    const model = buildWeightChart(points, '1m', RATE, today)!;
    expect(nearestPoint(model, 0)?.date).toBe(model.startDate);
    expect(nearestPoint(model, 1)?.date).toBe(today);
    expect(nearestPoint(model, 0.5)?.date).toBe(addDays(model.startDate, 15));
  });

  it("n'a rien à dessiner sans pesée", () => {
    expect(buildWeightChart([], '3m', RATE, today)).toBeNull();
  });
});
