import type { GainRate, PulseChoice, PulseDay, PulseLevel, PulseMode, TemplateExercise, WorkoutAdjustment, WorkoutTemplate } from '../../db/types';
import { addDays } from '../../lib/dates';
import type { BudgetSettings } from '../budget';
import type { MindRoutine, RoutineId } from '../mind';
import { formatHours, formatNumber, formatTime } from '../../lib/format';
import type { DayIndex, LifeData } from '../lifeIndex';
import { exerciseSessions, parseRepRange, suggestNext } from '../progression';
import { templateForDay } from '../training';
import { LIGHTEN } from './adjust';
import { analyzeDay, type DayAnalysis } from './analysis';
import { buildPlan, buildProposal, type PlanItem, type Proposal, type Reco } from './plan';
import { keptRecently, readinessSeries, trendAt, type Trend } from './history';
import { computeNutritionStatus, type NutritionStatus } from './nutrition';
import { computeReadiness, recentMood, type HealthDay, type Readiness } from './readiness';
import { evaluateRules, lowerMode, MODE_RANK, templateLoads, type RuleHit } from './rules';
import { PULSE_ENGINE_VERSION, type PulseSettings } from './settings';
import { PULSE_SOURCES } from './sources';

/**
 * PULSE : le moteur de décision du jour. Fonction pure : mêmes données, même résultat.
 * Deux indicateurs séparés (Readiness Score, Nutrition Status), un niveau de lecture du score,
 * des règles prioritaires, une proposition de séance séparée du score (qui garde toujours le choix
 * « Garder la séance prévue »), puis des recommandations Training, Nutrition, Mind et Recovery.
 * Rien n'est appliqué sans validation.
 */
export type { Reco } from './plan';

export type TrainingKind = 'none' | 'done' | 'as-planned' | 'no-record' | 'lighten' | 'replace' | 'suspended' | 'rest' | 'blocked';

export interface TrainingAdvice {
  kind: TrainingKind;
  template: WorkoutTemplate | null;
  /** Séance reportée d'hier par ton choix « Déplacer à demain ». */
  moved: boolean;
  adjustment: WorkoutAdjustment | null;
  actions: PulseChoice[];
  recos: Reco[];
  /** Surcharge progressive suggérée (deux pistes au plus), les jours où le score le permet. */
  hints: string[];
}

export interface PulseResult {
  date: string;
  readiness: Readiness;
  nutrition: NutritionStatus;
  rules: RuleHit[];
  /** Niveau de lecture du score : basse, modérée, satisfaisante, élevée. */
  level: PulseLevel | null;
  /** Proposition de séance (après les règles) ; elle ne décide jamais seule d'annuler une séance. */
  mode: PulseMode | null;
  trend: Trend;
  analysis: DayAnalysis;
  training: TrainingAdvice;
  nutritionRecos: Reco[];
  mindRecos: Reco[];
  recoveryRecos: Reco[];
  /** Plan du jour par module (PULSE 1.2). */
  plan: PlanItem[];
  /** Proposition de séance en attente de validation, s'il y en a une. */
  proposal: Proposal | null;
  /** Scores des 14 derniers jours, aujourd'hui compris (recalculés). */
  recent: { date: string; score: number | null }[];
}

export interface PulseInput {
  date: string;
  index: DayIndex;
  data: LifeData;
  health: readonly HealthDay[];
  profile: { birthDate?: string; heightCm?: number; goal?: string; gainRate: GainRate };
  muscleOf: (exerciseId: string) => string | null;
  settings: PulseSettings;
  /** Journal PULSE d'hier (pour une séance déplacée). */
  yesterday: PulseDay | null;
  /** Journal PULSE des jours précédents (choix passés). */
  journal?: readonly PulseDay[];
  /** Routines Mind personnalisées (durées du plan). */
  routines?: Record<RoutineId, MindRoutine>;
  budget?: BudgetSettings | null;
}

export { adjustTargets, LIGHTEN } from './adjust';

const n0 = (v: number) => formatNumber(v, 0);

/** « 23:30 » → « 17:30 » (heure de coucher moins 6 heures, autour de minuit). */
export function sixHoursBefore(time: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const total = (((h * 60 + m - 360) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
const kg = (v: number) => formatNumber(v, v % 1 ? 1 : 0);

function progressionHints(template: WorkoutTemplate, data: LifeData): string[] {
  const hints: string[] = [];
  for (const e of template.exercises) {
    const sessions = exerciseSessions(e.exerciseId, data.workouts, data.sets);
    const last = sessions.at(-1);
    const s = suggestNext(sessions, parseRepRange(e.reps));
    if (last && s && s.weightKg > last.maxLoad) hints.push(`${data.exerciseName(e.exerciseId)} : ${kg(s.weightKg)} kg (+${kg(s.weightKg - last.maxLoad)}).`);
    if (hints.length === 2) break;
  }
  return hints;
}

function trainingAdvice(input: PulseInput, mode: PulseMode | null, rules: RuleHit[], score: number | null, fromScore: PulseMode | null): TrainingAdvice {
  const { date, index, data } = input;
  const movedTemplate =
    input.yesterday?.choice === 'deplacer' && input.yesterday.plannedTemplateId
      ? (data.templates.find((t) => t.id === input.yesterday!.plannedTemplateId && !t.deletedAt) ?? null)
      : null;
  const template = movedTemplate ?? templateForDay(data.templates, date);
  const base = { template, moved: !!movedTemplate, adjustment: null, actions: [] as PulseChoice[], hints: [] as string[] };
  const done = index.get(date)?.workouts ?? [];
  if (rules.some((r) => r.id === 'mineur')) return { ...base, kind: 'blocked', recos: [] };
  if (done.length) {
    return { ...base, kind: 'done', recos: [{ id: 'fait', text: `Séance faite : ${done.map((w) => w.workout.name).join(', ')}. Place à la récupération.` }] };
  }
  const chest = rules.find((r) => r.id === 'poitrine');
  if (chest) return { ...base, kind: 'rest', recos: [{ id: 'repos', text: 'Pas d’entraînement aujourd’hui.', reason: chest.text, to: chest.to }] };
  const name = template?.name ?? '';
  const movedNote = movedTemplate ? ` (reportée d’hier)` : '';
  const pain = rules.find((r) => r.id === 'douleur-alerte' && template && r.avoidMuscles && templateLoads(template, r.avoidMuscles, input.muscleOf));
  if (template && pain) {
    return {
      ...base,
      kind: 'suspended',
      recos: [
        {
          id: 'suspendue',
          text: `Séance ${name}${movedNote} suspendue : elle sollicite la zone douloureuse (${pain.zone!.toLocaleLowerCase('fr-FR')}). Un exercice qui ne la sollicite pas reste possible, seulement s’il ne réveille aucune douleur, ni pendant ni après.`,
          reason: pain.text,
          to: pain.to,
          source: pain.source,
        },
      ],
    };
  }
  if (!template || !mode) {
    if (!template) {
      return {
        ...base,
        kind: 'none',
        recos: [
          {
            id: 'libre',
            text:
              mode === 'allege' || mode === 'recuperation'
                ? 'Pas de séance prévue : profites-en pour récupérer, une marche facile suffit.'
                : 'Pas de séance prévue : repos ou activité libre.',
          },
        ],
      };
    }
    return { ...base, kind: 'as-planned', recos: [{ id: 'prevue', text: `Séance prévue : ${name}${movedNote}.` }] };
  }
  const fatigue = rules.find((r) => r.id === 'fatigue-installee');
  /** La règle qui a fait baisser la proposition sous ce que le score seul aurait donné. */
  const cap = fromScore ? rules.find((r) => r.capMode && MODE_RANK[r.capMode] < MODE_RANK[fromScore] && r.capMode === mode) : undefined;
  const s = input.settings.modes;
  const kept = keptRecently(input.journal ?? [], date);
  const keptNote: Reco[] =
    kept >= 3
      ? [
          {
            id: 'garde-souvent',
            text: `Tu as gardé ta séance prévue ${kept} fois ces 7 derniers jours malgré la proposition. Si les propositions te semblent trop prudentes, ajuste les seuils dans les réglages PULSE.`,
            to: '/pulse/reglages',
          },
        ]
      : [];
  switch (mode) {
    case 'feu-vert': {
      const hints = progressionHints(template, data);
      return {
        ...base,
        kind: 'as-planned',
        hints,
        recos: [
          {
            id: 'telle-quelle',
            text: `Séance ${name}${movedNote} telle quelle.${hints.length ? ` Surcharge progressive : ${hints.join(' ')}` : ''}`,
            reason: 'Tes signaux sont bons : c’est le bon jour pour suivre la progression prévue.',
          },
        ],
      };
    }
    case 'normal':
      return { ...base, kind: 'no-record', recos: [{ id: 'sans-record', text: `Séance ${name}${movedNote} telle quelle, sans chercher de record.` }] };
    case 'allege':
      return {
        ...base,
        kind: 'lighten',
        adjustment: LIGHTEN,
        actions: ['alleger', 'garder', 'deplacer'],
        recos: [
          {
            id: 'allegee',
            text: `Version allégée de ${name}${movedNote} : une série de moins par exercice, 2 répétitions en réserve de plus, pas de record visé.`,
            reason: cap
              ? `${cap.title} : ${cap.text}`
              : `Ton indicateur est à ${score}, sous ${s.normal} : PULSE propose une version allégée. C’est une proposition, tu peux garder la séance prévue.`,
            source: cap?.source,
            to: cap?.to,
          },
          ...keptNote,
        ],
      };
    case 'recuperation':
      return {
        ...base,
        kind: 'replace',
        actions: ['remplacer', 'garder', 'deplacer'],
        recos: [
          {
            id: 'remplacer',
            text: `Remplace ${name}${movedNote} par 30 minutes d’activité facile (marche ou vélo, en pouvant parler) et 10 minutes de mobilité.`,
            reason: fatigue
              ? fatigue.text
              : cap
                ? `${cap.title} : ${cap.text}`
                : `Ton indicateur est à ${score}, sous ${s.allege} : PULSE propose une récupération active. C’est une proposition, tu peux garder la séance prévue.`,
            source: fatigue?.source ?? cap?.source,
          },
          ...(fatigue
            ? [
                {
                  id: 'decharge',
                  text: 'Si la fatigue continue, allège aussi tes prochaines séances : environ 40 % de séries en moins et des charges un peu plus légères.',
                  source: PULSE_SOURCES.surentrainement,
                },
              ]
            : []),
          ...keptNote,
        ],
      };
  }
}

function nutritionRecos(input: PulseInput, status: NutritionStatus, mode: PulseMode | null, rules: RuleHit[], bedTime: string | null, sleepHours: number | null): Reco[] {
  if (rules.some((r) => r.id === 'mineur')) return [];
  const out: Reco[] = [];
  const t = status.targets;
  if (!t) out.push({ id: 'objectifs', text: 'Définis tes objectifs dans Nutrition pour suivre la cohérence de tes apports.', to: '/nutrition/objectifs' });
  if (t && rules.some((r) => r.id === 'poids-bas')) out.push({ id: 'pas-deficit', text: 'Pas de déficit : ton poids est déjà bas.', to: '/nutrition/objectifs' });
  if (!t) {
    // Pas d'objectif : seules les pistes qui n'en dépendent pas (caféine) suivent.
  } else if (rules.some((r) => r.id === 'apport-bas')) {
    out.push({
      id: 'revenir',
      text: `Reviens vers ${n0(t.kcal)} kcal aujourd’hui, avec ${n0(t.proteinG)} g de protéines répartis sur 3 ou 4 repas. Compose mon repas t’aide à atteindre la cible.`,
      reason: 'Un déficit trop fort freine la récupération et la conservation du muscle.',
      to: '/nutrition/compose',
    });
  } else if ((mode === 'allege' || mode === 'recuperation') && input.profile.goal === 'perte') {
    out.push({ id: 'pas-plus', text: `Reste à ton objectif de ${n0(t.kcal)} kcal, sans déficit en plus un jour de fatigue.` });
  } else if (status.kind !== 'incomplet') {
    out.push({ id: 'objectif-jour', text: `Objectif du jour : ${n0(t.kcal)} kcal et ${n0(t.proteinG)} g de protéines.`, to: '/nutrition' });
  }
  if (t && status.proteinLow && status.avgProteinG !== null) {
    out.push({
      id: 'proteines',
      text: `Protéines : ${n0(status.avgProteinG)} g par jour ces derniers jours, pour ${n0(t.proteinG)} g visés. Une source de protéines à chaque repas aide à y arriver.`,
      source: PULSE_SOURCES.proteines,
    });
  }
  if (sleepHours !== null && sleepHours < input.settings.sleepTargetHours - 1) {
    const cutoff = bedTime ? sixHoursBefore(bedTime) : null;
    out.push({
      id: 'cafeine',
      text: cutoff
        ? `Pas de caféine dans les 6 heures avant ton coucher : rien après ${formatTime(cutoff)} si tu te couches comme hier.`
        : 'Pas de caféine dans les 6 heures avant ton coucher.',
      reason: 'Prise 6 heures avant le coucher, la caféine réduit encore le sommeil.',
      source: PULSE_SOURCES.cafeine,
    });
  }
  if (t && status.kind === 'incomplet') out.push({ id: 'noter', text: 'Note tes repas pour que le statut nutrition soit fiable.', to: '/nutrition' });
  return out.slice(0, 3);
}

function mindRecos(input: PulseInput, mode: PulseMode | null, rules: RuleHit[], training: TrainingAdvice, sleepHours: number | null): Reco[] {
  const out: Reco[] = [];
  const distress = rules.find((r) => r.id === 'detresse');
  if (distress) out.push({ id: 'detresse', text: distress.text });
  const mood = recentMood(input.index, input.date);
  if (rules.some((r) => r.id === 'douleur-alerte' || r.id === 'douleur-suivi'))
    out.push({ id: 'respiration-lente', text: 'Respiration lente, 5 minutes, si la douleur gêne l’endormissement.', to: '/mind/exercice/respiration-lente' });
  if ((mood?.stress ?? 0) >= 4) out.push({ id: 'coherence', text: 'Cohérence cardiaque, 5 minutes, pour faire redescendre la pression.', to: '/mind/exercice/coherence' });
  if (sleepHours !== null && sleepHours < input.settings.sleepTargetHours - 1)
    out.push({ id: 'soir', text: 'Rituel du soir pour préparer une nuit plus longue.', to: '/mind/routine/soir' });
  if (mode === 'recuperation') out.push({ id: 'jacobson', text: 'Relaxation de Jacobson ce soir, pour relâcher le corps.', to: '/mind/exercice/jacobson' });
  if ((mood?.mood ?? 5) <= 2 && !distress) out.push({ id: 'recentrage', text: 'Exercice « Recentrage », 3 minutes.', to: '/mind/exercice/recentrage' });
  if ((training.kind === 'as-planned' || training.kind === 'no-record' || training.kind === 'lighten') && training.template)
    out.push({ id: 'avant', text: 'Routine « Avant la séance », juste avant de commencer.', to: '/mind/routine/avant' });
  const seen = new Set<string>();
  return out.filter((r) => !seen.has(r.id) && seen.add(r.id)).slice(0, distress ? 3 : 2);
}

function recoveryRecos(input: PulseInput, mode: PulseMode | null, rules: RuleHit[], sleepHours: number | null): Reco[] {
  const out: Reco[] = [];
  const target = input.settings.sleepTargetHours;
  if (sleepHours !== null && sleepHours < target) out.push({ id: 'coucher', text: 'Couche-toi 30 minutes plus tôt ce soir.', source: PULSE_SOURCES.sommeil });
  if (sleepHours !== null && sleepHours < target - 1)
    out.push({
      id: 'sieste',
      text: 'Sieste courte en début d’après-midi si tu peux : 10 minutes environ, 20 au plus.',
      reason: 'Après une nuit raccourcie, une sieste d’une dizaine de minutes est la plus réparatrice.',
      source: PULSE_SOURCES.sieste,
    });
  if (mode === 'recuperation')
    out.push({ id: 'repos', text: `Vise au moins ${formatHours(target)} de sommeil et évite deux séances intenses de suite.`, source: PULSE_SOURCES.surentrainement });
  const pain = rules.find((r) => r.id === 'douleur-alerte' || r.id === 'douleur-suivi');
  if (pain) out.push({ id: 'journal-douleur', text: 'Note ta douleur chaque jour : ce journal aide le médecin ou le kiné.', to: pain.to });
  if (!out.length && mode) out.push({ id: 'calme', text: 'Retour au calme après l’effort et coucher à ton heure habituelle.' });
  return out.slice(0, 3);
}

export function computePulse(input: PulseInput): PulseResult {
  const { date, index, settings } = input;
  const { readiness, load, hrvBelowDays } = computeReadiness({ date, index, health: input.health, settings });
  const nutrition = computeNutritionStatus({
    date,
    index,
    data: input.data,
    weighIns: input.data.weighIns,
    heightCm: input.profile.heightCm,
    gainRate: input.profile.gainRate,
    settings,
  });
  const measuredSleep = input.health.find((h) => h.date === date && typeof h.sleepHours === 'number')?.sleepHours ?? null;
  const checkIn = index.get(date)?.checkIn ?? null;
  const sleepHours = measuredSleep ?? checkIn?.sleepHours ?? null;
  const rules = evaluateRules({
    date,
    index,
    pains: input.data.pains,
    birthDate: input.profile.birthDate,
    goal: input.profile.goal,
    settings,
    sleepHours,
    load,
    hrvBelowDays,
    nutrition,
  });
  const mode = readiness.modeFromScore ? rules.reduce<PulseMode>((m, r) => (r.capMode ? lowerMode(m, r.capMode) : m), readiness.modeFromScore) : null;
  const training = trainingAdvice(input, mode, rules, readiness.score, readiness.modeFromScore);
  const bedTime = checkIn?.bedTime ?? null;
  const series = readinessSeries({ index, health: input.health, settings }, addDays(date, -30), addDays(date, -1));
  const trend = trendAt(series, date, readiness.score);
  const analysis = analyzeDay({ date, index, readiness, trend, loadRatio: load.ratio, settings });
  const core = {
    date,
    readiness,
    nutrition,
    rules,
    level: readiness.level,
    mode,
    trend,
    analysis,
    training,
    nutritionRecos: nutritionRecos(input, nutrition, mode, rules, bedTime, sleepHours),
    mindRecos: mindRecos(input, mode, rules, training, sleepHours),
    recoveryRecos: recoveryRecos(input, mode, rules, sleepHours),
  };
  const plan = buildPlan(core, { date, index, data: input.data, settings, muscleOf: input.muscleOf, routines: input.routines, budget: input.budget });
  const recent = [...series.slice(-13).map((p) => ({ date: p.date, score: p.score })), { date, score: readiness.score }];
  return { ...core, plan, proposal: buildProposal(core), recent };
}

/** Ce que le journal PULSE garde du jour (sans le choix, enregistré à part). */
export function pulseSnapshot(r: PulseResult): Omit<PulseDay, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'choice' | 'choiceAt'> {
  return {
    date: r.date,
    engineVersion: PULSE_ENGINE_VERSION,
    readiness: r.readiness.score,
    confidence: r.readiness.confidence,
    mode: r.mode,
    components: r.readiness.components.map((c) => ({ key: c.key, score: c.score, weight: c.weight })),
    nutritionKind: r.nutrition.kind,
    nutritionScore: r.nutrition.score,
    rules: r.rules.map((h) => h.id),
    plannedTemplateId: r.training.template?.id ?? null,
    plan: r.plan.map((p) => ({ id: p.id, module: p.module, title: p.title, to: p.to })),
    level: r.level,
    coverage: r.readiness.score === null ? null : r.readiness.coverage.present,
    trainingKind: r.training.kind,
  };
}
