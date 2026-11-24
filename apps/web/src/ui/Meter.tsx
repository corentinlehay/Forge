import { formatNumber } from '../lib/format';

interface MeterProps {
  label: string;
  value: number;
  target?: number | null;
  unit?: string;
  decimals?: number;
}

/** Jauge linéaire : valeur, objectif et barre de progression. Sans objectif, la valeur seule. */
export function Meter({ label, value, target, unit = 'g', decimals = 0 }: MeterProps) {
  const ratio = target ? Math.min(value / target, 1) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="text-cendre">{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold">{formatNumber(value, decimals)}</span>
          {target ? (
            <span className="text-cendre">
              {' '}
              / {formatNumber(target, decimals)} {unit}
            </span>
          ) : (
            <span className="text-cendre"> {unit}</span>
          )}
        </span>
      </div>
      {target ? (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-graphite"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.round(value)}
        >
          <div
            className="motion-grow-x h-full w-full origin-left rounded-full bg-module transition-transform duration-[var(--forge-duration-fill)] ease-[var(--forge-ease-enter)]"
            style={{ scale: `${ratio} 1` }}
          />
        </div>
      ) : null}
    </div>
  );
}
