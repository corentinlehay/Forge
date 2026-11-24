import { Icon } from './Icon';

interface StepperProps {
  label: string;
  value: number | null;
  step: number;
  min: number;
  max: number;
  /** Valeur proposée au premier appui quand rien n'est encore saisi. */
  start: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  /** Fourni : un lien Effacer apparaît sous le libellé quand une valeur est saisie. */
  onClear?: () => void;
}

const round = (v: number) => Math.round(v * 100) / 100;

/** Moins / valeur / plus, avec de grandes cibles tactiles. */
export function Stepper({ label, value, step, min, max, start, format, onChange, onClear }: StepperProps) {
  const move = (dir: 1 | -1) => onChange(round(value === null ? start : Math.min(max, Math.max(min, value + dir * step))));
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex flex-col items-start text-[15px]">
        {label}
        {onClear && value !== null && (
          <button type="button" onClick={onClear} aria-label={`${label} : effacer`} className="py-1 text-[13px] text-cendre underline-offset-2 active:underline">
            Effacer
          </button>
        )}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label} : diminuer`}
          disabled={value !== null && value - step < min - 1e-9}
          onClick={() => move(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-graphite disabled:opacity-40"
        >
          <Icon name="minus" size={18} />
        </button>
        <span className="min-w-[76px] text-center text-[17px] font-semibold tabular-nums" aria-live="polite">
          {value === null ? '—' : format(value)}
        </span>
        <button
          type="button"
          aria-label={`${label} : augmenter`}
          disabled={value !== null && value + step > max + 1e-9}
          onClick={() => move(1)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-graphite disabled:opacity-40"
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    </div>
  );
}
