import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useCheckIns, useToday, useWorkouts } from '../../db/hooks';
import { exercisesIn, formatDuration, routineSeconds, sleepAroundTraining, sleepStats } from '../../domain/mind';
import { recoveryScore } from '../../domain/wellbeing';
import { addDays } from '../../lib/dates';
import { formatDayMonth, formatNumber } from '../../lib/format';
import { BarChart } from '../../ui/BarChart';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { useCheckInSheet } from '../wellbeing/CheckInSheet';
import { ExerciseRow, MindBack, useFavorites, useRoutines } from './mindShared';
import { useAudioCatalog } from '../../services/audioApi';
import { AudioShelf } from '../audio/AudioScreens';

const hoursText = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const clockText = (t: string) => t.replace(':', ' h ');

/** Sommeil et récupération : nuits notées au check-in du matin, régularité, rituel du soir. */
export function SleepScreen() {
  const checkIns = useCheckIns();
  const workouts = useWorkouts();
  const today = useToday();
  const { openCheckIn } = useCheckInSheet();
  const { routines } = useRoutines();
  const { favorites } = useFavorites();
  const [days, setDays] = useState<'7' | '30'>('30');
  const { items: audio } = useAudioCatalog();
  const nightAudio = audio.filter((a) => a.format === 'sommeil' || a.categories.includes('dormir'));

  const model = useMemo(() => {
    if (!checkIns || !workouts) return null;
    const n = Number(days);
    const stats = sleepStats(checkIns, today, n);
    const since = addDays(today, -(n - 1));
    const recent = checkIns.filter((c) => !c.deletedAt && c.date >= since && c.date <= today);
    const scores = recent.flatMap((c) => (recoveryScore(c) === null ? [] : [recoveryScore(c)!]));
    const recovery = scores.length ? Math.round(scores.reduce((a, v) => a + v, 0) / scores.length) : null;
    const byDate = new Map(checkIns.map((c) => [c.date, c]));
    const bars = Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1))).map((d, i) => {
      const c = byDate.get(d);
      return {
        key: d,
        label: n === 7 || i % 5 === (n - 1) % 5 ? String(Number(d.slice(8, 10))) : '',
        value: c?.sleepHours ?? 0,
        detail: c && c.sleepHours !== null ? `Nuit du ${formatDayMonth(addDays(d, -1))} : ${hoursText(c.sleepHours)}` : `${formatDayMonth(d)} : pas noté`,
      };
    });
    return { stats, recovery, bars, training: sleepAroundTraining(checkIns, workouts, today), lastNight: byDate.get(today) ?? null };
  }, [checkIns, workouts, today, days]);

  if (!model)
    return (
      <Screen withTabBar={false}>
        <MindBack />
      </Screen>
    );
  const { stats } = model;
  const soir = routines.soir;

  return (
    <Screen withTabBar={false}>
      <MindBack />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-metal text-[40px] leading-none">Sommeil</h1>
        <Button size="small" variant="secondary" onClick={() => openCheckIn(today)}>
          {model.lastNight ? 'Modifier ma nuit' : 'Noter ma nuit'}
        </Button>
      </div>
      <Segmented
        label="Période"
        value={days}
        onChange={setDays}
        options={[
          { value: '7', label: '7 jours' },
          { value: '30', label: '30 jours' },
        ]}
      />

      {stats.nights === 0 ? (
        <p className="rounded-[18px] bg-anthracite p-4 text-[15px] leading-snug text-cendre">
          Aucune nuit notée sur la période. Le check-in du matin enregistre ta nuit : durée, et si tu veux l’heure du coucher, du réveil, les réveils et la qualité.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2">
            {[
              [
                'Durée moyenne',
                stats.avgHours !== null ? hoursText(stats.avgHours) : '–',
                `${stats.nights} nuit${stats.nights > 1 ? 's' : ''} notée${stats.nights > 1 ? 's' : ''}`,
              ],
              ['Qualité ressentie', stats.avgQuality !== null ? `${formatNumber(stats.avgQuality, 1)} / 5` : '–', stats.avgQuality !== null ? 'moyenne' : 'à noter au check-in'],
              [
                'Coucher moyen',
                stats.bedTime ? clockText(stats.bedTime.mean) : '–',
                stats.bedTime ? `écart moyen ${stats.bedTime.spreadMin} min` : 'au moins 3 nuits avec l’heure',
              ],
              [
                'Réveil moyen',
                stats.wakeTime ? clockText(stats.wakeTime.mean) : '–',
                stats.wakeTime ? `écart moyen ${stats.wakeTime.spreadMin} min` : 'au moins 3 nuits avec l’heure',
              ],
              ['Réveils par nuit', stats.avgAwakenings !== null ? formatNumber(stats.avgAwakenings, 1) : '–', 'moyenne'],
              ['Récupération au réveil', model.recovery !== null ? `${model.recovery} / 100` : '–', 'sommeil, énergie, fatigue, courbatures'],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-[16px] bg-anthracite p-3">
                <dt className="text-[12px] text-cendre">{label}</dt>
                <dd className="font-metal text-[24px] leading-tight">{value}</dd>
                <dd className="text-[12px] text-cendre">{sub}</dd>
              </div>
            ))}
          </dl>

          <section aria-label="Durée des nuits" className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-4">
            <h2 className="text-[17px] font-semibold">Durée des nuits</h2>
            <BarChart tone="brume" title="Heures de sommeil" bars={model.bars} target={7} targetLabel="Repère 7 h" height={120} />
            <p className="text-[12px] leading-snug text-cendre">
              {stats.shortNights > 0 ? `${stats.shortNights} nuit${stats.shortNights > 1 ? 's' : ''} sous 7 h sur la période. ` : ''}
              Repère adulte : au moins 7 heures par nuit (Watson et al., 2015). Un repère général, pas un objectif médical.
            </p>
          </section>

          {model.training && (
            <section aria-label="Sommeil et entraînement" className="flex flex-col gap-1 rounded-[18px] border border-graphite p-4">
              <h2 className="text-[15px] font-semibold">Sommeil et entraînement</h2>
              <p className="text-[15px] leading-snug">
                Les nuits avant une séance : {hoursText(model.training.before)} en moyenne, contre {hoursText(model.training.other)} les autres nuits.
              </p>
              <p className="text-[12px] leading-snug text-cendre">
                Sur les 60 derniers jours ({model.training.nightsBefore} et {model.training.nightsOther} nuits). Une observation, pas une cause : d’autres facteurs peuvent jouer.
              </p>
            </section>
          )}
        </>
      )}

      <section aria-label="Rituel du soir" className="flex flex-col gap-3 rounded-[22px] bg-brume-voile p-[18px]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold">{soir.title}</h2>
            <p className="text-[13px] text-cendre">
              {soir.steps.length} exercices, {formatDuration(routineSeconds(soir))}
            </p>
          </div>
          <Link
            to="/mind/routine/soir"
            viewTransition
            aria-label={`Commencer : ${soir.title}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brume text-noir"
          >
            <Icon name="play" size={22} />
          </Link>
        </div>
        <p className="text-[13px] leading-snug text-cendre">
          Repères d’hygiène du sommeil de l’Institut national du sommeil et de la vigilance : te coucher et te lever à heures fixes, une chambre calme et sombre, ni café, ni thé,
          ni écrans avant de dormir.
        </p>
      </section>

      <AudioShelf title="Séances audio pour la nuit" items={nightAudio} />

      <section aria-label="Pour s’endormir" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">Pour préparer la nuit</h2>
        <ul>
          {exercisesIn('dormir').map((e) => (
            <ExerciseRow key={e.id} exercise={e} favorite={favorites.includes(e.id)} />
          ))}
        </ul>
      </section>
    </Screen>
  );
}
