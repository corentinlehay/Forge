import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Workout, WorkoutSet } from '../../db/types';
import { volumeMoment, volumeTexts, type VolumeMoment } from '../../domain/volumeMoment';
import { capitalize, formatDayMonth, formatDayMonthLong, formatDayShort, formatNumber } from '../../lib/format';
import { useReducedMotion } from '../../lib/motion';
import { haptic } from '../../services/haptics';
import { BarChart } from '../../ui/BarChart';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';

const kg = (v: number) => `${formatNumber(Math.round(v), 0)} kg`;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Durée du compteur : plus la séance compte de séries, plus il prend son temps, dans des limites raisonnables. */
const buildDuration = (sets: number) => Math.min(2200, Math.max(1200, 700 + sets * 70));

/**
 * Compteur qui additionne la séance : la valeur affichée monte jusqu'au vrai total,
 * et chaque série « se pose » quand le compteur l'atteint. Avec « réduire les animations », le total s'affiche d'emblée.
 */
function useBuild(total: number, sets: number, reduce: boolean) {
  const [shown, setShown] = useState(reduce ? total : 0);
  const [done, setDone] = useState(reduce);
  const finish = useRef<() => void>(() => {});

  useEffect(() => {
    if (reduce) {
      setShown(total);
      setDone(true);
      return;
    }
    let frame = 0;
    let start = 0;
    const duration = buildDuration(sets);
    const stop = () => {
      cancelAnimationFrame(frame);
      setShown(total);
      setDone(true);
    };
    finish.current = stop;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / duration);
      setShown(total * easeOut(t));
      if (t < 1) frame = requestAnimationFrame(tick);
      else stop();
    };
    // Laisse la vue apparaître avant de compter.
    const delay = window.setTimeout(() => (frame = requestAnimationFrame(tick)), 260);
    return () => {
      window.clearTimeout(delay);
      cancelAnimationFrame(frame);
    };
  }, [total, sets, reduce]);

  return { shown, done, skip: () => finish.current() };
}

interface VolumeMomentSheetProps {
  open: boolean;
  onClose: () => void;
  workout: Workout;
  workouts: readonly Workout[];
  sets: readonly WorkoutSet[];
  nameOf: (exerciseId: string) => string;
}

/** Vue plein écran du volume d'une séance (élément <dialog> natif : focus, touche Échap, couche supérieure). */
export function VolumeMomentSheet({ open, onClose, ...rest }: VolumeMomentSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
    } else if (dialog.open) dialog.close();
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-noir p-0 text-craie open:animate-fade-in"
    >
      {open && <VolumeContent titleId={titleId} onClose={onClose} {...rest} />}
    </dialog>
  );
}

function VolumeContent({ titleId, onClose, workout, workouts, sets, nameOf }: Omit<VolumeMomentSheetProps, 'open'> & { titleId: string }) {
  const reduce = useReducedMotion();
  // Les chiffres sont figés à l'ouverture : une série corrigée ensuite ne relance pas le compteur.
  const [m] = useState<VolumeMoment>(() => volumeMoment(workout, workouts, sets));
  const texts = useMemo(() => volumeTexts(m, workout.name, workout.id), [m, workout.name, workout.id]);
  const setCount = m.exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const { shown, done, skip } = useBuild(m.volumeKg, setCount, reduce);
  const total = formatNumber(m.volumeKg, 0);
  const digits = total.replace(/\D/g, '').length;
  const size = digits <= 4 ? 'text-[128px]' : digits === 5 ? 'text-[112px]' : 'text-[92px]';
  const maxRow = Math.max(1, ...m.exercises.map((e) => e.volumeKg));

  const felt = useRef(false);
  useEffect(() => {
    if (!done || felt.current) return;
    felt.current = true;
    haptic(texts.badges.length ? 'success' : 'light');
  }, [done, texts.badges.length]);

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-[radial-gradient(120%_70%_at_0%_0%,color-mix(in_oklab,var(--forge-accent)_13%,var(--forge-bg)),var(--forge-bg)_70%)]">
      <div className="pt-safe pb-safe mx-auto flex min-h-full w-full max-w-[560px] flex-col gap-7 px-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] text-cendre">
            {workout.name}, {formatDayShort(workout.date).toLocaleLowerCase('fr-FR')}
            {m.live ? ', en cours' : ''}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="motion-press -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-graphite/80 text-craie"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <header className="flex flex-col gap-3">
          <h2 id={titleId} className="sr-only">
            {texts.lead} {total} kg
          </h2>
          <p aria-hidden="true" className="font-metal text-[22px] tracking-[0.04em] text-cendre uppercase">
            {texts.lead}
          </p>
          <button type="button" onClick={skip} aria-hidden="true" tabIndex={-1} className="flex items-end gap-2 text-left">
            <span key={done ? 'done' : 'count'} className={`font-metal leading-[0.82] ${size} ${done && !reduce ? 'motion-impact' : ''}`}>
              {formatNumber(Math.round(shown), 0)}
            </span>
            <span className="font-metal pb-[0.12em] text-[40px] text-cendre uppercase">kg</span>
          </button>
          <div className="flex min-h-8 flex-wrap gap-2">
            {done &&
              texts.badges.map((b, i) => (
                <span
                  key={b.text}
                  style={{ animationDelay: `${i * 90}ms` }}
                  className={`motion-pop flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${
                    b.kind === 'record' ? 'bg-citron text-noir shadow-[0_0_14px_color-mix(in_oklab,var(--forge-accent)_40%,transparent)]' : 'border border-citron/60 text-citron'
                  }`}
                >
                  <Icon name={b.kind === 'record' ? 'trophy' : 'up'} size={14} strokeWidth={2.2} />
                  {b.text}
                </span>
              ))}
          </div>
          {/* La phrase occupe déjà sa place pendant le compteur : rien ne saute quand elle apparaît. */}
          <p className={`text-[22px] leading-snug font-semibold ${done ? 'motion-rise' : 'opacity-0'}`} aria-hidden={!done}>
            {texts.hook}
          </p>
        </header>

        {m.exercises.length > 0 && (
          <section aria-label="Volume par exercice" className="flex flex-col gap-3.5">
            <h3 className="text-[13px] text-cendre">Série après série</h3>
            {m.exercises.map((e) => (
              <div key={e.exerciseId} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span className="truncate">{nameOf(e.exerciseId)}</span>
                  <span className="shrink-0 text-cendre tabular-nums">
                    {kg(e.volumeKg)}
                    <span className="sr-only">, {e.sets.length} séries</span>
                  </span>
                </div>
                <div aria-hidden="true" className="flex h-3.5 gap-[2px]" style={{ width: `${(e.volumeKg / maxRow) * 100}%` }}>
                  {e.sets.map((s) => {
                    const placed = shown >= s.untilKg - 0.5;
                    return (
                      <span key={s.id} style={{ flexGrow: s.volumeKg, flexBasis: 0 }} className={`h-full rounded-[4px] ${placed ? 'motion-brick bg-citron' : 'bg-graphite'}`} />
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}

        {done && texts.facts.length > 0 && (
          <dl className="flex flex-col gap-3">
            {texts.facts.map((f, i) => (
              <div key={f.label} className="motion-rise flex items-baseline gap-3 border-t border-graphite pt-3" style={{ ['--i' as string]: i + 1 }}>
                <dt className="sr-only">{f.label}</dt>
                <dd className="font-metal w-[34%] shrink-0 text-[28px] whitespace-nowrap">{f.value}</dd>
                <dd aria-hidden="true" className="text-[14px] leading-snug text-cendre">
                  {f.label}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {done && m.history.length >= 2 && (
          <section
            aria-label={`Volume de tes séances ${workout.name}`}
            className="motion-rise flex flex-col gap-1 rounded-[22px] bg-anthracite p-4"
            style={{ ['--i' as string]: 4 }}
          >
            <h3 className="text-[13px] text-cendre">
              {workout.name} : {m.history.length === 2 ? 'tes 2 dernières séances' : `tes ${m.history.length} dernières séances`}
            </h3>
            <BarChart
              title={`${workout.name}, volume par séance`}
              tone="citron"
              height={112}
              bars={m.history.map((h) => ({
                key: h.id,
                label: formatDayMonth(h.date),
                value: h.volumeKg,
                detail: `${h.id === workout.id ? (m.live ? 'Cette séance, jusqu’ici' : 'Cette séance') : capitalize(formatDayMonthLong(h.date))} : ${kg(h.volumeKg)}`,
              }))}
            />
          </section>
        )}

        {done && (
          <p className="motion-rise text-[17px] leading-relaxed text-craie/90" style={{ ['--i' as string]: 5 }}>
            {texts.identity}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-3 pb-2">
          <p className="text-[12px] leading-snug text-cendre">{texts.footnote}</p>
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
