import { useEffect, useState, type ReactNode } from 'react';

interface RingProps {
  /** Progression de 0 à 1 (au-delà, l'anneau reste plein et passe en alerte). */
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  children?: ReactNode;
  /** Couleur au-delà de 100 % : alerte (braise) ou neutre. */
  overTone?: 'alert' | 'neutral';
}

/** Jauge circulaire, dans la couleur de l'espace affiché. Elle se remplit à l'affichage, puis suit les changements. */
export function Ring({ value, size = 112, stroke = 10, label, children, overTone = 'neutral' }: RingProps) {
  const target = Math.min(Math.max(value, 0), 1);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = value > 1.05 && overTone === 'alert' ? 'var(--forge-danger)' : 'var(--forge-module)';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--forge-surface-secondary)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          style={{ transition: 'stroke-dashoffset var(--forge-duration-fill) var(--forge-ease-enter)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
