import { useEffect, useMemo } from 'react';
import { repos, useExercises, useMeta, useProfile, usePulseDay } from '../../db/hooks';
import type { PulseDay } from '../../db/types';
import { computePulse, pulseSnapshot, type PulseResult } from '../../domain/pulse/pulse';
import { PULSE_SETTINGS_KEY, resolveSettings, type PulseSettings } from '../../domain/pulse/settings';
import { addDays } from '../../lib/dates';
import { useLifeData } from '../review/useLifeData';

export interface PulseModel {
  today: string;
  result: PulseResult;
  settings: PulseSettings;
  record: PulseDay | null;
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

  const model = useMemo(() => {
    if (!life || !profile || !exercises || stored === undefined || record === undefined || yesterday === undefined) return null;
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
    });
    return { today: life.today, result, settings, record };
  }, [life, profile, exercises, stored, record, yesterday]);

  const snapshot = model ? JSON.stringify(pulseSnapshot(model.result)) : null;
  useEffect(() => {
    if (!snapshot) return;
    void repos.pulseDays.saveSnapshot(JSON.parse(snapshot)).catch(() => undefined);
  }, [snapshot]);

  return model;
}
