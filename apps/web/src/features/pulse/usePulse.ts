import { useEffect, useMemo } from 'react';
import { repos, useExercises, useMeta, useProfile, usePulseDay, usePulseDays } from '../../db/hooks';
import type { CheckIn, PulseDay } from '../../db/types';
import { computePulse, pulseSnapshot, type PulseResult } from '../../domain/pulse/pulse';
import { PULSE_SETTINGS_KEY, resolveSettings, type PulseSettings } from '../../domain/pulse/settings';
import { addDays } from '../../lib/dates';
import { useLifeData, type LifeModel } from '../review/useLifeData';
import { BUDGET_KEY, type BudgetSettings } from '../../domain/budget';
import { resolveRoutines, ROUTINES_KEY, type RoutineStep, type RoutineId } from '../../domain/mind';

export interface PulseModel {
  today: string;
  result: PulseResult;
  settings: PulseSettings;
  record: PulseDay | null;
  /** Check-in du jour, pour proposer de le compléter ou de le corriger. */
  checkIn: CheckIn | null;
  /** Données de la personne (séances, pratiques Mind) pour la validation et le bilan. */
  life: LifeModel;
  /** Journal PULSE complet. */
  journal: PulseDay[];
}

/**
 * PULSE du jour, recalculé à chaque saisie. Le résultat est gardé dans le journal PULSE
 * (seulement s'il change) ; aucune donnée ne quitte l'iPhone.
 */
export function usePulse(): PulseModel | null {
  const life = useLifeData();
  const profile = useProfile();
  const exercises = useExercises();
  const stored = useMeta<unknown>(PULSE_SETTINGS_KEY);
  const today = life?.today ?? '';
  const record = usePulseDay(today);
  const yesterday = usePulseDay(today ? addDays(today, -1) : '');
  const journal = usePulseDays();
  const routines = useMeta<Partial<Record<RoutineId, RoutineStep[]>>>(ROUTINES_KEY);
  const budget = useMeta<BudgetSettings>(BUDGET_KEY);

  const model = useMemo(() => {
    if (!life || !profile || !exercises || stored === undefined || record === undefined || yesterday === undefined || !journal || routines === undefined || budget === undefined)
      return null;
    const settings = resolveSettings(stored);
    const muscles = new Map(exercises.map((e) => [e.id, e.muscle ?? null]));
    const result = computePulse({
      date: life.today,
      index: life.index,
      data: life.data,
      // PULSE 1 : aucune source de mesure. L'import Apple Santé (PULSE 2) remplira ce tableau.
      health: [],
      profile: { birthDate: profile.birthDate, heightCm: profile.heightCm, goal: profile.goal, gainRate: profile.gainRate },
      muscleOf: (id) => muscles.get(id) ?? null,
      settings,
      yesterday,
      journal: journal.filter((d) => d.date < life.today),
      routines: resolveRoutines(routines),
      budget: budget ?? null,
    });
    return { today: life.today, result, settings, record, checkIn: life.index.get(life.today)?.checkIn ?? null, life, journal };
  }, [life, profile, exercises, stored, record, yesterday, journal, routines, budget]);

  const snapshot = model ? JSON.stringify(pulseSnapshot(model.result)) : null;
  useEffect(() => {
    if (!snapshot) return;
    void repos.pulseDays.saveSnapshot(JSON.parse(snapshot)).catch(() => undefined);
  }, [snapshot]);

  return model;
}
