import { useState } from 'react';
import { niceScale } from '../domain/chartScale';
import { formatDayMonth, formatNumber } from '../lib/format';

export interface LinePoint {
  date: string;
  value: number;
}

const W = 340;
const H = 150;
const PAD = { l: 34, r: 10, t: 10, b: 22 };

/**
 * Courbe simple d'une mesure dans le temps (échelle ajustée aux valeurs, pas depuis zéro).
 * Toucher un point affiche sa valeur ; le dernier point est choisi par défaut.
 */
export function LineChart({
  points,
  unit,
  title,
  decimals = 1,
  tone = 'module',
}: {
  points: LinePoint[];
  unit: string;
  title: string;
  decimals?: number;
  tone?: 'module' | 'citron' | 'brume';
}) {
  const [picked, setPicked] = useState<number | null>(null);
  if (points.length === 0) return null;
  const color = tone === 'brume' ? 'var(--forge-mind)' : tone === 'citron' ? 'var(--forge-accent)' : 'var(--forge-module)';
  const values = points.map((p) => p.value);
  const scale = niceScale(Math.min(...values), Math.max(...values), 3, 2);
  const t0 = Date.parse(points[0]!.date);
  const t1 = Date.parse(points.at(-1)!.date);
  const x = (d: string) => (t1 === t0 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((Date.parse(d) - t0) / (t1 - t0)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - (v - scale.min) / (scale.max - scale.min)) * (H - PAD.t - PAD.b);
  const sel = picked !== null && picked < points.length ? picked : points.length - 1;
  const p = points[sel]!;
  const path = points.map((pt, i) => `${i ? 'L' : 'M'}${x(pt.date).toFixed(1)} ${y(pt.value).toFixed(1)}`).join(' ');

  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="flex items-baseline justify-between text-[13px]">
        <span className="text-cendre">{title}</span>
        <span aria-live="polite">
          {formatDayMonth(p.date)} :{' '}
          <span className="font-semibold">
            {formatNumber(p.value, decimals)} {unit}
          </span>
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${title}, de ${formatNumber(points[0]!.value, decimals)} à ${formatNumber(points.at(-1)!.value, decimals)} ${unit}`}
      >
        {scale.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--forge-chart-grid)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--forge-chart-axis)">
              {formatNumber(t, t % 1 ? 1 : 0)}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={H - 6} fontSize="10" fill="var(--forge-chart-axis)">
          {formatDayMonth(points[0]!.date)}
        </text>
        {points.length > 1 && (
          <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="10" fill="var(--forge-chart-axis)">
            {formatDayMonth(points.at(-1)!.date)}
          </text>
        )}
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((pt, i) => (
          <g key={`${pt.date}-${i}`} onClick={() => setPicked(i)} className="cursor-pointer">
            <circle cx={x(pt.date)} cy={y(pt.value)} r="14" fill="transparent" />
            <circle cx={x(pt.date)} cy={y(pt.value)} r={i === sel ? 5 : 3.5} fill={i === sel ? color : 'var(--forge-bg)'} stroke={color} strokeWidth="2" />
          </g>
        ))}
      </svg>
    </figure>
  );
}
