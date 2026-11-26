import type { MuscleGroup } from '../../data/muscles';
import type { Specialization } from '../../db/types';
import type { MuscleResolver } from '../muscleVolume';
import { badgeUnlocks, badgeXp, type BadgeUnlock } from './badges';
import { characteristics, type Characteristic, type CharacteristicKey } from './characteristics';
import { baseXpEvents, buildModel, levelFor, levelUps, type LevelInput, type LevelProgress, type XpEvent } from './xp';

export type { Specialization };

/** Un titre choisi par l'utilisateur, lié à une caractéristique ; il ne change aucun calcul. */
export const SPECIALIZATIONS: readonly { id: Specialization; characteristic: CharacteristicKey; text: string }[] = [
  { id: 'POWER', characteristic: 'force', text: 'Soulever plus lourd' },
  { id: 'BUILDER', characteristic: 'hypertrophie', text: 'Construire du muscle' },
  { id: 'ENGINE', characteristic: 'endurance', text: 'Tenir plus longtemps' },
  { id: 'DISCIPLINE', characteristic: 'regularite', text: 'Ne rien lâcher' },
  { id: 'MOBILITY', characteristic: 'mobilite', text: 'Bouger librement' },
  { id: 'RECOVERY', characteristic: 'recuperation', text: 'Récupérer mieux' },
];

export interface LevelState {
  events: XpEvent[];
  progress: LevelProgress;
  unlocks: BadgeUnlock[];
  characteristics: Characteristic[];
  levelUps: { level: number; date: string }[];
  /** ENGINE et MOBILITY restent cachées tant qu'Endurance et Mobilité n'ont pas de note. */
  specializations: typeof SPECIALIZATIONS;
  /** La spécialisation de la meilleure caractéristique notée ; null sans note. */
  suggested: Specialization | null;
}

/** Tout FORGE LEVEL, calculé à partir des données : XP sans doublon, niveau, badges, caractéristiques. */
export function computeLevel(input: LevelInput, resolve: MuscleResolver, muscles: readonly MuscleGroup[]): LevelState {
  const model = buildModel(input);
  const unlocks = badgeUnlocks(model);
  const all = [...baseXpEvents(model), ...badgeXp(unlocks)];
  // Une clé ne compte qu'une fois, quoi qu'il arrive.
  const seen = new Set<string>();
  const events = all.filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true))).sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
  const total = events.reduce((n, e) => n + e.xp, 0);
  const chars = characteristics(model, resolve, muscles);
  const scored = chars.filter((c) => c.score !== null);
  const specializations = SPECIALIZATIONS.filter((s) => !['endurance', 'mobilite'].includes(s.characteristic) || scored.some((c) => c.key === s.characteristic));
  const best = [...scored].sort((a, b) => b.score! - a.score!)[0];
  return {
    events,
    progress: levelFor(total),
    unlocks: unlocks.sort((a, b) => b.date.localeCompare(a.date)),
    characteristics: chars,
    levelUps: levelUps(events),
    specializations,
    suggested: best ? SPECIALIZATIONS.find((s) => s.characteristic === best.key)!.id : null,
  };
}
