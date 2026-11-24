import { useState } from 'react';

export interface Bar {
  key: string;
  /** Étiquette sous la barre (courte). */
  label: string;
  value: number;
  /** Détail affiché quand la barre est touchée. */
  detail: string;
}

interface BarChartProps {
  bars: Bar[];
  /** Ligne d'objectif (même unité que les valeurs). */
  target?: number | null;
  targetLabel?: string;
  height?: number;
  title: string;
  /** Couleur de la barre choisie : celle de l'espace affiché par défaut, ou une couleur imposée. */
  tone?: 'module' | 'citron' | 'brume';
}

/**
 * Barres tactiles : toucher une barre affiche son détail au-dessus du graphique.
 * Construit en HTML (boutons) pour rester lisible au lecteur d'écran.
 */
export function BarChart({ bars, target, targetLabel = 'Objectif', height = 132, title, tone = 'module' }: BarChartProps) {
  const [selected, setSelected] = useState(bars.length - 1);
  const max = Math.max(1, target ?? 0, ...bars.map((b) => b.value)) * 1.08;
  const current = bars[Math.min(selected, bars.length - 1)];

  return (
    <figure className="m-0 flex flex-col gap-2">
      <figcaption className="min-h-[20px] text-[13px]" aria-live="polite">
        {current ? current.detail : title}
      </figcaption>
      <div className="relative" style={{ height }}>
        {target ? (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-craie/40" style={{ bottom: `${(target / max) * 100}%` }}>
            <span className="absolute -top-[18px] right-0 text-[11px] text-cendre">{targetLabel}</span>
          </div>
        ) : null}
        <div className="flex h-full items-end gap-1.5">
          {bars.map((bar, i) => (
            <button
              key={bar.key}
              type="button"
              onClick={() => setSelected(i)}
              aria-pressed={i === selected}
              aria-label={bar.detail}
              className="flex h-full min-w-0 flex-1 items-end"
            >
              <span
                className={`motion-grow block w-full rounded-t-[4px] transition-[height,background-color] duration-500 ease-out ${i === selected ? (tone === 'brume' ? 'bg-brume' : tone === 'citron' ? 'bg-citron' : 'bg-module') : 'bg-cendre/35'}`}
                style={{ height: `${Math.max(bar.value > 0 ? 3 : 0, (bar.value / max) * 100)}%`, ['--i' as string]: i }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5 text-[11px] text-cendre" aria-hidden="true">
        {bars.map((bar, i) => (
          <span key={bar.key} className={`min-w-0 flex-1 overflow-visible text-center whitespace-nowrap ${i === selected ? 'text-craie' : ''}`}>
            {bar.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
