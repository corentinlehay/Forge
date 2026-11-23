import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useCheckIns, useExercises, useToday, useWorkouts, useWorkoutSets } from '../../db/hooks';
import { e1rm, findRecords, weeklyVolumes } from '../../domain/training';
import { averageCheckIns, recoveryScore } from '../../domain/wellbeing';
import { addDays } from '../../lib/dates';
import { formatDayMonth, formatDayShort, formatNumber } from '../../lib/format';
import { BarChart } from '../../ui/BarChart';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Card, Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { useCheckInSheet } from '../wellbeing/CheckInSheet';
import { useWeighInSheet } from '../weight/WeighInSheet';
import { WeightPanel } from '../weight/WeightScreen';

type View = 'poids' | 'entrainement' | 'bien-etre';
const views = [
  { value: 'poids', label: 'Poids' },
  { value: 'entrainement', label: 'Entraînement' },
  { value: 'bien-etre', label: 'Bien-être' },
] as const;

const hours = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const kg = (v: number) => formatNumber(v, v % 1 ? 1 : 0);

export function ProgressionScreen() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('vue');
  const view: View = raw === 'entrainement' || raw === 'bien-etre' ? raw : 'poids';
  const { openNew } = useWeighInSheet();
  const { openCheckIn } = useCheckInSheet();

  return (
    <Screen>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-metal text-[40px]">Progression</h1>
        {view === 'poids' && (
          <Button size="small" onClick={openNew}>
            Se peser
          </Button>
        )}
        {view === 'bien-etre' && (
          <Button size="small" onClick={() => openCheckIn()}>
            Check-in
          </Button>
        )}
      </div>
      <Segmented label="Vue" options={views} value={view} onChange={(v) => setParams(v === 'poids' ? {} : { vue: v }, { replace: true })} />
      {view === 'poids' && <WeightPanel />}
      {view === 'entrainement' && <TrainingPanel />}
      {view === 'bien-etre' && <WellbeingPanel />}
    </Screen>
  );
}

function TrainingPanel() {
  const today = useToday();
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const exercises = useExercises();

  const model = useMemo(() => {
    if (!workouts || !sets || !exercises) return null;
    const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Exercice';
    const volumes = weeklyVolumes(workouts, sets, today, 8);
    const records = findRecords(workouts, sets).filter((r) => r.date >= addDays(today, -90));
    const activeWorkoutIds = new Set(workouts.map((w) => w.id));
    const best = new Map<string, { value: number; weightKg: number; reps: number }>();
    for (const s of sets) {
      if (!activeWorkoutIds.has(s.workoutId)) continue;
      const value = e1rm(s.weightKg, s.reps);
      const current = best.get(s.exerciseId);
      if (!current || value > current.value) best.set(s.exerciseId, { value, weightKg: s.weightKg, reps: s.reps });
    }
    const bests = [...best.entries()].map(([id, b]) => ({ id, name: nameOf(id), ...b })).sort((a, b) => b.value - a.value).slice(0, 8);
    return { volumes, records: records.map((r) => ({ ...r, name: nameOf(r.exerciseId) })), bests };
  }, [workouts, sets, exercises, today]);

  if (!model) return null;
  const totalSessions = model.volumes.reduce((n, w) => n + w.sessions, 0);
  if (totalSessions === 0 && model.bests.length === 0) {
    return <p className="rounded-[18px] bg-anthracite p-4 text-[15px] leading-snug text-cendre">Aucune séance enregistrée. Ta progression apparaîtra ici après tes premières séances dans Training.</p>;
  }

  return (
    <>
      <Card label="Volume par semaine">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[13px] text-cendre">Volume par semaine, 8 dernières semaines</h2>
          <p className="text-[13px]">
            En moyenne {formatNumber(totalSessions / 8, 1)} séance{totalSessions / 8 >= 2 ? 's' : ''} par semaine
          </p>
        </div>
        <BarChart
          title="Volume par semaine"
          bars={model.volumes.map((w) => ({
            key: w.weekStart,
            label: formatDayMonth(w.weekStart).split(' ')[0] ?? '',
            value: w.volumeKg,
            detail: `Semaine du ${formatDayMonth(w.weekStart)} : ${formatNumber(w.volumeKg, 0)} kg, ${w.sessions} séance${w.sessions > 1 ? 's' : ''}`,
          }))}
        />
      </Card>

      <section aria-label="Records" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">Records des 90 derniers jours</h2>
        {model.records.length === 0 ? (
          <p className="text-[15px] text-cendre">Pas encore de record : il en faut une première séance de référence par exercice.</p>
        ) : (
          <ul>
            {model.records.slice(0, 10).map((r) => (
              <li key={`${r.workoutId}-${r.exerciseId}`} className="flex min-h-11 items-center justify-between gap-3 border-b border-anthracite py-2 last:border-b-0">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon name="trophy" size={18} className="shrink-0 text-citron" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px]">{r.name}</span>
                    <span className="block text-[12px] text-cendre">
                      {formatDayShort(r.date)}, 1RM estimé {kg(Math.round(r.e1rmKg * 2) / 2)} kg (+{kg(Math.round((r.e1rmKg - r.previousE1rmKg) * 2) / 2)})
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                  {kg(r.weightKg)} kg × {r.reps}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Meilleures performances" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">Meilleures performances</h2>
        <ul>
          {model.bests.map((b) => (
            <li key={b.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-anthracite py-2 last:border-b-0">
              <span className="min-w-0 truncate text-[15px]">{b.name}</span>
              <span className="shrink-0 text-right">
                <span className="block text-[15px] font-semibold tabular-nums">{kg(b.weightKg)} kg × {b.reps}</span>
                <span className="block text-[12px] text-cendre">1RM estimé {kg(Math.round(b.value * 2) / 2)} kg</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-cendre">1RM estimé avec la formule d’Epley, pour comparer des séries de répétitions différentes.</p>
      </section>
    </>
  );
}

function WellbeingPanel() {
  const today = useToday();
  const checkIns = useCheckIns();
  const { openCheckIn } = useCheckInSheet();
  if (!checkIns) return null;
  if (checkIns.length === 0) {
    return <p className="rounded-[18px] bg-anthracite p-4 text-[15px] leading-snug text-cendre">Aucun check-in pour l’instant. Un check-in prend dix secondes : sommeil, énergie, fatigue et courbatures.</p>;
  }
  const week = averageCheckIns(checkIns, today, 7);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const byDate = new Map(checkIns.map((c) => [c.date, c]));

  return (
    <>
      {week && (
        <dl className="grid grid-cols-2 gap-3">
          {[
            ['Sommeil moyen', hours(week.sleepHours)],
            ['Récupération moyenne', `${week.score}/100`],
            ['Énergie moyenne', `${formatNumber(week.energy, 1)}/5`],
            ['Fatigue moyenne', `${formatNumber(week.fatigue, 1)}/5`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[18px] bg-anthracite p-3.5">
              <dt className="text-[12px] text-cendre">{label}</dt>
              <dd className="font-metal mt-1 text-[28px]">{value}</dd>
            </div>
          ))}
          <p className="col-span-2 -mt-1 text-[12px] text-cendre">
            Sur les 7 derniers jours ({week.count} check-in{week.count > 1 ? 's' : ''}).
          </p>
        </dl>
      )}

      <Card label="Sommeil sur 14 jours">
        <h2 className="text-[13px] text-cendre">Sommeil, 14 derniers jours</h2>
        <BarChart
          title="Sommeil par nuit"
          target={8}
          targetLabel="8 h"
          bars={days.map((d) => {
            const c = byDate.get(d);
            return {
              key: d,
              label: formatDayMonth(d).split(' ')[0] ?? '',
              value: c?.sleepHours ?? 0,
              detail: c
                ? `${formatDayShort(d)} : ${hours(c.sleepHours)}, énergie ${c.energy}/5, fatigue ${c.fatigue}/5, récupération ${recoveryScore(c)}/100`
                : `${formatDayShort(d)} : pas de check-in`,
            };
          })}
        />
      </Card>

      <section aria-label="Check-ins" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">Derniers check-ins</h2>
        <ul>
          {[...checkIns]
            .reverse()
            .slice(0, 7)
            .map((c) => (
              <li key={c.id} className="border-b border-anthracite last:border-b-0">
                <button type="button" onClick={() => openCheckIn(c.date)} className="flex min-h-11 w-full items-center justify-between gap-3 py-2.5 text-left">
                  <span className="min-w-0">
                    <span className="block text-[15px]">{formatDayShort(c.date)}</span>
                    <span className="block text-[12px] text-cendre">
                      {hours(c.sleepHours)}, énergie {c.energy}/5, fatigue {c.fatigue}/5, courbatures {c.soreness}/5
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 font-semibold tabular-nums">
                    {recoveryScore(c)}
                    <Icon name="chevron" size={16} className="text-cendre" />
                  </span>
                </button>
              </li>
            ))}
        </ul>
        <p className="mt-2 text-[12px] text-cendre">Récupération estimée : un repère calculé à partir de ton check-in, pas une mesure médicale.</p>
      </section>
    </>
  );
}
