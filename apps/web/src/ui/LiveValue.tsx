import type { ReactNode } from 'react';
import { useChangeDirection } from '../lib/motion';

/**
 * Valeur qui « arrive » : frappée à l'apparition, puis par le haut si elle monte, par le bas si elle baisse.
 * Le texte affiché est toujours la vraie valeur : aucun compteur ne fait défiler de faux chiffres.
 */
export function LiveValue({ value, children, className = '' }: { value: number | null | undefined; children: ReactNode; className?: string }) {
  const { direction, key } = useChangeDirection(value);
  const motion = direction === 'up' ? 'motion-value-up' : direction === 'down' ? 'motion-value-down' : 'motion-pop';
  return (
    <span key={key} className={`inline-block ${motion} ${className}`}>
      {children}
    </span>
  );
}
