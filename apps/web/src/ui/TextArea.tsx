import type { TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

/** Texte sur plusieurs lignes, en 17 px (pas de zoom automatique sur iPhone). */
export function TextArea({ label, hint, className = '', rows = 3, ...rest }: TextAreaProps) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="flex items-baseline justify-between gap-2 text-[13px] text-cendre">
        {label}
        {hint && <span className="text-[12px]">{hint}</span>}
      </span>
      <textarea
        rows={rows}
        className="min-h-12 w-full resize-none rounded-[12px] bg-graphite px-3 py-2.5 text-[17px] leading-snug outline-none placeholder:text-cendre/70 focus-visible:outline-2 focus-visible:outline-citron"
        {...rest}
      />
    </label>
  );
}
