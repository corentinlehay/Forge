import type { SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly { value: string; label: string }[];
}

/** Liste de choix native : la roue de sélection d'iOS. */
export function SelectField({ label, options, className = '', ...rest }: SelectFieldProps) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] text-cendre">{label}</span>
      <span className="relative flex h-12 items-center rounded-[12px] bg-graphite focus-within:outline-2 focus-within:outline-citron">
        <select className="h-full w-full min-w-0 appearance-none bg-transparent pr-8 pl-3 text-[17px] text-craie outline-none" {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevron" size={16} className="pointer-events-none absolute right-3 rotate-90 text-cendre" />
      </span>
    </label>
  );
}
