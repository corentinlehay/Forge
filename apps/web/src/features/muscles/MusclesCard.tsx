import { useMemo } from 'react';
import { Link } from 'react-router';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../data/muscles';
import { muscleWeek, volumeLevel, volumeStatus, type VolumeLevel } from '../../domain/muscleVolume';
import { addDays } from '../../lib/dates';
import { Icon } from '../../ui/Icon';
import { MiniBody } from './BodyMap';
import { useMuscleData } from './useMuscleData';

/** Aperçu de la semaine par muscle, sur l'écran Training. */
export function MusclesCard() {
  const data = useMuscleData();
  const summary = useMemo(() => {
    if (!data) return null;
    const current = muscleWeek(data.workouts, data.sets, data.resolve, data.today).muscles;
    if (MUSCLE_GROUPS.some((m) => current[m].fractional > 0)) return { week: current, label: 'Cette semaine' };
    return { week: muscleWeek(data.workouts, data.sets, data.resolve, addDays(data.today, -7)).muscles, label: 'Semaine passée' };
  }, [data]);
  if (!summary) return null;
  const { week, label } = summary;
  const levels = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, volumeLevel(week[m].fractional)])) as Record<MuscleGroup, VolumeLevel>;
  const worked = MUSCLE_GROUPS.filter((m) => week[m].fractional > 0).length;
  const inRange = MUSCLE_GROUPS.filter((m) => volumeStatus(week[m].fractional).tone === 'good').length;
  return (
    <Link to="/training/muscles" viewTransition className="flex min-h-[64px] items-center gap-3 rounded-[18px] bg-anthracite px-4 py-3 active:scale-[0.99]">
      <MiniBody levels={levels} />
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold">Muscles</span>
        <span className="block text-[13px] leading-snug text-cendre">
          {worked
            ? `${label} : ${worked} groupe${worked > 1 ? 's' : ''} travaillé${worked > 1 ? 's' : ''}, ${inRange} dans le repère de 10 à 20 séries`
            : 'Volume par muscle, fréquence et records, de face et de dos'}
        </span>
      </span>
      <Icon name="chevron" size={16} className="shrink-0 text-cendre" />
    </Link>
  );
}
