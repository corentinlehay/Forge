import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type ReactNode } from 'react';
import { libraryExercise } from '../../data/exerciseLibrary';
import type { Need } from '../../data/exerciseTraits';
import { adoptPlan, QUESTIONNAIRE_KEY, type QuestionnaireRecord } from '../../db/adoptPlan';
import { repos, useMeta, useProfile, useToday, useWeighIns } from '../../db/hooks';
import { getDb } from '../../db/schema';
import type { Experience, Sex } from '../../db/types';
import { ageOn, GOAL_LABELS, MIN_AGE, nutritionPlan, trainingPlan, ZONE_LABELS, type DailyActivity, type Goal, type PlanAnswers, type Zone } from '../../domain/plan';
import { formatRest } from '../../domain/workoutFlow';
import { isDateKey } from '../../lib/dates';
import { formatNumber, parseDecimal, WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';

type StepId = 'objectif' | 'toi' | 'activite' | 'niveau' | 'semaine' | 'lieu' | 'zones' | 'plan';
const STEPS: StepId[] = ['objectif', 'toi', 'activite', 'niveau', 'semaine', 'lieu', 'zones', 'plan'];
const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const GOALS: { value: Goal; text: string }[] = [
  { value: 'muscle', text: 'Gagner du muscle, avec une prise de poids lente et contrôlée.' },
  { value: 'perte', text: 'Perdre du gras en gardant ton muscle.' },
  { value: 'recompo', text: 'Garder ton poids, avec plus de muscle et moins de gras.' },
  { value: 'force', text: 'Soulever plus lourd sur les grands mouvements.' },
  { value: 'forme', text: 'Bouger régulièrement, rester en bonne santé.' },
];
const ACTIVITIES: { value: DailyActivity; title: string; text: string }[] = [
  { value: 'assis', title: 'Plutôt assis', text: 'Bureau, voiture, peu de marche.' },
  { value: 'debout', title: 'Souvent debout', text: 'Commerce, enseignement, beaucoup de déplacements à pied.' },
  { value: 'physique', title: 'Travail physique', text: 'Chantier, manutention, métier d’effort.' },
];
const LEVELS: { value: Experience; title: string; text: string }[] = [
  { value: 'beginner', title: 'Débutant', text: 'Moins d’un an d’entraînement régulier.' },
  { value: 'intermediate', title: 'Intermédiaire', text: 'De un à trois ans d’entraînement régulier.' },
  { value: 'advanced', title: 'Confirmé', text: 'Plus de trois ans, tu connais tes charges.' },
];
const EQUIPMENT: { value: Need; label: string }[] = [
  { value: 'halteres', label: 'Haltères' },
  { value: 'banc', label: 'Banc' },
  { value: 'barre', label: 'Barre et disques, avec support' },
  { value: 'traction', label: 'Barre de traction' },
  { value: 'kettlebell', label: 'Kettlebell' },
];
const ZONES: { value: Zone; label: string }[] = (Object.keys(ZONE_LABELS) as Zone[]).map((z) => ({ value: z, label: ZONE_LABELS[z] }));

interface Draft {
  goal: Goal | null;
  sex: Sex | null;
  birthDate: string;
  height: string;
  weight: string;
  activity: DailyActivity | null;
  experience: Experience | null;
  returning: boolean;
  weekdays: number[];
  sessionMinutes: PlanAnswers['sessionMinutes'] | null;
  place: 'salle' | 'maison' | null;
  equipment: Need[];
  zones: Zone[];
}

const decimalText = (v: number) => formatNumber(v, v % 1 ? 1 : 0).replace(/\s/g, '');

/**
 * Questionnaire de départ : huit écrans courts, puis le plan calculé (programme et objectifs).
 * Rien n'est enregistré avant « Adopter ce plan ».
 */
export function PlanQuestionnaire({ mode, onFinished, onCancel, onSkip }: { mode: 'onboarding' | 'settings'; onFinished: () => void; onCancel?: () => void; onSkip?: () => void }) {
  const profile = useProfile();
  const weighIns = useWeighIns();
  const previous = useMeta<QuestionnaireRecord>(QUESTIONNAIRE_KEY);
  const hasPrograms = useLiveQuery(async () => (await repos.programs.listActive()).length > 0, []);
  if (profile === undefined || weighIns === undefined || previous === undefined || hasPrograms === undefined) return <Screen withTabBar={false}>{null}</Screen>;
  const last = [...weighIns]
    .filter((w) => !w.deletedAt)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .at(-1);
  const p = previous?.answers;
  const initial: Draft = {
    goal: p?.goal ?? profile?.goal ?? null,
    sex: p?.sex ?? profile?.sex ?? null,
    birthDate: p?.birthDate ?? profile?.birthDate ?? '',
    height: p?.heightCm ? String(p.heightCm) : profile?.heightCm ? String(profile.heightCm) : '',
    weight: last ? decimalText(last.weightKg) : p ? decimalText(p.weightKg) : '',
    activity: p?.activity ?? null,
    experience: p?.experience ?? profile?.experience ?? null,
    returning: p?.returning ?? profile?.returningAfterBreak ?? false,
    weekdays: p?.weekdays ?? [],
    sessionMinutes: p?.sessionMinutes ?? null,
    place: p?.place ?? null,
    equipment: p?.equipment ?? [],
    zones: p?.zones ?? [],
  };
  return (
    <Flow
      mode={mode}
      initial={initial}
      firstName={profile?.firstName}
      hasTargets={Boolean(profile?.nutritionTargets)}
      hasPrograms={hasPrograms}
      onFinished={onFinished}
      onCancel={onCancel}
      onSkip={onSkip}
    />
  );
}

function Flow({
  mode,
  initial,
  firstName,
  hasTargets,
  hasPrograms,
  onFinished,
  onCancel,
  onSkip,
}: {
  mode: 'onboarding' | 'settings';
  initial: Draft;
  firstName?: string;
  hasTargets: boolean;
  hasPrograms: boolean;
  onFinished: () => void;
  onCancel?: () => void;
  onSkip?: () => void;
}) {
  const today = useToday();
  const [draft, setDraft] = useState<Draft>(initial);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const step = STEPS[index]!;
  const set = (patch: Partial<Draft>) => {
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const check = (): string | null => {
    switch (step) {
      case 'objectif':
        return draft.goal ? null : 'Choisis ton objectif principal.';
      case 'toi': {
        if (!draft.sex) return 'Indique ton sexe : il entre dans le calcul de tes besoins.';
        if (!isDateKey(draft.birthDate) || draft.birthDate > today) return 'Indique ta date de naissance.';
        const age = ageOn(draft.birthDate, today);
        if (age < MIN_AGE) return 'FORGE est conçu pour les adultes de 18 ans et plus.';
        if (age > 100) return 'Vérifie ta date de naissance.';
        const h = Number(draft.height);
        if (!Number.isInteger(h) || h < 100 || h > 250) return 'Taille en centimètres, entre 100 et 250.';
        const w = parseDecimal(draft.weight);
        if (w === null || w < WEIGHT_MIN_KG || w > WEIGHT_MAX_KG) return `Poids en kilos, entre ${WEIGHT_MIN_KG} et ${WEIGHT_MAX_KG}.`;
        return null;
      }
      case 'activite':
        return draft.activity ? null : 'Choisis ce qui ressemble le plus à tes journées.';
      case 'niveau':
        return draft.experience ? null : 'Choisis ton niveau.';
      case 'semaine':
        if (!draft.weekdays.length) return 'Choisis au moins un jour.';
        if (draft.weekdays.length > 6) return 'Garde au moins un jour de repos par semaine.';
        return draft.sessionMinutes ? null : 'Choisis la durée d’une séance.';
      case 'lieu':
        return draft.place ? null : 'Choisis où tu t’entraînes.';
      default:
        return null;
    }
  };

  const next = () => {
    const problem = check();
    if (problem) return setError(problem);
    setIndex((i) => Math.min(STEPS.length - 1, i + 1));
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    setError(null);
    setIndex((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0 });
  };

  const questionCount = STEPS.length - 1;
  return (
    <Screen withTabBar={false}>
      <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-48px)] flex-col gap-5">
        <div className="flex items-center justify-between gap-3 pt-2">
          {index > 0 ? (
            <button type="button" onClick={back} className="-ml-2 flex min-h-11 items-center gap-1 px-2 text-[15px] text-cendre">
              <Icon name="back" size={20} />
              Retour
            </button>
          ) : onCancel ? (
            <button type="button" onClick={onCancel} className="-ml-2 flex min-h-11 items-center gap-1 px-2 text-[15px] text-cendre">
              <Icon name="back" size={20} />
              Réglages
            </button>
          ) : (
            <span />
          )}
          {onSkip && step !== 'plan' && (
            <button type="button" onClick={onSkip} className="min-h-11 px-2 text-[15px] text-cendre">
              Plus tard
            </button>
          )}
        </div>
        {step !== 'plan' && (
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-cendre">
              Question {index + 1} sur {questionCount}
            </p>
            <div className="h-1 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
              <div className="h-full rounded-full bg-citron transition-[width] duration-300" style={{ width: `${((index + 1) / questionCount) * 100}%` }} />
            </div>
          </div>
        )}

        {step === 'objectif' && (
          <Question title="Ton objectif principal">
            {GOALS.map((g) => (
              <Choice key={g.value} title={GOAL_LABELS[g.value]} text={g.text} selected={draft.goal === g.value} onClick={() => set({ goal: g.value })} />
            ))}
          </Question>
        )}

        {step === 'toi' && (
          <Question title="Toi" hint="Pour estimer ta dépense d’énergie. Ces informations restent sur ton téléphone.">
            <Chips
              label="Sexe"
              options={[
                { value: 'male' as Sex, label: 'Homme' },
                { value: 'female' as Sex, label: 'Femme' },
              ]}
              selected={draft.sex ? [draft.sex] : []}
              onToggle={(v) => set({ sex: v })}
            />
            <Field label="Date de naissance" type="date" value={draft.birthDate} max={today} onChange={(e) => set({ birthDate: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Taille" suffix="cm" inputMode="numeric" value={draft.height} maxLength={3} onChange={(e) => set({ height: e.target.value.replace(/\D/g, '') })} />
              <Field label="Poids" suffix="kg" inputMode="decimal" value={draft.weight} maxLength={5} onChange={(e) => set({ weight: e.target.value })} />
            </div>
          </Question>
        )}

        {step === 'activite' && (
          <Question title="Tes journées, hors sport">
            {ACTIVITIES.map((a) => (
              <Choice key={a.value} title={a.title} text={a.text} selected={draft.activity === a.value} onClick={() => set({ activity: a.value })} />
            ))}
          </Question>
        )}

        {step === 'niveau' && (
          <Question title="Ton niveau en musculation">
            {LEVELS.map((l) => (
              <Choice key={l.value} title={l.title} text={l.text} selected={draft.experience === l.value} onClick={() => set({ experience: l.value })} />
            ))}
            <label className="flex min-h-12 items-center justify-between gap-3 rounded-[16px] bg-anthracite px-4 py-3">
              <span className="text-[15px] leading-snug">Je reprends après plusieurs mois de pause</span>
              <input type="checkbox" checked={draft.returning} onChange={(e) => set({ returning: e.target.checked })} className="h-6 w-6 shrink-0 accent-[var(--color-citron)]" />
            </label>
          </Question>
        )}

        {step === 'semaine' && (
          <Question title="Ta semaine d’entraînement" hint="Les jours où tu peux t’entraîner : une séance par jour choisi.">
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 text-[13px] text-cendre">Jours</legend>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_LETTERS.map((letter, i) => {
                  const on = draft.weekdays.includes(i + 1);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={on}
                      aria-label={DAY_NAMES[i]}
                      onClick={() => set({ weekdays: on ? draft.weekdays.filter((d) => d !== i + 1) : [...draft.weekdays, i + 1].sort() })}
                      className={`h-12 rounded-[12px] text-[15px] font-semibold ${on ? 'bg-citron text-noir' : 'bg-graphite text-cendre'}`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Chips
              label="Durée d’une séance"
              options={([45, 60, 75, 90] as const).map((m) => ({ value: m, label: `${m} min` }))}
              selected={draft.sessionMinutes ? [draft.sessionMinutes] : []}
              onToggle={(m) => set({ sessionMinutes: m })}
            />
          </Question>
        )}

        {step === 'lieu' && (
          <Question title="Où t’entraînes-tu ?">
            <Choice title="En salle de sport" text="Barres, haltères, machines et poulies." selected={draft.place === 'salle'} onClick={() => set({ place: 'salle' })} />
            <Choice title="À la maison" text="Avec ton matériel, ou au poids du corps." selected={draft.place === 'maison'} onClick={() => set({ place: 'maison' })} />
            {draft.place === 'maison' && (
              <>
                <Chips
                  label="Ton matériel (tout ce que tu as)"
                  options={EQUIPMENT}
                  selected={draft.equipment}
                  onToggle={(v) => set({ equipment: draft.equipment.includes(v) ? draft.equipment.filter((x) => x !== v) : [...draft.equipment, v] })}
                />
                {!draft.equipment.length && <p className="text-[13px] text-cendre">Sans matériel, le programme se fait au poids du corps.</p>}
              </>
            )}
          </Question>
        )}

        {step === 'zones' && (
          <Question title="Une zone à ménager ?" hint="Facultatif. FORGE écarte les mouvements les plus exigeants pour la zone choisie.">
            <Chips
              label="Zones"
              hideLabel
              options={ZONES}
              selected={draft.zones}
              onToggle={(v) => set({ zones: draft.zones.includes(v) ? draft.zones.filter((x) => x !== v) : [...draft.zones, v] })}
            />
            <p className="text-[13px] leading-snug text-cendre">
              Douleur, blessure récente ou traitement en cours : demande l’avis d’un professionnel de santé avant de reprendre.
            </p>
          </Question>
        )}

        {step === 'plan' && (
          <PlanSummary
            mode={mode}
            answers={toAnswers(draft, firstName)}
            today={today}
            hasTargets={hasTargets}
            hasPrograms={hasPrograms}
            onEdit={() => setIndex(0)}
            onFinished={onFinished}
            onSkip={onSkip}
          />
        )}

        {step !== 'plan' && (
          <div className="mt-auto flex flex-col gap-2">
            {error && (
              <p className="text-[15px] text-braise" role="alert">
                {error}
              </p>
            )}
            <Button onClick={next}>{index === questionCount - 1 ? 'Voir mon plan' : 'Continuer'}</Button>
          </div>
        )}
      </div>
    </Screen>
  );
}

function toAnswers(d: Draft, firstName?: string): PlanAnswers {
  return {
    ...(firstName ? { firstName } : {}),
    goal: d.goal!,
    sex: d.sex!,
    birthDate: d.birthDate,
    heightCm: Number(d.height),
    weightKg: parseDecimal(d.weight)!,
    activity: d.activity!,
    experience: d.experience!,
    returning: d.returning,
    weekdays: d.weekdays,
    sessionMinutes: d.sessionMinutes!,
    place: d.place!,
    equipment: d.place === 'maison' ? d.equipment : [],
    zones: d.zones,
  };
}

function Question({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h1 className="font-metal text-[40px] leading-none">{title}</h1>
      {hint && <p className="text-[15px] leading-snug text-cendre">{hint}</p>}
      <div className="mt-1 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Choice({ title, text, selected, onClick }: { title: string; text: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-[64px] w-full items-center justify-between gap-3 rounded-[18px] border-2 px-4 py-3 text-left transition-colors ${selected ? 'border-citron bg-anthracite' : 'border-transparent bg-anthracite'}`}
    >
      <span className="min-w-0">
        <span className="block text-[17px] font-semibold">{title}</span>
        <span className="block text-[13px] leading-snug text-cendre">{text}</span>
      </span>
      <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-citron text-noir' : 'border-2 border-graphite'}`}>
        {selected && <Icon name="check" size={14} strokeWidth={3} />}
      </span>
    </button>
  );
}

const trim = (v: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Math.abs(v));
const signedPct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${trim(v)}`;
const signedKg = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Math.abs(v))}`;

function PlanSummary({
  mode,
  answers,
  today,
  hasTargets,
  hasPrograms,
  onEdit,
  onFinished,
  onSkip,
}: {
  mode: 'onboarding' | 'settings';
  answers: PlanAnswers;
  today: string;
  hasTargets: boolean;
  hasPrograms: boolean;
  onEdit: () => void;
  onFinished: () => void;
  onSkip?: () => void;
}) {
  const nutrition = useMemo(() => nutritionPlan(answers, today), [answers, today]);
  const training = useMemo(() => trainingPlan(answers), [answers]);
  const [useNutrition, setUseNutrition] = useState(true);
  const [useTraining, setUseTraining] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!nutrition.ok) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <h1 className="font-metal text-[40px] leading-none">Pas de plan pour l’instant</h1>
        <p className="text-[17px] leading-snug">{nutrition.reason}</p>
        <div className="mt-auto flex flex-col gap-2">
          {onSkip && <Button onClick={onSkip}>Continuer sans plan</Button>}
          <Button variant="secondary" onClick={onEdit}>
            Modifier mes réponses
          </Button>
        </div>
      </div>
    );
  }
  const n = nutrition.plan;
  const t = n.targets;

  const adopt = async () => {
    setBusy(true);
    setError(null);
    try {
      await adoptPlan(getDb(), { answers, nutrition: useNutrition ? n : null, training: useTraining ? training : null, today });
      onFinished();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'L’enregistrement a échoué. Réessaie.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="font-metal text-[44px] leading-none">Ton plan de départ</h1>
        <p className="text-[15px] leading-snug text-cendre">Calculé par FORGE à partir de tes réponses, avec des règles publiées. Tout reste modifiable ensuite.</p>
      </div>

      <section aria-label="Nutrition" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-semibold">Nutrition</h2>
          <span className="text-[13px] text-cendre">{GOAL_LABELS[n.goal]}</span>
        </div>
        <p className="font-metal text-[48px] leading-none">
          {formatNumber(t.kcal, 0)} <span className="font-sans text-[15px] font-normal text-cendre">kcal par jour</span>
        </p>
        <dl className="grid grid-cols-3 gap-2">
          {[
            ['Protéines', `${t.proteinG} g`],
            ['Glucides', `${t.carbsG} g`],
            ['Lipides', `${t.fatG} g`],
            ['Fibres', `${t.fiberG} g`],
            ['Boissons', `${formatNumber((t.waterMl ?? 0) / 1000, 1)} L`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[14px] bg-graphite/60 p-2.5">
              <dt className="text-[12px] text-cendre">{label}</dt>
              <dd className="text-[17px] font-semibold whitespace-nowrap">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[15px] leading-snug">
          <span className="text-cendre">Rythme de poids visé : </span>
          {signedPct(n.gainRate.lowPctPerWeek)} à {signedPct(n.gainRate.highPctPerWeek)} % par semaine, soit {signedKg((answers.weightKg * n.gainRate.lowPctPerWeek) / 100)} à{' '}
          {signedKg((answers.weightKg * n.gainRate.highPctPerWeek) / 100)} kg aujourd’hui.
        </p>
        <ul className="flex flex-col gap-2 text-[13px] leading-snug text-cendre">
          {n.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
          <li>
            Repères : métabolisme de base de Mifflin-St Jeor (1990) ; protéines 1,6 à 2,2 g par kg (Morton et al., 2018) ;{' '}
            {n.goal === 'perte'
              ? 'perte de 0,5 à 1 % du poids par semaine (Helms et al., 2014)'
              : n.goal === 'muscle'
                ? 'prise de 0,25 à 0,5 % par semaine (Iraki et al., 2019)'
                : 'poids stable'}{' '}
            ; fibres 30 g (ANSES) ; boissons d’après l’EFSA (2010).
          </li>
        </ul>
      </section>

      <section aria-label="Entraînement" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
        <div className="flex flex-col">
          <h2 className="text-[17px] font-semibold">Entraînement</h2>
          <p className="text-[13px] text-cendre">
            {training.programName}, {training.splitLabel}
          </p>
        </div>
        {training.sessions.map((s) => (
          <div key={s.name} className="flex flex-col gap-1 border-t border-graphite pt-3">
            <p className="text-[15px] font-semibold">
              <span className="text-cendre capitalize">{DAY_NAMES[s.weekday - 1]}</span> {s.name}
            </p>
            <ul className="flex flex-col gap-0.5 text-[13px] leading-snug">
              {s.exercises.map((e) => (
                <li key={e.libraryId} className="flex justify-between gap-3">
                  <span className="min-w-0">{libraryExercise(e.libraryId)?.name}</span>
                  <span className="shrink-0 text-cendre tabular-nums">
                    {e.sets} × {e.reps}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-[12px] leading-snug text-cendre">
          RIR visé {training.sessions[0]?.exercises[0]?.rir ?? 2} (répétitions gardées en réserve), repos de{' '}
          {formatRest(Math.min(...training.sessions.flatMap((s) => s.exercises.map((e) => e.restSec))))} à{' '}
          {formatRest(Math.max(...training.sessions.flatMap((s) => s.exercises.map((e) => e.restSec))))}. FORGE te proposera ensuite tes charges, séance après séance.
        </p>
        {training.warnings.map((w) => (
          <p key={w} className="text-[13px] leading-snug">
            {w}
          </p>
        ))}
        {training.excluded.length > 0 && <p className="text-[12px] leading-snug text-cendre">Écartés : {training.excluded.join(', ')}.</p>}
      </section>

      {mode === 'settings' && (
        <div className="flex flex-col gap-2">
          <Toggle label={hasTargets ? 'Remplacer mes objectifs nutritionnels' : 'Enregistrer ces objectifs nutritionnels'} checked={useNutrition} onChange={setUseNutrition} />
          <Toggle
            label={hasPrograms ? 'Ajouter ce programme et l’activer (tes programmes actuels restent dans « Programmes »)' : 'Créer ce programme'}
            checked={useTraining}
            onChange={setUseTraining}
          />
        </div>
      )}

      <p className="text-[12px] leading-snug text-cendre">
        Repères généraux, pas un avis médical. Grossesse, maladie, traitement, trouble du comportement alimentaire : demande l’avis d’un professionnel de santé avant de suivre un
        plan.
      </p>
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void adopt()} disabled={busy || (!useNutrition && !useTraining)}>
        Adopter ce plan
      </Button>
      <Button variant="secondary" onClick={onEdit}>
        Modifier mes réponses
      </Button>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 rounded-[16px] bg-anthracite px-4 py-3">
      <span className="text-[15px] leading-snug">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-6 w-6 shrink-0 accent-[var(--color-citron)]" />
    </label>
  );
}
