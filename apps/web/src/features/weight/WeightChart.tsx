import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { TrendPoint } from '../../domain/weight';
import { nearestPoint, type WeightChartModel } from '../../domain/weightChart';
import { daysBetween } from '../../lib/dates';
import { formatDayMonth, formatDayShort, formatKg, formatMeasuredKg, formatNumber } from '../../lib/format';

const HEIGHT = 200;
const PLOT_TOP = 8;
const PLOT_BOTTOM = 176;
const GUTTER = 34;

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

/**
 * Pesées (points), poids tendance (ligne citron) et fourchette visée (zone).
 * Glisser le doigt sur la courbe affiche le détail du jour.
 */
export function WeightChart({ model, pulseKey }: { model: WeightChartModel; pulseKey: string | null }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [selected, setSelected] = useState<TrendPoint | null>(null);
  const plotW = Math.max(0, width - GUTTER);
  const plotH = PLOT_BOTTOM - PLOT_TOP;

  const x = (date: string) => (daysBetween(model.startDate, date) / model.spanDays) * plotW;
  const y = (kg: number) => PLOT_TOP + ((model.yMax - kg) / (model.yMax - model.yMin)) * plotH;

  const trendPath = model.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.trendKg).toFixed(1)}`).join('');
  const band = model.band.length
    ? [...model.band.map((b) => `${x(b.date).toFixed(1)},${y(b.highKg).toFixed(1)}`), ...[...model.band].reverse().map((b) => `${x(b.date).toFixed(1)},${y(b.lowKg).toFixed(1)}`)].join(' ')
    : '';
  const last = model.points.at(-1);
  const tickDecimals = model.ticks.some((t) => !Number.isInteger(t)) ? 1 : 0;

  const inspect = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSelected(nearestPoint(model, (e.clientX - rect.left) / rect.width));
  };

  const first = model.points[0];
  const summary =
    first && last
      ? `Poids tendance de ${formatKg(first.trendKg)} le ${formatDayMonth(first.date)} à ${formatKg(last.trendKg)} le ${formatDayMonth(last.date)}, ${model.measuredCount} pesées.`
      : 'Aucune pesée sur la période.';

  return (
    <figure className="m-0">
      <div ref={ref} className="relative">
        {selected && (
          <div
            aria-live="polite"
            className="pointer-events-none absolute top-0 z-10 rounded-[12px] bg-graphite/95 px-3 py-2 text-[13px] whitespace-nowrap shadow-lg"
            style={x(selected.date) > plotW / 2 ? { left: 0 } : { right: GUTTER }}
          >
            <p className="font-semibold">{formatDayShort(selected.date)}</p>
            <p className="text-cendre">{selected.measured ? `Pesée ${formatMeasuredKg(selected.weightKg)}` : 'Pas de pesée ce jour'}</p>
            <p>Tendance {formatKg(selected.trendKg)}</p>
          </div>
        )}
        {width > 0 && (
          <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={summary} className="block overflow-visible">
            <defs>
              <clipPath id="plot-area">
                <rect x={0} y={PLOT_TOP} width={plotW} height={plotH} />
              </clipPath>
            </defs>
            {model.ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} stroke="var(--color-graphite)" strokeWidth={1} />
                <text x={width} y={y(t) + 4} fill="var(--color-cendre)" fontSize={11} textAnchor="end">
                  {formatNumber(t, tickDecimals)}
                </text>
              </g>
            ))}
            {band && <polygon points={band} fill="var(--color-citron)" fillOpacity={0.1} clipPath="url(#plot-area)" />}
            <g fill="var(--color-cendre)" fillOpacity={0.55}>
              {model.points
                .filter((p) => p.measured)
                .map((p) => (
                  <circle key={p.date} cx={x(p.date)} cy={y(p.weightKg)} r={2.5} />
                ))}
            </g>
            <path d={trendPath} fill="none" stroke="var(--color-citron)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {selected && (
              <g>
                <line x1={x(selected.date)} x2={x(selected.date)} y1={PLOT_TOP} y2={PLOT_BOTTOM} stroke="var(--color-craie)" strokeOpacity={0.35} />
                {selected.measured && <circle cx={x(selected.date)} cy={y(selected.weightKg)} r={4} fill="var(--color-cendre)" stroke="var(--color-noir)" strokeWidth={2} />}
                <circle cx={x(selected.date)} cy={y(selected.trendKg)} r={4.5} fill="var(--color-craie)" stroke="var(--color-noir)" strokeWidth={2} />
              </g>
            )}
            {last && !selected && (
              <circle
                key={pulseKey ?? 'static'}
                cx={x(last.date)}
                cy={y(last.trendKg)}
                r={4.5}
                fill="var(--color-citron)"
                stroke="var(--color-noir)"
                strokeWidth={2}
                className={pulseKey ? 'animate-pulse-once' : undefined}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              />
            )}
            {model.xLabels.map((d, i) => (
              <text
                key={`${d}-${i}`}
                x={i === 0 ? 0 : i === 1 ? plotW / 2 : plotW}
                y={HEIGHT - 4}
                fill="var(--color-cendre)"
                fontSize={11}
                textAnchor={i === 0 ? 'start' : i === 1 ? 'middle' : 'end'}
              >
                {formatDayMonth(d)}
              </text>
            ))}
            <rect
              x={0}
              y={0}
              width={plotW}
              height={PLOT_BOTTOM}
              fill="transparent"
              style={{ touchAction: 'pan-y' }}
              onPointerDown={inspect}
              onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons ? inspect(e) : undefined)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && setSelected(null)}
              onPointerUp={(e) => e.pointerType !== 'mouse' && window.setTimeout(() => setSelected(null), 2500)}
            />
          </svg>
        )}
      </div>
      <figcaption className="mt-2.5 flex flex-wrap gap-4 text-[13px] text-cendre">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-3.5 rounded-full bg-citron" />
          Tendance
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-cendre" />
          Pesées
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-3.5 rounded-[2px] bg-citron/20" />
          Fourchette visée
        </span>
      </figcaption>
    </figure>
  );
}

/** Mini-courbe de la tendance pour l'Accueil. */
export function TrendSparkline({ points, width = 132, height = 28 }: { points: TrendPoint[]; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.trendKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.5);
  const px = (i: number) => 2 + (i / (points.length - 1)) * (width - 4);
  const py = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(p.trendKg).toFixed(1)}`).join('');
  const lastPoint = points.at(-1)!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      <path d={d} fill="none" stroke="var(--color-cendre)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={px(points.length - 1)} cy={py(lastPoint.trendKg)} r={4} fill="var(--color-citron)" stroke="var(--color-anthracite)" strokeWidth={2} />
    </svg>
  );
}
