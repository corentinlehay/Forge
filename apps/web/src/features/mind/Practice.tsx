import { useCallback, useEffect, useRef, useState } from 'react';
import type { MindExercise } from '../../data/mindExercises';
import { repos } from '../../db/hooks';
import type { MindSession, Scale5 } from '../../db/types';
import { formatDuration } from '../../domain/mind';
import { toLocalDateKey } from '../../lib/dates';
import { chime, unlockAudio } from '../../services/beep';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { ScaleChips } from '../../ui/ScaleChips';
import { useWakeLock } from '../training/useWakeLock';
import { ExercisePlayer } from './Players';
import { useClock } from './useClock';

export interface PracticeItem {
  exercise: MindExercise;
  minutes: number;
}

interface PracticeProps {
  kind: MindSession['kind'];
  refId: string;
  title: string;
  items: PracticeItem[];
  tensionBefore: Scale5 | null;
  sound: boolean;
  onClose: () => void;
}

/** Une pratique arrêtée avant la fin n'est gardée qu'au-delà d'une minute. */
const MIN_SAVED_SEC = 60;
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * Déroulé plein écran d'un exercice ou d'une routine (plusieurs exercices à la suite).
 * La pratique est enregistrée dès la fin ; la tension ressentie après se renseigne ensuite.
 */
export function Practice({ kind, refId, title, items, tensionBefore, sound, onClose }: PracticeProps) {
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(true);
  const [phase, setPhase] = useState<'play' | 'end'>('play');
  const [summaries, setSummaries] = useState<string[]>([]);
  const [saved, setSaved] = useState<{ id: string; durationSec: number; completed: boolean } | null>(null);
  const [after, setAfter] = useState<Scale5 | null>(null);
  const startedAt = useRef(new Date());
  const doneSec = useRef(0);
  const { elapsed, seek } = useClock(running && phase === 'play');
  /** Temps réellement passé sur l'exercice en cours (les sauts d'étape ne comptent pas). */
  const real = useClock(running && phase === 'play');
  useWakeLock(phase === 'play');
  const item = items[index]!;

  const save = useCallback(
    async (completed: boolean, durationSec: number) => {
      const start = startedAt.current;
      const record = await repos.mindSessions.add({
        date: toLocalDateKey(start),
        time: hhmm(start),
        kind,
        ref: refId,
        title,
        durationSec: Math.round(durationSec),
        completed,
        ...(tensionBefore ? { tensionBefore } : {}),
      });
      setSaved({ id: record.id, durationSec: Math.round(durationSec), completed });
    },
    [kind, refId, title, tensionBefore],
  );

  const onComplete = useCallback(
    (summary?: string) => {
      doneSec.current += real.elapsed;
      if (summary) setSummaries((s) => [...s, items.length > 1 ? `${item.exercise.title} : ${summary}` : summary]);
      if (index + 1 < items.length) {
        if (sound) chime('step');
        seek(0);
        real.seek(0);
        setIndex(index + 1);
        return;
      }
      if (sound) chime('end');
      setPhase('end');
      void save(true, doneSec.current);
    },
    [item, real, items.length, index, sound, seek, save],
  );

  const stop = () => {
    const total = doneSec.current + real.elapsed;
    setRunning(false);
    if (total >= MIN_SAVED_SEC) {
      setPhase('end');
      void save(false, total);
    } else onClose();
  };

  useEffect(() => {
    unlockAudio();
  }, []);

  const saveAfter = async (v: Scale5) => {
    setAfter(v);
    if (saved) await repos.mindSessions.update(saved.id, { tensionAfter: v });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[radial-gradient(ellipse_at_top,var(--color-brume-voile),var(--forge-bg)_70%)]"
      role="dialog"
      aria-label={title}
    >
      <div className="pt-safe pb-safe mx-auto flex min-h-full w-full max-w-[560px] flex-1 flex-col gap-4 px-5">
        <header className="flex min-h-14 items-center justify-between gap-3 pt-2">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{phase === 'end' ? title : item.exercise.title}</p>
            {items.length > 1 && phase === 'play' && (
              <p className="text-[12px] text-cendre">
                {title}, exercice {index + 1} sur {items.length}
              </p>
            )}
          </div>
          {phase === 'play' && (
            <button type="button" onClick={stop} className="flex min-h-11 items-center gap-1 rounded-full px-3 text-[15px] text-cendre">
              <Icon name="close" size={18} />
              Arrêter
            </button>
          )}
        </header>

        {phase === 'play' ? (
          <>
            <ExercisePlayer key={index} exercise={item.exercise} minutes={item.minutes} elapsed={elapsed} running={running} sound={sound} onSeek={seek} onComplete={onComplete} />
            <div className="flex justify-center pb-4">
              <button
                type="button"
                onClick={() => setRunning((r) => !r)}
                aria-label={running ? 'Pause' : 'Reprendre'}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-craie text-noir active:scale-95"
              >
                {running ? (
                  <span className="flex gap-1.5" aria-hidden="true">
                    <span className="h-5 w-1.5 rounded-sm bg-noir" />
                    <span className="h-5 w-1.5 rounded-sm bg-noir" />
                  </span>
                ) : (
                  <Icon name="play" size={26} />
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col justify-center gap-6 pb-6">
            <div className="flex flex-col gap-2">
              <p className="font-metal text-[44px] leading-none">{saved?.completed === false ? 'Arrêté' : 'Terminé'}</p>
              <p className="text-[17px] text-cendre">
                {saved ? `Pratique enregistrée : ${formatDuration(saved.durationSec)}${saved.completed ? '' : ', arrêtée avant la fin'}.` : 'Enregistrement…'}
              </p>
            </div>
            {summaries.length > 0 && (
              <ul className="flex flex-col gap-1.5 text-[15px] leading-snug">
                {summaries.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
            <ScaleChips tone="brume" label="Tension ressentie maintenant (facultatif)" value={after} onChange={(v) => void saveAfter(v)} low="Détendu" high="Très tendu" />
            {tensionBefore && after && (
              <p className="text-[15px]">
                Tension avant : {tensionBefore}, après : {after}.
              </p>
            )}
            <Button onClick={onClose}>Fermer</Button>
          </div>
        )}
      </div>
    </div>
  );
}
