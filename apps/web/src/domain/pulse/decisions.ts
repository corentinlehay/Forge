import type { MindSession, PulseAction, PulseChoice, PulseDay, PulsePlanRef, PulseReview, Workout } from '../../db/types';
import { describeAdjustment } from './adjust';

/**
 * Décisions et bilan du soir (cahier PULSE, sections 8 et 12).
 * Rien ici n'écrit : ce sont les règles de ce qu'on peut annuler, et de ce que le bilan préremplit.
 */
export const ACTION_LABELS: Record<PulseAction, string> = {
  accepter: 'Accepté',
  refuser: 'Refusé, séance prévue gardée',
  modifier: 'Modifié',
  reporter: 'Reporté à demain',
  annuler: 'Choix annulé',
};

export const CHOICE_LABELS: Record<PulseChoice, string> = {
  alleger: 'version allégée',
  remplacer: 'récupération active',
  garder: 'séance prévue',
  deplacer: 'séance déplacée à demain',
};

/** Une décision en une ligne : « Modifié : version allégée (2 répétitions en réserve de plus) ». */
export function decisionText(d: NonNullable<PulseDay['decisions']>[number]): string {
  if (d.action === 'annuler') return ACTION_LABELS.annuler;
  if (d.action === 'refuser' || d.action === 'reporter') return ACTION_LABELS[d.action];
  const adj = describeAdjustment(d.adjustment);
  return `${ACTION_LABELS[d.action]} : ${d.choice ? CHOICE_LABELS[d.choice] : ''}${adj ? ` (${adj})` : ''}`;
}

export interface RevertCheck {
  ok: boolean;
  reason?: string;
  /** Séance en cours à remettre aux objectifs prévus. */
  workoutId?: string;
}

/**
 * Peut-on revenir sur le choix du jour ? Oui tant que la séance prévue n'est pas terminée ;
 * une séance allégée en cours retrouve ses objectifs prévus. Seulement le jour même.
 */
export function canRevert(record: PulseDay | null, workouts: readonly Workout[], today: string): RevertCheck {
  if (!record?.choice) return { ok: false, reason: 'Aucun choix à annuler.' };
  if (record.date !== today) return { ok: false, reason: 'Un choix ne s’annule que le jour même.' };
  const planned = workouts.filter((w) => !w.deletedAt && w.date === record.date && w.templateId && w.templateId === record.plannedTemplateId);
  if (planned.some((w) => w.endedAt)) return { ok: false, reason: 'La séance est terminée : ce choix ne peut plus être annulé.' };
  const running = planned.find((w) => !w.endedAt && w.adjustment);
  return running ? { ok: true, workoutId: running.id } : { ok: true };
}

/** Modifications proposées dans le bilan du soir. */
export const REVIEW_CHANGES: { key: string; label: string }[] = [
  { key: 'allegee', label: 'Séance allégée' },
  { key: 'gardee', label: 'Séance prévue gardée' },
  { key: 'deplacee', label: 'Séance déplacée' },
  { key: 'remplacee', label: 'Récupération active à la place' },
  { key: 'sautee', label: 'Séance sautée' },
  { key: 'autre-seance', label: 'Autre séance' },
  { key: 'repas', label: 'Repas différents du plan' },
  { key: 'aucune', label: 'Aucune' },
];
export const REVIEW_CHANGE_LABELS = new Map(REVIEW_CHANGES.map((c) => [c.key, c.label]));

export const FOLLOWED_LABELS: Record<NonNullable<PulseReview['followed']>, string> = { oui: 'Oui', partiel: 'En partie', non: 'Non' };
export const USEFUL_LABELS: Record<NonNullable<PulseReview['useful']>, string> = { oui: 'Oui', 'un-peu': 'Un peu', non: 'Non' };

const CHANGE_OF_CHOICE: Record<PulseChoice, string> = { alleger: 'allegee', garder: 'gardee', deplacer: 'deplacee', remplacer: 'remplacee' };

/** Lien d'un élément du plan vers ce qui prouve qu'il est fait : une pratique Mind, ou la séance. */
function doneBy(item: PulsePlanRef, workouts: readonly { templateId?: string | null }[], mind: readonly MindSession[], plannedTemplateId: string | null | undefined): boolean {
  if (item.module === 'training' && ['telle-quelle', 'prevue', 'sans-record', 'allegee'].includes(item.id))
    return workouts.some((w) => !plannedTemplateId || w.templateId === plannedTemplateId);
  const m = item.to?.match(/^\/mind\/(exercice|routine)\/([^/]+)$/);
  if (m) return mind.some((s) => !s.deletedAt && s.ref === m[2] && (s.completed || s.durationSec >= 60));
  return false;
}

/** Bilan prérempli à partir de ce qui est déjà connu : le choix du jour et ce qui a été fait. */
export function reviewDefaults(record: PulseDay, finishedWorkouts: readonly Workout[], mind: readonly MindSession[]): Omit<PulseReview, 'at'> {
  if (record.review) {
    const { at: _at, ...rest } = record.review;
    return rest;
  }
  const done = (record.plan ?? []).filter((p) => doneBy(p, finishedWorkouts, mind, record.plannedTemplateId)).map((p) => p.id);
  return {
    followed: null,
    changes: record.choice ? [CHANGE_OF_CHOICE[record.choice]] : [],
    sessionFeel: null,
    dayFeel: null,
    useful: null,
    done,
  };
}

export const hasReviewAnswer = (r: Omit<PulseReview, 'at'>) =>
  r.followed !== null || r.changes.length > 0 || r.sessionFeel !== null || r.dayFeel !== null || r.useful !== null || r.done.length > 0 || !!r.note?.trim();

/** « Plan suivi en partie, journée 4/5, recommandations utiles » : le bilan en une ligne. */
export function reviewSummary(r: PulseReview): string {
  const parts = [
    r.followed ? `plan suivi : ${FOLLOWED_LABELS[r.followed].toLocaleLowerCase('fr-FR')}` : null,
    r.sessionFeel ? `séance ${r.sessionFeel}/5` : null,
    r.dayFeel ? `journée ${r.dayFeel}/5` : null,
    r.useful ? `recommandations utiles : ${USEFUL_LABELS[r.useful].toLocaleLowerCase('fr-FR')}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(', ').replace(/^./, (x) => x.toLocaleUpperCase('fr-FR')) : 'Bilan sans réponse';
}

/** Le bilan du soir s'ouvre à partir de cette heure ; celui de la veille reste possible le lendemain. */
export const REVIEW_FROM_HOUR = 17;

export const FEEL_MIN_TEXT = 'Le ressenti selon ton choix se compare avec au moins 3 bilans après une proposition acceptée et 3 après une séance gardée.';
