import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { MIND_EXERCISE_BY_ID, MIND_EXERCISES } from '../../data/mindExercises';
import { repos } from '../../db/hooks';
import {
  chosenMinutes,
  DEFAULT_ROUTINES,
  exerciseSeconds,
  FAMILY_LABELS,
  FAMILY_ORDER,
  formatDuration,
  ROUTINE_ORDER,
  ROUTINES_KEY,
  type RoutineId,
  type RoutineStep,
} from '../../domain/mind';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { Stepper } from '../../ui/Stepper';
import { useToast } from '../../ui/Toast';
import { MindBack, useRoutines } from './mindShared';

const MAX_STEPS = 6;

/** Personnalisation d'une routine : exercices, ordre, durées. */
export function RoutineEditor() {
  const { id = '' } = useParams();
  const routineId = (ROUTINE_ORDER as string[]).includes(id) ? (id as RoutineId) : null;
  const { routines, stored, loaded } = useRoutines();
  if (!routineId)
    return (
      <Screen withTabBar={false}>
        <MindBack />
      </Screen>
    );
  if (!loaded)
    return (
      <Screen withTabBar={false}>
        <MindBack to={`/mind/routine/${routineId}`} label="Routine" />
      </Screen>
    );
  return <Editor key={routineId} routineId={routineId} initial={routines[routineId].steps} stored={stored} />;
}

function Editor({ routineId, initial, stored }: { routineId: RoutineId; initial: RoutineStep[]; stored: Partial<Record<RoutineId, RoutineStep[]>> | null }) {
  const [steps, setSteps] = useState<RoutineStep[]>(initial);
  const [picking, setPicking] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const routine = DEFAULT_ROUTINES[routineId];
  const total = steps.reduce((a, st) => a + exerciseSeconds(MIND_EXERCISE_BY_ID.get(st.exerciseId)!, st.minutes), 0);

  const move = (i: number, d: -1 | 1) =>
    setSteps((list) => {
      const next = [...list];
      const [it] = next.splice(i, 1);
      next.splice(i + d, 0, it!);
      return next;
    });

  const save = async (next: RoutineStep[] | null) => {
    const all = { ...(stored ?? {}) };
    if (next) all[routineId] = next;
    else delete all[routineId];
    await repos.meta.set(ROUTINES_KEY, all);
    toast.show(next ? 'Routine enregistrée' : 'Routine d’origine rétablie');
    void navigate(`/mind/routine/${routineId}`, { replace: true, viewTransition: true });
  };

  return (
    <Screen withTabBar={false}>
      <MindBack to={`/mind/routine/${routineId}`} label="Routine" />
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[32px] leading-none">{routine.title}</h1>
        <p className="text-[15px] text-cendre">
          {steps.length} exercice{steps.length > 1 ? 's' : ''}, {formatDuration(total)}
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((st, i) => {
          const ex = MIND_EXERCISE_BY_ID.get(st.exerciseId)!;
          return (
            <li key={`${st.exerciseId}-${i}`} className="flex flex-col gap-3 rounded-[18px] bg-anthracite p-3.5">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-[17px]">
                    {i + 1}. {ex.title}
                  </span>
                  <span className="block text-[13px] text-cendre">
                    {FAMILY_LABELS[ex.family]}, {formatDuration(exerciseSeconds(ex, st.minutes))}
                  </span>
                </span>
                <span className="flex shrink-0">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={`Monter ${ex.title}`}
                    className="flex h-11 w-10 items-center justify-center text-cendre disabled:opacity-30"
                  >
                    <Icon name="up" size={18} />
                  </button>
                  <button
                    type="button"
                    disabled={i === steps.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`Descendre ${ex.title}`}
                    className="flex h-11 w-10 items-center justify-center text-cendre disabled:opacity-30"
                  >
                    <Icon name="down" size={18} />
                  </button>
                  <button
                    type="button"
                    disabled={steps.length === 1}
                    onClick={() => setSteps((list) => list.filter((_, j) => j !== i))}
                    aria-label={`Retirer ${ex.title}`}
                    className="flex h-11 w-10 items-center justify-center text-cendre disabled:opacity-30"
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </span>
              </div>
              {ex.range && (
                <Stepper
                  label="Durée"
                  value={chosenMinutes(ex, st.minutes)}
                  step={1}
                  min={ex.range[0]}
                  max={ex.range[1]}
                  start={ex.minutes}
                  format={(v) => `${v} min`}
                  onChange={(v) => setSteps((list) => list.map((x, j) => (j === i ? { ...x, minutes: v } : x)))}
                />
              )}
            </li>
          );
        })}
      </ol>
      {steps.length < MAX_STEPS && (
        <Button variant="secondary" onClick={() => setPicking(true)}>
          <Icon name="plus" size={18} />
          Ajouter un exercice
        </Button>
      )}
      <Button variant="calm" onClick={() => void save(steps)}>
        Enregistrer la routine
      </Button>
      {stored?.[routineId] && (
        <Button variant="quiet" className="self-center" onClick={() => void save(null)}>
          Revenir à la routine d’origine
        </Button>
      )}
      <Sheet open={picking} title="Ajouter un exercice" onClose={() => setPicking(false)}>
        {picking && (
          <div className="flex flex-col gap-4 pb-1">
            {FAMILY_ORDER.map((f) => (
              <section key={f} aria-label={FAMILY_LABELS[f]}>
                <h3 className="mb-1 text-[13px] text-cendre">{FAMILY_LABELS[f]}</h3>
                <ul>
                  {MIND_EXERCISES.filter((e) => e.family === f).map((e) => (
                    <li key={e.id} className="border-b border-graphite last:border-b-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSteps((list) => [...list, { exerciseId: e.id }]);
                          setPicking(false);
                        }}
                        className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left text-[15px]"
                      >
                        <span>
                          {e.title} <span className="text-cendre">{formatDuration(exerciseSeconds(e))}</span>
                        </span>
                        <Icon name="plus" size={18} className="shrink-0 text-brume" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
