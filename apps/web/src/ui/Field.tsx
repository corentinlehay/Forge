import type { InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  suffix?: string;
}

/** Champ de saisie avec libellé visible ; texte en 17 px pour éviter le zoom automatique d'iOS. */
export function Field({ label, suffix, className = '', ...rest }: FieldProps) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] text-cendre">{label}</span>
      <span className="flex h-12 items-center rounded-[12px] bg-graphite pr-3 focus-within:outline-2 focus-within:outline-citron">
        <input
          aria-label={suffix ? `${label}, en ${suffix}` : label}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-[17px] outline-none focus-visible:outline-none placeholder:text-cendre/70"
          {...rest}
        />
        {suffix && <span className="text-[15px] text-cendre">{suffix}</span>}
      </span>
    </label>
  );
}
