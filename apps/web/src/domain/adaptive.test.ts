import { describe, expect, it } from 'vitest';
import type { FoodEntry, NutritionTargets, Workout } from '../db/types';
import { addDays } from '../lib/dates';
import { adjustTargets, analyzeTargets, type AdaptiveInput } from './adaptive';

const today = '2026-11-23';
const targets: NutritionTargets = { kcal: 2800, proteinG: 145, carbsG: 375, fatG: 80 };
const sync = { createdAt: 'x', updatedAt: 'x', deletedAt: null };

/** 21 jours : pesées quotidiennes avec une pente donnée (kg par semaine) et un apport quotidien donné. */
function input(ratePerWeek: number, intake: number, opts: Partial<AdaptiveInput> = {}, days = 21): AdaptiveInput {
  const weighIns = [];
  const entries: FoodEntry[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, -(days - 1 - i));
    weighIns.push({ date, time: '07:00', weightKg: 80 + (ratePerWeek / 7) * i + (i % 2 ? 0.3 : -0.3) });
    entries.push({ ...sync, id: `e${i}`, date, meal: 'lunch', name: 'Jour', kcal: intake, proteinG: 150, carbsG: 300, fatG: 80, createdAt: `${date}T12:00:00Z` });
  }
  return { today, weighIns, entries, workouts: [] as Workout[], targets, gainRate: { lowPctPerWeek: 0.25, highPctPerWeek: 0.5 }, lastChange: null, floorKcal: 1750, ...opts };
}

describe('objectifs dynamiques', () => {
  it('ne propose rien sans objectif, ni avant 14 jours depuis le dernier changement', () => {
    expect(analyzeTargets({ ...input(0.3, 2800), targets: null }).status).toBe('no-targets');
    const waiting = analyzeTargets(input(0.3, 2800, { lastChange: addDays(today, -5) }));
    expect(waiting.status).toBe('waiting');
    expect(waiting.availableOn).toBe(addDays(today, 8));
  });

  it('demande assez de pesées et de jours notés (pas de réaction à une seule pesée)', () => {
    const a = input(0.1, 2800);
    const few = analyzeTargets({ ...a, weighIns: a.weighIns.filter((_, i) => i % 4 === 0) });
    expect(few.status).toBe('insufficient');
    expect(few.missing[0]).toContain('jours pesés');
  });

  it('dans la fourchette : aucun changement proposé', () => {
    const a = analyzeTargets(input(0.3, 2800));
    expect(a.status).toBe('ok');
    expect(a.rateStatus).toBe('within');
    expect(a.proposal).toBeNull();
  });

  it('prise trop lente en mangeant l’objectif : propose une hausse plafonnée, ajoutée en glucides', () => {
    const a = analyzeTargets(input(0, 2800));
    expect(a.rateStatus).toBe('below');
    expect(a.proposal?.deltaKcal).toBe(200);
    expect(a.proposal?.targets).toMatchObject({ kcal: 3000, proteinG: 145, fatG: 80, carbsG: 425 });
    expect(a.maintenanceKcal).toBeGreaterThan(2700);
  });

  it('prise trop rapide : propose une baisse', () => {
    const a = analyzeTargets(input(0.8, 2800));
    expect(a.rateStatus).toBe('above');
    expect(a.proposal!.deltaKcal).toBeLessThan(0);
  });

  it('si l’objectif n’est pas atteint, conseille de le suivre au lieu de l’augmenter', () => {
    const a = analyzeTargets(input(0, 2500));
    expect(a.proposal).toBeNull();
    expect(a.advice).toContain('atteins d’abord');
  });

  it('écarte les jours incomplets et ne descend jamais sous le métabolisme de base', () => {
    const base = input(0.8, 2800, { targets: { ...targets, kcal: 1800 }, floorKcal: 1750 });
    const a = analyzeTargets({ ...base, entries: base.entries.map((e, i) => (i < 3 ? { ...e, kcal: 500 } : { ...e, kcal: 1800 })) });
    expect(a.incompleteDays).toBe(3);
    expect(a.proposal?.targets.kcal ?? 1800).toBeGreaterThanOrEqual(1750);
  });

  it('garde au moins 20 % de lipides en baissant', () => {
    expect(adjustTargets({ kcal: 2000, proteinG: 150, carbsG: 200, fatG: 30 }, -200)).toMatchObject({ kcal: 1800, fatG: 40 });
  });
});
