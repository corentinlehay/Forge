import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { niceScale } from '../../domain/chartScale';
import { daysBetween } from '../../lib/dates';
import { formatDayMonth, formatDayShort, formatNumber } from '../../lib/format';

export interface ChartPoint {
  date: string;
  value: number;
  /** Détail de la séance, affiché au toucher. */
  detail: string;
}

const HEIGHT = 180;
const TOP = 10;
const BOTTOM = 156;
const GUTTER = 40;
const PAD = 6;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Une valeur par séance, dans le temps. Toucher ou glisser sur la courbe affiche la séance. */
export function ExerciseChart({ points, unit, summary, minSpan }: { points: ChartPoint[]; unit: string; summary: string; minSpan: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [selected, setSelected] = useState<number | null>(null);
  const plotW = Math.max(0, width - GUTTER);
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const span = Math.max(1, daysBetween(first.date, last.date));
  const scale = niceScale(Math.min(...points.map((p) => p.value)), Math.max(...points.map((p) => p.value)), 4, minSpan);
  const x = (date: string) => (points.length === 1 ? plotW / 2 : PAD + (daysBetween(first.date, date) / span) * (plotW - 2 * PAD));
  const y = (v: number) => TOP + ((scale.max - v) / (scale.max - scale.min)) * (BOTTOM - TOP);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join('');
  const decimals = scale.ticks.some((t) => !Number.isInteger(t)) ? 1 : 0;
  const current = selected === null ? null : points[selected];

  const inspect = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(points[best]!.date) - px)) best = i;
    });
    setSelected(best);
  };

  return (
    <figure className="m-0">
      <div ref={ref} className="relative">
        <div aria-live="polite" className="mb-1 min-h-[38px] text-[13px]">
          {current ? (
            <>
              <p className="font-semibold">
                {formatNumber(current.value, current.value % 1 ? 1 : 0)} {unit}, {formatDayShort(current.date).toLocaleLowerCase('fr-FR')}
              </p>
              <p className="text-cendre">{current.detail}</p>
            </>
          ) : (
            <p className="text-cendre">Touche la courbe pour voir une séance.</p>
          )}
        </div>
        {width > 0 && (
          <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={summary} className="block overflow-visible">
            {scale.ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} stroke="var(--color-graphite)" strokeWidth={1} />
                <text x={width} y={y(t) + 4} fill="var(--color-cendre)" fontSize={11} textAnchor="end">
                  {formatNumber(t, decimals)}
                </text>
              </g>
            ))}
            {points.length > 1 && <path d={path} fill="none" stroke="var(--color-citron)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
            {current && <line x1={x(current.date)} x2={x(current.date)} y1={TOP} y2={BOTTOM} stroke="var(--color-craie)" strokeOpacity={0.35} />}
            {points.map((p, i) => (
              <circle
                key={`${p.date}-${i}`}
                cx={x(p.date)}
                cy={y(p.value)}
                r={selected === i ? 5.5 : 4}
                fill={selected === i ? 'var(--color-craie)' : 'var(--color-citron)'}
                stroke="var(--color-anthracite)"
                strokeWidth={2}
              />
            ))}
            <text x={0} y={HEIGHT - 4} fill="var(--color-cendre)" fontSize={11}>
              {formatDayMonth(first.date)}
            </text>
            {points.length > 1 && (
              <text x={plotW} y={HEIGHT - 4} fill="var(--color-cendre)" fontSize={11} textAnchor="end">
                {formatDayMonth(last.date)}
              </text>
            )}
            <rect
              x={0}
              y={0}
              width={plotW}
              height={BOTTOM + 8}
              fill="transparent"
              style={{ touchAction: 'pan-y' }}
              onPointerDown={inspect}
              onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons ? inspect(e) : undefined)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && setSelected(null)}
            />
          </svg>
        )}
      </div>
    </figure>
  );
}
