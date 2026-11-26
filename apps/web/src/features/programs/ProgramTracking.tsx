import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { MUSCLE_LABELS } from '../../data/muscles';
import { useAllTemplates, useExercises, useProgramVersions, usePrograms, usePulseDays, useToday, useWorkouts, useWorkoutSets } from '../../db/hooks';
import type { Program } from '../../db/types';
import { buildCatalog, catalogItem } from '../../domain/exerciseCatalog';
import type { MuscleResolver } from '../../domain/muscleVolume';
import { TREND_LABELS } from '../../domain/progression';
import { cycleWeek, programStatus } from '../../domain/programs/status';
import {
  adherence,
  cycleWeeks,
  exerciseProgress,
  musclePlanVsDone,
  programHistory,
  programRecords,
  programWorkouts,
  type SlotState,
  type TrackedWeek,
  type WeekSlot,
} from '../../domain/programs/tracking';
import { weekStart } from '../../domain/training';
import { heavy } from '../../domain/volumeMoment';
import { addDays } from '../../lib/dates';
import { countLabel, formatDayMonth, formatDayMonthLong, formatNumber } from '../../lib/format';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { BackLink } from './ProgramsScreen';

/** « 1 séance prévue », « 3 séances prévues ». */
const plural = (n: number, one: string, many: string) => `${formatNumber(n, 0)} ${n >= 2 ? many : one}`;

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const dayIndex = (date: string) => (new Date(`${date}T12:00:00`).getDay() + 6) % 7;

export const SLOT_LABELS: Record<SlotState, string> = {
  faite: 'faite',
  allegee: 'faite en version allégée',
  manquee: 'pas faite',
  aujourdhui: 'prévue aujourd’hui',
  'a-venir': 'à venir',
  deplacee: 'déplacée avec PULSE',
  recuperation: 'récupération active à la place',
};

/** Tout le suivi d'un programme, calculé à partir des données enregistrées. */
export function useProgramTracking(program: Pick<Program, 'id' | 'startDate' | 'durationWeeks'> | null | undefined, withSets = true) {
  const templates = useAllTemplates();
  const versions = useProgramVersions(program?.id);
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const pulseDays = usePulseDays();
  const today = useToday();
  return useMemo(() => {
    if (!program || !templates || !versions || !workouts || !pulseDays || (withSets && !sets)) return null;
    const input = { program, templates, versions, workouts, sets: withSets ? sets! : [], pulseDays, today };
    const weeks = cycleWeeks(input);
    const mine = programWorkouts(program.id, workouts, templates);
    return { weeks, adherence: adherence(weeks), workouts: mine, allWorkouts: workouts, templates, versions, pulseDays, sets: sets ?? [], today };
  }, [program, templates, versions, workouts, sets, pulseDays, today, withSets]);
}

export function ProgramTrackingScreen() {
  const { id } = useParams();
  const programs = usePrograms();
  const program = programs?.find((p) => p.id === id && !p.deletedAt);
  const data = useProgramTracking(program);
  const exercises = useExercises();
  const back = `/training/programmes/${id}`;
  if (programs && !program)
    return (
      <Screen withTabBar={false}>
        <BackLink to="/training/programmes" label="Programmes" />
        <p className="text-[17px]">Ce programme n’existe plus.</p>
      </Screen>
    );
  if (!program || !data || !exercises)
    return (
      <Screen withTabBar={false}>
        <BackLink to={back} label="Programme" />
      </Screen>
    );
  return <Tracking program={program} data={data} exercises={exercises} />;
}

type Data = NonNullable<ReturnType<typeof useProgramTracking>>;

function Tracking({ program, data, exercises }: { program: Program; data: Data; exercises: NonNullable<ReturnType<typeof useExercises>> }) {
  const { weeks, today } = data;
  const here = `/training/programmes/${program.id}`;
  const cycle = cycleWeek(program, today);
  const current = weeks.find((w) => w.current) ?? null;
  const from = program.startDate ?? null;
  const catalog = useMemo(() => buildCatalog(exercises), [exercises]);
  const nameOf = (exerciseId: string) => catalogItem(catalog, exerciseId)?.name ?? 'Exercice supprimé';
  const resolve: MuscleResolver = (exerciseId) => {
    const item = catalogItem(catalog, exerciseId);
    return item ? { muscle: item.muscle, secondary: item.secondary } : null;
  };
  // Une semaine du cycle qui commence n'a encore rien : on montre la précédente tant que rien n'est fait.
  const started = (w: TrackedWeek) => w.slots.some((x) => x.state === 'faite' || x.state === 'allegee') || w.extra.length > 0;
  const previous = current ? weeks.find((w) => w.index === current.index - 1) : undefined;
  const muscleWeek = current && !started(current) && previous ? previous : current;
  const range = muscleWeek ? { from: muscleWeek.start, to: muscleWeek.end } : { from: weekStart(today), to: addDays(weekStart(today), 6) };
  const muscles = musclePlanVsDone(data.templates, program.id, data.workouts, data.sets, resolve, range.from, range.to);
  const inCycle = from ? data.workouts.filter((w) => w.date >= from) : data.workouts;
  const exerciseIds = data.templates.filter((t) => t.programId === program.id && !t.deletedAt).flatMap((t) => t.exercises.map((e) => e.exerciseId));
  const progress = exerciseProgress(exerciseIds, inCycle, data.sets);
  const records = programRecords(new Set(data.workouts.map((w) => w.id)), data.allWorkouts, data.sets, from);
  const history = programHistory(program.id, data.versions, data.pulseDays, data.templates, from);
  const status = programStatus(program);
  const a = data.adherence;
  const thisWeek = current ? current.slots.filter((s) => s.state === 'faite' || s.state === 'allegee').length : null;

  return (
    <Screen withTabBar={false}>
      <BackLink to={here} label={program.name} />
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[40px] leading-none">Suivi</h1>
        <p className="text-[15px] text-cendre">
          {cycle?.kind === 'en-cours'
            ? `${cycle.total ? `Semaine ${cycle.week} sur ${cycle.total}` : `Semaine ${cycle.week}`}, depuis le ${formatDayMonthLong(program.startDate!)}`
            : cycle?.kind === 'fini'
              ? `Les ${cycle.total} semaines du cycle sont passées`
              : cycle?.kind === 'a-venir'
                ? `Le cycle commence le ${formatDayMonthLong(cycle.startDate)}`
                : 'Date de début inconnue'}
          {status !== 'actif' ? `, programme ${status === 'termine' ? 'terminé' : status === 'archive' ? 'archivé' : status === 'brouillon' ? 'en brouillon' : 'en pause'}` : ''}.
        </p>
      </div>

      {!program.startDate && (
        <div className="flex flex-col gap-2 rounded-[18px] bg-anthracite p-4">
          <p className="text-[15px] leading-snug">Sans date de début, FORGE ne peut pas compter tes semaines ni ta régularité. Le reste vient de tes séances.</p>
          <Link to={`${here}/modifier`} viewTransition className="self-start text-[15px] font-semibold text-citron">
            Indiquer la date de début
          </Link>
        </div>
      )}

      {program.startDate && (
        <section aria-label="En bref" className="grid grid-cols-3 gap-2">
          <Tile
            value={a.rate === null ? '–' : `${a.rate} %`}
            label="Régularité"
            hint={a.planned ? `${a.done} sur ${plural(a.planned, 'séance prévue', 'séances prévues')}` : 'Rien de dû encore'}
          />
          <Tile value={current ? `${thisWeek} / ${current.slots.length}` : '–'} label="Cette semaine" hint={current ? 'séances faites' : 'Hors du cycle'} />
          <Tile value={current ? heavy(current.volumeKg) : '–'} label="Volume" hint="cette semaine" />
        </section>
      )}
      {program.startDate && (a.lightened > 0 || a.recovered > 0 || a.extra > 0) && (
        <p className="-mt-2 text-[13px] leading-snug text-cendre">
          {[
            a.lightened ? `${plural(a.lightened, 'séance allégée', 'séances allégées')} avec PULSE, ${a.lightened > 1 ? 'comptées comme faites' : 'comptée comme faite'}` : null,
            a.recovered
              ? `${plural(a.recovered, 'récupération active', 'récupérations actives')} choisie${a.recovered > 1 ? 's' : ''} avec PULSE, pas comptée${a.recovered > 1 ? 's' : ''} comme due${a.recovered > 1 ? 's' : ''}`
              : null,
            a.extra ? `${plural(a.extra, 'séance en plus', 'séances en plus')}` : null,
          ]
            .filter(Boolean)
            .join(' ; ')}
          .
        </p>
      )}

      {weeks.length > 0 && <WeeksCalendar weeks={weeks} />}

      {weeks.some((w) => w.past || w.current) && <VolumeBars weeks={weeks.filter((w) => w.past || w.current)} />}

      {muscles.length > 0 && (
        <section aria-label="Séries par muscle" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
          <div>
            <h2 className="text-[17px] font-semibold">Séries par muscle</h2>
            <p className="text-[13px] text-cendre">
              Séries directes faites{' '}
              {muscleWeek
                ? muscleWeek === current
                  ? `cette semaine (semaine ${muscleWeek.index})`
                  : `en semaine ${muscleWeek.index}, la semaine ${current!.index} commence`
                : 'cette semaine'}
              , sur celles prévues par le programme.
            </p>
          </div>
          <ul className="flex flex-col gap-2.5">
            {muscles.map((m) => (
              <li
                key={m.muscle}
                className="grid grid-cols-[104px_1fr_56px] items-center gap-2"
                aria-label={`${MUSCLE_LABELS[m.muscle]} : ${m.done} séries sur ${m.planned} prévues`}
              >
                <span className="truncate text-[13px]">{MUSCLE_LABELS[m.muscle]}</span>
                <span className="relative h-3 overflow-hidden rounded-[4px] bg-graphite" aria-hidden="true">
                  <span className="absolute inset-y-0 left-0 rounded-[4px] bg-citron" style={{ width: `${Math.min(100, m.planned ? (m.done / m.planned) * 100 : 100)}%` }} />
                </span>
                <span className="text-right text-[13px] tabular-nums" aria-hidden="true">
                  {m.done}
                  <span className="text-cendre"> / {m.planned}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Progression" className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Progression</h2>
        {progress.length ? (
          <ul className="flex flex-col gap-2">
            {progress.slice(0, 8).map((p) => (
              <li key={p.exerciseId} className="flex items-center justify-between gap-3 rounded-[18px] bg-anthracite px-4 py-3">
                <span className="min-w-0">
                  <span className="block text-[15px] leading-tight font-semibold">{nameOf(p.exerciseId)}</span>
                  <span className="block text-[13px] text-cendre tabular-nums">
                    1RM estimé {formatNumber(p.firstE1rm, 0)} → {formatNumber(p.bestE1rm, 0)} kg, {countLabel(p.sessions, 'séance')}. {TREND_LABELS[p.trend]}
                  </span>
                </span>
                <span className={`shrink-0 font-metal text-[22px] tabular-nums ${p.change > 0 ? 'text-citron' : 'text-cendre'}`}>
                  {p.change > 0 ? '+' : ''}
                  {formatNumber(p.change, 1)} %
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] leading-snug text-cendre">Il faut au moins deux séances avec charge sur un même exercice du programme pour mesurer sa progression.</p>
        )}
        <p className="text-[12px] text-cendre">1RM estimé par la formule d’Epley, de la première séance {from ? 'du cycle' : 'du programme'} à la meilleure.</p>
      </section>

      <section aria-label="Records" className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Records {from ? 'du cycle' : 'du programme'}</h2>
        {records.length ? (
          <ul className="flex flex-col">
            {records.slice(0, 8).map((r) => (
              <li key={`${r.workoutId}-${r.exerciseId}`} className="flex items-center gap-3 border-b border-graphite py-2 last:border-b-0">
                <Icon name="trophy" size={18} className="shrink-0 text-citron" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-tight">{nameOf(r.exerciseId)}</span>
                  <span className="block text-[13px] text-cendre tabular-nums">
                    {formatDayMonth(r.date)}, {formatNumber(r.weightKg, r.weightKg % 1 ? 1 : 0)} kg × {r.reps}, 1RM estimé {e1rmPair(r.e1rmKg, r.previousE1rmKg)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-cendre">Pas encore de record pendant ce programme.</p>
        )}
        {records.length > 8 && <p className="text-[13px] text-cendre">Et {records.length - 8} autres.</p>}
      </section>

      <section aria-label="Historique" className="flex flex-col gap-2 pb-4">
        <h2 className="text-[17px] font-semibold">Historique</h2>
        <p className="-mt-1 text-[13px] text-cendre">Les versions du programme et les choix faits avec PULSE sur ses séances.</p>
        {history.length ? (
          <ol className="flex flex-col">
            {history.map((h) => (
              <li key={h.kind === 'version' ? h.versionId : `${h.date}-${h.text}`} className="flex gap-3 border-b border-graphite py-2.5 last:border-b-0">
                <span className="w-14 shrink-0 text-[13px] text-cendre tabular-nums">{formatDayMonth(h.date)}</span>
                {h.kind === 'version' ? (
                  <Link to={`${here}/versions/${h.versionId}`} viewTransition className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-tight font-semibold">Version {h.version}</span>
                    <span className="line-clamp-2 block text-[13px] leading-snug text-cendre">{h.text}</span>
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-tight font-semibold">PULSE{h.session ? `, ${h.session}` : ''}</span>
                    <span className="block text-[13px] leading-snug text-cendre">{h.text}</span>
                  </span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[15px] text-cendre">Rien pour l’instant.</p>
        )}
      </section>
    </Screen>
  );
}

/** « 280,2 kg (avant 279,9) » : une décimale seulement quand l'arrondi cacherait l'écart. */
function e1rmPair(now: number, before: number): string {
  const d = Math.round(now) === Math.round(before) ? 1 : 0;
  return `${formatNumber(now, d)} kg (avant ${formatNumber(before, d)})`;
}

function Tile({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[18px] bg-anthracite px-3 py-3">
      <span className="text-[12px] text-cendre">{label}</span>
      <span className="font-metal text-[26px] leading-none tabular-nums">{value}</span>
      <span className="text-[12px] leading-tight text-cendre">{hint}</span>
    </div>
  );
}

const SLOT_STYLES: Record<SlotState, string> = {
  faite: 'bg-citron text-noir',
  allegee: 'bg-citron/30 text-citron ring-1 ring-citron/60',
  manquee: 'bg-transparent text-cendre ring-1 ring-cendre/40 line-through',
  aujourdhui: 'bg-graphite text-craie ring-2 ring-citron',
  'a-venir': 'bg-graphite text-cendre',
  deplacee: 'bg-graphite text-cendre ring-1 ring-cendre/40',
  recuperation: 'bg-graphite text-cendre ring-1 ring-cendre/40',
};
const SLOT_MARK: Partial<Record<SlotState, string>> = { allegee: '½', deplacee: '→', recuperation: 'R' };

function SlotChip({ slot }: { slot: WeekSlot }) {
  const mark = SLOT_MARK[slot.state];
  return (
    <span
      className={`relative flex h-9 w-9 items-center justify-center rounded-[10px] text-[13px] font-semibold ${SLOT_STYLES[slot.state]}`}
      aria-label={`${DAY_NAMES[dayIndex(slot.date)]} ${formatDayMonth(slot.date)}, ${slot.name} : ${SLOT_LABELS[slot.state]}`}
      role="img"
    >
      {DAY_LETTERS[dayIndex(slot.date)]}
      {mark && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-noir px-0.5 text-[10px] leading-none text-craie">{mark}</span>
      )}
    </span>
  );
}

/** Les semaines du cycle, passées et à venir : chaque séance prévue avec son état, et le détail d'une semaine en la touchant. */
function WeeksCalendar({ weeks }: { weeks: TrackedWeek[] }) {
  return (
    <section aria-label="Semaines du cycle" className="flex flex-col gap-2">
      <h2 className="text-[17px] font-semibold">Semaines du cycle</h2>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-cendre" aria-label="Légende">
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] bg-citron" /> Faite
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] bg-citron/30 ring-1 ring-citron/60" /> Allégée (½)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] ring-1 ring-cendre/40" /> Pas faite
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] bg-graphite" /> À venir
        </li>
        <li>→ déplacée, R récupération (PULSE)</li>
      </ul>
      <ol className="flex flex-col gap-1.5">
        {weeks.map((w) => (
          <li key={w.index}>
            <details className={`group rounded-[16px] px-3 py-2 ${w.current ? 'bg-anthracite ring-1 ring-citron/40' : 'bg-anthracite/60'}`}>
              <summary className="flex cursor-pointer list-none flex-col gap-2 py-1 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-semibold">
                    Semaine {w.index}
                    <span className="ml-2 text-[13px] font-normal text-cendre tabular-nums">
                      {formatDayMonth(w.start)} au {formatDayMonth(w.end)}
                    </span>
                  </span>
                  <Icon name="chevron" size={16} className="shrink-0 text-cendre transition-transform group-open:rotate-90" />
                </span>
                <span className="flex min-w-0 flex-wrap gap-1.5">
                  {w.slots.map((s) => (
                    <SlotChip key={`${s.date}-${s.templateId}`} slot={s} />
                  ))}
                  {w.extra.length > 0 && (
                    <span
                      className="flex h-9 items-center rounded-[10px] bg-citron-voile px-2 text-[12px] font-semibold text-citron"
                      aria-label={`${plural(w.extra.length, 'séance en plus', 'séances en plus')}`}
                    >
                      +{w.extra.length}
                    </span>
                  )}
                  {!w.slots.length && !w.extra.length && <span className="text-[13px] text-cendre">Aucune séance prévue</span>}
                </span>
              </summary>
              <ul className="flex flex-col gap-1 pt-1 pb-1">
                {w.slots.map((s) => (
                  <li key={`${s.date}-${s.templateId}`} className="text-[13px] leading-snug">
                    <span className="text-cendre capitalize">{DAY_NAMES[dayIndex(s.date)]}</span> {s.name} : {SLOT_LABELS[s.state]}
                  </li>
                ))}
                {w.extra.map((e) => (
                  <li key={e.workoutId} className="text-[13px] leading-snug">
                    <span className="text-cendre capitalize">{DAY_NAMES[dayIndex(e.date)]}</span> {e.name} : en plus
                  </li>
                ))}
                {(w.past || w.current) && <li className="text-[13px] text-cendre tabular-nums">Volume : {heavy(w.volumeKg)}</li>}
              </ul>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Volume (charge × répétitions) de chaque semaine du cycle jusqu'à aujourd'hui. Valeurs écrites sous chaque barre. */
function VolumeBars({ weeks }: { weeks: TrackedWeek[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.volumeKg));
  const shown = weeks.slice(-12);
  return (
    <section aria-label="Volume par semaine" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
      <div>
        <h2 className="text-[17px] font-semibold">Volume par semaine</h2>
        <p className="text-[13px] text-cendre">Charge × répétitions de toutes les séries du programme.</p>
      </div>
      <ol className="flex h-36 items-end gap-1.5">
        {shown.map((w) => (
          <li key={w.index} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" aria-label={`Semaine ${w.index} : ${heavy(w.volumeKg)}`}>
            <span className="text-[10px] text-cendre tabular-nums" aria-hidden="true">
              {w.volumeKg ? formatNumber(w.volumeKg / 1000, 1) : '0'}
            </span>
            <span
              className={`w-full max-w-9 rounded-t-[4px] ${w.current ? 'bg-citron' : 'bg-citron/50'}`}
              style={{ height: `${Math.max(w.volumeKg ? 4 : 1, (w.volumeKg / max) * 100)}%` }}
              aria-hidden="true"
            />
            <span className="text-[11px] text-cendre tabular-nums" aria-hidden="true">
              S{w.index}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-[12px] text-cendre">En tonnes. La semaine en cours est en plein.</p>
    </section>
  );
}
