import { useEffect, useRef, useState } from 'react';

/**
 * FORGE MOTION côté code : mêmes durées que design/tokens.css (--forge-duration-*).
 * Une animation confirme, guide ou montre un changement ; elle ne change jamais une donnée affichée.
 */
export const MOTION = { press: 110, fast: 180, base: 260, slow: 420, fill: 700, draw: 800, stagger: 40 } as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Suit la préférence « réduire les animations » de l'iPhone, y compris si elle change en cours d'usage. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduce(q.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, []);
  return reduce;
}

/**
 * Sens du dernier changement d'une valeur affichée : 'up', 'down', ou null au premier affichage.
 * La valeur affichée est toujours la vraie : seul son arrivée est animée (pas de compteur qui défile).
 */
export function useChangeDirection(value: number | null | undefined): { direction: 'up' | 'down' | null; key: number } {
  const previous = useRef(value);
  const [state, setState] = useState<{ direction: 'up' | 'down' | null; key: number }>({ direction: null, key: 0 });
  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (before === value || before === null || before === undefined || value === null || value === undefined) return;
    setState((s) => ({ direction: value > before ? 'up' : 'down', key: s.key + 1 }));
  }, [value]);
  return state;
}

/** Sens d'une navigation entre deux onglets, pour la transition (glissement vers la gauche ou la droite). */
export function markNavDirection(from: number, to: number): void {
  if (from < 0 || to < 0 || from === to) return;
  const root = document.documentElement;
  root.dataset.nav = to > from ? 'forward' : 'backward';
  window.setTimeout(() => {
    if (root.dataset.nav) delete root.dataset.nav;
  }, MOTION.slow + 100);
}
