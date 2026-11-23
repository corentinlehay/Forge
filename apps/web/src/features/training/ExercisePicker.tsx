import { useMemo, useState } from 'react';
import { MUSCLE_GROUPS, MUSCLE_LABELS, EQUIPMENT_LABELS, type Equipment, type MuscleGroup } from '../../data/muscles';
import { repos, useExercises } from '../../db/hooks';
import type { Exercise } from '../../db/types';
import { buildCatalog, searchCatalog, type CatalogItem } from '../../domain/exerciseCatalog';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { CustomExerciseForm } from './CustomExerciseForm';
import { ExerciseThumb } from './ExerciseVisual';

type Filter = MuscleGroup | 'tous';
const filters = [
  { value: 'tous' as Filter, label: 'Tous' },
  ...MUSCLE_GROUPS.map((m) => ({
    value: m as Filter,
    label: MUSCLE_LABELS[m],
  })),
];

export function describeItem(item: Pick<CatalogItem, 'muscle' | 'equipment'>): string {
  const parts = [item.muscle ? MUSCLE_LABELS[item.muscle] : 'Muscle à préciser', item.equipment ? EQUIPMENT_LABELS[item.equipment as Equipment]?.toLocaleLowerCase('fr-FR') : null];
  return parts.filter(Boolean).join(', ');
}

/** L'exercice en base pour un élément du catalogue (créé ou relié au premier usage). */
export async function exerciseFor(item: CatalogItem): Promise<Exercise> {
  if (item.library) return repos.exercises.fromLibrary(item.library);
  return item.exercise!;
}

/** Choisir un exercice : recherche, filtre par muscle, bibliothèque et exercices perso, création. */
export function ExercisePicker({ exclude, onPick }: { exclude: readonly string[]; onPick: (exercise: Exercise, item: CatalogItem | null) => Promise<void> }) {
  const exercises = useExercises();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('tous');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalog = useMemo(() => buildCatalog(exercises ?? []), [exercises]);
  const matches = searchCatalog(catalog, query, filter === 'tous' ? null : filter).filter((i) => !i.exercise || !exclude.includes(i.exercise.id));

  const pick = async (item: CatalogItem) => {
    try {
      await onPick(await exerciseFor(item), item);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ajout impossible.');
    }
  };

  if (creating) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant="quiet" className="-ml-2 self-start" onClick={() => setCreating(false)}>
          <Icon name="back" size={18} />
          Retour à la liste
        </Button>
        <CustomExerciseForm editing={null} others={exercises ?? []} onSaved={(e) => void onPick(e, null)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-1">
      <Field label="Chercher un exercice" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} placeholder="Ex. développé, squat, curl" enterKeyHint="search" />
      <Chips label="Groupe musculaire" hideLabel layout="scroll" options={filters} selected={[filter]} onToggle={setFilter} />
      <ul className="flex flex-col">
        {matches.map((item) => (
          <li key={item.key} className="border-b border-graphite last:border-b-0">
            <button type="button" onClick={() => void pick(item)} className="flex min-h-16 w-full items-center gap-3 py-2 text-left">
              <ExerciseThumb item={item} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-tight">{item.name}</span>
                <span className="block text-[13px] text-cendre">
                  {describeItem(item)}
                  {!item.library && ', perso'}
                </span>
              </span>
              <Icon name="plus" size={20} className="shrink-0 text-citron" />
            </button>
          </li>
        ))}
      </ul>
      {!matches.length && <p className="text-[15px] text-cendre">Aucun exercice ne correspond. Crée-le : il rejoindra tes exercices perso.</p>}
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button variant="secondary" onClick={() => setCreating(true)}>
        <Icon name="plus" size={18} />
        Créer un exercice perso
      </Button>
    </div>
  );
}
