import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, type Equipment } from '../../data/muscles';
import { repos, useAllTemplates, useExercises, useTemplates, useToday, useWorkouts, useWorkoutSets } from '../../db/hooks';
import { buildCatalog, catalogItem } from '../../domain/exerciseCatalog';
import {
  exerciseRecords,
  exerciseSessions,
  exerciseTrend,
  parseRepRange,
  sinceForPeriod,
  suggestNext,
  TREND_LABELS,
  type SessionPerf,
  type TrendKind,
} from '../../domain/progression';
import { formatRest } from '../../domain/workoutFlow';
import { countLabel, formatDayShort, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { Sheet } from '../../ui/Sheet';
import { StatusChip } from '../../ui/StatusChip';
import { useToast } from '../../ui/Toast';
import { CustomExerciseForm } from './CustomExerciseForm';
import { ExerciseChart } from './ExerciseChart';
import { ExerciseDemo } from './ExerciseVisual';

export const kgText = (v: number) => formatNumber(v, v % 1 ? (Math.round(v * 100) % 10 ? 2 : 1) : 0);

type Period = '30' | '90' | '365' | 'all';
type Metric = 'e1rm' | 'load' | 'volume';
const PERIODS = [
  { value: '30', label: '30 j' },
  { value: '90', label: '90 j' },
  { value: '365', label: '1 an' },
  { value: 'all', label: 'Tout' },
] as const;
const METRICS = [
  { value: 'e1rm', label: '1RM estimé' },
  { value: 'load', label: 'Charge max' },
  { value: 'volume', label: 'Volume' },
] as const;

const TREND_STYLE: Record<TrendKind, { icon: IconName; tone: 'good' | 'neutral' | 'alert' }> = {
  progression: { icon: 'trendUp', tone: 'good' },
  stagnation: { icon: 'flat', tone: 'neutral' },
  regression: { icon: 'trendDown', tone: 'alert' },
  irregular: { icon: 'warning', tone: 'neutral' },
  insufficient: { icon: 'clock', tone: 'neutral' },
};

export const setsText = (s: SessionPerf) => s.sets.map((x) => `${kgText(x.weightKg)} × ${x.reps}${x.rir !== null && x.rir !== undefined ? ` (RIR ${x.rir})` : ''}`).join(', ');

/** Fiche d'un exercice : démonstration, muscles, consignes, records par période, courbe et historique. */
export function ExerciseDetailScreen() {
  const { key = '' } = useParams();
  const exercises = useExercises();
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const templates = useTemplates();
  const allTemplates = useAllTemplates();
  const today = useToday();
  const navigate = useNavigate();
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('90');
  const [metric, setMetric] = useState<Metric>('e1rm');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const catalog = useMemo(() => buildCatalog(exercises ?? []), [exercises]);
  const item = catalogItem(catalog, key);
  const sessions = useMemo(() => (item?.exercise && workouts && sets ? exerciseSessions(item.exercise.id, workouts, sets) : []), [item?.exercise, workouts, sets]);

  if (!exercises || !workouts || !sets || !templates || !allTemplates)
    return (
      <Screen withTabBar={false}>
        <BackLink />
      </Screen>
    );
  if (!item) {
    return (
      <Screen withTabBar={false}>
        <BackLink />
        <p className="text-[17px]">Cet exercice n’existe plus.</p>
      </Screen>
    );
  }

  const since = sinceForPeriod(today, period === 'all' ? null : (Number(period) as 30 | 90 | 365));
  const inPeriod = since ? sessions.filter((s) => s.date >= since) : sessions;
  const records = exerciseRecords(sessions, since);
  const trend = exerciseTrend(sessions);
  const target = templates.flatMap((t) => t.exercises).find((e) => e.exerciseId === item.exercise?.id);
  const suggestion = suggestNext(sessions, parseRepRange(target?.reps));
  const used = Boolean(item.exercise && (sessions.length || allTemplates.some((t) => t.exercises.some((e) => e.exerciseId === item.exercise!.id))));

  const value = (s: SessionPerf) => (metric === 'e1rm' ? Math.round(s.e1rmKg * 10) / 10 : metric === 'load' ? s.maxLoad : s.volumeKg);
  const points = inPeriod.map((s) => ({
    date: s.date,
    value: value(s),
    detail: setsText(s),
  }));
  const metricLabel = METRICS.find((m) => m.value === metric)!.label;

  const remove = async () => {
    if (!item.exercise) return;
    await repos.exercises.remove(item.exercise.id);
    toast.show('Exercice supprimé');
    navigate('/training/exercices', { replace: true });
  };

  return (
    <Screen withTabBar={false}>
      <BackLink />
      {item.images && <ExerciseDemo images={item.images} name={item.name} />}
      <div className="flex flex-col gap-2">
        <h1 className="font-metal text-[36px] leading-none">{item.name}</h1>
        <ul className="flex flex-wrap gap-1.5" aria-label="Muscles et matériel">
          {item.muscle ? (
            <li className="rounded-full bg-citron px-2.5 py-1 text-[13px] font-semibold text-noir">{MUSCLE_LABELS[item.muscle]}</li>
          ) : (
            <li className="rounded-full bg-graphite px-2.5 py-1 text-[13px] text-braise">Muscle à préciser</li>
          )}
          {item.secondary.map((m) => (
            <li key={m} className="rounded-full bg-graphite px-2.5 py-1 text-[13px]">
              {MUSCLE_LABELS[m]}
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-3 gap-2 text-[13px]">
          {[
            ['Matériel', item.equipment ? EQUIPMENT_LABELS[item.equipment as Equipment] : 'Non précisé'],
            ['Type', item.kind === 'compound' ? 'Polyarticulaire' : item.kind === 'isolation' ? 'Isolation' : 'Non précisé'],
            ['Repos', item.rest ? formatRest(item.rest) : 'Non précisé'],
          ].map(([label, text]) => (
            <div key={label}>
              <dt className="text-cendre">{label}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </div>

      {!item.library && !item.muscle && (
        <div className="flex flex-col gap-3 rounded-[18px] bg-anthracite p-4">
          <p className="text-[15px] leading-snug">Précise le muscle principal de cet exercice : il sert au suivi du volume par muscle.</p>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Compléter l’exercice
          </Button>
        </div>
      )}

      {item.cues.length > 0 && (
        <section aria-label="Consignes" className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-4">
          <h2 className="text-[17px] font-semibold">Consignes</h2>
          <ul className="flex flex-col gap-2">
            {item.cues.map((c) => (
              <li key={c} className="flex gap-2.5 text-[15px] leading-snug">
                <Icon name="check" size={16} strokeWidth={2.6} className="mt-0.5 shrink-0 text-citron" />
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Tes performances" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold">Tes performances</h2>
          {sessions.length > 0 && <StatusChip icon={TREND_STYLE[trend.kind].icon} tone={TREND_STYLE[trend.kind].tone} label={TREND_LABELS[trend.kind]} />}
        </div>
        {sessions.length === 0 ? (
          <p className="text-[15px] text-cendre">Pas encore fait. Tes records et ta courbe apparaîtront après ta première séance.</p>
        ) : (
          <>
            <p className="text-[15px] leading-snug text-cendre">{trend.text}</p>
            {suggestion && (
              <div className="flex flex-col gap-1 rounded-[18px] border border-graphite p-4">
                <p className="text-[13px] text-cendre">Prochain objectif proposé</p>
                <p className="font-metal text-[28px]">
                  {kgText(suggestion.weightKg)} <span className="font-sans text-[15px] font-normal text-cendre">kg</span> × {suggestion.reps}{' '}
                  <span className="font-sans text-[15px] font-normal text-cendre">sur chaque série</span>
                </p>
                <p className="text-[13px] leading-snug text-cendre">{suggestion.reason} C’est une proposition : FORGE ne change jamais ta charge à ta place.</p>
              </div>
            )}
            <Segmented label="Période" options={PERIODS} value={period} onChange={setPeriod} />
            {inPeriod.length === 0 ? (
              <p className="text-[15px] text-cendre">Aucune séance sur cette période.</p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-2">
                  {[
                    ['Meilleure charge', records.bestLoad ? `${kgText(records.bestLoad.weightKg)} kg × ${records.bestLoad.reps}` : '–', records.bestLoad?.date],
                    ['Meilleures répétitions', records.bestReps ? `${records.bestReps.reps} à ${kgText(records.bestReps.weightKg)} kg` : '–', records.bestReps?.date],
                    ['Force estimée (1RM)', records.bestE1rm ? `${kgText(Math.round(records.bestE1rm.valueKg * 10) / 10)} kg` : '–', records.bestE1rm?.date],
                    ['Meilleur volume', records.bestVolume ? `${formatNumber(records.bestVolume.volumeKg, 0)} kg` : '–', records.bestVolume?.date],
                  ].map(([label, text, date]) => (
                    <div key={label} className="rounded-[16px] bg-anthracite p-3">
                      <dt className="text-[12px] text-cendre">{label}</dt>
                      <dd className="font-metal text-[22px] leading-tight">{text}</dd>
                      {date && <dd className="text-[12px] text-cendre">{formatDayShort(date)}</dd>}
                    </div>
                  ))}
                </dl>
                <div className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-4">
                  <Segmented label="Mesure affichée" options={METRICS} value={metric} onChange={setMetric} />
                  <ExerciseChart
                    points={points}
                    unit="kg"
                    minSpan={metric === 'volume' ? 200 : 5}
                    summary={`${metricLabel} sur ${countLabel(points.length, 'séance')}, de ${formatNumber(points[0]!.value, 0)} à ${formatNumber(points.at(-1)!.value, 0)} kg.`}
                  />
                  <p className="text-[12px] text-cendre">
                    {metric === 'e1rm'
                      ? 'Force estimée : 1RM calculé à partir de ta meilleure série (formule d’Epley).'
                      : metric === 'load'
                        ? 'La charge la plus lourde de chaque séance.'
                        : 'Volume : charge × répétitions, toutes séries confondues.'}
                  </p>
                </div>
                <section aria-label="Historique de l’exercice" className="flex flex-col">
                  <h3 className="mb-1 text-[15px] font-semibold">Historique</h3>
                  <ul>
                    {[...inPeriod].reverse().map((s) => (
                      <li key={s.workoutId} className="border-b border-anthracite last:border-b-0">
                        <Link to={`/training/seance/${s.workoutId}`} viewTransition className="flex min-h-11 items-center justify-between gap-3 py-2.5">
                          <span className="min-w-0">
                            <span className="block text-[15px]">{formatDayShort(s.date)}</span>
                            <span className="block text-[13px] leading-snug text-cendre">{setsText(s)}</span>
                          </span>
                          <Icon name="chevron" size={16} className="shrink-0 text-cendre" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </>
        )}
      </section>

      {!item.library && item.exercise && (
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Icon name="edit" size={18} />
            Modifier l’exercice
          </Button>
          {!used &&
            (confirmDelete ? (
              <Button variant="danger" onClick={() => void remove()}>
                Confirmer la suppression
              </Button>
            ) : (
              <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirmDelete(true)}>
                Supprimer l’exercice
              </Button>
            ))}
          {used && <p className="text-center text-[13px] text-cendre">Exercice utilisé dans tes séances : il ne peut pas être supprimé.</p>}
        </div>
      )}
      {item.library && <p className="text-[12px] text-cendre">Illustrations : Free Exercise DB, domaine public. Consignes rédigées pour FORGE.</p>}

      <Sheet open={editing} title="Modifier l’exercice" onClose={() => setEditing(false)}>
        {editing && item.exercise && (
          <CustomExerciseForm
            editing={item.exercise}
            others={exercises}
            onSaved={() => {
              setEditing(false);
              toast.show('Exercice enregistré');
            }}
          />
        )}
      </Sheet>
    </Screen>
  );
}

function BackLink() {
  return (
    <Link to="/training/exercices" viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      Exercices
    </Link>
  );
}
