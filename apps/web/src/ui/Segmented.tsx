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
  return (
    <div
      role="group"
      aria-label={label}
      className="grid gap-1 rounded-[14px] bg-anthracite p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`h-10 rounded-[10px] px-2 text-sm transition-colors ${active ? 'bg-graphite font-semibold text-craie' : 'text-cendre'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
