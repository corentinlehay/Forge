import type { Scale5 } from '../db/types';

interface ScaleChipsProps {
  label: string;
  value: Scale5 | null;
  onChange: (value: Scale5) => void;
  low: string;
  high: string;
}

/** Échelle de 1 à 5, cinq grandes touches. */
export function ScaleChips({ label, value, onChange, low, high }: ScaleChipsProps) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-[15px] font-semibold">{label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`${label} : ${n} sur 5`}
            onClick={() => onChange(n)}
            className={`h-12 rounded-[12px] font-display text-[20px] font-semibold transition-colors ${value === n ? 'bg-citron text-noir' : 'bg-graphite text-craie'}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[12px] text-cendre">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}
