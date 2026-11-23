import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Chronomètre d'exercice : temps écoulé en secondes (horloge murale, juste même si l'écran s'éteint),
 * avec pause, reprise et saut à une position.
 */
export function useClock(running: boolean, tickMs = 100) {
  const base = useRef(0);
  const startedAt = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    const id = window.setInterval(() => setElapsed(base.current + (Date.now() - startedAt.current!) / 1000), tickMs);
    return () => {
      base.current += (Date.now() - startedAt.current!) / 1000;
      startedAt.current = null;
      window.clearInterval(id);
    };
  }, [running, tickMs]);

  const seek = useCallback((seconds: number) => {
    base.current = Math.max(0, seconds);
    if (startedAt.current !== null) startedAt.current = Date.now();
    setElapsed(base.current);
  }, []);

  return { elapsed, seek };
}
