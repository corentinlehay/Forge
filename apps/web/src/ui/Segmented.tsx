interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const n = options.length;
  return (
    <div role="group" aria-label={label} className="relative grid gap-1 rounded-[14px] bg-anthracite p-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {/* Le fond de l'option choisie glisse d'une option à l'autre : on voit d'où l'on vient. */}
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 rounded-[10px] bg-graphite transition-transform duration-[var(--forge-duration-base)] ease-[var(--forge-ease-standard)]"
        style={{ width: `calc((100% - 8px - ${(n - 1) * 4}px) / ${n})`, transform: `translateX(calc(${index} * (100% + 4px)))` }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`relative h-10 rounded-[10px] px-2 text-sm transition-colors duration-[var(--forge-duration-fast)] active:scale-[0.97] ${active ? 'font-semibold text-craie' : 'text-cendre'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
