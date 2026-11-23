import { repos } from '../../db/hooks';
import type { WorkoutTemplate } from '../../db/types';
import { toLocalDateKey } from '../../lib/dates';
import { nowIso } from '../../lib/ids';

/** Démarre une séance (depuis le programme ou libre) et renvoie son identifiant. */
export async function startWorkout(template: WorkoutTemplate | null, now: Date = new Date()): Promise<string> {
  const workout = await repos.workouts.add({
    date: toLocalDateKey(now),
    name: template?.name ?? 'Séance libre',
    templateId: template?.id ?? null,
    exerciseIds: template ? template.exercises.map((e) => e.exerciseId) : [],
    startedAt: nowIso(now),
    endedAt: null,
  });
  return workout.id;
}
