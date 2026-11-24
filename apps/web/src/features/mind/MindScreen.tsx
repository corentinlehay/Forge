import { useMemo } from 'react';
import { Link } from 'react-router';
import { MIND_EXERCISE_BY_ID } from '../../data/mindExercises';
import { repos, useAudioStates, useCheckIns, useMindSessions, useMoodLogs, useProfile, useTemplates, useToday, useWorkouts } from '../../db/hooks';
import type { MoodLog, Scale5 } from '../../db/types';
import {
  CATEGORY_INFO,
  CATEGORY_ORDER,
  exerciseSeconds,
  formatDuration,
  greeting,
  MOOD_FIELDS,
  moodAverages,
  practiceSummary,
  recommendMind,
  routineSeconds,
  ROUTINE_ORDER,
  suggestedExercises,
  type MoodKey,
} from '../../domain/mind';
import { completedWorkouts, templateForDay, weekStart } from '../../domain/training';
import { addDays } from '../../lib/dates';
import { formatDayLong, formatNumber } from '../../lib/format';
import { BarChart } from '../../ui/BarChart';
import { CoachButton } from '../../ui/CoachButton';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { useToast } from '../../ui/Toast';
import { MindCaution, SessionRow, useRoutines } from './mindShared';
import { useAudioCatalog } from '../../services/audioApi';
import { resumePosition } from '../../domain/audio';
import { AudioShelf } from '../audio/AudioScreens';

const QUICK: MoodKey[] = ['mood', 'stress', 'mentalEnergy'];
const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Accueil FORGE MIND : état du jour, recommandation, catégories, routines, habitudes, progression. */
export function MindScreen() {
  const profile = useProfile();
  const today = useToday();
  const moods = useMoodLogs();
  const sessions = useMindSessions();
  const checkIns = useCheckIns();
  const workouts = useWorkouts();
  const templates = useTemplates();
  const { routines } = useRoutines();
  const toast = useToast();
  const { items: audio } = useAudioCatalog();
  const audioStates = useAudioStates();
  const audioShelf = useMemo(() => {
    const resumable = (id: string, d: number) => {
      const st = audioStates?.get(id);
      return st ? resumePosition(st.position, st.durationSec || d) > 0 : false;
    };
    return [...audio].sort((a, b) => Number(resumable(b.id, b.durationSec)) - Number(resumable(a.id, a.durationSec))).slice(0, 3);
  }, [audio, audioStates]);
  const hasHypnosis = audio.some((a) => a.format === 'hypnose');

  const model = useMemo(() => {
    if (!moods || !sessions || !checkIns || !workouts || !templates) return null;
    const now = new Date();
    const todayLog = moods.find((m) => m.date === today) ?? null;
    const doneToday = new Set(sessions.filter((s) => s.date === today && s.completed).map((s) => s.ref));
    const lastWorkout = completedWorkouts(workouts)[0];
    const endedToday = lastWorkout?.date === today && lastWorkout.endedAt ? Math.round((now.getTime() - new Date(lastWorkout.endedAt).getTime()) / 60000) : null;
    const trainedToday = workouts.some((w) => w.date === today && !w.deletedAt);
    const reco = recommendMind({
      hour: now.getHours(),
      mood: todayLog,
      lastNight: checkIns.find((c) => c.date === today) ?? null,
      workoutEndedMinutesAgo: endedToday,
      trainingPlanned: !trainedToday && templateForDay(templates, today) !== null,
      doneToday,
    });
    const more = suggestedExercises(reco, today, doneToday);
    const practice = practiceSummary(sessions, today);
    const monday = weekStart(today);
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(monday, (i - 7) * 7)).map((start) => {
      const end = addDays(start, 6);
      const min = Math.round(sessions.filter((s) => s.date >= start && s.date <= end).reduce((a, s) => a + s.durationSec / 60, 0));
      return { start, min };
    });
    const trends = (['mood', 'stress', 'mentalEnergy'] as const).map((k) => ({ key: k, ...moodAverages(moods, k, today) }));
    return { todayLog, reco, more, practice, weeks, trends };
  }, [moods, sessions, checkIns, workouts, templates, today]);

  const setQuick = async (key: MoodKey, value: Scale5) => {
    const existing = model?.todayLog;
    if (existing) await repos.moodLogs.update(existing.id, { [key]: value } as Partial<MoodLog>);
    else await repos.moodLogs.add({ date: today, [key]: value });
    toast.show('Noté dans ton journal');
  };

  const hour = new Date().getHours();
  const reco = model?.reco;
  const recoTarget = reco?.target;
  const recoTitle = recoTarget ? (recoTarget.kind === 'routine' ? routines[recoTarget.id].title : MIND_EXERCISE_BY_ID.get(recoTarget.id)!.title) : '';
  const recoSeconds = recoTarget ? (recoTarget.kind === 'routine' ? routineSeconds(routines[recoTarget.id]) : exerciseSeconds(MIND_EXERCISE_BY_ID.get(recoTarget.id)!)) : 0;
  const recoLink = recoTarget ? (recoTarget.kind === 'routine' ? `/mind/routine/${recoTarget.id}` : `/mind/exercice/${recoTarget.id}`) : '/mind';

  return (
    <Screen>
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[15px] text-cendre">{formatDayLong(today)}</p>
          <h1 className="font-metal text-[40px] leading-none">{greeting(hour, profile?.firstName)}</h1>
        </div>
        <CoachButton />
      </header>

      <section aria-label="État du jour" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Comment tu te sens ?</h2>
          <Link to="/mind/journal" viewTransition className="flex min-h-11 items-center px-1 text-[15px] text-brume">
            Journal
          </Link>
        </div>
        {QUICK.map((key) => {
          const field = MOOD_FIELDS.find((f) => f.key === key)!;
          const value = (model?.todayLog?.[key] as Scale5 | null | undefined) ?? null;
          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-[15px]">{field.label}</span>
              <span
                className="flex gap-1.5"
                role="radiogroup"
                aria-label={`${field.label} : 1 ${field.low.toLocaleLowerCase('fr-FR')}, 5 ${field.high.toLocaleLowerCase('fr-FR')}`}
              >
                {([1, 2, 3, 4, 5] as Scale5[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={value === v}
                    aria-label={`${field.label} ${v}`}
                    onClick={() => void setQuick(key, v)}
                    className={`h-10 w-10 rounded-full text-[15px] tabular-nums transition-colors ${value === v ? 'bg-brume font-semibold text-noir' : 'bg-graphite text-cendre'}`}
                  >
                    {v}
                  </button>
                ))}
              </span>
            </div>
          );
        })}
        <p className="text-[12px] text-cendre">Facultatif : note ce que tu veux, quand tu veux.</p>
      </section>

      {reco && (
        <section aria-label="Recommandé maintenant" className="flex flex-col gap-3 rounded-[22px] bg-brume-voile p-[18px] outline-1 outline-brume/30">
          <p className="text-[13px] text-brume">Pour toi, maintenant</p>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-metal text-[28px] leading-tight">{recoTitle}</h2>
              <p className="text-[13px] text-cendre">{formatDuration(recoSeconds)}</p>
            </div>
            <Link
              to={recoLink}
              viewTransition
              aria-label={`Commencer : ${recoTitle}`}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-citron text-noir active:scale-95"
            >
              <Icon name="play" size={24} />
            </Link>
          </div>
          <p className="text-[15px] leading-snug">{reco.reason}</p>
          {model.more.length > 0 && (
            <div className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px] pb-1">
              {model.more.map((e) => (
                <Link key={e.id} to={`/mind/exercice/${e.id}`} viewTransition className="shrink-0 rounded-full bg-graphite px-3.5 py-2 text-[14px] whitespace-nowrap">
                  {e.title} <span className="text-cendre">{formatDuration(exerciseSeconds(e))}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <AudioShelf title="Séances audio" items={audioShelf} more="/mind/audio" />

      <section aria-label="Catégories" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Exercices guidés</h2>
          <Link to="/mind/exercices" viewTransition className="flex min-h-11 items-center px-1 text-[15px] text-brume">
            Tout voir
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORY_ORDER.map((c) => (
            <Link
              key={c}
              to={`/mind/exercices?categorie=${c}`}
              viewTransition
              className="flex min-h-[76px] flex-col justify-between rounded-[18px] bg-anthracite p-3.5 active:scale-[0.99]"
            >
              <span className="text-[17px] font-semibold">{CATEGORY_INFO[c].label}</span>
              <span className="text-[12px] text-cendre">{CATEGORY_INFO[c].blurb}</span>
            </Link>
          ))}
          {hasHypnosis && (
            <Link
              to="/mind/hypnose"
              viewTransition
              className="flex min-h-[76px] flex-col justify-between rounded-[18px] bg-brume-voile p-3.5 outline-1 outline-brume/25 active:scale-[0.99]"
            >
              <span className="text-[17px] font-semibold">Hypnose</span>
              <span className="text-[12px] text-cendre">Séances guidées, par thème</span>
            </Link>
          )}
          <Link to="/mind/preparation" viewTransition className="flex min-h-[76px] flex-col justify-between rounded-[18px] bg-anthracite p-3.5 active:scale-[0.99]">
            <span className="text-[17px] font-semibold">Mental du sportif</span>
            <span className="text-[12px] text-cendre">Pression, confiance, stagnation</span>
          </Link>
        </div>
      </section>

      <section aria-label="Routines" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">Routines</h2>
        <ul>
          {ROUTINE_ORDER.map((id) => (
            <li key={id} className="border-b border-anthracite last:border-b-0">
              <Link to={`/mind/routine/${id}`} viewTransition className="flex min-h-16 items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-[17px]">{routines[id].title}</span>
                  <span className="block text-[13px] text-cendre">
                    {routines[id].steps.length} exercices, {formatDuration(routineSeconds(routines[id]))}
                  </span>
                </span>
                <Icon name="chevron" size={18} className="shrink-0 text-cendre" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Link to="/mind/sommeil" viewTransition className="flex items-center justify-between gap-3 rounded-[18px] bg-anthracite p-4 active:scale-[0.99]">
        <span className="flex items-center gap-3">
          <Icon name="moon" size={22} className="text-brume" />
          <span>
            <span className="block text-[17px] font-semibold">Sommeil</span>
            <span className="block text-[13px] text-cendre">Tes nuits, leur régularité, le rituel du soir</span>
          </span>
        </span>
        <Icon name="chevron" size={18} className="text-cendre" />
      </Link>

      {model && (
        <section aria-label="Habitudes" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
          <h2 className="text-[17px] font-semibold">Ta pratique</h2>
          <ol className="grid grid-cols-7 gap-1.5" aria-label="Cette semaine">
            {model.practice.week.map((d, i) => (
              <li key={d.date} className="flex flex-col items-center gap-1" aria-label={`${DAY_LETTERS[i]} : ${d.minutes ? `${d.minutes} min` : 'rien'}`}>
                <span className="text-[12px] text-cendre">{DAY_LETTERS[i]}</span>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] tabular-nums ${d.minutes ? 'bg-brume text-noir' : d.date === today ? 'border border-brume/50' : 'bg-graphite/60'}`}
                >
                  {d.minutes || ''}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-[15px]">
            {model.practice.minutes30 > 0
              ? `${model.practice.minutes30} min sur 30 jours, ${model.practice.sessions30} pratique${model.practice.sessions30 > 1 ? 's' : ''}.`
              : 'Ta première pratique apparaîtra ici.'}
            {model.practice.streak >= 2 && <span className="text-brume"> {model.practice.streak} jours de suite.</span>}
          </p>
          {model.weeks.some((w) => w.min > 0) && (
            <BarChart
              tone="brume"
              title="Minutes par semaine"
              height={96}
              bars={model.weeks.map((w) => ({
                key: w.start,
                label: `${w.start.slice(8, 10)}/${w.start.slice(5, 7)}`,
                value: w.min,
                detail: `Semaine du ${formatDayLong(w.start).toLocaleLowerCase('fr-FR')} : ${w.min} min`,
              }))}
            />
          )}
          {model.trends.some((t) => t.current !== null) && <p className="-mb-2 border-t border-graphite pt-3 text-[13px] text-cendre">Journal, moyennes sur 7 jours</p>}
          {model.trends.some((t) => t.current !== null) && (
            <dl className="grid grid-cols-3 gap-2" aria-label="Moyennes du journal sur 7 jours">
              {model.trends.map((t) => {
                const field = MOOD_FIELDS.find((f) => f.key === t.key)!;
                return (
                  <div key={t.key}>
                    <dt className="text-[12px] text-cendre">{field.label.split(' ')[0]}</dt>
                    <dd className="font-metal text-[24px] leading-tight">{t.current !== null ? formatNumber(t.current, 1) : '–'}</dd>
                    {t.previous !== null && t.current !== null && <dd className="text-[12px] text-cendre">avant : {formatNumber(t.previous, 1)}</dd>}
                  </div>
                );
              })}
            </dl>
          )}
        </section>
      )}

      {sessions && sessions.length > 0 && (
        <section aria-label="Dernières pratiques" className="flex flex-col">
          <h2 className="mb-1 text-[17px] font-semibold">Dernières pratiques</h2>
          <ul>
            {sessions.slice(0, 5).map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </ul>
        </section>
      )}

      <MindCaution />
    </Screen>
  );
}
