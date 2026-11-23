import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from './Icon';

interface LinkCardProps {
  to: string;
  title: string;
  /** Texte lu par le lecteur d'écran : où mène la carte. */
  label: string;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}

/** Carte entière cliquable vers un espace : le titre, puis son contenu. */
export function LinkCard({ to, title, label, children, className = '', aside }: LinkCardProps) {
  return (
    <Link
      to={to}
      viewTransition
      aria-label={label}
      className={`flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px] transition-transform duration-150 active:scale-[0.985] ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] text-cendre">{title}</h2>
        <span className="flex items-center gap-2 text-cendre">
          {aside}
          <Icon name="chevron" size={16} />
        </span>
      </div>
      {children}
    </Link>
  );
}
