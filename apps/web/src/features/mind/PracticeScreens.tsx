import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { MIND_EXERCISE_BY_ID } from '../../data/mindExercises';
import { useMindSessions } from '../../db/hooks';
import type { Scale5 } from '../../db/types';
import {
  CATEGORY_INFO,
  chosenMinutes,
  exerciseInstructions,
  exerciseSeconds,
  FAMILY_LABELS,
  formatDuration,
  routineSeconds,
  ROUTINE_ORDER,
  type RoutineId,
} from '../../domain/mind';
import { formatDayShort } from '../../lib/format';
import { unlockAudio } from '../../services/beep';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { ScaleChips } from '../../ui/ScaleChips';
import { Screen } from '../../ui/Screen';
import { Stepper } from '../../ui/Stepper';
import { ExerciseRow, MindBack, useFavorites, useHistoryBack, useRoutines, useSoundSetting } from './mindShared';
import { Practice, type PracticeItem } from './Practice';

function SoundToggle({ sound, setSound }: { sound: boolean; setSound: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
      <span>
        Repères sonores
        <span className="block text-[12px] text-cendre">Une note douce à chaque changement ; muette si l’iPhone est en silencieux.</span>
      </span>
      <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="h-6 w-6 shrink-0 accent-[var(--forge-mind)]" />
    </label>
  );
}

function LastDone({ refId }: { refId: string }) {
  const sessions = useMindSessions();
  const mine = sessions?.filter((s) => s.ref === refId) ?? [];
  if (!mine.length) return null;
  return (
    <p className="text-[13px] text-cendre">
      Fait {mine.length} fois, dernière fois {formatDayShort(mine[0]!.date).toLocaleLowerCase('fr-FR')}.
    </p>
  );
}

/** Fiche d'un exercice guidé : présentation, objectif, consignes, durée, puis le déroulé interactif. */
export function ExerciseScreen() {
  const { id = '' } = useParams();
  const exercise = MIND_EXERCISE_BY_ID.get(id);
  const back = useHistoryBack('/mind/exercices');
  const { favorites, toggle } = useFavorites();
  const [minutes, setMinutes] = useState(exercise?.minutes ?? 1);
  const [tension, setTension] = useState<Scale5 | null>(null);
  const [sound, setSound] = useSoundSetting();
  const [playing, setPlaying] = useState(false);

  if (!exercise) {
    return (
      <Screen withTabBar={false}>
        <MindBack to="/mind/exercices" label="Exercices" />
        <p className="text-[15px] text-cendre">Cet exercice n’existe pas ou plus.</p>
      </Screen>
    );
  }
  const m = chosenMinutes(exercise, minutes);
  const favorite = favorites.includes(exercise.id);

  return (
    <Screen withTabBar={false}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={back} className="-ml-2 flex min-h-11 items-center gap-1 px-2 text-[15px] text-cendre">
          <Icon name="back" size={20} />
          Retour
        </button>
        <button
          type="button"
          onClick={() => toggle(exercise.id)}
          aria-pressed={favorite}
          aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className="flex h-11 w-11 items-center justify-center"
        >
          <Icon name="star" size={22} className={favorite ? 'fill-brume text-brume' : 'text-cendre'} />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-brume">
          {FAMILY_LABELS[exercise.family]}, {formatDuration(exerciseSeconds(exercise, m))}
        </p>
        <h1 className="font-metal text-[36px] leading-none">{exercise.title}</h1>
        <p className="text-[17px] leading-snug">{exercise.presentation}</p>
      </div>
      <dl className="flex flex-col gap-2 rounded-[18px] bg-anthracite p-4 text-[15px]">
        <div>
          <dt className="text-[13px] text-cendre">Objectif</dt>
          <dd>{exercise.goal}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-cendre">Position</dt>
          <dd>{exercise.position}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-cendre">Pour</dt>
          <dd>{exercise.categories.map((c) => CATEGORY_INFO[c].label).join(', ')}</dd>
        </div>
      </dl>
      {exercise.range && (
        <Stepper label="Durée" value={m} step={1} min={exercise.range[0]} max={exercise.range[1]} start={exercise.minutes} format={(v) => `${v} min`} onChange={setMinutes} />
      )}
      <section aria-label="Comment faire" className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Comment faire</h2>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] leading-snug marker:text-cendre">
          {exerciseInstructions(exercise, m).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>
      {exercise.caution && (
        <p className="flex gap-2 rounded-[18px] border border-graphite p-3.5 text-[13px] leading-snug">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-cendre" />
          {exercise.caution}
        </p>
      )}
      <ScaleChips tone="brume" label="Tension ressentie avant (facultatif)" value={tension} onChange={setTension} low="Détendu" high="Très tendu" />
      <SoundToggle sound={sound} setSound={setSound} />
      <Button
        onClick={() => {
          unlockAudio();
          setPlaying(true);
        }}
      >
        <Icon name="play" size={18} />
        Commencer
      </Button>
      <LastDone refId={exercise.id} />
      {exercise.source && <p className="text-[12px] leading-snug text-cendre">Repère : {exercise.source}</p>}
      {playing && (
        <Practice
          kind="exercise"
          refId={exercise.id}
          title={exercise.title}
          items={[{ exercise, minutes: m }]}
          tensionBefore={tension}
          sound={sound}
          onClose={() => setPlaying(false)}
        />
      )}
    </Screen>
  );
}

/** Routine : plusieurs exercices à la suite, personnalisable. */
export function RoutineScreen() {
  const { id = '' } = useParams();
  const routineId = (ROUTINE_ORDER as string[]).includes(id) ? (id as RoutineId) : null;
  const { routines } = useRoutines();
  const back = useHistoryBack('/mind');
  const [tension, setTension] = useState<Scale5 | null>(null);
  const [sound, setSound] = useSoundSetting();
  const [playing, setPlaying] = useState(false);
  const routine = routineId ? routines[routineId] : null;
  const items = useMemo<PracticeItem[]>(
    () =>
      routine
        ? routine.steps.map((st) => ({ exercise: MIND_EXERCISE_BY_ID.get(st.exerciseId)!, minutes: chosenMinutes(MIND_EXERCISE_BY_ID.get(st.exerciseId)!, st.minutes) }))
        : [],
    [routine],
  );

  if (!routine) {
    return (
      <Screen withTabBar={false}>
        <MindBack />
        <p className="text-[15px] text-cendre">Cette routine n’existe pas.</p>
      </Screen>
    );
  }

  return (
    <Screen withTabBar={false}>
      <button type="button" onClick={back} className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
        <Icon name="back" size={20} />
        Retour
      </button>
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-brume">Routine, {formatDuration(routineSeconds(routine))}</p>
        <h1 className="font-metal text-[36px] leading-none">{routine.title}</h1>
        <p className="text-[17px] leading-snug">{routine.blurb}</p>
      </div>
      <section aria-label="Déroulé" className="flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Déroulé</h2>
          <Link to={`/mind/routine/${routine.id}/modifier`} viewTransition className="flex min-h-11 items-center px-1 text-[15px] text-brume">
            Personnaliser
          </Link>
        </div>
        <ol>
          {items.map((it, i) => (
            <ExerciseRow key={`${it.exercise.id}-${i}`} exercise={it.exercise} seconds={exerciseSeconds(it.exercise, it.minutes)} />
          ))}
        </ol>
      </section>
      <ScaleChips tone="brume" label="Tension ressentie avant (facultatif)" value={tension} onChange={setTension} low="Détendu" high="Très tendu" />
      <SoundToggle sound={sound} setSound={setSound} />
      <Button
        onClick={() => {
          unlockAudio();
          setPlaying(true);
        }}
      >
        <Icon name="play" size={18} />
        Commencer la routine
      </Button>
      <LastDone refId={routine.id} />
      {playing && <Practice kind="routine" refId={routine.id} title={routine.title} items={items} tensionBefore={tension} sound={sound} onClose={() => setPlaying(false)} />}
    </Screen>
  );
}
