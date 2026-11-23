import { useEffect, useMemo, useRef, useState } from 'react';
import type { MindExercise } from '../../data/mindExercises';
import { exerciseSeconds, positionIn } from '../../domain/mind';
import { chime } from '../../services/beep';
import { Icon } from '../../ui/Icon';

export interface PlayerProps {
  exercise: MindExercise;
  minutes: number;
  elapsed: number;
  running: boolean;
  sound: boolean;
  onSeek: (seconds: number) => void;
  /** Fin de l'exercice ; summary : ce que l'exercice a mesuré (décrochages, distractions). */
  onComplete: (summary?: string) => void;
}

const clock = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Appelle onComplete une seule fois quand `done` passe à vrai. */
function useCompleteOnce(done: boolean, onComplete: (summary?: string) => void, summary?: string) {
  const fired = useRef(false);
  useEffect(() => {
    if (done && !fired.current) {
      fired.current = true;
      onComplete(summary);
    }
  }, [done, onComplete, summary]);
}

/** Joue un repère sonore à chaque changement de `key` pendant que l'exercice tourne. */
function useCue(key: string, kind: Parameters<typeof chime>[0], running: boolean, sound: boolean) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current !== null && last.current !== key && running && sound) chime(kind);
    last.current = key;
  }, [key, kind, running, sound]);
}

export function ExercisePlayer(props: PlayerProps) {
  switch (props.exercise.player.kind) {
    case 'breath':
      return <BreathPlayer {...props} />;
    case 'steps':
      return <StepsPlayer {...props} />;
    case 'grounding':
      return <GroundingPlayer {...props} />;
    case 'focus':
      return <FocusPlayer {...props} />;
  }
}

const MIN_SCALE = 0.42;
const ease = (p: number) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, p))) / 2;

function BreathPlayer({ exercise, minutes, elapsed, running, sound, onComplete }: PlayerProps) {
  const player = exercise.player as Extract<MindExercise['player'], { kind: 'breath' }>;
  const durations = useMemo(() => player.phases.map((p) => p.seconds), [player]);
  const total = exerciseSeconds(exercise, minutes);
  const pos = positionIn(durations, elapsed, total);
  const phase = player.phases[pos.index]!;
  const cycles = Math.round(total / durations.reduce((a, b) => a + b, 0));
  useCue(`${pos.cycle}-${pos.index}`, phase.motion, running, sound);
  useCompleteOnce(pos.done, onComplete);

  const progress = 1 - pos.remaining / phase.seconds;
  const previous = player.phases[(pos.index - 1 + player.phases.length) % player.phases.length]!;
  const held = previous.motion === 'in' ? 1 : MIN_SCALE;
  const scale = phase.motion === 'in' ? MIN_SCALE + (1 - MIN_SCALE) * ease(progress) : phase.motion === 'out' ? 1 - (1 - MIN_SCALE) * ease(progress) : held;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <div className="relative flex h-[280px] w-[280px] items-center justify-center" aria-hidden="true">
        <div className="absolute inset-0 rounded-full border border-brume/25" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgb(174_188_245/0.55),rgb(174_188_245/0.12)_70%)]" style={{ transform: `scale(${scale})` }} />
        <div className="absolute inset-0 rounded-full" style={{ transform: `scale(${MIN_SCALE})`, border: '1px dashed rgb(174 188 245 / 0.35)' }} />
      </div>
      <div className="flex flex-col items-center gap-1 text-center" aria-live="polite">
        <p className="font-metal text-[44px] leading-none">{phase.label}</p>
        <p className="text-[17px] text-cendre tabular-nums">{Math.ceil(pos.remaining)}</p>
        {phase.hint && <p className="max-w-[300px] text-[15px] text-cendre">{phase.hint}</p>}
      </div>
      <p className="text-[13px] text-cendre tabular-nums">
        Cycle {Math.min(pos.cycle + 1, cycles)} sur {cycles}, reste {clock(total - elapsed)}
      </p>
    </div>
  );
}

function StepsPlayer({ exercise, elapsed, running, sound, onSeek, onComplete }: PlayerProps) {
  const steps = (exercise.player as Extract<MindExercise['player'], { kind: 'steps' }>).steps;
  const durations = useMemo(() => steps.map((s) => s.seconds), [steps]);
  const total = durations.reduce((a, b) => a + b, 0);
  const pos = positionIn(durations, elapsed, total);
  const step = steps[pos.index]!;
  const startOf = (i: number) => durations.slice(0, i).reduce((a, b) => a + b, 0);
  useCue(String(pos.index), step.cue === 'tension' ? 'hold' : 'step', running, sound);
  useCompleteOnce(pos.done, onComplete);
  const stepProgress = 1 - pos.remaining / step.seconds;

  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <div className="flex items-center justify-between text-[13px] text-cendre">
        <span>
          Étape {pos.index + 1} sur {steps.length}
        </span>
        <span className="tabular-nums">reste {clock(total - elapsed)}</span>
      </div>
      {step.cue && <p className={`text-[15px] font-semibold ${step.cue === 'tension' ? 'text-craie' : 'text-brume'}`}>{step.cue === 'tension' ? 'Contracte' : 'Relâche'}</p>}
      <p key={pos.index} className="animate-fade-in min-h-[180px] text-[24px] leading-snug" aria-live="polite">
        {step.text}
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
        <div className="h-full rounded-full bg-brume" style={{ width: `${Math.round(stepProgress * 100)}%` }} />
      </div>
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => onSeek(startOf(Math.max(0, pos.index - (stepProgress < 0.15 ? 1 : 0))))}
          className="flex min-h-11 items-center gap-1 px-1 text-[15px] text-cendre"
        >
          <Icon name="back" size={18} />
          Reprendre l’étape
        </button>
        <button type="button" onClick={() => onSeek(startOf(pos.index + 1))} className="flex min-h-11 items-center gap-1 px-1 text-[15px] text-cendre">
          {pos.index + 1 < steps.length ? 'Étape suivante' : 'Terminer'}
          <Icon name="chevron" size={18} />
        </button>
      </div>
    </div>
  );
}

function GroundingPlayer({ exercise, running, sound, onComplete }: PlayerProps) {
  const stages = (exercise.player as Extract<MindExercise['player'], { kind: 'grounding' }>).stages;
  const [stage, setStage] = useState(0);
  const [found, setFound] = useState(0);
  const current = stages[Math.min(stage, stages.length - 1)]!;
  const done = stage >= stages.length;
  useCompleteOnce(done, onComplete);

  useEffect(() => {
    if (found < current.count || done) return;
    const t = window.setTimeout(() => {
      if (sound) chime(stage + 1 >= stages.length ? 'end' : 'step');
      setStage((s) => s + 1);
      setFound(0);
    }, 700);
    return () => window.clearTimeout(t);
  }, [found, current.count, done, sound, stage, stages.length]);

  return (
    <div className="flex flex-1 flex-col justify-center gap-7">
      <p className="text-[13px] text-cendre">
        Étape {Math.min(stage + 1, stages.length)} sur {stages.length}
      </p>
      <p key={stage} className="animate-fade-in font-metal text-[34px] leading-tight">
        {current.count} {current.prompt}
      </p>
      <p className="text-[17px] leading-snug text-cendre">{current.hint}</p>
      <div className="flex flex-wrap gap-3" role="group" aria-label="Éléments trouvés">
        {Array.from({ length: current.count }, (_, i) => (
          <button
            key={`${stage}-${i}`}
            type="button"
            disabled={!running || i !== found}
            onClick={() => setFound((f) => f + 1)}
            aria-label={i < found ? `Élément ${i + 1} trouvé` : `Marquer l’élément ${i + 1}`}
            className={`flex h-14 w-14 items-center justify-center rounded-full border text-[17px] transition-colors ${
              i < found ? 'border-brume bg-brume text-noir' : i === found ? 'border-brume text-brume' : 'border-graphite text-cendre'
            }`}
          >
            {i < found ? <Icon name="check" size={22} strokeWidth={2.4} /> : i + 1}
          </button>
        ))}
      </div>
      <p className="text-[13px] text-cendre">Touche un rond à chaque élément trouvé, à ton rythme.</p>
    </div>
  );
}

function FocusPlayer({ exercise, minutes, elapsed, running, onComplete }: PlayerProps) {
  const player = exercise.player as Extract<MindExercise['player'], { kind: 'focus' }>;
  const total = exerciseSeconds(exercise, minutes);
  const [count, setCount] = useState(0);
  const [returns, setReturns] = useState(0);
  const [labels, setLabels] = useState<Record<string, number>>({});
  const done = elapsed >= total;
  const summary =
    player.mode === 'count'
      ? returns === 0
        ? 'Aucun décrochage noté.'
        : `${returns} retour${returns > 1 ? 's' : ''} au souffle : autant de répétitions de l’attention.`
      : Object.keys(labels).length === 0
        ? 'Aucune distraction notée.'
        : `Distractions notées : ${Object.entries(labels)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k.toLocaleLowerCase('fr-FR')} ${v}`)
            .join(', ')}.`;
  useCompleteOnce(done, onComplete, summary);

  return (
    <div className="flex flex-1 flex-col justify-center gap-7">
      <p className="text-center text-[13px] text-cendre tabular-nums">reste {clock(total - elapsed)}</p>
      {player.mode === 'count' ? (
        <>
          <button
            type="button"
            disabled={!running}
            onClick={() => setCount((c) => (c % 10) + 1)}
            className="mx-auto flex h-[220px] w-[220px] flex-col items-center justify-center rounded-full border border-brume/40 bg-brume/10 active:scale-[0.98]"
          >
            <span className="font-metal text-[72px] leading-none tabular-nums" aria-live="polite">
              {count}
            </span>
            <span className="text-[15px] text-cendre">Touche à chaque expiration</span>
          </button>
          <button
            type="button"
            disabled={!running}
            onClick={() => {
              setCount(0);
              setReturns((r) => r + 1);
            }}
            className="mx-auto min-h-11 rounded-full border border-graphite px-5 text-[15px]"
          >
            J’ai décroché
          </button>
          <p className="text-center text-[13px] text-cendre">Décrochages remarqués : {returns}</p>
        </>
      ) : (
        <>
          <p className="text-center text-[17px] leading-snug">Reste sur ton souffle. Quand ton attention part, touche ce qui l’a attirée.</p>
          <div className="grid grid-cols-2 gap-3">
            {(player.labels ?? []).map((l) => (
              <button
                key={l}
                type="button"
                disabled={!running}
                onClick={() => setLabels((m) => ({ ...m, [l]: (m[l] ?? 0) + 1 }))}
                className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-[18px] bg-anthracite active:scale-[0.98]"
              >
                <span className="text-[17px] font-semibold">{l}</span>
                <span className="text-[13px] text-cendre tabular-nums">{labels[l] ?? 0}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
