import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { MindExercise } from '../../data/mindExercises';
import { repos, useMeta } from '../../db/hooks';
import type { MindSession } from '../../db/types';
import { exerciseSeconds, FAMILY_LABELS, formatDuration, resolveRoutines, ROUTINES_KEY, type RoutineId, type RoutineStep } from '../../domain/mind';
import { formatDayShort } from '../../lib/format';
import { Icon } from '../../ui/Icon';

export const FAVORITES_KEY = 'mindFavorites';
const SOUND_KEY = 'forge.mindSound';

/** Retour à l'écran précédent de Mind (ou à l'accueil Mind si on arrive d'un lien direct). */
export function MindBack({ to = '/mind', label = 'Mind' }: { to?: string; label?: string }) {
  return (
    <Link to={to} viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      {label}
    </Link>
  );
}

export function useHistoryBack(fallback = '/mind') {
  const navigate = useNavigate();
  return useCallback(() => {
    if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) void navigate(-1);
    else void navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}

export function useFavorites() {
  const stored = useMeta<string[]>(FAVORITES_KEY);
  const favorites = stored ?? [];
  const toggle = useCallback((id: string) => void repos.meta.set(FAVORITES_KEY, favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id]), [favorites]);
  return { favorites, toggle, loaded: stored !== undefined };
}

export function useRoutines() {
  const stored = useMeta<Partial<Record<RoutineId, RoutineStep[]>>>(ROUTINES_KEY);
  return { routines: resolveRoutines(stored), stored: stored ?? null, loaded: stored !== undefined };
}

/** Repère sonore des exercices : réglage propre à l'appareil, actif par défaut. */
export function useSoundSetting(): [boolean, (v: boolean) => void] {
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const update = (v: boolean) => {
    setSound(v);
    try {
      localStorage.setItem(SOUND_KEY, v ? 'on' : 'off');
    } catch {
      /* réglage gardé pour cette visite seulement */
    }
  };
  return [sound, update];
}

/** seconds : durée à afficher quand elle diffère de celle par défaut (étape d'une routine). */
export function ExerciseRow({ exercise, favorite, to, seconds }: { exercise: MindExercise; favorite?: boolean; to?: string; seconds?: number }) {
  return (
    <li className="border-b border-anthracite last:border-b-0">
      <Link to={to ?? `/mind/exercice/${exercise.id}`} viewTransition className="flex min-h-16 items-center gap-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[17px]">
            {exercise.title}
            {favorite && <Icon name="star" size={14} className="shrink-0 text-brume" aria-label="Favori" />}
          </span>
          <span className="block text-[13px] text-cendre">
            {FAMILY_LABELS[exercise.family]}, {formatDuration(seconds ?? exerciseSeconds(exercise))}
          </span>
        </span>
        <Icon name="chevron" size={18} className="shrink-0 text-cendre" />
      </Link>
    </li>
  );
}

export function SessionRow({ s }: { s: MindSession }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-anthracite py-2.5 last:border-b-0">
      <span className="min-w-0">
        <span className="block truncate text-[15px]">{s.title}</span>
        <span className="block text-[12px] text-cendre">
          {formatDayShort(s.date)} à {s.time.replace(':', ' h ')}
          {s.completed ? '' : ', arrêté avant la fin'}
        </span>
      </span>
      <span className="shrink-0 text-right text-[13px] text-cendre">
        {formatDuration(s.durationSec)}
        {s.tensionBefore && s.tensionAfter ? (
          <span className="block text-[12px]">
            tension {s.tensionBefore} → {s.tensionAfter}
          </span>
        ) : null}
      </span>
    </li>
  );
}

/** Note de précaution commune à Mind. */
export function MindCaution() {
  return (
    <p className="text-[12px] leading-snug text-cendre">
      Ces exercices sont des repères de bien-être et de préparation mentale, pas un soin ni un traitement. Si tu te sens mal plusieurs jours de suite, parles-en à ton médecin. En
      cas de détresse psychique, le 3114 répond jour et nuit, gratuitement ; en cas d’urgence, appelle le 15 ou le 112.
    </p>
  );
}
