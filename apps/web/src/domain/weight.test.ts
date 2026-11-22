import { describe, expect, it } from 'vitest';
import { addDays } from '../lib/dates';
import {
  computeTrend,
  fillGaps,
  gainBandKg,
  gainStatus,
  summarizeWeight,
  toDailyWeights,
  weeklyRateKg,
  type DailyWeight,
} from './weight';

const DEFAULT_RATE = { lowPctPerWeek: 0.25, highPctPerWeek: 0.5 };

function series(start: string, values: number[]): DailyWeight[] {
  return values.map((weightKg, i) => ({ date: addDays(start, i), weightKg, measured: true }));
}

describe('une valeur par jour', () => {
  it('garde la première pesée de la journée et ignore les pesées supprimées', () => {
    const daily = toDailyWeights([
      { date: '2026-11-02', time: '07:10', weightKg: 89.9 },
      { date: '2026-11-01', time: '19:00', weightKg: 90.6 },
      { date: '2026-11-01', time: '07:00', weightKg: 89.8 },
      { date: '2026-11-03', time: '07:00', weightKg: 70, deletedAt: '2026-11-03T08:00:00.000Z' },
    ]);
    expect(daily).toEqual([
      { date: '2026-11-01', weightKg: 89.8, measured: true },
      { date: '2026-11-02', weightKg: 89.9, measured: true },
    ]);
  });

  it('comble les jours manquants par interpolation linéaire', () => {
    const filled = fillGaps([
      { date: '2026-11-01', weightKg: 89, measured: true },
      { date: '2026-11-04', weightKg: 90.5, measured: true },
    ]);
    expect(filled.map((d) => d.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
    expect(filled[1]?.weightKg).toBeCloseTo(89.5, 10);
    expect(filled[2]?.weightKg).toBeCloseTo(90, 10);
    expect(filled[1]?.measured).toBe(false);
  });
});

describe('poids tendance', () => {
  it('reste stable sur une série constante', () => {
    const points = computeTrend(series('2026-11-01', [88, 88, 88, 88]));
    expect(points.every((p) => p.trendKg === 88)).toBe(true);
  });

  it('ne suit qu’à 10 % un saut brutal', () => {
    const points = computeTrend(series('2026-11-01', [80, 90]));
    expect(points[1]?.trendKg).toBeCloseTo(81, 10);
  });

  it('retrouve le rythme réel sur une prise régulière de 0,3 kg par semaine', () => {
    const values = Array.from({ length: 60 }, (_, i) => 85 + (0.3 / 7) * i);
    const rate = weeklyRateKg(computeTrend(series('2026-09-01', values)));
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0.3, 2);
  });

  it('ne calcule pas de rythme avant 7 jours', () => {
    expect(weeklyRateKg(computeTrend(series('2026-11-01', [88, 88.1, 88.2])))).toBeNull();
  });
});

describe('fourchette de prise', () => {
  it('convertit les % en kg par semaine', () => {
    const band = gainBandKg(89.6, DEFAULT_RATE);
    expect(band.lowKgPerWeek).toBeCloseTo(0.224, 3);
    expect(band.highKgPerWeek).toBeCloseTo(0.448, 3);
  });

  it('situe le rythme par rapport à la fourchette', () => {
    const band = { lowKgPerWeek: 0.22, highKgPerWeek: 0.45 };
    expect(gainStatus(null, band)).toBe('insufficient_data');
    expect(gainStatus(0.1, band)).toBe('below');
    expect(gainStatus(0.3, band)).toBe('within');
    expect(gainStatus(0.6, band)).toBe('above');
  });
});

describe('synthèse du poids', () => {
  it('signale l’absence de données', () => {
    const summary = summarizeWeight([], DEFAULT_RATE);
    expect(summary.status).toBe('insufficient_data');
    expect(summary.latestTrendKg).toBeNull();
  });

  it('reste en calibrage pendant les 14 premiers jours mesurés', () => {
    const weighIns = Array.from({ length: 10 }, (_, i) => ({ date: addDays('2026-11-01', i), time: '07:00', weightKg: 88 + 0.03 * i }));
    expect(summarizeWeight(weighIns, DEFAULT_RATE).calibrating).toBe(true);
  });

  it('reproduit l’exemple de la planche visuelle : dans la fourchette', () => {
    const weighIns = Array.from({ length: 84 }, (_, i) => ({
      date: addDays('2026-09-01', i),
      time: '07:00',
      weightKg: 86.4 + 0.0428 * i + 0.32 * Math.sin(1.7 * i) + 0.18 * Math.sin(0.37 * i + 1) + 0.12 * Math.sin(3.1 * i + 2),
    }));
    const summary = summarizeWeight(weighIns, DEFAULT_RATE);
    expect(summary.latestTrendKg!).toBeCloseTo(89.56, 2);
    expect(summary.status).toBe('within');
    expect(summary.calibrating).toBe(false);
  });
});
