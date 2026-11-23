import { useCallback, useEffect, useState } from 'react';
import { remainingSec } from '../../domain/workoutFlow';
import { beep } from '../../services/beep';

const KEY = 'forge.restTimer';

export interface RestTimerState {
  workoutId: string;
  exerciseId: string;
  endsAt: number;
  totalSec: number;
  alerted: boolean;
}

function read(): RestTimerState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RestTimerState) : null;
  } catch {
    return null;
  }
}

function write(state: RestTimerState | null) {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : le minuteur vit seulement en mémoire */
  }
}

/**
 * Minuteur de repos : l'heure de fin est enregistrée, il survit à un rechargement ou au passage en arrière-plan.
 * Un signal sonore part à la fin (une seule fois).
 */
export function useRestTimer(workoutId: string) {
  const [state, setState] = useState<RestTimerState | null>(() => {
    const saved = read();
    return saved?.workoutId === workoutId ? saved : null;
  });
  const [now, setNow] = useState(() => Date.now());

  const update = useCallback((next: RestTimerState | null) => {
    write(next);
    setState(next);
  }, []);

  useEffect(() => {
    if (!state) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [state]);

  const remaining = state ? remainingSec(state.endsAt, now) : 0;

  useEffect(() => {
    if (!state || state.alerted || remaining > 0) return;
    const late = now - state.endsAt > 10_000;
    if (!late) beep();
    update({ ...state, alerted: true });
  }, [state, remaining, now, update]);

  // Écran « repos terminé » effacé au bout d'une minute.
  useEffect(() => {
    if (state && state.alerted && now - state.endsAt > 60_000) update(null);
  }, [state, now, update]);

  return {
    state,
    remaining,
    done: Boolean(state && remaining === 0),
    start: (exerciseId: string, totalSec: number) => {
      const t = Date.now();
      setNow(t);
      update({
        workoutId,
        exerciseId,
        endsAt: t + totalSec * 1000,
        totalSec,
        alerted: false,
      });
    },
    adjust: (deltaSec: number) => {
      if (!state) return;
      const t = Date.now();
      setNow(t);
      const endsAt = Math.max(t, state.endsAt + deltaSec * 1000);
      update({
        ...state,
        endsAt,
        totalSec: Math.max(1, state.totalSec + deltaSec),
        alerted: endsAt <= t ? state.alerted : false,
      });
    },
    stop: () => update(null),
  };
}
