interface ChipOption<T extends string | number> {
  value: T;
  label: string;
}

interface ChipsProps<T extends string | number> {
  label: string;
  options: readonly ChipOption<T>[];
  /** Valeurs choisies (une seule en mode simple). */
  selected: readonly T[];
  onToggle: (value: T) => void;
  /** Une ligne qui défile (filtres) ou des puces qui passent à la ligne (formulaires). */
  layout?: 'scroll' | 'wrap';
  /** Couleur des choix actifs : brume dans FORGE MIND. */
  tone?: 'citron' | 'brume';
  hideLabel?: boolean;
  /** Libellé en question (gras, 15 px), comme les échelles de 1 à 5. */
  strongLabel?: boolean;
}

/** Puces à choisir : un toucher sélectionne, un second désélectionne. */
export function Chips<T extends string | number>({ label, options, selected, onToggle, layout = 'wrap', hideLabel = false, tone = 'citron', strongLabel = false }: ChipsProps<T>) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className={hideLabel ? 'sr-only' : strongLabel ? 'mb-2 text-[15px] font-semibold' : 'mb-2 text-[13px] text-cendre'}>{label}</legend>
      <div className={layout === 'scroll' ? '-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]' : 'flex flex-wrap gap-2'}>
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.value)}
              className={`h-10 shrink-0 rounded-full px-4 text-[15px] whitespace-nowrap transition-colors ${on ? (tone === 'brume' ? 'bg-brume' : 'bg-citron') + ' font-semibold text-noir' : 'bg-graphite text-craie'}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
