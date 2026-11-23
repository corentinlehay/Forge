import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { EQUIPMENT_LABELS, MUSCLE_GROUPS, MUSCLE_LABELS, type Equipment, type MuscleGroup } from '../../data/muscles';
import { useExercises, useWorkouts, useWorkoutSets } from '../../db/hooks';
import { buildCatalog, searchCatalog, type CatalogItem } from '../../domain/exerciseCatalog';
import { activeOnly } from '../../domain/training';
import { countLabel } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { CustomExerciseForm } from './CustomExerciseForm';
import { describeItem } from './ExercisePicker';
import { ExerciseThumb } from './ExerciseVisual';

type Filter = MuscleGroup | 'tous';
const filters = [
  { value: 'tous' as Filter, label: 'Tous' },
  ...MUSCLE_GROUPS.map((m) => ({
    value: m as Filter,
    label: MUSCLE_LABELS[m],
  })),
];

const equipmentLine = (item: CatalogItem) =>
  [item.equipment ? EQUIPMENT_LABELS[item.equipment as Equipment] : null, item.library ? null : 'perso'].filter(Boolean).join(', ').replace(/^p/, 'P');

/** Bibliothèque d'exercices, classée par groupe musculaire, avec tes exercices perso. */
export function ExerciseLibraryScreen() {
  const exercises = useExercises();
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('tous');
  const [creating, setCreating] = useState(false);

  const catalog = useMemo(() => buildCatalog(exercises ?? []), [exercises]);
  const sessionCount = useMemo(() => {
    const live = new Set(activeOnly(workouts ?? []).map((w) => w.id));
    const map = new Map<string, Set<string>>();
    for (const s of activeOnly(sets ?? [])) {
      if (!live.has(s.workoutId)) continue;
      const set = map.get(s.exerciseId) ?? new Set<string>();
      set.add(s.workoutId);
      map.set(s.exerciseId, set);
    }
    return (item: CatalogItem) => (item.exercise ? (map.get(item.exercise.id)?.size ?? 0) : 0);
  }, [workouts, sets]);

  const matches = searchCatalog(catalog, query, filter === 'tous' ? null : filter);
  const grouped = !query.trim() && filter === 'tous';
  const groups: { title: string; items: CatalogItem[] }[] = grouped
    ? [
        ...MUSCLE_GROUPS.map((m) => ({
          title: MUSCLE_LABELS[m],
          items: matches.filter((i) => i.muscle === m),
        })),
        { title: 'Muscle à préciser', items: matches.filter((i) => !i.muscle) },
      ].filter((g) => g.items.length)
    : [{ title: '', items: matches }];

  return (
    <Screen withTabBar={false}>
      <Link to="/training" viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
        <Icon name="back" size={20} />
        Training
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-metal text-[40px]">Exercices</h1>
        <Button size="small" variant="secondary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={18} />
          Créer
        </Button>
      </div>
      <Field label="Chercher un exercice" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} placeholder="Ex. développé, squat, curl" enterKeyHint="search" />
      <Chips label="Groupe musculaire" hideLabel layout="scroll" options={filters} selected={[filter]} onToggle={setFilter} />

      {!matches.length && <p className="text-[15px] text-cendre">Aucun exercice ne correspond. Crée-le avec le bouton Créer.</p>}
      {groups.map((g) => (
        <section key={g.title || 'resultats'} aria-label={g.title || 'Résultats'} className="flex flex-col">
          {g.title && <h2 className="mb-1 text-[17px] font-semibold">{g.title}</h2>}
          <ul className="flex flex-col">
            {g.items.map((item) => {
              const n = sessionCount(item);
              return (
                <li key={item.key} className="border-b border-anthracite last:border-b-0">
                  <Link to={`/training/exercices/${item.key}`} viewTransition className="flex min-h-16 items-center gap-3 py-2">
                    <ExerciseThumb item={item} size={52} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] leading-tight">{item.name}</span>
                      <span className="block text-[13px] text-cendre">{grouped ? equipmentLine(item) : `${describeItem(item)}${item.library ? '' : ', perso'}`}</span>
                    </span>
                    {n > 0 && <span className="shrink-0 text-[13px] text-cendre">{countLabel(n, 'séance')}</span>}
                    <Icon name="chevron" size={16} className="shrink-0 text-cendre" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="text-[12px] text-cendre">Illustrations : Free Exercise DB, domaine public.</p>

      <Sheet open={creating} title="Nouvel exercice" onClose={() => setCreating(false)}>
        {creating && (
          <CustomExerciseForm
            editing={null}
            others={exercises ?? []}
            onSaved={(e) => {
              setCreating(false);
              toast.show('Exercice créé');
              navigate(`/training/exercices/${e.id}`, { viewTransition: true });
            }}
          />
        )}
      </Sheet>
    </Screen>
  );
}
