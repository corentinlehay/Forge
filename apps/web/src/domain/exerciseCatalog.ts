import { EXERCISE_LIBRARY, exerciseImages, type LibraryExercise } from '../data/exerciseLibrary';
import { MUSCLE_GROUPS, type MuscleGroup } from '../data/muscles';
import type { Exercise } from '../db/types';
import { normalize } from './food';

/**
 * Catalogue affiché : la bibliothèque FORGE et tes exercices perso.
 * Un ancien exercice saisi au clavier qui porte le nom d'un exercice de la bibliothèque est fusionné avec lui.
 */
export interface CatalogItem {
  /** Identifiant de la bibliothèque, ou identifiant de ton exercice perso. */
  key: string;
  name: string;
  muscle: MuscleGroup | null;
  secondary: MuscleGroup[];
  equipment: string | null;
  kind: 'compound' | 'isolation' | null;
  rest: number | null;
  cues: string[];
  library: LibraryExercise | null;
  /** Ton exercice en base (absent tant qu'il n'a jamais servi). */
  exercise: Exercise | null;
  images: [string, string] | null;
}

const isMuscle = (v: unknown): v is MuscleGroup => typeof v === 'string' && (MUSCLE_GROUPS as readonly string[]).includes(v);

export function buildCatalog(exercises: readonly Exercise[]): CatalogItem[] {
  const active = exercises.filter((e) => !e.deletedAt);
  const linked = new Map<string, Exercise>();
  for (const e of active) if (e.libraryId) linked.set(e.libraryId, e);
  const byName = new Map(EXERCISE_LIBRARY.map((l) => [normalize(l.name), l]));
  const merged = new Set<string>();
  for (const e of active) {
    if (e.libraryId) continue;
    const lib = byName.get(normalize(e.name));
    if (lib && !linked.has(lib.id)) {
      linked.set(lib.id, e);
      merged.add(e.id);
    }
  }
  const items: CatalogItem[] = EXERCISE_LIBRARY.map((lib) => ({
    key: lib.id,
    name: lib.name,
    muscle: lib.muscle,
    secondary: lib.secondary,
    equipment: lib.equipment,
    kind: lib.kind,
    rest: lib.rest,
    cues: lib.cues,
    library: lib,
    exercise: linked.get(lib.id) ?? null,
    images: exerciseImages(lib.id),
  }));
  for (const e of active) {
    if (e.libraryId || merged.has(e.id)) continue;
    items.push({
      key: e.id,
      name: e.name,
      muscle: isMuscle(e.muscle) ? e.muscle : null,
      secondary: (e.secondary ?? []).filter(isMuscle),
      equipment: e.equipment ?? null,
      kind: e.kind ?? null,
      rest: e.restSec ?? null,
      cues: e.cues ?? [],
      library: null,
      exercise: e,
      images: null,
    });
  }
  return items.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Recherche sans accents ni majuscules ; filtre facultatif par muscle (principal ou secondaire). */
export function searchCatalog(items: readonly CatalogItem[], query: string, muscle: MuscleGroup | null): CatalogItem[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (muscle && item.muscle !== muscle) return false;
    if (!words.length) return true;
    const hay = normalize(item.name);
    return words.every((w) => hay.includes(w));
  });
}

export function catalogItem(items: readonly CatalogItem[], key: string): CatalogItem | undefined {
  return items.find((i) => i.key === key || i.exercise?.id === key);
}

/** Fourchette de répétitions proposée à l'ajout d'un exercice (modifiable). */
export function defaultReps(kind: CatalogItem['kind']): string {
  return kind === 'isolation' ? '10-15' : '6-10';
}
