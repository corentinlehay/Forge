import { describe, expect, it } from 'vitest';
import { buildDailyBrief, type BriefInput } from './coach';
import { dayNutrition } from './nutrition';
import { summarizeWeight } from './weight';

const rate = { lowPctPerWeek: 0.25, highPctPerWeek: 0.5 };
const empty: BriefInput = {
  today: '2026-11-23',
  hour: 9,
  weight: summarizeWeight([], rate),
  lastWeighInDate: null,
  nutrition: dayNutrition([], '2026-11-23', null),
  training: { plannedToday: null, doneToday: null, inProgress: false, sessionsThisWeek: 0, plannedPerWeek: 0, plannedSoFar: 0, recentRecords: [] },
  wellbeing: null,
};

describe('analyse du jour', () => {
  it("ne dit rien sans données", () => {
    const brief = buildDailyBrief(empty);
    expect(brief.enoughData).toBe(false);
    expect(brief.findings).toEqual([]);
  });

  it('résume les faits enregistrés', () => {
    const brief = buildDailyBrief({
      ...empty,
      training: { ...empty.training, plannedToday: 'Upper A', plannedPerWeek: 5, plannedSoFar: 1 },
      wellbeing: { sleepHours: 7.5, score: 72 },
    });
    expect(brief.summary).toEqual(['Séance prévue : Upper A.', 'Sommeil 7 h 30, récupération 72/100.']);
  });

  it('priorise une nuit courte avant une séance', () => {
    const brief = buildDailyBrief({ ...empty, training: { ...empty.training, plannedToday: 'Lower A', plannedPerWeek: 5, plannedSoFar: 2, sessionsThisWeek: 1 }, wellbeing: { sleepHours: 5.5, score: 40 } });
    expect(brief.top?.id).toBe('short-sleep');
    expect(brief.top?.observation).toBe('Nuit courte (5 h 30) avec une séance prévue.');
    expect(brief.recommendation?.id).toBe('short-sleep');
  });

  it('ne juge les protéines qu’en fin de journée', () => {
    const targets = { kcal: 3200, proteinG: 180, carbsG: 415, fatG: 90 };
    const morning = buildDailyBrief({ ...empty, nutrition: dayNutrition([], '2026-11-23', targets) });
    expect(morning.findings.map((f) => f.id)).not.toContain('protein-low');
    const evening = buildDailyBrief({ ...empty, hour: 18, nutrition: dayNutrition([], '2026-11-23', targets) });
    expect(evening.findings.map((f) => f.id)).toContain('protein-low');
  });

  it('signale les pesées manquantes', () => {
    const brief = buildDailyBrief({ ...empty, lastWeighInDate: '2026-11-19' });
    expect(brief.findings[0]?.observation).toBe('Aucune pesée depuis 4 jours : la tendance perd en précision.');
  });
});
