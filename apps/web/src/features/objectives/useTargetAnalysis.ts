import { useMemo } from 'react';
import { useFoodEntries, useMeta, useProfile, useTargetChanges, useToday, useWeighIns, useWorkouts } from '../../db/hooks';
import { DEFAULT_GAIN_RATE } from '../../db/repositories/profile';
import { analyzeTargets, type Analysis } from '../../domain/adaptive';
import { ageOn, bmrMifflin } from '../../domain/plan';
import { addDays } from '../../lib/dates';
import { computeTrend, toDailyWeights } from '../../domain/weight';

export const DISMISS_KEY = 'targetProposalDismissed';
export const DISMISS_DAYS = 7;

/** Analyse des objectifs nutritionnels (et proposition éventuelle, sauf si refusée récemment). */
export function useTargetAnalysis(): { analysis: Analysis; dismissedUntil: string | null } | null {
  const profile = useProfile();
  const weighIns = useWeighIns();
  const entries = useFoodEntries();
  const workouts = useWorkouts();
  const changes = useTargetChanges();
  const dismissed = useMeta<{ date: string }>(DISMISS_KEY);
  const today = useToday();
  return useMemo(() => {
    if (!profile || !weighIns || !entries || !workouts || !changes || dismissed === undefined) return null;
    const trendKg = computeTrend(toDailyWeights(weighIns)).at(-1)?.trendKg ?? null;
    const floorKcal =
      profile.sex && profile.birthDate && profile.heightCm && trendKg ? Math.round(bmrMifflin(profile.sex, trendKg, profile.heightCm, ageOn(profile.birthDate, today))) : null;
    const analysis = analyzeTargets({
      today,
      weighIns,
      entries,
      workouts,
      targets: profile.nutritionTargets ?? null,
      gainRate: profile.gainRate ?? DEFAULT_GAIN_RATE,
      lastChange: changes[0]?.date ?? null,
      floorKcal,
    });
    const until = dismissed ? addDays(dismissed.date, DISMISS_DAYS) : null;
    const dismissedUntil = until && until > today ? until : null;
    return { analysis, dismissedUntil };
  }, [profile, weighIns, entries, workouts, changes, dismissed, today]);
}
