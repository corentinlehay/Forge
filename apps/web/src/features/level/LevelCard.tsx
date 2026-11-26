import { Link } from 'react-router';
import { useProfile } from '../../db/hooks';
import { BADGES } from '../../domain/level/badges';
import { formatNumber } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import { UserEmblem } from './Emblem';
import { useLevel } from './useLevel';

/** Entrée de FORGE LEVEL (Progression et accueil) : niveau, XP vers le suivant, dernier badge. */
export function LevelCard() {
  const level = useLevel();
  const profile = useProfile();
  if (!level || profile === undefined) return null;
  const { progress } = level;
  const lastBadge = level.unlocks[0];
  return (
    <Link
      to="/progression/joueur"
      viewTransition
      data-module="progression"
      aria-label={`Niveau ${progress.level}, ${formatNumber(progress.totalXp, 0)} XP. Ouvrir la fiche joueur`}
      className="flex items-center gap-4 rounded-[22px] bg-anthracite p-[18px] transition-transform duration-[var(--forge-duration-press)] active:scale-[0.985]"
    >
      <UserEmblem level={progress.level} size={56} bare />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="flex items-baseline gap-1.5">
            <span className="text-[13px] text-cendre">Niveau</span>
            <span className="font-metal text-[30px] leading-none">{progress.level}</span>
          </span>
          <span className="truncate text-[12px] text-cendre tabular-nums">
            {progress.next ? `${formatNumber(progress.next - progress.totalXp, 0)} XP pour le ${progress.level + 1}` : 'Niveau maximal'}
          </span>
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
          <span className="block h-full rounded-full bg-module" style={{ width: `${Math.max(2, progress.progress * 100)}%` }} />
        </span>
        <span className="truncate text-[12px] text-cendre">{lastBadge ? `Dernier badge : ${badgeName(lastBadge.id)}` : 'Fiche joueur, caractéristiques et badges'}</span>
      </span>
      <Icon name="chevron" size={16} className="shrink-0 text-cendre" />
    </Link>
  );
}

const badgeName = (id: string) => BADGES.find((b) => b.id === id)?.name ?? id;
