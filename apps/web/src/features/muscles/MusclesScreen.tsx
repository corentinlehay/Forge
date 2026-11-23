import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup } from '../../data/muscles';
import { muscleVolumeBetween, volumeLevel, volumeStatus, VOLUME_REFERENCE, type MuscleWeek, type VolumeLevel } from '../../domain/muscleVolume';
import { weekStart } from '../../domain/training';
import { addDays } from '../../lib/dates';
import { formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { StatusChip } from '../../ui/StatusChip';
import { BodyMap, LevelLegend, LEVEL_COLORS } from './BodyMap';
import { useMuscleData } from './useMuscleData';

type Period = 'semaine' | 'precedente' | 'moyenne';
const PERIODS = [
  { value: 'semaine', label: 'En cours' },
  { value: 'precedente', label: 'Précédente' },
  { value: 'moyenne', label: 'Moy. 4 sem.' },
] as const;

export const setsText = (v: number) => `${formatNumber(v, v % 1 ? 1 : 0)} série${v >= 2 ? 's' : ''}`;

/** Carte des muscles : volume de la semaine par groupe musculaire, de face et de dos. */
export function MusclesScreen() {
  const data = useMuscleData();
  const navigate = useNavigate();
  const [chosen, setPeriod] = useState<Period | null>(null);
  const [selected, setSelected] = useState<MuscleGroup | null>(null);

  // Par défaut, la semaine en cours ; si elle est encore vide (lundi matin), la semaine précédente.
  const period: Period = useMemo(() => {
    if (chosen) return chosen;
    if (!data) return 'semaine';
    const start = weekStart(data.today);
    const empty = muscleVolumeBetween(data.workouts, data.sets, data.resolve, start, addDays(start, 6)).muscles;
    return MUSCLE_GROUPS.some((m) => empty[m].fractional > 0) ? 'semaine' : 'precedente';
  }, [chosen, data]);

  const view = useMemo(() => {
    if (!data) return null;
    const start = weekStart(data.today);
    const range =
      period === 'semaine' ? [start, addDays(start, 6)] : period === 'precedente' ? [addDays(start, -7), addDays(start, -1)] : [addDays(start, -28), addDays(start, -1)];
    const result = muscleVolumeBetween(data.workouts, data.sets, data.resolve, range[0]!, range[1]!);
    const divisor = period === 'moyenne' ? 4 : 1;
    const muscles = Object.fromEntries(
      MUSCLE_GROUPS.map((m) => {
        const w = result.muscles[m];
        return [m, { ...w, fractional: w.fractional / divisor, directSets: w.directSets / divisor, indirectSets: w.indirectSets / divisor, days: w.days / divisor }];
      }),
    ) as Record<MuscleGroup, MuscleWeek>;
    const levels = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, volumeLevel(muscles[m].fractional)])) as Record<MuscleGroup, VolumeLevel>;
    const unknown = result.unknownExerciseIds.map((id) => data.itemOf(id)).filter(Boolean);
    return { muscles, levels, unknown };
  }, [data, period]);

  if (!data || !view)
    return (
      <Screen withTabBar={false}>
        <BackLink />
      </Screen>
    );
  const current = selected ? view.muscles[selected] : null;
  const describe = (m: MuscleGroup) => `${MUSCLE_LABELS[m]} : ${setsText(view.muscles[m].fractional)}`;
  const worked = MUSCLE_GROUPS.filter((m) => view.muscles[m].fractional > 0).length;
  const inRange = MUSCLE_GROUPS.filter((m) => volumeStatus(view.muscles[m].fractional).tone === 'good').length;

  return (
    <Screen withTabBar={false}>
      <BackLink />
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[40px] leading-none">Muscles</h1>
        <p className="text-[15px] text-cendre">
          {worked
            ? `${worked} groupe${worked > 1 ? 's' : ''} travaillé${worked > 1 ? 's' : ''}, ${inRange} dans le repère de ${VOLUME_REFERENCE.low} à ${VOLUME_REFERENCE.high} séries.`
            : 'Aucune série sur cette période.'}
        </p>
      </div>
      <Segmented label="Période" options={PERIODS} value={period} onChange={setPeriod} />

      <section aria-label="Carte des muscles" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-4">
        <BodyMap levels={view.levels} selected={selected} describe={describe} onSelect={(m) => setSelected((cur) => (cur === m ? null : m))} />
        <LevelLegend />
        {current ? (
          <div className="flex flex-col gap-2 border-t border-graphite pt-3" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-semibold">{MUSCLE_LABELS[current.muscle]}</h2>
              <StatusChip
                icon={volumeStatus(current.fractional).tone === 'good' ? 'check' : 'info'}
                tone={volumeStatus(current.fractional).tone}
                label={volumeStatus(current.fractional).label}
              />
            </div>
            <p className="font-metal text-[32px] leading-none">{setsText(current.fractional)}</p>
            <p className="text-[13px] text-cendre">
              {formatNumber(current.directSets, current.directSets % 1 ? 1 : 0)} directe{current.directSets >= 2 ? 's' : ''},{' '}
              {formatNumber(current.indirectSets, current.indirectSets % 1 ? 1 : 0)} indirecte
              {current.indirectSets >= 2 ? 's' : ''} (comptées pour moitié), {formatNumber(current.days, current.days % 1 ? 1 : 0)} jour{current.days >= 2 ? 's' : ''}{' '}
              d’entraînement
              {period === 'moyenne' ? ' par semaine' : ''}.
            </p>
            <Button variant="secondary" onClick={() => navigate(`/training/muscles/${current.muscle}`, { viewTransition: true })}>
              Historique, exercices et records
            </Button>
          </div>
        ) : (
          <p className="border-t border-graphite pt-3 text-[13px] text-cendre">Touche un muscle pour voir son détail.</p>
        )}
      </section>

      {view.unknown.length > 0 && (
        <div className="flex flex-col gap-2 rounded-[18px] border border-graphite p-4">
          <p className="text-[15px] leading-snug">
            {view.unknown.length === 1 ? 'Un exercice n’est pas compté' : `${view.unknown.length} exercices ne sont pas comptés`} : précise son muscle principal.
          </p>
          <ul className="flex flex-wrap gap-2">
            {view.unknown.map((item) => (
              <li key={item!.key}>
                <Link to={`/training/exercices/${item!.key}`} viewTransition className="flex min-h-10 items-center rounded-full bg-graphite px-3.5 text-[15px]">
                  {item!.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section aria-label="Séries par muscle" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">Séries par muscle</h2>
        <ul>
          {MUSCLE_GROUPS.map((m) => {
            const w = view.muscles[m];
            const pct = Math.min(1, w.fractional / 24);
            return (
              <li key={m} className="border-b border-anthracite last:border-b-0">
                <Link to={`/training/muscles/${m}`} viewTransition className="flex min-h-12 items-center gap-3 py-2">
                  <span className="w-[112px] shrink-0 text-[15px]">{MUSCLE_LABELS[m]}</span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct * 100}%`, background: LEVEL_COLORS[view.levels[m]] }} />
                    <span className="absolute inset-y-0 w-px bg-cendre/60" style={{ left: `${(VOLUME_REFERENCE.low / 24) * 100}%` }} />
                  </span>
                  <span className="w-[52px] shrink-0 text-right text-[15px] tabular-nums">{formatNumber(w.fractional, w.fractional % 1 ? 1 : 0)}</span>
                  <Icon name="chevron" size={14} className="shrink-0 text-cendre" />
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[12px] leading-snug text-cendre">
          Le trait marque {VOLUME_REFERENCE.low} séries : un volume de 10 séries par semaine et plus par muscle est associé à une meilleure prise de muscle (Schoenfeld et al.,
          2017). Une série compte pour le muscle principal de l’exercice et pour moitié pour ses muscles secondaires (Pelland et al., 2024).
        </p>
      </section>
    </Screen>
  );
}

function BackLink() {
  return (
    <Link to="/training" viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      Training
    </Link>
  );
}
