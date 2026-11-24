import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';
type Size = 'large' | 'small';

const variants: Record<Variant, string> = {
  primary: 'bg-citron text-noir disabled:bg-citron-voile disabled:text-cendre',
  secondary: 'bg-graphite text-craie hover:bg-graphite/80 disabled:text-cendre',
  quiet: 'bg-transparent text-cendre hover:text-craie disabled:opacity-50',
  danger: 'bg-graphite text-braise disabled:opacity-50',
};

const sizes: Record<Size, string> = {
  large: 'h-[52px] w-full rounded-[16px] px-5 text-[17px] font-semibold',
  small: 'h-11 rounded-full px-5 text-base font-semibold',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** Une seule action principale par écran, toujours dans le vert FORGE, même dans Nutrition, Mind et Progression ; le reste reste calme. */
export function Button({ variant = 'primary', size = 'large', className = '', type = 'button', ...rest }: ButtonProps) {
  const quietSize = variant === 'quiet' ? 'min-h-11 px-2 text-[15px] font-medium' : sizes[size];
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 transition-colors active:opacity-80 disabled:cursor-not-allowed ${variants[variant]} ${quietSize} ${className}`}
      {...rest}
    />
  );
}
