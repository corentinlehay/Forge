import type { PulseLevel, WorkoutAdjustment, WorkoutTemplate } from '../../db/types';
import { MIND_EXERCISE_BY_ID } from '../../data/mindExercises';
import { addDays } from '../../lib/dates';
import { formatHours, formatNumber, formatTime } from '../../lib/format';
import type { BudgetSettings } from '../budget';
import type { DayIndex, LifeData } from '../lifeIndex';
import { DEFAULT_ROUTINES, routineSeconds, type MindRoutine, type RoutineId } from '../mind';
import { MEAL_LABELS } from '../nutrition';
import { adjustTargets, describeAdjustment, volumeOf, volumeText } from './adjust';
import type { DayAnalysis } from './analysis';
import type { NutritionStatus } from './nutrition';
import type { Readiness } from './readiness';
import type { RuleHit } from './rules';
import { LEVEL_LABELS, type PulseSettings } from './settings';
import { PULSE_SOURCES } from './sources';

/**
 * Plan du jour (cahier PULSE, section 6) : les recommandations, rangées par module.
 * Chaque élément a un objectif, une justification, une durée ou une quantité indicative,
 * une priorité, un lien vers le module, et les données réellement utilisées (« Pourquoi ? »).
 * Rien n'est appliqué : la séance se valide dans « À valider », les objectifs nutritionnels ne changent jamais.
 */
export type PlanModule = 'training' | 'nutrition' | 'mind' | 'sommeil' | 'recuperation';
export const PLAN_MODULES: PlanModule[] = ['training', 'nutrition', 'mind', 'sommeil', 'recuperation'];
export const PLAN_MODULE_LABELS: Record<PlanModule, string> = {
  training: 'Training',
  nutrition: 'Nutrition',
  mind: 'Mind',
  sommeil: 'Sommeil',
  recuperation: 'Récupération',
};

export type Priority = 'haute' | 'moyenne' | 'basse';
export const PRIORITY_LABELS: Record<Priority, string> = { haute: 'Priorité haute', moyenne: 'Priorité moyenne', basse: 'Priorité basse' };
const PRIORITY_RANK: Record<Priority, number> = { haute: 0, moyenne: 1, basse: 2 };

export interface PlanItem {
  id: string;
  module: PlanModule;
  title: string;
  /** Précision facultative (ex. surcharge progressive). */
  detail?: string;
  goal: string;
  reason: string;
  amount: string | null;
  priority: Priority;
  to: string | null;
  source?: string;
  /** Les données réellement utilisées, pour répondre à « Pourquoi ? ». */
  basis: string[];
  /** La proposition attend ta validation dans « À valider ». */
  pending?: boolean;
}

export interface Reco {
  id: string;
  text: string;
  reason?: string;
  source?: string;
  to?: string;
}

/** Ce dont le plan a besoin du résultat PULSE (sans dépendre du moteur, pour éviter un cycle). */
export interface PlanSource {
  date: string;
  readiness: Readiness;
  level: PulseLevel | null;
  nutrition: NutritionStatus;
  rules: RuleHit[];
  analysis: DayAnalysis;
  training: { kind: string; template: WorkoutTemplate | null; adjustment: WorkoutAdjustment | null; recos: Reco[]; hints: string[] };
  nutritionRecos: Reco[];
  mindRecos: Reco[];
  recoveryRecos: Reco[];
}

export interface PlanContext {
  date: string;
  index: DayIndex;
  data: LifeData;
  settings: PulseSettings;
  muscleOf: (exerciseId: string) => string | null;
  routines?: Record<RoutineId, MindRoutine>;
  budget?: BudgetSettings | null;
}

const n0 = (v: number) => formatNumber(v, 0);
const minutesOf = (seconds: number) => `environ ${Math.max(1, Math.round(seconds / 60))} min`;
const exerciseMinutes = (id: string) => {
  const ex = MIND_EXERCISE_BY_ID.get(id);
  return ex ? `${ex.minutes} min` : null;
};

/** Heure de réveil habituelle : médiane des réveils notés sur 14 jours, s'il y en a au moins 3. */
export function usualWake(index: DayIndex, date: string): { minutes: number; count: number } | null {
  const mins: number[] = [];
  for (let k = 0; k < 14; k++) {
    const t = index.get(addDays(date, -k))?.checkIn?.wakeTime;
    if (!t) continue;
    const [h = 0, m = 0] = t.split(':').map(Number);
    mins.push(h * 60 + m);
  }
  if (mins.length < 3) return null;
  mins.sort((a, b) => a - b);
  const mid = Math.floor(mins.length / 2);
  const median = mins.length % 2 ? mins[mid]! : Math.round((mins[mid - 1]! + mins[mid]!) / 2);
  return { minutes: median, count: mins.length };
}

const clock = (minutes: number) => {
  const m = (((Math.round(minutes / 15) * 15) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Heure de coucher indicative : réveil habituel moins le sommeil visé (et 30 minutes de plus après une nuit courte), au quart d'heure. */
export function bedtimeFor(wakeMinutes: number, targetHours: number, earlierMinutes = 0): string {
  return clock(wakeMinutes - targetHours * 60 - earlierMinutes);
}

function readinessBasis(src: PlanSource): string[] {
  const r = src.readiness;
  if (r.score === null || !src.level) return [r.unavailable ?? 'Pas de score aujourd’hui.'];
  return [
    `Indicateur ${r.score}/100, ${LEVEL_LABELS[src.level].toLocaleLowerCase('fr-FR')} (${r.coverage.present} dimensions sur ${r.coverage.total}).`,
    ...src.analysis.factors.map((f) => f.text),
  ];
}

function sleepBasis(ctx: PlanContext): string[] {
  const c = ctx.index.get(ctx.date)?.checkIn;
  return [
    typeof c?.sleepHours === 'number' ? `Nuit de ${formatHours(c.sleepHours)}, notée dans ton check-in.` : 'Durée de la nuit non notée aujourd’hui.',
    `Sommeil visé : ${formatHours(ctx.settings.sleepTargetHours)} (réglage PULSE).`,
  ];
}

function moodBasis(ctx: PlanContext): string[] {
  const m = ctx.index.get(ctx.date)?.mood ?? ctx.index.get(addDays(ctx.date, -1))?.mood ?? null;
  if (!m) return [];
  const when = m.date === ctx.date ? 'journal Mind du jour' : 'journal Mind d’hier';
  return [
    [m.mood ? `humeur ${m.mood}/5` : null, m.stress ? `stress ${m.stress}/5` : null]
      .filter(Boolean)
      .join(', ')
      .replace(/^./, (x) => x.toLocaleUpperCase('fr-FR')) + ` (${when}).`,
  ];
}

const ruleBasis = (rules: RuleHit[]) => rules.filter((r) => r.level !== 'nutrition').map((r) => `Règle : ${r.title}.`);

function sorted(items: PlanItem[]): PlanItem[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => PRIORITY_RANK[a.it.priority] - PRIORITY_RANK[b.it.priority] || a.i - b.i)
    .map(({ it }) => it);
}

function trainingItems(src: PlanSource, ctx: PlanContext): PlanItem[] {
  const t = src.training;
  const reco = t.recos[0];
  const name = t.template?.name ?? '';
  const volume = t.template ? volumeOf(t.template.exercises) : null;
  const basis = [...readinessBasis(src), ...ruleBasis(src.rules)];
  const out: PlanItem[] = [];
  const base = { module: 'training' as const, basis, to: '/training' };
  switch (t.kind) {
    case 'blocked':
      return [];
    case 'done': {
      const done = ctx.index.get(ctx.date)?.workouts ?? [];
      const sets = done.reduce((n, w) => n + w.setCount, 0);
      out.push({
        ...base,
        id: 'seance-faite',
        title: `Séance faite : ${done.map((w) => w.workout.name).join(', ')}`,
        goal: 'Laisser le corps récupérer',
        reason: 'La séance du jour est enregistrée.',
        amount: `${sets} série${sets > 1 ? 's' : ''} enregistrée${sets > 1 ? 's' : ''}`,
        priority: 'basse',
      });
      break;
    }
    case 'rest':
      out.push({
        ...base,
        id: 'repos-total',
        title: 'Pas d’entraînement aujourd’hui',
        goal: 'Ne prendre aucun risque',
        reason: reco?.reason ?? '',
        amount: null,
        priority: 'haute',
        to: reco?.to ?? null,
      });
      break;
    case 'suspended': {
      out.push({
        ...base,
        id: 'suspendue',
        title: `Séance ${name} suspendue`,
        goal: 'Ne pas solliciter la zone douloureuse',
        reason: reco?.reason ?? '',
        detail: reco?.text,
        amount: null,
        priority: 'haute',
        to: reco?.to ?? null,
        source: reco?.source,
      });
      const avoid = src.rules.find((r) => r.id === 'douleur-alerte' && r.avoidMuscles)?.avoidMuscles ?? [];
      const names = [
        ...new Set(
          ctx.data.templates
            .filter((tp) => !tp.deletedAt)
            .flatMap((tp) => tp.exercises.map((e) => e.exerciseId))
            .filter((id) => {
              const m = ctx.muscleOf(id);
              return m !== null && !avoid.includes(m);
            })
            .map((id) => ctx.data.exerciseName(id)),
        ),
      ].slice(0, 3);
      if (names.length)
        out.push({
          ...base,
          id: 'alternatives',
          title: 'Exercices qui ne sollicitent pas la zone',
          detail: `Tirés de tes séances : ${names.join(', ')}.`,
          goal: 'Rester actif sans réveiller la douleur',
          reason: 'Seulement s’ils ne réveillent aucune douleur, ni pendant ni après.',
          amount: 'Séries habituelles, sans record',
          priority: 'basse',
        });
      break;
    }
    case 'none':
      out.push({
        ...base,
        id: 'libre',
        title: 'Pas de séance prévue',
        goal: 'Bouger sans contrainte',
        reason: reco?.text ?? '',
        amount: 'Repos ou activité libre',
        priority: 'basse',
      });
      break;
    case 'as-planned':
      out.push({
        ...base,
        id: reco?.id === 'telle-quelle' ? 'telle-quelle' : 'prevue',
        title: `Séance ${name}`,
        detail: t.hints.length ? `Surcharge progressive : ${t.hints.join(' ')}` : undefined,
        goal: reco?.id === 'telle-quelle' ? 'Suivre la progression prévue' : 'Suivre ton programme',
        reason: reco?.reason ?? 'Pas encore de score aujourd’hui : la séance reste telle quelle.',
        amount: volume ? volumeText(volume) : null,
        priority: 'moyenne',
      });
      break;
    case 'no-record':
      out.push({
        ...base,
        id: 'sans-record',
        title: `Séance ${name}`,
        goal: 'Faire la séance prévue, sans chercher de record',
        reason: 'Tes signaux sont corrects, sans plus : pas le jour pour forcer.',
        amount: volume ? volumeText(volume) : null,
        priority: 'moyenne',
      });
      break;
    case 'lighten': {
      const after = t.template ? volumeOf(adjustTargets(t.template.exercises, t.adjustment)) : null;
      out.push({
        ...base,
        id: 'allegee',
        title: `Séance ${name}, version allégée proposée`,
        detail: describeAdjustment(t.adjustment) ?? undefined,
        goal: 'Garder l’habitude en limitant la fatigue',
        reason: reco?.reason ?? '',
        amount: after && volume ? `${volumeText(after)} (au lieu de ${volume.sets})` : null,
        priority: 'haute',
        source: reco?.source,
        pending: true,
      });
      break;
    }
    case 'replace':
      out.push({
        ...base,
        id: 'remplacer',
        title: `Récupération active à la place de ${name}`,
        goal: 'Bouger sans ajouter de fatigue',
        reason: reco?.reason ?? '',
        amount: '30 min d’activité facile et 10 min de mobilité',
        priority: 'haute',
        source: reco?.source,
        pending: true,
      });
      break;
  }
  for (const r of t.recos.slice(1)) {
    if (r.id === 'decharge')
      out.push({
        ...base,
        id: 'decharge',
        title: 'Alléger les prochaines séances',
        goal: 'Laisser la fatigue retomber',
        reason: r.text,
        amount: 'environ 40 % de séries en moins',
        priority: 'moyenne',
        source: r.source,
      });
    if (r.id === 'garde-souvent')
      out.push({
        ...base,
        id: 'garde-souvent',
        title: 'Ajuster les seuils de PULSE',
        goal: 'Des propositions qui collent à tes journées',
        reason: r.text,
        amount: null,
        priority: 'basse',
        to: '/pulse/reglages',
      });
  }
  return out;
}

function nutritionItems(src: PlanSource, ctx: PlanContext): PlanItem[] {
  if (src.rules.some((r) => r.id === 'mineur')) return [];
  const t = src.nutrition.targets;
  const basis = [
    t ? `Objectif en vigueur : ${n0(t.kcal)} kcal et ${n0(t.proteinG)} g de protéines.` : 'Pas d’objectif nutritionnel défini.',
    ...src.nutrition.lines,
    ...src.rules.filter((r) => r.level === 'nutrition').map((r) => `Règle : ${r.title}.`),
  ];
  const base = { module: 'nutrition' as const, basis, to: '/nutrition' };
  const out: PlanItem[] = [];
  for (const r of src.nutritionRecos) {
    if (r.id === 'objectifs')
      out.push({
        ...base,
        id: r.id,
        title: 'Définir tes objectifs',
        goal: 'Suivre la cohérence de tes apports',
        reason: r.text,
        amount: null,
        priority: 'moyenne',
        to: r.to ?? '/nutrition/objectifs',
      });
    if (r.id === 'pas-deficit')
      out.push({ ...base, id: r.id, title: 'Pas de déficit', goal: 'Protéger ta santé', reason: r.text, amount: null, priority: 'haute', to: r.to ?? '/nutrition/objectifs' });
    if (r.id === 'revenir' && t)
      out.push({
        ...base,
        id: r.id,
        title: `Revenir à ${n0(t.kcal)} kcal`,
        goal: 'Sortir d’un apport trop bas',
        reason: r.reason ?? r.text,
        detail: r.text,
        amount: `${n0(t.kcal)} kcal, ${n0(t.proteinG)} g de protéines`,
        priority: 'haute',
        to: r.to ?? '/nutrition',
      });
    if (r.id === 'pas-plus' && t)
      out.push({
        ...base,
        id: r.id,
        title: 'Rester à ton objectif',
        goal: 'Ne pas creuser le déficit un jour de fatigue',
        reason: r.text,
        amount: `${n0(t.kcal)} kcal`,
        priority: 'moyenne',
      });
    if (r.id === 'objectif-jour' && t)
      out.push({
        ...base,
        id: r.id,
        title: 'Objectif du jour',
        goal: 'Couvrir tes besoins',
        reason: 'Ton objectif en vigueur, sans changement automatique.',
        amount: `${n0(t.kcal)} kcal et ${n0(t.proteinG)} g de protéines`,
        priority: 'moyenne',
      });
    if (r.id === 'proteines' && t)
      out.push({
        ...base,
        id: r.id,
        title: 'Plus de protéines',
        goal: 'Atteindre ton objectif protéique',
        reason: r.text,
        amount: `${n0(t.proteinG)} g visés`,
        priority: 'moyenne',
        source: r.source,
      });
    if (r.id === 'noter') out.push({ ...base, id: r.id, title: 'Noter tes repas', goal: 'Un statut nutrition fiable', reason: r.text, amount: null, priority: 'basse' });
  }
  if (t) {
    const perMeal = Math.max(5, Math.round(t.proteinG / 4 / 5) * 5);
    out.push({
      ...base,
      id: 'repartition',
      title: 'Répartition des protéines',
      goal: 'Atteindre ton objectif protéique plus facilement',
      reason: 'Répartir les protéines sur au moins 4 repas est une stratégie raisonnable pour la construction musculaire.',
      amount: `environ ${perMeal} g par repas, sur 4 repas`,
      priority: 'basse',
      source: PULSE_SOURCES.proteinesRepas,
    });
  }
  const planned = (ctx.index.get(ctx.date)?.plans ?? []).filter((p) => p.status === 'planned');
  if (planned.length) {
    out.push({
      ...base,
      id: 'planning',
      title: 'Au planning aujourd’hui',
      detail: planned.map((p) => `${MEAL_LABELS[p.meal]} : ${ctx.data.recipeName(p.recipeKey)}`).join(' ; '),
      goal: 'Suivre tes repas prévus',
      reason: 'Tes repas prévus dans FORGE KITCHEN.',
      amount: `${planned.length} repas prévu${planned.length > 1 ? 's' : ''}`,
      priority: 'basse',
      to: '/nutrition/planning',
    });
  } else if (t) {
    out.push({
      ...base,
      id: 'compose',
      title: 'Compose un repas',
      goal: 'Compléter ta journée en restant dans ta cible',
      reason: 'Compose mon repas part de ce qu’il te reste pour la journée.',
      amount: null,
      priority: 'basse',
      to: '/nutrition/compose',
    });
  }
  const b = ctx.budget;
  if (b && (b.dailyEur || b.weeklyEur)) {
    out.push({
      ...base,
      id: 'budget',
      title: 'Budget alimentaire',
      goal: 'Rester dans ton budget',
      reason: 'Ton budget en vigueur, sans changement.',
      amount: b.dailyEur ? `${formatNumber(b.dailyEur, b.dailyEur % 1 ? 2 : 0)} € par jour` : `${formatNumber(b.weeklyEur!, b.weeklyEur! % 1 ? 2 : 0)} € par semaine`,
      priority: 'basse',
      to: '/nutrition/budget',
    });
  }
  return sorted(out).slice(0, 4);
}

function routineMinutes(ctx: PlanContext, id: RoutineId) {
  return minutesOf(routineSeconds((ctx.routines ?? DEFAULT_ROUTINES)[id]));
}

function mindItems(src: PlanSource, ctx: PlanContext): PlanItem[] {
  const basis = [...moodBasis(ctx), ...ruleBasis(src.rules.filter((r) => r.id === 'detresse' || r.id.startsWith('douleur')))];
  const base = { module: 'mind' as const, basis: basis.length ? basis : readinessBasis(src) };
  const out: PlanItem[] = [];
  for (const r of src.mindRecos) {
    if (r.id === 'detresse')
      out.push({ ...base, id: r.id, title: 'En parler à quelqu’un', goal: 'Ne pas rester seul avec ça', reason: r.text, amount: null, priority: 'haute', to: null });
    if (r.id === 'respiration-lente')
      out.push({
        ...base,
        id: r.id,
        title: 'Respiration lente',
        goal: 'Apaiser la douleur à l’endormissement',
        reason: r.text,
        amount: '5 min',
        priority: 'moyenne',
        to: r.to ?? null,
      });
    if (r.id === 'coherence')
      out.push({ ...base, id: r.id, title: 'Cohérence cardiaque', goal: 'Faire redescendre la pression', reason: r.text, amount: '5 min', priority: 'moyenne', to: r.to ?? null });
    if (r.id === 'recentrage')
      out.push({
        ...base,
        id: r.id,
        title: 'Recentrage',
        goal: 'Retrouver un peu de calme',
        reason: r.text,
        amount: exerciseMinutes('recentrage') ?? '3 min',
        priority: 'moyenne',
        to: r.to ?? null,
      });
    if (r.id === 'avant')
      out.push({
        ...base,
        id: r.id,
        title: 'Préparation mentale',
        goal: 'Arriver concentré à ta séance',
        reason: r.text,
        amount: routineMinutes(ctx, 'avant'),
        priority: 'basse',
        to: r.to ?? null,
      });
  }
  if (['as-planned', 'no-record', 'lighten'].includes(src.training.kind) && src.training.template)
    out.push({
      ...base,
      id: 'apres',
      title: 'Décompression après la séance',
      goal: 'Revenir au calme',
      reason: 'Routine « Après l’entraînement » : retour au calme et respiration.',
      amount: routineMinutes(ctx, 'apres'),
      priority: 'basse',
      to: '/mind/routine/apres',
    });
  return sorted(out).slice(0, 3);
}

function sleepItems(src: PlanSource, ctx: PlanContext): PlanItem[] {
  const target = ctx.settings.sleepTargetHours;
  const basis = sleepBasis(ctx);
  const base = { module: 'sommeil' as const, basis };
  const out: PlanItem[] = [];
  const short = src.recoveryRecos.some((r) => r.id === 'coucher');
  const wake = usualWake(ctx.index, ctx.date);
  if (wake) {
    const time = bedtimeFor(wake.minutes, target, short ? 30 : 0);
    out.push({
      ...base,
      id: 'coucher',
      title: `Coucher vers ${formatTime(time)}`,
      goal: `Dormir ${formatHours(target)} avant ton réveil habituel`,
      reason: short ? 'Ta nuit a été plus courte que ta cible : 30 minutes plus tôt que d’habitude ce soir.' : 'Ton réveil habituel moins ton sommeil visé.',
      amount: `${formatHours(target)} de sommeil visé`,
      priority: short ? 'haute' : 'moyenne',
      to: '/mind/sommeil',
      source: PULSE_SOURCES.sommeil,
      basis: [...basis, `Réveil habituel : ${formatTime(clock(wake.minutes))} (médiane de ${wake.count} réveils notés sur 14 jours).`],
    });
  } else {
    out.push({
      ...base,
      id: 'coucher',
      title: short ? 'Coucher 30 minutes plus tôt' : 'Horaire de coucher indicatif',
      goal: short ? 'Rattraper la nuit courte' : `Dormir ${formatHours(target)}`,
      reason: short
        ? 'Ta nuit a été plus courte que ta cible. Note aussi ton heure de réveil dans le check-in (détails de la nuit) pour avoir un horaire.'
        : 'Note ton heure de réveil dans le check-in (détails de la nuit) : il en faut 3 sur 14 jours pour proposer un horaire.',
      amount: short ? '30 min plus tôt' : null,
      priority: short ? 'haute' : 'basse',
      to: '/mind/sommeil',
      source: short ? PULSE_SOURCES.sommeil : undefined,
    });
  }
  const shortRitual = src.mindRecos.some((r) => r.id === 'soir');
  out.push({
    ...base,
    id: 'soir',
    title: 'Rituel du soir',
    goal: 'Préparer l’endormissement',
    reason: shortRitual ? 'Après une nuit courte, ralentir avant de dormir aide à se coucher à l’heure.' : 'Un repère simple pour ralentir avant de dormir.',
    amount: routineMinutes(ctx, 'soir'),
    priority: shortRitual ? 'moyenne' : 'basse',
    to: '/mind/routine/soir',
  });
  if (src.mindRecos.some((r) => r.id === 'jacobson'))
    out.push({
      ...base,
      id: 'jacobson',
      title: 'Relaxation de Jacobson',
      goal: 'Relâcher le corps',
      reason: 'Journée de récupération : relâcher les tensions avant la nuit.',
      amount: exerciseMinutes('jacobson'),
      priority: 'moyenne',
      to: '/mind/exercice/jacobson',
    });
  const nap = src.recoveryRecos.find((r) => r.id === 'sieste');
  if (nap)
    out.push({
      ...base,
      id: 'sieste',
      title: 'Sieste courte',
      goal: 'Récupérer d’une nuit raccourcie',
      reason: nap.reason ?? nap.text,
      amount: '10 min environ, 20 au plus',
      priority: 'moyenne',
      to: null,
      source: nap.source,
    });
  const caffeine = src.nutritionRecos.find((r) => r.id === 'cafeine');
  if (caffeine)
    out.push({
      ...base,
      id: 'cafeine',
      title: 'Caféine : heure limite',
      goal: 'Protéger ta prochaine nuit',
      reason: caffeine.reason ?? '',
      detail: caffeine.text,
      amount: '6 h avant le coucher',
      priority: 'moyenne',
      to: null,
      source: caffeine.source,
    });
  return sorted(out).slice(0, 4);
}

function recoveryItems(src: PlanSource, ctx: PlanContext): PlanItem[] {
  const base = { module: 'recuperation' as const, basis: [...readinessBasis(src), ...ruleBasis(src.rules)] };
  const out: PlanItem[] = [];
  for (const r of src.recoveryRecos) {
    if (r.id === 'repos')
      out.push({
        ...base,
        id: r.id,
        title: 'Repos prioritaire',
        goal: 'Laisser la fatigue retomber',
        reason: r.text,
        amount: `au moins ${formatHours(ctx.settings.sleepTargetHours)} de sommeil`,
        priority: 'moyenne',
        to: null,
        source: r.source,
      });
    if (r.id === 'journal-douleur')
      out.push({ ...base, id: r.id, title: 'Noter ta douleur', goal: 'Suivre son évolution', reason: r.text, amount: 'chaque jour', priority: 'moyenne', to: r.to ?? null });
    if (r.id === 'calme') out.push({ ...base, id: r.id, title: 'Retour au calme', goal: 'Récupérer après l’effort', reason: r.text, amount: null, priority: 'basse', to: null });
  }
  const kind = src.training.kind;
  const painful = src.rules.some((r) => r.id === 'poitrine' || r.id === 'douleur-alerte');
  if ((kind === 'none' || kind === 'done') && !painful)
    out.push({
      ...base,
      id: 'mobilite',
      title: 'Mobilité douce',
      goal: 'Garder de l’amplitude sans fatigue',
      reason: 'Quelques mouvements lents, sans douleur, sur les articulations travaillées cette semaine.',
      amount: '10 min',
      priority: 'basse',
      to: null,
    });
  if (['done', 'as-planned', 'no-record', 'lighten'].includes(kind) && !painful)
    out.push({
      ...base,
      id: 'etirements',
      title: 'Étirements doux, si tu en as l’habitude',
      goal: 'Le confort après la séance',
      reason: 'Ils n’évitent pas les courbatures : fais-les pour le confort, sans forcer.',
      amount: '5 à 10 min',
      priority: 'basse',
      to: null,
      source: PULSE_SOURCES.etirements,
    });
  return sorted(out).slice(0, 3);
}

export function buildPlan(src: PlanSource, ctx: PlanContext): PlanItem[] {
  return [...trainingItems(src, ctx), ...nutritionItems(src, ctx), ...mindItems(src, ctx), ...sleepItems(src, ctx), ...recoveryItems(src, ctx)];
}

/* ---------- Proposition à valider (cahier PULSE, section 8) ---------- */

export interface Proposal {
  kind: 'lighten' | 'replace';
  templateId: string;
  templateName: string;
  /** Situation actuelle : la séance prévue. */
  situation: string;
  /** Modification proposée. */
  proposed: string;
  reason: string;
  source?: string;
  impact: string[];
  basis: string[];
  /** Ajustement proposé par défaut (version allégée) ; null pour la récupération active. */
  adjustment: WorkoutAdjustment | null;
}

/** Impact attendu d'une version allégée sur la séance prévue. */
export function lightenImpact(template: WorkoutTemplate, adjustment: WorkoutAdjustment): string[] {
  const before = volumeOf(template.exercises);
  const after = volumeOf(adjustTargets(template.exercises, adjustment));
  const pct = before.sets ? Math.round(((after.sets - before.sets) / before.sets) * 100) : 0;
  const rir = (v: typeof before) => (v.rirMin === v.rirMax ? `${v.rirMin}` : `${v.rirMin} à ${v.rirMax}`);
  return [
    after.sets === before.sets ? `Volume : ${before.sets} séries, inchangé.` : `Volume : ${before.sets} séries → ${after.sets} (${pct < 0 ? '−' : '+'}${Math.abs(pct)} %).`,
    rir(after) === rir(before)
      ? 'Intensité : répétitions en réserve inchangées.'
      : `Intensité : ${rir(before)} → ${rir(after)} répétitions en réserve, avec tes charges habituelles.`,
    'Aucune hausse de charge proposée pendant la séance, et pas de record visé.',
    `Programme inchangé : ta prochaine séance ${template.name} reprend les objectifs habituels.`,
  ];
}

export const REPORT_IMPACT = 'Reporter : la séance est proposée demain dans PULSE ; le programme et le calendrier ne changent pas.';

export function buildProposal(src: PlanSource): Proposal | null {
  const t = src.training;
  if (!t.template || (t.kind !== 'lighten' && t.kind !== 'replace')) return null;
  const tp = t.template;
  const reco = t.recos[0];
  const situation = `Séance ${tp.name} prévue : ${volumeText(volumeOf(tp.exercises))}.`;
  const basis = [...readinessBasis(src), ...ruleBasis(src.rules)];
  if (t.kind === 'lighten' && t.adjustment) {
    const after = volumeOf(adjustTargets(tp.exercises, t.adjustment));
    return {
      kind: 'lighten',
      templateId: tp.id,
      templateName: tp.name,
      situation,
      proposed: `Version allégée : ${volumeText(after)} (${describeAdjustment(t.adjustment)}), pas de record visé.`,
      reason: reco?.reason ?? '',
      source: reco?.source,
      impact: lightenImpact(tp, t.adjustment),
      basis,
      adjustment: t.adjustment,
    };
  }
  return {
    kind: 'replace',
    templateId: tp.id,
    templateName: tp.name,
    situation,
    proposed: 'Récupération active à la place : 30 minutes d’activité facile (marche ou vélo, en pouvant parler) et 10 minutes de mobilité.',
    reason: reco?.reason ?? '',
    source: reco?.source,
    impact: [`Pas de musculation aujourd’hui.`, `Programme inchangé : ${tp.name} revient à sa prochaine date prévue.`],
    basis,
    adjustment: null,
  };
}
