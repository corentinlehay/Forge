import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { repos, useExercises, useTemplates, useWorkouts, useWorkoutSets } from '../../db/hooks';
import type { WorkoutSet } from '../../db/types';
import { bestE1rm, e1rm, lastPerformance, workoutStats } from '../../domain/training';
import { nowIso } from '../../lib/ids';
import { formatDayShort, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { SetForm } from './SetForm';

const kgText = (v: number) => formatNumber(v, v % 1 ? (Math.round(v * 100) % 10 ? 2 : 1) : 0);

type SheetState = { kind: 'none' } | { kind: 'add'; exerciseId: string } | { kind: 'edit'; set: WorkoutSet } | { kind: 'exercise' };

/** Une séance : exercices, séries validées au pavé, performance à battre, records en direct. */
export function WorkoutScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const workout = useLiveQuery(() => repos.workouts.get(id), [id]);
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const exercises = useExercises();
  const templates = useTemplates();
  const [sheet, setSheet] = useState<SheetState>({ kind: 'none' });
  const [stamped, setStamped] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mine = useMemo(() => (sets ?? []).filter((s) => s.workoutId === id).sort((a, b) => a.position - b.position), [sets, id]);
  const nameOf = (exerciseId: string) => exercises?.find((e) => e.id === exerciseId)?.name ?? 'Exercice';
  const template = templates?.find((t) => t.id === workout?.templateId);

  if (workout === undefined && workouts !== undefined) {
    const exists = workouts.some((w) => w.id === id);
    if (!exists) {
      return (
        <Screen withTabBar={false}>
          <BackLink />
          <p className="text-[17px]">Cette séance n’existe pas ou a été supprimée.</p>
        </Screen>
      );
    }
  }
  if (!workout || !sets || !workouts || !exercises) return <Screen withTabBar={false}><BackLink /></Screen>;

  const order = [...workout.exerciseIds, ...mine.map((s) => s.exerciseId).filter((e) => !workout.exerciseIds.includes(e))];
  const exerciseIds = [...new Set(order)];
  const stats = workoutStats(workout, mine);
  const ended = Boolean(workout.endedAt);

  /** Une série est un record si elle bat le meilleur 1RM estimé des autres séances (et est la meilleure du jour). */
  const isRecord = (s: WorkoutSet) => {
    const before = bestE1rm(s.exerciseId, workouts, sets, workout.id);
    if (before === null) return false;
    const value = e1rm(s.weightKg, s.reps);
    const bestToday = Math.max(...mine.filter((x) => x.exerciseId === s.exerciseId).map((x) => e1rm(x.weightKg, x.reps)));
    return value > before + 1e-9 && value === bestToday;
  };

  const addSet = async (exerciseId: string, weightKg: number, reps: number) => {
    const saved = await repos.sets.add({ workoutId: workout.id, exerciseId, position: (mine.at(-1)?.position ?? -1) + 1, weightKg, reps });
    setStamped(saved.id);
    setSheet({ kind: 'none' });
  };

  const finish = async () => {
    await repos.workouts.update(workout.id, { endedAt: nowIso() });
    toast.show(`Séance terminée : ${stats.setCount} série${stats.setCount > 1 ? 's' : ''}, ${formatNumber(stats.volumeKg, 0)} kg`);
    navigate('/training', { viewTransition: true });
  };

  const removeWorkout = async () => {
    for (const s of mine) await repos.sets.remove(s.id);
    await repos.workouts.remove(workout.id);
    toast.show('Séance supprimée');
    navigate('/training', { replace: true });
  };

  const sheetExercise = sheet.kind === 'add' ? sheet.exerciseId : sheet.kind === 'edit' ? sheet.set.exerciseId : null;
  const prefill = (exerciseId: string) => {
    const lastToday = mine.filter((s) => s.exerciseId === exerciseId).at(-1);
    if (lastToday) return { weight: lastToday.weightKg, reps: lastToday.reps };
    const perf = lastPerformance(exerciseId, workouts, sets, workout.id);
    return perf ? { weight: perf.weightKg, reps: perf.reps } : { weight: null, reps: null };
  };

  return (
    <Screen withTabBar={false}>
      <BackLink />
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[44px]">{workout.name}</h1>
        <p className="text-[15px] text-cendre">
          {formatDayShort(workout.date)}, {ended ? 'terminée' : 'en cours'}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-[18px] bg-anthracite p-3.5">
        {[
          ['Séries', formatNumber(stats.setCount, 0)],
          ['Exercices', formatNumber(stats.exerciseCount, 0)],
          ['Volume', `${formatNumber(stats.volumeKg, 0)} kg`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[12px] text-cendre">{label}</dt>
            <dd className="font-metal text-[26px] whitespace-nowrap">{value}</dd>
          </div>
        ))}
      </dl>

      {exerciseIds.length === 0 && <p className="text-[15px] text-cendre">Ajoute un premier exercice pour commencer.</p>}

      {exerciseIds.map((exerciseId) => {
        const list = mine.filter((s) => s.exerciseId === exerciseId);
        const perf = lastPerformance(exerciseId, workouts, sets, workout.id);
        const target = template?.exercises.find((e) => e.exerciseId === exerciseId);
        return (
          <section key={exerciseId} aria-label={nameOf(exerciseId)} className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[17px] font-semibold">{nameOf(exerciseId)}</h2>
              {target && (
                <span className="shrink-0 text-[13px] text-cendre">
                  {target.sets} × {target.reps}
                </span>
              )}
            </div>
            <p className="text-[13px] text-cendre">
              {perf ? (
                <>
                  À battre : <span className="font-semibold text-craie">{kgText(perf.weightKg)} kg × {perf.reps}</span>, {formatDayShort(perf.date).toLocaleLowerCase('fr-FR')}
                </>
              ) : (
                'Première fois : pas de performance à battre.'
              )}
            </p>
            {list.length > 0 && (
              <ol className="flex flex-col">
                {list.map((s, i) => {
                  const record = isRecord(s);
                  return (
                    <li key={s.id} className={`rounded-[10px] ${stamped === s.id ? 'animate-frappe' : ''}`}>
                      <button type="button" onClick={() => setSheet({ kind: 'edit', set: s })} className="flex min-h-11 w-full items-center gap-3 px-1 text-left">
                        <span className="w-6 text-[13px] text-cendre tabular-nums">{i + 1}</span>
                        <span className="font-metal flex-1 text-[24px]">
                          {kgText(s.weightKg)} <span className="font-sans text-[13px] font-normal text-cendre">kg</span> × {s.reps}
                        </span>
                        {record && (
                          <span className="flex items-center gap-1 rounded-full bg-citron px-2 py-0.5 text-[12px] font-semibold text-noir shadow-[0_0_14px_rgb(214_246_74/0.55)]">
                            <Icon name="trophy" size={13} strokeWidth={2.2} />
                            Record
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <Button variant="secondary" onClick={() => setSheet({ kind: 'add', exerciseId })}>
              <Icon name="plus" size={18} />
              Ajouter une série
            </Button>
          </section>
        );
      })}

      <Button variant="secondary" onClick={() => setSheet({ kind: 'exercise' })}>
        <Icon name="plus" size={18} />
        Ajouter un exercice
      </Button>

      {!ended && (
        <Button onClick={() => void finish()} disabled={stats.setCount === 0}>
          Terminer la séance
        </Button>
      )}
      {!ended && stats.setCount === 0 && <p className="-mt-2 text-center text-[13px] text-cendre">Valide au moins une série pour terminer.</p>}

      {confirmDelete ? (
        <div className="flex flex-col gap-2">
          <Button variant="danger" onClick={() => void removeWorkout()}>
            Confirmer la suppression
          </Button>
          <Button variant="quiet" onClick={() => setConfirmDelete(false)}>
            Garder la séance
          </Button>
        </div>
      ) : (
        <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirmDelete(true)}>
          Supprimer la séance
        </Button>
      )}

      <Sheet
        open={sheet.kind !== 'none'}
        title={sheet.kind === 'exercise' ? 'Ajouter un exercice' : sheetExercise ? nameOf(sheetExercise) : ''}
        onClose={() => setSheet({ kind: 'none' })}
      >
        {sheet.kind === 'add' && (
          <SetForm
            key={`add-${sheet.exerciseId}`}
            initialWeight={prefill(sheet.exerciseId).weight}
            initialReps={prefill(sheet.exerciseId).reps}
            editing={false}
            onSave={(w, r) => addSet(sheet.exerciseId, w, r)}
          />
        )}
        {sheet.kind === 'edit' && (
          <SetForm
            key={`edit-${sheet.set.id}`}
            initialWeight={sheet.set.weightKg}
            initialReps={sheet.set.reps}
            editing
            onSave={async (w, r) => {
              await repos.sets.update(sheet.set.id, { weightKg: w, reps: r });
              setSheet({ kind: 'none' });
            }}
            onDelete={async () => {
              await repos.sets.remove(sheet.set.id);
              setSheet({ kind: 'none' });
            }}
          />
        )}
        {sheet.kind === 'exercise' && (
          <ExercisePicker
            exclude={exerciseIds}
            onPick={async (exerciseId) => {
              await repos.workouts.update(workout.id, { exerciseIds: [...exerciseIds, exerciseId] });
              setSheet({ kind: 'add', exerciseId });
            }}
          />
        )}
      </Sheet>
    </Screen>
  );
}

function BackLink() {
  return (
    <Link to="/training" viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      Training
    </Link>
  );
}

function ExercisePicker({ exclude, onPick }: { exclude: string[]; onPick: (exerciseId: string) => Promise<void> }) {
  const exercises = useExercises();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const q = query.trim().toLocaleLowerCase('fr-FR');
  const matches = (exercises ?? [])
    .filter((e) => !exclude.includes(e.id) && (!q || e.name.toLocaleLowerCase('fr-FR').includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .slice(0, 8);
  const exact = exercises?.some((e) => e.name.toLocaleLowerCase('fr-FR') === q);

  const create = async () => {
    try {
      const exercise = await repos.exercises.findOrCreate(query);
      await onPick(exercise.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible.');
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-1">
      <Field label="Exercice" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} placeholder="Chercher ou créer" autoFocus />
      <ul className="flex flex-col">
        {matches.map((e) => (
          <li key={e.id} className="border-b border-graphite last:border-b-0">
            <button type="button" onClick={() => void onPick(e.id)} className="flex min-h-11 w-full items-center justify-between py-2 text-left text-[15px]">
              {e.name}
              <Icon name="plus" size={18} className="text-citron" />
            </button>
          </li>
        ))}
      </ul>
      {q && !exact && (
        <Button variant="secondary" onClick={() => void create()}>
          Créer « {query.trim()} »
        </Button>
      )}
      {!q && !matches.length && <p className="text-[15px] text-cendre">Tape le nom d’un exercice pour le créer.</p>}
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
