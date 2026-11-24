import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { repos, useAllTemplates, useExercises, useWorkouts, useWorkoutSets } from '../../db/hooks';
import type { TemplateExercise, Workout, WorkoutSet } from '../../db/types';
import { buildCatalog, catalogItem, type CatalogItem } from '../../domain/exerciseCatalog';
import { exerciseSessions, holdLoad, parseRepRange, suggestNext, type Suggestion } from '../../domain/progression';
import { adjustTargets, describeAdjustment } from '../../domain/pulse/adjust';
import { revertChoice } from '../pulse/pulseActions';
import { toLocalDateKey } from '../../lib/dates';
import { bestE1rm, e1rm, lastPerformance, workoutStats } from '../../domain/training';
import { formatClock, formatRest, moveItem, nextSet, restFor } from '../../domain/workoutFlow';
import { nowIso } from '../../lib/ids';
import { formatDayShort, formatNumber } from '../../lib/format';
import { unlockAudio } from '../../services/beep';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { TextArea } from '../../ui/TextArea';
import { useToast } from '../../ui/Toast';
import { ExercisePicker } from './ExercisePicker';
import { ExerciseDemo, ExerciseThumb } from './ExerciseVisual';
import { SetForm } from './SetForm';
import { IconButton } from './TemplateScreen';
import { useRestTimer } from './useRestTimer';
import { TrainingMindLinks } from '../mind/LibraryScreens';
import { useWakeLock } from './useWakeLock';

const kgText = (v: number) => formatNumber(v, v % 1 ? (Math.round(v * 100) % 10 ? 2 : 1) : 0);

type SheetState =
  | { kind: 'none' }
  | { kind: 'add'; exerciseId: string }
  | { kind: 'edit'; set: WorkoutSet }
  | { kind: 'exercise' }
  | { kind: 'menu'; exerciseId: string }
  | { kind: 'info'; exerciseId: string };

function useMinutesSince(startIso: string, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [active]);
  return Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 60_000));
}

/** Une séance en direct : séries au pavé, RIR, repos minuté, objectif proposé, notes, sauvegarde à chaque série. */
export function WorkoutScreen() {
  const { id = '' } = useParams();
  const workout = useLiveQuery(() => repos.workouts.get(id), [id]);
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const exercises = useExercises();
  const templates = useAllTemplates();

  if (workout === undefined && workouts !== undefined && !workouts.some((w) => w.id === id)) {
    return (
      <Screen withTabBar={false}>
        <BackLink />
        <p className="text-[17px]">Cette séance n’existe pas ou a été supprimée.</p>
      </Screen>
    );
  }
  if (!workout || !sets || !workouts || !exercises || !templates)
    return (
      <Screen withTabBar={false}>
        <BackLink />
      </Screen>
    );
  const targets = adjustTargets(templates.find((t) => t.id === workout.templateId)?.exercises ?? [], workout.adjustment);
  return <LiveWorkout workout={workout} workouts={workouts} sets={sets} targets={targets} />;
}

function LiveWorkout({ workout, workouts, sets, targets }: { workout: Workout; workouts: Workout[]; sets: WorkoutSet[]; targets: TemplateExercise[] }) {
  const navigate = useNavigate();
  const toast = useToast();
  const exercises = useExercises() ?? [];
  const catalog = useMemo(() => buildCatalog(exercises), [exercises]);
  const [sheet, setSheet] = useState<SheetState>({ kind: 'none' });
  const [stamped, setStamped] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ended = Boolean(workout.endedAt);
  const timer = useRestTimer(workout.id);
  const minutes = useMinutesSince(workout.startedAt, !ended);
  useWakeLock(!ended);

  const mine = useMemo(() => sets.filter((s) => s.workoutId === workout.id).sort((a, b) => a.position - b.position), [sets, workout.id]);
  const order = [...new Set([...workout.exerciseIds, ...mine.map((s) => s.exerciseId)])];
  const stats = workoutStats(workout, mine);
  const next = ended ? null : nextSet(order, mine, targets);

  const exerciseOf = (exerciseId: string) => exercises.find((e) => e.id === exerciseId);
  const itemOf = (exerciseId: string): CatalogItem | undefined => catalogItem(catalog, exerciseId);
  const nameOf = (exerciseId: string) => itemOf(exerciseId)?.name ?? exerciseOf(exerciseId)?.name ?? 'Exercice';
  const targetOf = (exerciseId: string) => targets.find((t) => t.exerciseId === exerciseId);
  const suggestionFor = (exerciseId: string): Suggestion | null => {
    const sessions = exerciseSessions(exerciseId, workouts, sets, workout.id);
    const s = suggestNext(sessions, parseRepRange(targetOf(exerciseId)?.reps));
    return workout.adjustment ? holdLoad(s, sessions.at(-1)?.maxLoad ?? null) : s;
  };

  /** Une série est un record si elle bat le meilleur 1RM estimé des autres séances (et est la meilleure du jour). */
  const isRecord = (s: WorkoutSet) => {
    const before = bestE1rm(s.exerciseId, workouts, sets, workout.id);
    if (before === null) return false;
    const value = e1rm(s.weightKg, s.reps);
    const bestToday = Math.max(...mine.filter((x) => x.exerciseId === s.exerciseId).map((x) => e1rm(x.weightKg, x.reps)));
    return value > before + 1e-9 && value === bestToday;
  };

  const prefill = (exerciseId: string) => {
    const lastToday = mine.filter((s) => s.exerciseId === exerciseId).at(-1);
    if (lastToday)
      return {
        weight: lastToday.weightKg,
        reps: lastToday.reps,
        rir: lastToday.rir ?? null,
      };
    const perf = lastPerformance(exerciseId, workouts, sets, workout.id);
    return perf ? { weight: perf.weightKg, reps: perf.reps, rir: null } : { weight: null, reps: null, rir: null };
  };

  const addSet = async (exerciseId: string, weightKg: number, reps: number, rir: number | null) => {
    unlockAudio();
    const saved = await repos.sets.add({
      workoutId: workout.id,
      exerciseId,
      position: (mine.at(-1)?.position ?? -1) + 1,
      weightKg,
      reps,
      rir,
    });
    setStamped(saved.id);
    setSheet({ kind: 'none' });
    if (!ended) timer.start(exerciseId, restFor(exerciseId, targets, exerciseOf(exerciseId)?.restSec ?? itemOf(exerciseId)?.rest));
  };

  const setOrder = (ids: string[]) => repos.workouts.update(workout.id, { exerciseIds: ids });

  const removeExercise = async (exerciseId: string) => {
    for (const s of mine.filter((x) => x.exerciseId === exerciseId)) await repos.sets.remove(s.id);
    const notes = { ...(workout.exerciseNotes ?? {}) };
    delete notes[exerciseId];
    await repos.workouts.update(workout.id, {
      exerciseIds: order.filter((x) => x !== exerciseId),
      exerciseNotes: notes,
    });
    if (timer.state?.exerciseId === exerciseId) timer.stop();
    setSheet({ kind: 'none' });
    toast.show(`${nameOf(exerciseId)} retiré de la séance`);
  };

  const finish = async () => {
    await repos.workouts.update(workout.id, { endedAt: nowIso() });
    timer.stop();
    toast.show(`Séance terminée : ${stats.setCount} série${stats.setCount > 1 ? 's' : ''}, ${formatNumber(stats.volumeKg, 0)} kg`);
    navigate('/training', { viewTransition: true });
  };

  const removeWorkout = async () => {
    for (const s of mine) await repos.sets.remove(s.id);
    await repos.workouts.remove(workout.id);
    timer.stop();
    toast.show('Séance supprimée');
    navigate('/training', { replace: true });
  };

  const sheetExercise = sheet.kind === 'add' || sheet.kind === 'menu' || sheet.kind === 'info' ? sheet.exerciseId : sheet.kind === 'edit' ? sheet.set.exerciseId : null;
  const sheetTitle = sheet.kind === 'exercise' ? 'Ajouter un exercice' : sheetExercise ? nameOf(sheetExercise) : '';

  return (
    <Screen withTabBar={false}>
      <BackLink />
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[44px] leading-none">{workout.name}</h1>
        <p className="text-[15px] text-cendre">
          {formatDayShort(workout.date)}, {ended ? 'terminée' : minutes < 1 ? 'commencée à l’instant' : `en cours depuis ${minutes} min`}
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

      {workout.adjustment && (
        <div className="flex flex-col gap-2 rounded-[18px] border-l-2 border-brume bg-anthracite p-3.5">
          <p className="text-[15px] leading-snug">Version allégée acceptée dans PULSE : {describeAdjustment(workout.adjustment) ?? 'objectifs prévus'}, pas de record visé.</p>
          {!ended && (
            <button
              type="button"
              className="self-start py-1 text-[13px] text-cendre underline underline-offset-2"
              onClick={() => {
                void (async () => {
                  const today = toLocalDateKey(new Date());
                  const res = workout.date === today ? await revertChoice(workout.date, today) : { ok: false };
                  if (!res.ok) await repos.workouts.update(workout.id, { adjustment: null });
                  toast.show('Séance prévue rétablie');
                })();
              }}
            >
              Revenir à la séance prévue
            </button>
          )}
        </div>
      )}

      {order.length === 0 && <p className="text-[15px] text-cendre">Ajoute un premier exercice pour commencer.</p>}

      {order.map((exerciseId) => {
        const list = mine.filter((s) => s.exerciseId === exerciseId);
        const perf = lastPerformance(exerciseId, workouts, sets, workout.id);
        const target = targetOf(exerciseId);
        const item = itemOf(exerciseId);
        const suggestion = ended ? null : suggestionFor(exerciseId);
        const note = workout.exerciseNotes?.[exerciseId];
        const isNext = next?.exerciseId === exerciseId;
        const targetLine = target
          ? [
              `${target.sets} × ${target.reps || 'libre'}`,
              target.rir !== null && target.rir !== undefined ? `RIR ${target.rir}` : null,
              target.restSec ? `repos ${formatRest(target.restSec)}` : null,
            ]
              .filter(Boolean)
              .join(', ')
          : null;
        return (
          <section
            key={exerciseId}
            aria-label={nameOf(exerciseId)}
            className={`flex flex-col gap-2 rounded-[22px] bg-anthracite p-4 ${isNext ? 'outline-2 outline-citron/60' : ''}`}
          >
            <div className="flex items-start gap-3">
              {item && (
                <button type="button" aria-label={`Technique : ${nameOf(exerciseId)}`} onClick={() => setSheet({ kind: 'info', exerciseId })} className="shrink-0">
                  <ExerciseThumb item={item} size={44} />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] leading-tight font-semibold">{nameOf(exerciseId)}</h2>
                {targetLine && <p className="text-[13px] text-cendre">{targetLine}</p>}
              </div>
              <IconButton icon="dots" label={`Options : ${nameOf(exerciseId)}`} onClick={() => setSheet({ kind: 'menu', exerciseId })} />
            </div>
            <p className="text-[13px] text-cendre">
              {perf ? (
                <>
                  À battre :{' '}
                  <span className="font-semibold text-craie">
                    {kgText(perf.weightKg)} kg × {perf.reps}
                  </span>
                  , {formatDayShort(perf.date).toLocaleLowerCase('fr-FR')}
                </>
              ) : (
                'Première fois : pas de performance à battre.'
              )}
            </p>
            {suggestion && (
              <p className="text-[13px] text-cendre">
                Objectif proposé :{' '}
                <span className="font-semibold text-citron">
                  {kgText(suggestion.weightKg)} kg × {suggestion.reps}
                </span>{' '}
                sur chaque série
              </p>
            )}
            {note && (
              <button
                type="button"
                onClick={() => setSheet({ kind: 'menu', exerciseId })}
                className="flex gap-2 rounded-[12px] bg-graphite/60 px-3 py-2 text-left text-[14px] leading-snug"
              >
                <Icon name="note" size={16} className="mt-0.5 shrink-0 text-cendre" />
                {note}
              </button>
            )}
            {list.length > 0 && (
              <ol className="flex flex-col">
                {list.map((s, i) => (
                  <li key={s.id} className={`rounded-[10px] ${stamped === s.id ? 'animate-frappe' : ''}`}>
                    <button type="button" onClick={() => setSheet({ kind: 'edit', set: s })} className="flex min-h-11 w-full items-center gap-3 px-1 text-left">
                      <span className="w-6 text-[13px] text-cendre tabular-nums">{i + 1}</span>
                      <span className="font-metal flex-1 text-[24px]">
                        {kgText(s.weightKg)} <span className="font-sans text-[13px] font-normal text-cendre">kg</span> × {s.reps}
                      </span>
                      {s.rir !== null && s.rir !== undefined && <span className="text-[13px] text-cendre">RIR {s.rir === 5 ? '5+' : s.rir}</span>}
                      {isRecord(s) && (
                        <span className="flex items-center gap-1 rounded-full bg-citron px-2 py-0.5 text-[12px] font-semibold text-noir shadow-[0_0_10px_color-mix(in_oklab,var(--forge-accent)_40%,transparent)]">
                          <Icon name="trophy" size={13} strokeWidth={2.2} />
                          Record
                        </span>
                      )}
                    </button>
                  </li>
                ))}
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

      <WorkoutNote workout={workout} />

      {!ended && next && (
        <Button variant="secondary" onClick={() => void finish()} disabled={stats.setCount === 0}>
          Terminer la séance maintenant
        </Button>
      )}
      {ended && <p className="text-center text-[13px] text-cendre">Séance terminée : tu peux encore corriger une série en la touchant.</p>}
      {ended && <TrainingMindLinks only="apres" />}

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

      {!ended && (
        <>
          <div aria-hidden="true" className={timer.state ? 'h-[150px]' : 'h-[76px]'} />
          <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-graphite bg-noir/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2.5 px-5 pt-3 pb-2">
              {timer.state && <RestBar timer={timer} label={nameOf(timer.state.exerciseId)} />}
              {next ? (
                <Button onClick={() => setSheet({ kind: 'add', exerciseId: next.exerciseId })}>
                  <span className="truncate">
                    Série {next.setNumber}
                    {next.plannedSets ? ` sur ${next.plannedSets}` : ''} : {nameOf(next.exerciseId)}
                  </span>
                </Button>
              ) : order.length === 0 ? (
                <Button onClick={() => setSheet({ kind: 'exercise' })}>Ajouter un exercice</Button>
              ) : (
                <Button onClick={() => void finish()} disabled={stats.setCount === 0}>
                  Terminer la séance
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      <Sheet open={sheet.kind !== 'none'} title={sheetTitle} onClose={() => setSheet({ kind: 'none' })}>
        {sheet.kind === 'add' && (
          <SetForm
            key={`add-${sheet.exerciseId}-${mine.length}`}
            initialWeight={prefill(sheet.exerciseId).weight}
            initialReps={prefill(sheet.exerciseId).reps}
            initialRir={prefill(sheet.exerciseId).rir}
            suggestion={ended ? null : suggestionFor(sheet.exerciseId)}
            targetRir={targetOf(sheet.exerciseId)?.rir ?? null}
            editing={false}
            onSave={(w, r, rir) => addSet(sheet.exerciseId, w, r, rir)}
          />
        )}
        {sheet.kind === 'edit' && (
          <SetForm
            key={`edit-${sheet.set.id}`}
            initialWeight={sheet.set.weightKg}
            initialReps={sheet.set.reps}
            initialRir={sheet.set.rir ?? null}
            targetRir={targetOf(sheet.set.exerciseId)?.rir ?? null}
            editing
            onSave={async (w, r, rir) => {
              await repos.sets.update(sheet.set.id, {
                weightKg: w,
                reps: r,
                rir,
              });
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
            exclude={order}
            onPick={async (exercise) => {
              await setOrder([...order, exercise.id]);
              setSheet({ kind: 'add', exerciseId: exercise.id });
            }}
          />
        )}
        {sheet.kind === 'menu' && (
          <ExerciseMenu
            key={sheet.exerciseId}
            workout={workout}
            exerciseId={sheet.exerciseId}
            index={order.indexOf(sheet.exerciseId)}
            count={order.length}
            setCount={mine.filter((s) => s.exerciseId === sheet.exerciseId).length}
            onMove={async (delta) => {
              await setOrder(moveItem(order, order.indexOf(sheet.exerciseId), delta));
            }}
            onInfo={itemOf(sheet.exerciseId)?.cues.length || itemOf(sheet.exerciseId)?.images ? () => setSheet({ kind: 'info', exerciseId: sheet.exerciseId }) : null}
            onRemove={() => removeExercise(sheet.exerciseId)}
            onDone={() => setSheet({ kind: 'none' })}
          />
        )}
        {sheet.kind === 'info' && <ExerciseInfo item={itemOf(sheet.exerciseId)} />}
      </Sheet>
    </Screen>
  );
}

function RestBar({ timer, label }: { timer: ReturnType<typeof useRestTimer>; label: string }) {
  const total = timer.state?.totalSec ?? 1;
  const shown = Math.min(timer.remaining, total);
  const progress = 1 - shown / total;
  return (
    <div role="timer" aria-label={timer.done ? 'Repos terminé' : `Repos après ${label} : ${formatClock(shown)} restantes`} className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Icon name="timer" size={20} className={timer.done ? 'text-citron' : 'text-cendre'} />
        <div className="min-w-0 flex-1">
          <p className={`font-metal text-[30px] leading-none tabular-nums ${timer.done ? 'text-citron' : ''}`}>{timer.done ? 'C’est reparti' : formatClock(shown)}</p>
          <p className="truncate text-[12px] text-cendre">{timer.done ? 'Repos terminé' : 'Repos'}</p>
        </div>
        {!timer.done && (
          <>
            <button type="button" onClick={() => timer.adjust(-15)} aria-label="Retirer 15 secondes" className="h-11 rounded-full bg-graphite px-3 text-[15px] font-semibold">
              −15 s
            </button>
            <button type="button" onClick={() => timer.adjust(15)} aria-label="Ajouter 15 secondes" className="h-11 rounded-full bg-graphite px-3 text-[15px] font-semibold">
              +15 s
            </button>
          </>
        )}
        <button type="button" onClick={timer.stop} className="h-11 rounded-full px-2 text-[15px] text-cendre">
          {timer.done ? 'OK' : 'Passer'}
        </button>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
        <div className="h-full rounded-full bg-citron transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

function ExerciseMenu({
  workout,
  exerciseId,
  index,
  count,
  setCount,
  onMove,
  onInfo,
  onRemove,
  onDone,
}: {
  workout: Workout;
  exerciseId: string;
  index: number;
  count: number;
  setCount: number;
  onMove: (delta: -1 | 1) => Promise<void>;
  onInfo: (() => void) | null;
  onRemove: () => Promise<void>;
  onDone: () => void;
}) {
  const [note, setNote] = useState(workout.exerciseNotes?.[exerciseId] ?? '');
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();
  const saveNote = async () => {
    const notes = { ...(workout.exerciseNotes ?? {}) };
    if (note.trim()) notes[exerciseId] = note.trim();
    else delete notes[exerciseId];
    await repos.workouts.update(workout.id, { exerciseNotes: notes });
    toast.show(note.trim() ? 'Note enregistrée' : 'Note effacée');
    onDone();
  };
  return (
    <div className="flex flex-col gap-3 pb-1">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={index <= 0} onClick={() => void onMove(-1)}>
          <Icon name="up" size={18} />
          Monter
        </Button>
        <Button variant="secondary" disabled={index >= count - 1} onClick={() => void onMove(1)}>
          <Icon name="down" size={18} />
          Descendre
        </Button>
      </div>
      {onInfo && (
        <Button variant="secondary" onClick={onInfo}>
          <Icon name="info" size={18} />
          Technique et consignes
        </Button>
      )}
      <TextArea label="Note sur cet exercice" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder="Ex. réglage du siège : cran 4" />
      <Button onClick={() => void saveNote()}>Enregistrer la note</Button>
      {confirm ? (
        <Button variant="danger" onClick={() => void onRemove()}>
          {setCount ? `Confirmer : retirer l’exercice et ses ${setCount} série${setCount > 1 ? 's' : ''}` : 'Confirmer : retirer l’exercice'}
        </Button>
      ) : (
        <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirm(true)}>
          Retirer de la séance
        </Button>
      )}
    </div>
  );
}

function ExerciseInfo({ item }: { item: CatalogItem | undefined }) {
  if (!item) return <p className="pb-4 text-[15px] text-cendre">Pas de fiche pour cet exercice.</p>;
  return (
    <div className="flex flex-col gap-3 pb-3">
      {item.images && <ExerciseDemo images={item.images} name={item.name} />}
      {item.cues.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {item.cues.map((c) => (
            <li key={c} className="flex gap-2.5 text-[15px] leading-snug">
              <Icon name="check" size={16} strokeWidth={2.6} className="mt-0.5 shrink-0 text-citron" />
              {c}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-cendre">Pas de consigne enregistrée pour cet exercice.</p>
      )}
      <Link to={`/training/exercices/${item.key}`} viewTransition className="flex min-h-11 items-center gap-1 text-[15px] text-citron">
        Records et progression
        <Icon name="chevron" size={16} />
      </Link>
    </div>
  );
}

function WorkoutNote({ workout }: { workout: Workout }) {
  const [text, setText] = useState(workout.note ?? '');
  const [saved, setSaved] = useState(false);
  const dirty = text.trim() !== (workout.note ?? '').trim();
  const save = async () => {
    if (!dirty) return;
    await repos.workouts.update(workout.id, { note: text.trim() });
    setSaved(true);
  };
  return (
    <TextArea
      label="Note de séance"
      hint={dirty ? 'enregistrée quand tu quittes le champ' : saved ? 'enregistrée' : undefined}
      value={text}
      onChange={(e) => {
        setSaved(false);
        setText(e.target.value);
      }}
      onBlur={() => void save()}
      maxLength={2000}
      rows={2}
      placeholder="Forme du jour, sensations, douleurs…"
    />
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
