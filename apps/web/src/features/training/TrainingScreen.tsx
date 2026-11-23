import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { EXERCISE_LIBRARY } from '../../data/exerciseLibrary';
import { useAllTemplates, usePrograms, useExercises, useTemplates, useToday, useWorkouts, useWorkoutSets } from '../../db/hooks';
import { activeProgram, completedWorkouts, isoWeekday, setsByWorkout, weekStart, workoutStats } from '../../domain/training';
import { addDays } from '../../lib/dates';
import { countLabel, formatDayShort, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { useDashboardData } from '../dashboard/useDashboardData';
import { SessionHero } from './SessionHero';
import { ProgramsPanel } from './ProgramsSheet';
import { MusclesCard } from '../muscles/MusclesCard';
import { CoachButton } from '../../ui/CoachButton';
import { TrainingMindLinks } from '../mind/LibraryScreens';
import { startWorkout } from './workoutActions';

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const HISTORY_PREVIEW = 6;

export function TrainingScreen() {
  const data = useDashboardData();
  const today = useToday();
  const templates = useTemplates();
  const allTemplates = useAllTemplates();
  const programs = usePrograms();
  const exercises = useExercises();
  const workouts = useWorkouts();
  const sets = useWorkoutSets();
  const navigate = useNavigate();
  const [programsOpen, setProgramsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const history = useMemo(() => {
    if (!workouts || !sets) return [];
    const grouped = setsByWorkout(sets);
    return completedWorkouts(workouts).map((w) => workoutStats(w, grouped.get(w.id) ?? []));
  }, [workouts, sets]);

  const monday = weekStart(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const done = history.some((h) => h.workout.date === date);
    const planned = templates?.some((t) => t.weekdays.includes(i + 1)) ?? false;
    return { date, done, planned, isToday: date === today, past: date < today };
  });

  const freeSession = async () => {
    const id = await startWorkout(null);
    navigate(`/training/seance/${id}`, { viewTransition: true });
  };

  const program = programs ? activeProgram(programs) : null;
  const ownExercises = exercises?.filter((e) => !e.libraryId).length ?? 0;
  const visible = showAll ? history : history.slice(0, HISTORY_PREVIEW);

  return (
    <Screen>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-metal text-[40px]">Training</h1>
        <div className="flex items-center gap-2">
          {!data?.training.inProgress && (
            <Button size="small" variant="secondary" onClick={() => void freeSession()}>
              Séance libre
            </Button>
          )}
          <CoachButton />
        </div>
      </div>

      <ol className="grid grid-cols-7 gap-1.5" aria-label="Cette semaine">
        {week.map((d, i) => (
          <li
            key={d.date}
            aria-label={`${DAY_SHORT[i]} ${d.done ? 'séance faite' : d.planned ? 'séance prévue' : 'repos'}${d.isToday ? ", aujourd'hui" : ''}`}
            className={`flex flex-col items-center gap-1.5 rounded-[12px] py-2 ${d.isToday ? 'bg-anthracite' : ''}`}
          >
            <span className={`text-[12px] ${d.isToday ? 'font-semibold text-craie' : 'text-cendre'}`}>{DAY_LETTERS[i]}</span>
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full ${
                d.done ? 'bg-citron text-noir' : d.planned ? (d.past ? 'border-2 border-braise/70' : 'border-2 border-graphite') : ''
              }`}
            >
              {d.done ? <Icon name="check" size={14} strokeWidth={3} /> : !d.planned ? <span className="h-1 w-1 rounded-full bg-graphite" /> : null}
            </span>
          </li>
        ))}
      </ol>

      {data && <SessionHero data={data} linkToTraining={false} />}
      <TrainingMindLinks />

      <section aria-label="Programme" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold">Programme</h2>
            {program && <p className="truncate text-[13px] text-cendre">{program.name}</p>}
          </div>
          <Button variant="quiet" className="-mr-2 shrink-0" onClick={() => setProgramsOpen(true)}>
            <Icon name="list" size={18} />
            Programmes
          </Button>
        </div>
        {templates?.length === 0 && (
          <div className="flex flex-col gap-3 rounded-[18px] bg-anthracite p-4">
            <p className="text-[15px] leading-snug text-cendre">Aucune séance au programme. Ajoute tes séances et leurs jours : la séance du jour apparaîtra sur l’Accueil.</p>
            <Link to="/reglages/plan" viewTransition className="flex h-[52px] items-center justify-center rounded-[16px] bg-citron text-[17px] font-semibold text-noir">
              Construire mon programme avec le questionnaire
            </Link>
          </div>
        )}
        <ul className="flex flex-col gap-2">
          {templates?.map((t) => (
            <li key={t.id}>
              <Link
                to={`/training/programme/${t.id}`}
                viewTransition
                className="flex min-h-[60px] w-full items-center justify-between gap-3 rounded-[18px] bg-anthracite px-4 py-3 text-left active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[17px] font-semibold">{t.name}</span>
                  <span className="block text-[13px] text-cendre">
                    {t.weekdays.length ? t.weekdays.map((d) => DAY_SHORT[d - 1]).join(', ') : 'Sans jour fixe'}, {t.exercises.length} exercice
                    {t.exercises.length > 1 ? 's' : ''}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-cendre">
                  {t.weekdays.includes(isoWeekday(today)) && <span className="rounded-full bg-citron-voile px-2 py-0.5 text-[12px] text-citron">Aujourd’hui</span>}
                  <Icon name="edit" size={18} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/training/programme/nouvelle" viewTransition className="flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-graphite text-[17px] font-semibold">
          <Icon name="plus" size={18} />
          {templates?.length ? 'Ajouter une séance' : 'Créer une séance'}
        </Link>
      </section>

      <MusclesCard />

      <Link to="/training/exercices" viewTransition className="flex min-h-[64px] items-center justify-between gap-3 rounded-[18px] bg-anthracite px-4 py-3 active:scale-[0.99]">
        <span className="min-w-0">
          <span className="block text-[17px] font-semibold">Exercices</span>
          <span className="block text-[13px] text-cendre">
            {EXERCISE_LIBRARY.length} exercices illustrés, records et progression
            {ownExercises ? `, ${ownExercises} exercice${ownExercises > 1 ? 's' : ''} perso` : ''}
          </span>
        </span>
        <Icon name="chevron" size={16} className="shrink-0 text-cendre" />
      </Link>

      <section aria-label="Historique" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">Historique</h2>
        {history.length === 0 ? (
          <p className="text-[15px] text-cendre">Aucune séance terminée pour l’instant.</p>
        ) : (
          <ul>
            {visible.map(({ workout, setCount, volumeKg }) => (
              <li key={workout.id} className="border-b border-anthracite last:border-b-0">
                <Link to={`/training/seance/${workout.id}`} viewTransition className="flex min-h-11 items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px]">{workout.name}</span>
                    <span className="block text-[13px] text-cendre">{formatDayShort(workout.date)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-right text-[13px] text-cendre">
                    <span>
                      {countLabel(setCount, 'série')}
                      <br />
                      {formatNumber(volumeKg, 0)} kg
                    </span>
                    <Icon name="chevron" size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!showAll && history.length > HISTORY_PREVIEW && (
          <Button variant="quiet" className="-ml-2 self-start" onClick={() => setShowAll(true)}>
            Afficher les {history.length} séances
          </Button>
        )}
      </section>

      <Sheet open={programsOpen} title="Programmes" onClose={() => setProgramsOpen(false)}>
        {programsOpen && programs && allTemplates && <ProgramsPanel programs={programs} templates={allTemplates} onDone={() => setProgramsOpen(false)} />}
      </Sheet>
    </Screen>
  );
}
