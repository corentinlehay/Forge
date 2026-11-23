import { SCHEMA_VERSION } from '../db/schema';
import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, BACKUP_VERSION, backupSchema } from '../services/backup';
import { generateDemoData } from './demo';
import { findRecords, templateForDay } from './training';
import { analyzeTargets } from './adaptive';

describe('données de démonstration', () => {
  const now = new Date(2026, 10, 23, 9, 0);
  const data = generateDemoData('2026-11-23', now);

  it('respectent le format de sauvegarde (donc les règles de validation)', () => {
    const parsed = backupSchema.safeParse({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), schemaVersion: SCHEMA_VERSION, tables: data });
    expect(parsed.success).toBe(true);
  });

  it("ne déborde jamais sur l'avenir et laisse la séance du jour à faire", () => {
    const all = [...data.weighIns, ...data.foodEntries, ...data.workouts, ...data.checkIns];
    expect(all.every((r) => r.date <= '2026-11-23')).toBe(true);
    expect(data.workouts.some((w) => w.date === '2026-11-23')).toBe(false);
    expect(templateForDay(data.workoutTemplates, '2026-11-23')?.name).toBe('Upper A');
  });

  it("n'inscrit à 9 h que le petit-déjeuner du jour", () => {
    const meals = new Set(data.foodEntries.filter((e) => e.date === '2026-11-23').map((e) => e.meal));
    expect([...meals]).toEqual(['breakfast']);
  });

  it('montre des records et une progression', () => {
    expect(findRecords(data.workouts, data.workoutSets).length).toBeGreaterThan(0);
    expect(data.profile[0]?.firstName).toBe('Démo');
  });

  it('marque chaque identifiant comme fictif', () => {
    const ids = [...data.weighIns, ...data.foodEntries, ...data.workouts, ...data.workoutSets, ...data.checkIns, ...data.exercises].map((r) => r.id);
    expect(ids.every((i) => i.startsWith('demo-'))).toBe(true);
  });

  it('montrent une proposition d’ajustement des objectifs (plateau des 4 dernières semaines)', () => {
    const profile = data.profile[0]!;
    const a = analyzeTargets({
      today: '2026-11-23',
      weighIns: data.weighIns,
      entries: data.foodEntries,
      workouts: data.workouts,
      targets: profile.nutritionTargets ?? null,
      gainRate: profile.gainRate!,
      lastChange: null,
      floorKcal: 1900,
    });
    expect(a.status).toBe('ok');
    expect(a.rateStatus).toBe('below');
    expect(a.proposal?.deltaKcal).toBeGreaterThan(0);
  });
});
