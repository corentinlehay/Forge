import { MUSCLE_LABELS, type MuscleGroup } from '../../data/muscles';
import type { VolumeLevel } from '../../domain/muscleVolume';
import { HEAD, MUSCLE_SHAPES, SILHOUETTE, VIEW_H, VIEW_W, type View } from './bodyShapes';

/** Paliers de couleur : du graphite (aucune série) au citron (volume élevé). */
export const LEVEL_COLORS: Record<VolumeLevel, string> = {
  0: '#3a3d44',
  1: '#697446',
  2: '#90a347',
  3: '#b7d149',
  4: '#d6f64a',
};

export const LEVEL_LABELS: Record<VolumeLevel, string> = {
  0: '0',
  1: 'moins de 5',
  2: '5 à 9',
  3: '10 à 20',
  4: 'plus de 20',
};

const mirror = `matrix(-1 0 0 1 ${VIEW_W} 0)`;

function Figure({ view, levels, selected, describe, onSelect }: { view: View; levels: Record<MuscleGroup, VolumeLevel>; selected: MuscleGroup | null; describe: (m: MuscleGroup) => string; onSelect: (m: MuscleGroup) => void }) {
  const shapes = MUSCLE_SHAPES[view];
  return (
    <figure className="m-0 flex flex-1 flex-col items-center gap-1">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block h-auto w-full max-w-[190px]" role="group" aria-label={view === 'face' ? 'Vue de face' : 'Vue de dos'}>
        <g fill="#24262b" pointerEvents="none">
          <ellipse {...HEAD} />
          {SILHOUETTE.map((d) => (
            <g key={d}>
              <path d={d} />
              <path d={d} transform={mirror} />
            </g>
          ))}
        </g>
        {(Object.keys(shapes) as MuscleGroup[]).map((m) => {
          const on = selected === m;
          return (
            <g
              key={m}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={describe(m)}
              onClick={() => onSelect(m)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(m))}
              className="cursor-pointer outline-none"
              fill={LEVEL_COLORS[levels[m]]}
              stroke={on ? 'var(--color-craie)' : 'var(--color-anthracite)'}
              strokeWidth={on ? 2 : 1.2}
              strokeLinejoin="round"
            >
              {shapes[m]!.map((d) => (
                <g key={d}>
                  <path d={d} />
                  <path d={d} transform={mirror} />
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-[12px] text-cendre">{view === 'face' ? 'Face' : 'Dos'}</figcaption>
    </figure>
  );
}

/** Corps de face et de dos ; chaque muscle se touche. */
export function BodyMap(props: { levels: Record<MuscleGroup, VolumeLevel>; selected: MuscleGroup | null; describe: (m: MuscleGroup) => string; onSelect: (m: MuscleGroup) => void }) {
  return (
    <div className="flex gap-3">
      <Figure view="face" {...props} />
      <Figure view="dos" {...props} />
    </div>
  );
}

export function LevelLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-cendre" aria-label="Légende : séries par semaine">
      <span>Séries par semaine</span>
      {([0, 1, 2, 3, 4] as VolumeLevel[]).map((l) => (
        <span key={l} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-3 rounded-[3px]" style={{ background: LEVEL_COLORS[l] }} />
          {LEVEL_LABELS[l]}
        </span>
      ))}
    </div>
  );
}

export const muscleName = (m: MuscleGroup) => MUSCLE_LABELS[m];

/** Petite version, non interactive, pour un aperçu (la carte entière est un lien). */
export function MiniBody({ levels }: { levels: Record<MuscleGroup, VolumeLevel> }) {
  return (
    <div className="flex shrink-0 gap-1" aria-hidden="true">
      {(['face', 'dos'] as View[]).map((view) => (
        <svg key={view} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width={38} height={(38 * VIEW_H) / VIEW_W}>
          <g fill="#24262b">
            <ellipse {...HEAD} />
            {SILHOUETTE.map((d) => (
              <g key={d}>
                <path d={d} />
                <path d={d} transform={mirror} />
              </g>
            ))}
          </g>
          {(Object.entries(MUSCLE_SHAPES[view]) as [MuscleGroup, string[]][]).map(([m, ds]) => (
            <g key={m} fill={LEVEL_COLORS[levels[m]]}>
              {ds.map((d) => (
                <g key={d}>
                  <path d={d} />
                  <path d={d} transform={mirror} />
                </g>
              ))}
            </g>
          ))}
        </svg>
      ))}
    </div>
  );
}
