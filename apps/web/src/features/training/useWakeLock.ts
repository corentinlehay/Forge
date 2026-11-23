import { useEffect } from 'react';

/**
 * Garde l'écran allumé pendant une séance en cours (si l'iPhone le permet).
 * Le verrou se libère tout seul quand l'app passe en arrière-plan : il est repris au retour.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
      } catch {
        lock = null;
      }
    };
    void request();
    document.addEventListener('visibilitychange', request);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', request);
      void lock?.release();
    };
  }, [active]);
}
