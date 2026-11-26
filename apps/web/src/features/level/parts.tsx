import { Link } from 'react-router';
import { BADGE_CATEGORY_LABELS, type BadgeCategory, type BadgeDef } from '../../domain/level/badges';
import { CHARACTERISTIC_LABELS, CHARACTERISTIC_TEXTS, CONFIDENCE_LABELS, type Characteristic } from '../../domain/level/characteristics';
import type { BadgeProgress } from '../../domain/level/history';
import { LEVEL_SETTINGS } from '../../domain/level/settings';
import { formatDayMonth } from '../../lib/format';
import { Icon, type IconName } from '../../ui/Icon';
import { useHistoryBack } from '../mind/mindShared';

export function BackButton({ fallback = '/progression/joueur' }: { fallback?: string }) {
  const back = useHistoryBack(fallback);
  return (
    <button type="button" onClick={back} className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      Retour
    </button>
  );
}

export function NavRow({ to, icon, title, aside }: { to: string; icon: IconName; title: string; aside?: string }) {
  return (
    <Link to={to} viewTransition className="flex min-h-12 items-center justify-between gap-3 rounded-[14px] bg-anthracite px-4 active:opacity-80">
      <span className="flex items-center gap-2.5 text-[15px] font-semibold">
        <Icon name={icon} size={20} className="text-module" />
        {title}
      </span>
      <span className="flex items-center gap-2 text-[13px] text-cendre tabular-nums">
        {aside}
        <Icon name="chevron" size={16} />
      </span>
    </Link>
  );
}

const CATEGORY_ICONS: Record<BadgeCategory, IconName> = {
  force: 'bolt',
  regularite: 'calendar',
  endurance: 'timer',
  mind: 'moon',
  programs: 'list',
  special: 'star',
};

/**
 * Médaille d'un badge : un hexagone, l'icône de sa catégorie. Commun dans la couleur de l'espace, rare en citron,
 * à débloquer en contour gris. La rareté est aussi écrite à côté : la couleur seule ne porte rien.
 */
export function BadgeMedal({ badge, unlocked, size = 44 }: { badge: BadgeDef; unlocked: boolean; size?: number }) {
  const tone = !unlocked ? 'var(--forge-text-secondary)' : badge.rarity === 'rare' ? 'var(--forge-accent)' : 'var(--forge-module)';
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 100 100" className="absolute inset-0">
        <path
          d="M50 4 90 27v46L50 96 10 73V27z"
          fill={unlocked ? `color-mix(in oklab, ${tone} 16%, var(--forge-surface))` : 'none'}
          stroke={tone}
          strokeOpacity={unlocked ? 1 : 0.45}
          strokeWidth="5"
          strokeDasharray={unlocked ? undefined : '10 8'}
          strokeLinejoin="round"
        />
      </svg>
      <Icon name={CATEGORY_ICONS[badge.category]} size={Math.round(size * 0.42)} strokeWidth={2.2} className="relative" style={{ color: tone, opacity: unlocked ? 1 : 0.6 }} />
    </span>
  );
}

export function BadgeRow({ badge, unlock, progress }: { badge: BadgeDef; unlock: { date: string; detail: string } | null; progress?: BadgeProgress }) {
  const rare = badge.rarity === 'rare';
  return (
    <li
      className="flex items-start gap-3 border-b border-graphite py-3 last:border-b-0"
      aria-label={`${badge.name}, ${rare ? 'rare' : 'commun'}, ${unlock ? `débloqué le ${formatDayMonth(unlock.date)}` : `à débloquer : ${badge.condition}`}`}
    >
      <BadgeMedal badge={badge} unlocked={Boolean(unlock)} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`text-[15px] leading-tight font-semibold ${unlock ? '' : 'text-cendre'}`}>{badge.name}</span>
          <span className={`shrink-0 text-[11px] ${rare ? 'font-semibold text-citron' : 'text-cendre'}`}>{rare ? 'Rare' : 'Commun'}</span>
        </span>
        <span className="text-[13px] leading-snug text-cendre">{unlock ? `${formatDayMonth(unlock.date)}, ${unlock.detail}` : badge.condition}</span>
        {!unlock && progress && (
          <span className="mt-1 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-graphite">
              <span className="block h-full rounded-full bg-module/70" style={{ width: `${(progress.value / progress.target) * 100}%` }} />
            </span>
            <span className="shrink-0 text-[12px] text-cendre tabular-nums">{progress.text}</span>
          </span>
        )}
      </span>
    </li>
  );
}

export const categoryLabel = (c: BadgeCategory) => BADGE_CATEGORY_LABELS[c];

const CONFIDENCE_STYLE = { faible: 'text-cendre', moyenne: 'text-craie', elevee: 'text-module' } as const;

export function changeText(c: Characteristic): string | null {
  if (!c.change) return null;
  return c.change.delta === 0
    ? 'Stable sur 4 semaines'
    : `${c.change.delta > 0 ? '+' : ''}${c.change.delta} en 4 semaines, surtout : ${c.change.factor.toLocaleLowerCase('fr-FR')}`;
}

/** Une caractéristique : note, confiance, variation ; le détail de ses facteurs en la touchant. */
export function CharacteristicRow({ c, children }: { c: Characteristic; children?: React.ReactNode }) {
  const label = CHARACTERISTIC_LABELS[c.key];
  const journal = c.key === 'endurance' || c.key === 'mobilite';
  const change = changeText(c);
  return (
    <details className="group rounded-[18px] bg-anthracite px-4 py-3">
      <summary
        className="flex cursor-pointer list-none flex-col gap-2 [&::-webkit-details-marker]:hidden"
        aria-label={c.score === null ? `${label} : données insuffisantes` : `${label} : ${c.score} sur 100`}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold">{label}</span>
          {c.score === null ? (
            <span className="text-[13px] text-cendre">Données insuffisantes</span>
          ) : (
            <span className="flex items-baseline gap-1">
              <span className="font-metal text-[28px] leading-none tabular-nums">{c.score}</span>
              <span className="text-[12px] text-cendre">/100</span>
            </span>
          )}
        </span>
        {c.score !== null && (
          <span className="h-1.5 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
            <span className="block h-full rounded-full bg-module" style={{ width: `${c.score}%` }} />
          </span>
        )}
        <span className="flex items-start justify-between gap-3 text-[12px]">
          {c.score === null ? (
            <span className="leading-snug text-cendre">{c.missing}</span>
          ) : (
            <span className="flex min-w-0 flex-col gap-0.5 leading-snug">
              <span className={CONFIDENCE_STYLE[c.confidence!]}>{CONFIDENCE_LABELS[c.confidence!]}</span>
              {change && <span className="text-cendre tabular-nums">{change}</span>}
            </span>
          )}
          <Icon name="chevron" size={14} className="mt-0.5 shrink-0 text-cendre transition-transform group-open:rotate-90" />
        </span>
      </summary>
      <div className="flex flex-col gap-2 pt-3">
        <p className="text-[13px] leading-snug text-cendre">{CHARACTERISTIC_TEXTS[c.key]}</p>
        {c.factors.map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <p className="flex justify-between gap-3 text-[13px]">
              <span>
                {f.label} <span className="text-cendre">({f.weight} %)</span>
              </span>
              <span className="text-cendre tabular-nums">{Math.round(f.value)}/100</span>
            </p>
            <p className="text-[12px] text-cendre">{f.detail}</p>
          </div>
        ))}
        {children}
        {journal && (
          <Link to="/progression/joueur/activites" viewTransition className="self-start text-[13px] font-semibold text-module">
            Ouvrir le journal d’activité
          </Link>
        )}
      </div>
    </details>
  );
}

export function Rules() {
  const X = LEVEL_SETTINGS.xp;
  const rows: [string, string][] = [
    [`Séance terminée, ${X.workout.minSets} séries ou plus`, `${X.workout.xp} XP, une par jour, ${X.workout.maxPerWeek} par semaine au plus`],
    ['Semaine du programme respectée', `${X.programWeek.xp} XP`],
    ['Record personnel', `${X.record.xp} XP, ${X.record.maxPerWorkout} par séance au plus`],
    ['Objectif de charge proposé atteint', `${X.loadTarget.xp} XP, ${X.loadTarget.maxPerWorkout} par séance au plus`],
    ['Pratique Mind terminée', `${X.mind.xp} XP par jour`],
    ['Cardio ou mobilité notés', `${X.activity.xp} XP par jour`],
    ['Objectif de protéines atteint', `${X.protein.xp} XP, ${X.protein.maxPerWeek} jours par semaine au plus`],
    ['Bilan de la semaine rempli', `${X.weekNote.xp} XP`],
    ['Badge débloqué', `${X.badge.commun} XP, ${X.badge.rare} s’il est rare`],
    ['Cycle terminé avec 80 % des séances', `${X.cycle.xp} XP`],
  ];
  return (
    <details className="group rounded-[18px] bg-anthracite px-4 py-3">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="text-[15px] font-semibold">Comment se gagne l’XP</span>
        <Icon name="chevron" size={14} className="text-cendre transition-transform group-open:rotate-90" />
      </summary>
      <div className="flex flex-col gap-2 pt-2">
        <dl className="flex flex-col gap-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-[13px]">{k}</dt>
              <dd className="text-[12px] text-cendre">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[12px] leading-snug text-cendre">
          Ni le volume ni la durée ne rapportent d’XP : pas de course au surentraînement. Une séance allégée par PULSE rapporte autant qu’une séance normale. Tout se recalcule à
          partir de tes données : supprimer une séance retire l’XP qu’elle avait rapportée.
        </p>
      </div>
    </details>
  );
}
