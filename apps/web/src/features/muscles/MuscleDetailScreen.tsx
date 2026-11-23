import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { EXERCISE_LIBRARY } from '../../data/exerciseLibrary';
import { MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup } from '../../data/muscles';
import { muscleHistory, muscleWeek, volumeStatus, VOLUME_REFERENCE } from '../../domain/muscleVolume';
import { exerciseRecords, exerciseSessions, exerciseTrend, TREND_LABELS, sinceForPeriod } from '../../domain/progression';
import { capitalize, formatDayMonth, formatDayShort, formatNumber } from '../../lib/format';
import { BarChart } from '../../ui/BarChart';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { StatusChip } from '../../ui/StatusChip';
import { kgText } from '../training/ExerciseDetailScreen';
import { describeItem } from '../training/ExercisePicker';
import { ExerciseThumb } from '../training/ExerciseVisual';
import { setsText } from './MusclesScreen';
import { useMuscleData } from './useMuscleData';

const isMuscle = (v: string): v is MuscleGroup => (MUSCLE_GROUPS as readonly string[]).includes(v);
const n1 = (v: number) => formatNumber(v, v % 1 ? 1 : 0);

/** Un groupe musculaire : volume, fréquence, historique, exercices, records et progression. */
export function MuscleDetailScreen() {
  const { muscle = '' } = useParams();
  const data = useMuscleData();

  const model = useMemo(() => {
    if (!data || !isMuscle(muscle)) return null;
    const week = muscleWeek(data.workouts, data.sets, data.resolve, data.today).muscles[muscle];
    const history = muscleHistory(muscle, data.workouts, data.sets, data.resolve, data.today, 12);
    const since = sinceForPeriod(data.today, 365);
    const ownDirect = data.catalog.filter((i) => i.exercise && i.muscle === muscle);
    const performances = ownDirect
      .map((item) => {
        const sessions = exerciseSessions(item.exercise!.id, data.workouts, data.sets);
        return { item, sessions, records: exerciseRecords(sessions, since), trend: exerciseTrend(sessions) };
      })
      .filter((p) => p.sessions.length > 0)
      .sort((a, b) => b.sessions.length - a.sessions.length);
    const primary = EXERCISE_LIBRARY.filter((e) => e.muscle === muscle);
    const secondary = EXERCISE_LIBRARY.filter((e) => e.secondary.includes(muscle));
    return { week, history, performances, primary, secondary };
  }, [data, muscle]);

  if (!isMuscle(muscle)) {
    return (
      <Screen withTabBar={false}>
        <BackLink />
        <p className="text-[17px]">Ce groupe musculaire n’existe pas.</p>
      </Screen>
    );
  }
  if (!data || !model)
    return (
      <Screen withTabBar={false}>
        <BackLink />
      </Screen>
    );
  const { week, history, performances, primary, secondary } = model;
  const average4 = history.slice(-5, -1).reduce((s, h) => s + h.fractional, 0) / 4;
  const status = volumeStatus(average4);

  return (
    <Screen withTabBar={false}>
      <BackLink />
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-metal text-[40px] leading-none">{MUSCLE_LABELS[muscle]}</h1>
        <StatusChip icon={status.tone === 'good' ? 'check' : 'info'} tone={status.tone} label={`Moyenne : ${status.label.toLocaleLowerCase('fr-FR')}`} />
      </div>

      <dl className="grid grid-cols-2 gap-2">
        {[
          ['Cette semaine', setsText(week.fractional), `${n1(week.directSets)} directes, ${n1(week.indirectSets)} indirectes`],
          ['Fréquence', `${week.days} jour${week.days > 1 ? 's' : ''}`, 'avec des séries directes'],
          ['Moyenne 4 semaines', setsText(Math.round(average4 * 10) / 10), 'avant cette semaine'],
          ['Repère', `${VOLUME_REFERENCE.low} à ${VOLUME_REFERENCE.high}`, 'séries par semaine'],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-[16px] bg-anthracite p-3">
            <dt className="text-[12px] text-cendre">{label}</dt>
            <dd className="font-metal text-[24px] leading-tight">{value}</dd>
            <dd className="text-[12px] text-cendre">{sub}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Historique" className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-4">
        <h2 className="text-[17px] font-semibold">Séries par semaine</h2>
        <BarChart
          title={`Séries par semaine, ${MUSCLE_LABELS[muscle]}`}
          target={VOLUME_REFERENCE.low}
          targetLabel={`Repère ${VOLUME_REFERENCE.low}`}
          bars={history.map((h) => ({
            key: h.weekStart,
            label: formatDayMonth(h.weekStart).split(' ')[0] ?? '',
            value: h.fractional,
            detail: `Semaine du ${formatDayMonth(h.weekStart)} : ${setsText(h.fractional)} (${n1(h.directSets)} directes, ${n1(h.indirectSets)} indirectes)`,
          }))}
        />
        <p className="text-[12px] text-cendre">12 dernières semaines. Les séries indirectes comptent pour moitié.</p>
      </section>

      {week.exercises.length > 0 && (
        <section aria-label="Cette semaine" className="flex flex-col">
          <h2 className="mb-1 text-[17px] font-semibold">Travaillé cette semaine par</h2>
          <ul>
            {week.exercises.map((e) => {
              const item = data.itemOf(e.exerciseId);
              return (
                <li key={e.exerciseId} className="flex min-h-11 items-center justify-between gap-3 border-b border-anthracite py-2 last:border-b-0">
                  <span className="min-w-0 text-[15px]">{item?.name ?? 'Exercice'}</span>
                  <span className="shrink-0 text-[13px] text-cendre">
                    {e.sets} série{e.sets > 1 ? 's' : ''} {e.direct ? 'directe' : 'indirecte'}
                    {e.sets > 1 ? 's' : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-label="Records et progression" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">Records et progression</h2>
        {performances.length === 0 ? (
          <p className="text-[15px] text-cendre">Pas encore de séance sur un exercice qui cible ce muscle.</p>
        ) : (
          <ul>
            {performances.map(({ item, sessions, records, trend }) => (
              <li key={item.key} className="border-b border-anthracite last:border-b-0">
                <Link to={`/training/exercices/${item.key}`} viewTransition className="flex min-h-14 items-center gap-3 py-2">
                  <ExerciseThumb item={item} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-tight">{item.name}</span>
                    <span className="block text-[13px] text-cendre">
                      {records.bestE1rm
                        ? `1RM estimé ${kgText(Math.round(records.bestE1rm.valueKg * 10) / 10)} kg, ${formatDayShort(records.bestE1rm.date).toLocaleLowerCase('fr-FR')}`
                        : 'Pas de séance sur un an'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[13px]">
                    <span className="block">{TREND_LABELS[trend.kind]}</span>
                    <span className="block text-cendre">
                      {sessions.length} séance{sessions.length > 1 ? 's' : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Exercices associés" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">Exercices qui le ciblent</h2>
        <ul>
          {primary.map((lib) => {
            const item = data.catalog.find((i) => i.key === lib.id)!;
            return (
              <li key={lib.id} className="border-b border-anthracite last:border-b-0">
                <Link to={`/training/exercices/${lib.id}`} viewTransition className="flex min-h-14 items-center gap-3 py-2">
                  <ExerciseThumb item={item} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-tight">{lib.name}</span>
                    <span className="block text-[13px] text-cendre">{capitalize(describeItem(item).split(', ').slice(1).join(', ') || 'poids du corps')}</span>
                  </span>
                  <Icon name="chevron" size={14} className="shrink-0 text-cendre" />
                </Link>
              </li>
            );
          })}
        </ul>
        {secondary.length > 0 && (
          <p className="mt-2 text-[13px] leading-snug text-cendre">Sollicité aussi, en muscle secondaire, par : {secondary.map((e) => e.name).join(', ')}.</p>
        )}
      </section>
    </Screen>
  );
}

function BackLink() {
  return (
    <Link to="/training/muscles" viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      Muscles
    </Link>
  );
}
