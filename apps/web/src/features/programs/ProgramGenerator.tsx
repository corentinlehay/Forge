import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { libraryExercise } from '../../data/exerciseLibrary';
import { TRAITS } from '../../data/exerciseTraits';
import { MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup } from '../../data/muscles';
import { QUESTIONNAIRE_KEY, type QuestionnaireRecord } from '../../db/adoptPlan';
import { saveGeneratedProgram } from '../../db/generatedProgram';
import { repos, useEffortScale, useMeta, useProfile, usePrograms, useToday, useWorkouts } from '../../db/hooks';
import { getDb } from '../../db/schema';
import type { Program } from '../../db/types';
import { effortText } from '../../domain/effort';
import { buildCatalog, searchCatalog, type CatalogItem } from '../../domain/exerciseCatalog';
import { ageOn, MIN_AGE, PRIORITY_MUSCLES, trainingPlan, type TrainingPlan } from '../../domain/plan';
import {
  defaultProgramName,
  GENERATOR_KEY,
  GENERATOR_STEPS,
  generatedNote,
  historyHint,
  MAX_PICKS,
  MAX_PRIORITIES,
  OBJECTIVE_TEXTS,
  prefillAnswers,
  readGeneratorRecord,
  SESSION_MINUTES,
  stepProblem,
  toTrainingAnswers,
  trainedWeeks,
  type GeneratorAnswers,
  type GeneratorRecord,
  type GeneratorStep,
} from '../../domain/programs/generator';
import { OBJECTIVE_LABELS, OBJECTIVES, programStatus } from '../../domain/programs/status';
import { VOLUME_REFERENCE } from '../../domain/muscleVolume';
import { formatRest } from '../../domain/workoutFlow';
import { isDateKey } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { Choice, DAY_LETTERS, DAY_NAMES, EQUIPMENT, LEVELS, Question, ThreeDays, ZONES } from '../plan/PlanQuestionnaire';
import { ExerciseThumb } from '../training/ExerciseVisual';
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

/** Exercices que FORGE sait placer : ceux de la bibliothèque dont il connaît le mouvement et le matériel. */
const PLACEABLE = buildCatalog([]).filter((i) => i.library && TRAITS[i.library.id]);
const libraryName = (id: string) => libraryExercise(id)?.name ?? id;

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
        {picking && <LibraryPicker exclude={chosen} onPick={add} />}
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

type Filter = MuscleGroup | 'tous';
const FILTERS = [{ value: 'tous' as Filter, label: 'Tous' }, ...MUSCLE_GROUPS.map((m) => ({ value: m as Filter, label: MUSCLE_LABELS[m] }))];

function LibraryPicker({ exclude, onPick }: { exclude: readonly string[]; onPick: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('tous');
  const matches = searchCatalog(PLACEABLE, query, filter === 'tous' ? null : filter).filter((i) => !exclude.includes(i.library!.id));
  return (
    <div className="flex flex-col gap-3 pb-1">
      <Field label="Chercher un exercice" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} placeholder="Ex. développé, squat, curl" enterKeyHint="search" />
      <Chips label="Groupe musculaire" hideLabel layout="scroll" options={FILTERS} selected={[filter]} onToggle={setFilter} />
      <ul className="flex flex-col">
        {matches.map((item: CatalogItem) => (
          <li key={item.key} className="border-b border-graphite last:border-b-0">
            <button type="button" onClick={() => onPick(item.library!.id)} className="flex min-h-16 w-full items-center gap-3 py-2 text-left">
              <ExerciseThumb item={item} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-tight">{item.name}</span>
                <span className="block text-[13px] text-cendre">{item.muscle ? MUSCLE_LABELS[item.muscle] : ''}</span>
              </span>
              <Icon name="plus" size={20} className="shrink-0 text-citron" />
            </button>
          </li>
        ))}
      </ul>
      {!matches.length && <p className="text-[15px] text-cendre">Aucun exercice ne correspond.</p>}
    </div>
  );
}

/** La proposition : séances, volume par muscle, avertissements et raisons ; rien n'est enregistré avant un geste. */
function Proposal({ answers, active, onEdit }: { answers: GeneratorAnswers; active: Program | null; onEdit: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const scale = useEffortScale();
  const plan = useMemo(() => trainingPlan(toTrainingAnswers(answers)), [answers]);
  const [name, setName] = useState(() => defaultProgramName(answers.objective!, plan.sessions.length));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (activate: boolean) => {
    if (!name.trim()) return setError('Donne un nom au programme.');
    setBusy(true);
    setError(null);
    try {
      const program = await saveGeneratedProgram(getDb(), plan, {
        name: name.trim(),
        objective: answers.objective,
        secondaryObjective: answers.secondaryObjective,
        note: generatedNote(plan, answers),
        activate,
      });
      await repos.meta.set(GENERATOR_KEY, { answers, savedAt: new Date().toISOString() } satisfies GeneratorRecord);
      toast.show(activate ? 'Programme activé' : 'Brouillon enregistré');
      navigate(`/training/programmes/${program.id}`, { replace: true, viewTransition: true });
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : 'Enregistrement impossible. Réessaie.');
    }
  };

  const minutes = plan.sessions.map((s) => s.estimatedMinutes);
  const span = Math.min(...minutes) === Math.max(...minutes) ? `${minutes[0]} min` : `${Math.min(...minutes)} à ${Math.max(...minutes)} min`;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-metal text-[40px] leading-none">Ta proposition</h1>
        <p className="text-[15px] leading-snug text-cendre">
          {OBJECTIVE_LABELS[answers.objective!]}
          {answers.secondaryObjective ? `, puis ${OBJECTIVE_LABELS[answers.secondaryObjective].toLocaleLowerCase('fr-FR')}` : ''}. {plan.sessions.length} séance
          {plan.sessions.length > 1 ? 's' : ''} par semaine en {plan.splitLabel}, environ {span} chacune.
        </p>
      </div>

      <Field label="Nom du programme" value={name} onChange={(e) => (setError(null), setName(e.target.value))} maxLength={60} />

      <section aria-label="Séances" className="flex flex-col gap-2">
        {plan.sessions.map((s) => (
          <article key={s.name} className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-[18px]">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="min-w-0 text-[17px] font-semibold">
                <span className="text-cendre capitalize">{DAY_NAMES[s.weekday - 1]}</span> {s.name}
              </h2>
              <span className="shrink-0 text-[13px] text-cendre tabular-nums">≈ {s.estimatedMinutes} min</span>
            </div>
            <ul className="flex flex-col">
              {s.exercises.map((e) => (
                <li key={e.libraryId} className="flex flex-col border-t border-graphite py-2 first:border-t-0 first:pt-0">
                  <span className="text-[15px] leading-tight">{libraryName(e.libraryId)}</span>
                  <span className="text-[13px] text-cendre tabular-nums">
                    {e.sets} × {e.reps}, {effortText(e.rir, scale)}, repos {formatRest(e.restSec)}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
        <p className="text-[12px] leading-snug text-cendre">
          FORGE te propose ensuite tes charges, séance après séance. Durées estimées avec 8 min d’échauffement, 40 s par série et les repos.
        </p>
      </section>

      <VolumeChart plan={plan} />

      {plan.warnings.length > 0 && (
        <section aria-label="À savoir" className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-[18px]">
          <h2 className="text-[17px] font-semibold">À savoir</h2>
          {plan.warnings.map((w) => (
            <p key={w} className="text-[13px] leading-snug">
              {w}
            </p>
          ))}
        </section>
      )}

      <section aria-label="Pourquoi ces choix" className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Pourquoi ces choix</h2>
        <ul className="flex flex-col gap-2">
          {plan.reasons.map((r) => (
            <li key={r} className="flex gap-2 text-[13px] leading-snug">
              <Icon name="check" size={14} strokeWidth={3} className="mt-0.5 shrink-0 text-citron" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <p className="text-[12px] leading-snug text-cendre">Des repères généraux, pas un avis médical. Arrête un exercice qui fait mal.</p>
      </section>

      <div className="flex flex-col gap-2 pb-2">
        {error && (
          <p className="text-[15px] text-braise" role="alert">
            {error}
          </p>
        )}
        {active && <p className="text-[13px] leading-snug text-cendre">En l’activant, « {active.name} » passe en pause. Tu le retrouves dans Programmes.</p>}
        <Button disabled={busy} onClick={() => void save(true)}>
          Valider et activer
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void save(false)}>
          Enregistrer en brouillon
        </Button>
        <Button variant="quiet" disabled={busy} onClick={onEdit}>
          Modifier mes réponses
        </Button>
      </div>
    </div>
  );
}

const sets = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

/**
 * Séries par semaine et par muscle : directes en plein, indirectes (muscle secondaire, comptées pour moitié) en clair,
 * sur la bande de repère de 10 à 20 séries. Les valeurs sont écrites : la barre n'est qu'une aide.
 */
function VolumeChart({ plan }: { plan: TrainingPlan }) {
  const max = Math.max(VOLUME_REFERENCE.high + 4, ...plan.volume.map((v) => Math.ceil(v.total)));
  const pct = (n: number) => `${(n / max) * 100}%`;
  return (
    <section aria-label="Volume par semaine" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
      <div className="flex flex-col gap-1">
        <h2 className="text-[17px] font-semibold">Volume par semaine</h2>
        <p className="text-[13px] leading-snug text-cendre">
          Séries par muscle. Repère pour l’hypertrophie : {VOLUME_REFERENCE.low} à {VOLUME_REFERENCE.high} séries (Schoenfeld et al. 2017).
        </p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-cendre" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-citron" />
          Directes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-citron/35" />
          Indirectes, pour moitié
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-craie/10" />
          Repère
        </span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {plan.volume.map((v) => (
          <li
            key={v.muscle}
            className="grid grid-cols-[104px_1fr_56px] items-center gap-2"
            aria-label={`${MUSCLE_LABELS[v.muscle]} : ${sets(v.direct)} séries directes${v.indirect ? ` et ${sets(v.indirect)} indirectes` : ''}`}
          >
            <span className="truncate text-[13px]">{MUSCLE_LABELS[v.muscle]}</span>
            <span className="relative h-3 rounded-[4px] bg-graphite" aria-hidden="true">
              <span className="absolute inset-y-0 bg-craie/10" style={{ left: pct(VOLUME_REFERENCE.low), width: pct(VOLUME_REFERENCE.high - VOLUME_REFERENCE.low) }} />
              <span className="absolute inset-y-0 left-0 flex gap-[2px]" style={{ width: pct(v.total) }}>
                {v.direct > 0 && <span className="h-full rounded-[4px] bg-citron" style={{ width: `${(v.direct / v.total) * 100}%` }} />}
                {v.indirect > 0 && <span className="h-full flex-1 rounded-[4px] bg-citron/35" />}
              </span>
            </span>
            <span className="text-right text-[13px] tabular-nums" aria-hidden="true">
              {sets(v.direct)}
              {v.indirect > 0 && <span className="text-cendre"> +{sets(v.indirect)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
