import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { MUSCLE_LABELS } from '../../data/muscles';
import { QUESTIONNAIRE_KEY, type QuestionnaireRecord } from '../../db/adoptPlan';
import { repos, useMeta, useProfile, usePrograms, useToday, useWorkouts } from '../../db/hooks';
import type { Program } from '../../db/types';
import { ageOn, MIN_AGE, PRIORITY_MUSCLES } from '../../domain/plan';
import {
  GENERATOR_KEY,
  GENERATOR_STEPS,
  historyHint,
  MAX_PICKS,
  MAX_PRIORITIES,
  OBJECTIVE_TEXTS,
  prefillAnswers,
  readGeneratorRecord,
  SESSION_MINUTES,
  stepProblem,
  trainedWeeks,
  type GeneratorAnswers,
  type GeneratorRecord,
  type GeneratorStep,
} from '../../domain/programs/generator';
import { OBJECTIVE_LABELS, OBJECTIVES, programStatus } from '../../domain/programs/status';
import { isDateKey } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { Choice, DAY_LETTERS, DAY_NAMES, EQUIPMENT, LEVELS, Question, ThreeDays, ZONES } from '../plan/PlanQuestionnaire';
import { LibraryList, libraryName, Proposal } from './ProgramProposal';
import { BackLink } from './ProgramsScreen';

type Step = 'age' | GeneratorStep | 'proposition';

/** Assistant de programme : quelques questions, pré-remplies avec ce que FORGE sait déjà, puis une proposition à valider. */
export function ProgramGeneratorScreen() {
  const profile = useProfile();
  const questionnaire = useMeta<QuestionnaireRecord>(QUESTIONNAIRE_KEY);
  const previous = useMeta<GeneratorRecord>(GENERATOR_KEY);
  const workouts = useWorkouts();
  const programs = usePrograms();
  const today = useToday();
  if (profile === undefined || questionnaire === undefined || previous === undefined || !workouts || !programs)
    return (
      <Screen withTabBar={false}>
        <BackLink to="/training/programmes" label="Programmes" />
      </Screen>
    );

  const birthDate = profile?.birthDate ?? questionnaire?.answers.birthDate ?? null;
  if (birthDate && ageOn(birthDate, today) < MIN_AGE)
    return (
      <Screen withTabBar={false}>
        <BackLink to="/training/programmes" label="Programmes" />
        <p className="text-[17px] leading-snug">FORGE est conçu pour les adultes de 18 ans et plus : l’assistant ne propose pas de programme avant.</p>
      </Screen>
    );

  const initial = prefillAnswers(readGeneratorRecord(previous), questionnaire?.answers, profile);
  const active = programs.find((p) => !p.deletedAt && programStatus(p) === 'actif') ?? null;
  return <Generator initial={initial} askBirthDate={!birthDate} weeks={trainedWeeks(workouts)} active={active} />;
}

function Generator({ initial, askBirthDate, weeks, active }: { initial: GeneratorAnswers; askBirthDate: boolean; weeks: number; active: Program | null }) {
  const today = useToday();
  const navigate = useNavigate();
  // Figé à l'ouverture : la date enregistrée à la première étape ne doit pas décaler les suivantes.
  const [withAge] = useState(askBirthDate);
  const steps = useMemo<Step[]>(() => [...(withAge ? (['age'] as const) : []), ...GENERATOR_STEPS, 'proposition'], [withAge]);
  const [answers, setAnswers] = useState<GeneratorAnswers>(initial);
  const [birthDate, setBirthDate] = useState('');
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const step = steps[index]!;
  const questionCount = steps.length - 1;
  const set = (patch: Partial<GeneratorAnswers>) => {
    setError(null);
    setAnswers((a) => ({ ...a, ...patch }));
  };
  const toggle = <T,>(list: readonly T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const next = async () => {
    if (step === 'age') {
      if (!isDateKey(birthDate) || birthDate > today) return setError('Indique ta date de naissance.');
      const age = ageOn(birthDate, today);
      if (age < MIN_AGE) return setError('FORGE est conçu pour les adultes de 18 ans et plus.');
      if (age > 100) return setError('Vérifie ta date de naissance.');
      try {
        await repos.profile.update({ birthDate });
      } catch {
        return setError('Enregistrement impossible. Réessaie.');
      }
    } else if (step !== 'proposition') {
      const problem = stepProblem(step, answers);
      if (problem) return setError(problem);
    }
    setError(null);
    setIndex((i) => Math.min(steps.length - 1, i + 1));
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    setError(null);
    setIndex((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0 });
  };

  return (
    <Screen withTabBar={false}>
      <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-48px)] flex-col gap-5">
        <div className="flex items-center justify-between gap-3 pt-2">
          {index > 0 ? (
            <button type="button" onClick={back} className="-ml-2 flex min-h-11 items-center gap-1 px-2 text-[15px] text-cendre">
              <Icon name="back" size={20} />
              Retour
            </button>
          ) : (
            <BackLink to="/training/programmes" label="Programmes" />
          )}
          {index > 0 && (
            <button type="button" onClick={() => navigate('/training/programmes', { viewTransition: true })} className="min-h-11 px-2 text-[15px] text-cendre">
              Annuler
            </button>
          )}
        </div>

        {step !== 'proposition' && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-cendre">
              Question {index + 1} sur {questionCount}
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
              <div className="h-full rounded-full bg-citron transition-[width] duration-300" style={{ width: `${((index + 1) / questionCount) * 100}%` }} />
            </div>
          </div>
        )}

        {step === 'age' && (
          <Question title="Ta date de naissance" hint="FORGE ne propose de programme qu’aux adultes. Elle reste sur ton téléphone, dans ton profil.">
            <Field label="Date de naissance" type="date" value={birthDate} max={today} onChange={(e) => (setError(null), setBirthDate(e.target.value))} />
          </Question>
        )}

        {step === 'objectif' && (
          <Question title="L’objectif du programme" hint="Il choisit les répétitions, les repos et le volume.">
            {OBJECTIVES.map((o) => (
              <Choice
                key={o}
                title={OBJECTIVE_LABELS[o]}
                text={OBJECTIVE_TEXTS[o]}
                selected={answers.objective === o}
                onClick={() => set({ objective: o, secondaryObjective: answers.secondaryObjective === o ? null : answers.secondaryObjective })}
              />
            ))}
            {answers.objective && (
              <>
                <Chips
                  label="Objectif secondaire (facultatif)"
                  options={OBJECTIVES.filter((o) => o !== answers.objective).map((o) => ({ value: o, label: OBJECTIVE_LABELS[o] }))}
                  selected={answers.secondaryObjective ? [answers.secondaryObjective] : []}
                  onToggle={(o) => set({ secondaryObjective: answers.secondaryObjective === o ? null : o })}
                />
                <p className="text-[13px] leading-snug text-cendre">Il s’affiche sur le programme ; les répétitions suivent l’objectif principal.</p>
              </>
            )}
          </Question>
        )}

        {step === 'niveau' && (
          <Question title="Ton niveau" hint={historyHint(weeks) ?? undefined}>
            {LEVELS.map((l) => (
              <Choice key={l.value} title={l.title} text={l.text} selected={answers.experience === l.value} onClick={() => set({ experience: l.value })} />
            ))}
            <label className="flex min-h-12 items-center justify-between gap-3 rounded-[16px] bg-anthracite px-4 py-3">
              <span className="text-[15px] leading-snug">Je reprends après plusieurs mois de pause</span>
              <input type="checkbox" checked={answers.returning} onChange={(e) => set({ returning: e.target.checked })} className="h-6 w-6 shrink-0 accent-[var(--color-citron)]" />
            </label>
          </Question>
        )}

        {step === 'semaine' && (
          <Question title="Ta semaine" hint="Les jours où tu peux t’entraîner : une séance par jour choisi.">
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 text-[13px] text-cendre">Jours</legend>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_LETTERS.map((letter, i) => {
                  const on = answers.weekdays.includes(i + 1);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={on}
                      aria-label={DAY_NAMES[i]}
                      onClick={() => set({ weekdays: on ? answers.weekdays.filter((d) => d !== i + 1) : [...answers.weekdays, i + 1].sort((x, y) => x - y) })}
                      className={`h-12 rounded-[12px] text-[15px] font-semibold ${on ? 'bg-citron text-noir' : 'bg-graphite text-cendre'}`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Chips
              label="Durée d’une séance, échauffement compris"
              options={SESSION_MINUTES.map((m) => ({ value: m, label: `${m} min` }))}
              selected={answers.sessionMinutes ? [answers.sessionMinutes] : []}
              onToggle={(m) => set({ sessionMinutes: m })}
            />
            {answers.weekdays.length === 3 && <ThreeDays withPpl split={answers.split} weekdays={answers.weekdays} onChange={(split) => set({ split })} />}
          </Question>
        )}

        {step === 'lieu' && (
          <Question title="Où, et avec quoi ?">
            <Choice title="En salle de sport" text="Barres, haltères, machines et poulies." selected={answers.place === 'salle'} onClick={() => set({ place: 'salle' })} />
            <Choice title="À la maison" text="Avec ton matériel, ou au poids du corps." selected={answers.place === 'maison'} onClick={() => set({ place: 'maison' })} />
            {answers.place === 'maison' && (
              <>
                <Chips
                  label="Ton matériel (tout ce que tu as)"
                  options={EQUIPMENT}
                  selected={answers.equipment}
                  onToggle={(v) => set({ equipment: toggle(answers.equipment, v) })}
                />
                {!answers.equipment.length && <p className="text-[13px] text-cendre">Sans matériel, le programme se fait au poids du corps.</p>}
              </>
            )}
            {answers.place === 'salle' && (
              <Chips
                label="Pour choisir entre deux exercices"
                options={[
                  { value: 'aucune' as const, label: 'Sans préférence' },
                  { value: 'machines' as const, label: 'Machines et poulies d’abord' },
                  { value: 'libres' as const, label: 'Poids libres d’abord' },
                ]}
                selected={[answers.equipmentStyle ?? 'aucune']}
                onToggle={(v) => set({ equipmentStyle: v === 'aucune' ? null : v })}
              />
            )}
          </Question>
        )}

        {step === 'priorites' && (
          <Question
            title="Tes priorités"
            hint={`Facultatif. Jusqu’à ${MAX_PRIORITIES} groupes : une série de plus sur leurs exercices, et un exercice d’isolation si leur volume reste bas.`}
          >
            <Chips
              label="Groupes à développer"
              options={PRIORITY_MUSCLES.map((m) => ({ value: m, label: MUSCLE_LABELS[m] }))}
              selected={answers.priorities}
              onToggle={(m) => {
                if (!answers.priorities.includes(m) && answers.priorities.length >= MAX_PRIORITIES)
                  return setError(`Garde ${MAX_PRIORITIES} priorités au plus : retire-en une d’abord.`);
                set({ priorities: toggle(answers.priorities, m) });
              }}
            />
            <Chips
              label="Tes séries"
              options={[
                { value: 'equilibre' as const, label: 'Selon l’objectif' },
                { value: 'lourd' as const, label: 'Plus lourd, moins de répétitions' },
                { value: 'leger' as const, label: 'Plus léger, plus de répétitions' },
              ]}
              selected={[answers.repStyle ?? 'equilibre']}
              onToggle={(v) => set({ repStyle: v === 'equilibre' ? null : v })}
            />
          </Question>
        )}

        {step === 'exercices' && <ExercisesStep answers={answers} set={set} />}

        {step === 'proposition' && <Proposal answers={answers} active={active} onEdit={() => (setError(null), setIndex(withAge ? 1 : 0))} />}

        {step !== 'proposition' && (
          <div className="mt-auto flex flex-col gap-2">
            {error && (
              <p className="text-[15px] text-braise" role="alert">
                {error}
              </p>
            )}
            <Button onClick={() => void next()}>{index === questionCount - 1 ? 'Voir la proposition' : 'Continuer'}</Button>
          </div>
        )}
      </div>
    </Screen>
  );
}

function ExercisesStep({ answers, set }: { answers: GeneratorAnswers; set: (patch: Partial<GeneratorAnswers>) => void }) {
  const [picking, setPicking] = useState<'favorites' | 'avoid' | null>(null);
  const chosen = [...answers.favorites, ...answers.avoid];
  const add = (id: string) => {
    if (picking) set({ [picking]: [...answers[picking], id] });
    setPicking(null);
  };
  return (
    <Question title="Tes exercices" hint="Facultatif. Tes favoris passent en premier quand ils vont avec la séance ; les exercices à éviter n’apparaissent pas.">
      <PickList
        title="Favoris"
        ids={answers.favorites}
        addLabel="Ajouter un favori"
        onAdd={() => setPicking('favorites')}
        onRemove={(id) => set({ favorites: answers.favorites.filter((x) => x !== id) })}
      />
      <PickList
        title="À éviter"
        ids={answers.avoid}
        addLabel="Ajouter un exercice à éviter"
        onAdd={() => setPicking('avoid')}
        onRemove={(id) => set({ avoid: answers.avoid.filter((x) => x !== id) })}
      />
      <Chips
        label="Une zone à ménager ?"
        options={ZONES}
        selected={answers.zones}
        onToggle={(v) => set({ zones: answers.zones.includes(v) ? answers.zones.filter((x) => x !== v) : [...answers.zones, v] })}
      />
      <p className="text-[13px] leading-snug text-cendre">Douleur, blessure récente ou traitement en cours : demande l’avis d’un professionnel de santé avant de reprendre.</p>
      <Sheet open={picking !== null} title={picking === 'avoid' ? 'Exercice à éviter' : 'Exercice favori'} onClose={() => setPicking(null)}>
        {picking && <LibraryList exclude={chosen} onPick={add} />}
      </Sheet>
    </Question>
  );
}

function PickList({ title, ids, addLabel, onAdd, onRemove }: { title: string; ids: string[]; addLabel: string; onAdd: () => void; onRemove: (id: string) => void }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-[18px] bg-anthracite px-4 py-3">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {ids.length > 0 && (
        <ul className="flex flex-col">
          {ids.map((id) => (
            <li key={id} className="flex min-h-11 items-center justify-between gap-3 border-b border-graphite last:border-b-0">
              <span className="min-w-0 text-[15px] leading-tight">{libraryName(id)}</span>
              <button
                type="button"
                onClick={() => onRemove(id)}
                aria-label={`Retirer ${libraryName(id)}`}
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-cendre"
              >
                <Icon name="close" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {ids.length < MAX_PICKS ? (
        <Button variant="quiet" className="-ml-2 self-start text-citron" onClick={onAdd}>
          <Icon name="plus" size={18} />
          {addLabel}
        </Button>
      ) : (
        <p className="text-[13px] text-cendre">{MAX_PICKS} exercices au plus.</p>
      )}
    </section>
  );
}
