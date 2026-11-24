import type { Pain, PulseMode, WorkoutTemplate } from '../../db/types';
import { addDays } from '../../lib/dates';
import { formatHours } from '../../lib/format';
import { ALERT_TEXT, painStatus, zoneLabel, type PainAlert } from '../body';
import type { DayIndex } from '../lifeIndex';
import { ageOn, MIN_AGE } from '../plan';
import type { NutritionStatus } from './nutrition';
import { recentMood, type LoadSignals } from './readiness';
import type { PulseSettings } from './settings';
import { PULSE_SOURCES } from './sources';

/**
 * Règles de sécurité et de tendance : elles passent avant le score.
 * Elles ne posent jamais de diagnostic ; elles limitent l'entraînement proposé et orientent vers un avis médical.
 */
export type RuleId =
  'mineur' | 'poitrine' | 'douleur-alerte' | 'douleur-suivi' | 'douleur-signalee' | 'nuit-courte' | 'fatigue-installee' | 'detresse' | 'apport-bas' | 'poids-bas';

export interface RuleHit {
  id: RuleId;
  level: 'securite' | 'tendance' | 'nutrition';
  title: string;
  text: string;
  source?: string;
  to?: string;
  /** Le mode du jour ne dépasse pas celui-ci. */
  capMode?: PulseMode;
  /** Aucun entraînement proposé aujourd'hui. */
  noTraining?: boolean;
  /** Groupes musculaires à ne pas solliciter (douleur avec signe d'alerte). */
  avoidMuscles?: string[];
  zone?: string;
}

/** Groupes musculaires sollicités par chaque zone de douleur (clé sans côté). */
const ZONE_MUSCLES: Record<string, string[]> = {
  cou: ['trapezes', 'epaules'],
  epaule: ['epaules', 'pectoraux', 'dos', 'trapezes', 'triceps', 'biceps'],
  'haut-dos': ['dos', 'trapezes'],
  coude: ['biceps', 'triceps', 'avant-bras'],
  ventre: ['abdominaux', 'obliques'],
  'bas-dos': ['lombaires', 'ischios', 'fessiers', 'quadriceps', 'dos'],
  poignet: ['avant-bras', 'biceps', 'triceps', 'pectoraux'],
  hanche: ['fessiers', 'adducteurs', 'quadriceps', 'ischios'],
  fessier: ['fessiers', 'ischios'],
  cuisse: ['quadriceps', 'adducteurs'],
  ischio: ['ischios', 'fessiers'],
  genou: ['quadriceps', 'ischios', 'adducteurs', 'mollets', 'fessiers'],
  tibia: ['mollets', 'quadriceps'],
  mollet: ['mollets'],
  cheville: ['mollets', 'quadriceps', 'fessiers', 'ischios'],
};

export const zoneMuscles = (zone: string): string[] => ZONE_MUSCLES[zone.replace(/-(d|g)$/, '')] ?? [];

/** Une séance sollicite-t-elle ces muscles (muscle principal de ses exercices) ? */
export function templateLoads(template: WorkoutTemplate, muscles: readonly string[], muscleOf: (exerciseId: string) => string | null): boolean {
  return template.exercises.some((e) => {
    const m = muscleOf(e.exerciseId);
    return !!m && muscles.includes(m);
  });
}

export const MODE_RANK: Record<PulseMode, number> = { recuperation: 0, allege: 1, normal: 2, 'feu-vert': 3 };
export const lowerMode = (a: PulseMode, b: PulseMode): PulseMode => (MODE_RANK[a] <= MODE_RANK[b] ? a : b);

export interface RulesInput {
  date: string;
  index: DayIndex;
  pains: readonly Pain[];
  birthDate?: string;
  goal?: string;
  settings: PulseSettings;
  sleepHours: number | null;
  load: LoadSignals;
  hrvBelowDays: number;
  nutrition: NutritionStatus;
}

export function evaluateRules(input: RulesInput): RuleHit[] {
  const { date, index, settings } = input;
  const hits: RuleHit[] = [];
  if (input.birthDate && ageOn(input.birthDate, date) < MIN_AGE) {
    hits.push({
      id: 'mineur',
      level: 'securite',
      title: 'Pas de plan avant 18 ans',
      text: 'FORGE ne propose ni entraînement ni objectif nutritionnel avant 18 ans. Parles-en à un professionnel de santé ou à un éducateur sportif.',
      noTraining: true,
    });
  }

  for (const pain of input.pains.filter((p) => !p.deletedAt && p.startedOn <= date && (p.resolvedOn === null || p.resolvedOn > date))) {
    const status = painStatus({ ...pain, logs: pain.logs.filter((l) => l.date <= date) }, date);
    const zone = zoneLabel(pain.zone);
    const to = `/progression/douleur/${pain.id}`;
    if (status.alerts.includes('poitrine')) {
      hits.push({
        id: 'poitrine',
        level: 'securite',
        title: 'Douleur dans la poitrine',
        text: ALERT_TEXT.poitrine,
        noTraining: true,
        capMode: 'recuperation',
        to,
        zone,
        source: PULSE_SOURCES.douleurs,
      });
      continue;
    }
    const urgent = status.alerts.filter((a): a is PainAlert => a === 'signes' || a === 'intense');
    if (urgent.length) {
      hits.push({
        id: 'douleur-alerte',
        level: 'securite',
        title: `${zone} : signe d’alerte`,
        text: ALERT_TEXT[urgent[0]!],
        avoidMuscles: zoneMuscles(pain.zone),
        to,
        zone,
        source: PULSE_SOURCES.douleurs,
      });
      continue;
    }
    if (status.alerts.length || (status.current ?? 0) >= 4) {
      hits.push({
        id: 'douleur-suivi',
        level: 'securite',
        title: `${zone} : douleur suivie`,
        text: status.alerts.length ? ALERT_TEXT[status.alerts[0]!] : `Douleur notée ${status.current}/10 : évite ou adapte les mouvements qui la réveillent.`,
        to,
        zone,
        source: PULSE_SOURCES.douleurs,
      });
    }
  }

  // « Douleur inhabituelle » cochée au check-in sans douleur située aujourd'hui : prudence, sans rien deviner de la zone.
  const located = hits.some((h) => h.id === 'poitrine' || h.id === 'douleur-alerte' || h.id === 'douleur-suivi');
  const loggedToday = input.pains.some((p) => !p.deletedAt && p.logs.some((l) => l.date === date));
  if (index.get(date)?.checkIn?.unusualPain === true && !located && !loggedToday) {
    hits.push({
      id: 'douleur-signalee',
      level: 'securite',
      title: 'Douleur inhabituelle signalée',
      text: 'Tu signales une douleur inhabituelle sans l’avoir située : par prudence, PULSE propose au plus une version allégée. Situe-la pour que la séance s’adapte à la zone. Douleur dans la poitrine, essoufflement ou malaise : appelle le 15.',
      capMode: 'allege',
      to: '/progression?vue=douleurs',
      source: PULSE_SOURCES.douleurs,
    });
  }

  if (input.sleepHours !== null && input.sleepHours < settings.shortNightHours) {
    hits.push({
      id: 'nuit-courte',
      level: 'securite',
      title: `Nuit de moins de ${Number.isInteger(settings.shortNightHours) ? `${settings.shortNightHours} h` : formatHours(settings.shortNightHours)}`,
      text: 'Pas de séance intense ni de record visé aujourd’hui : une perte de sommeil aiguë diminue la performance physique.',
      capMode: 'allege',
      source: PULSE_SOURCES.sommeilPerf,
    });
  }

  const tired = (d: string) => {
    const c = index.get(d)?.checkIn;
    return !!c && (c.fatigue ?? 0) >= 4 && (c.soreness ?? 0) >= 4;
  };
  const subjectiveTrend = [0, 1, 2].every((k) => tired(addDays(date, -k)));
  if ((input.hrvBelowDays >= 3 || subjectiveTrend) && input.load.ratio !== null && input.load.ratio > settings.loadHigh) {
    hits.push({
      id: 'fatigue-installee',
      level: 'tendance',
      title: 'Fatigue qui s’installe',
      text:
        input.hrvBelowDays >= 3
          ? `VFC sous ta zone habituelle depuis ${input.hrvBelowDays} jours et charge en hausse : journée de récupération, sans aucun diagnostic. En cas de fièvre, de douleur dans la poitrine ou de malaise, pas d’entraînement et un avis médical.`
          : 'Fatigue et courbatures à 4 ou 5 sur 5 trois jours de suite, et charge en hausse : journée de récupération, sans aucun diagnostic. En cas de fièvre, de douleur dans la poitrine ou de malaise, pas d’entraînement et un avis médical.',
      capMode: 'recuperation',
      source: `${PULSE_SOURCES.vfc} ; ${PULSE_SOURCES.surentrainement} ; limites du rapport de charge : ${PULSE_SOURCES.charge}`,
    });
  }

  const mood = recentMood(index, date);
  if (mood?.mood === 1) {
    hits.push({
      id: 'detresse',
      level: 'securite',
      title: 'Moral au plus bas',
      text: 'Si ça ne va pas du tout, parles-en. En cas de détresse psychique, le 3114 répond jour et nuit, gratuitement ; en cas d’urgence, appelle le 15 ou le 112.',
    });
  }

  if (input.nutrition.lowIntakeStreak >= 3 && input.nutrition.targets) {
    hits.push({
      id: 'apport-bas',
      level: 'nutrition',
      title: 'Apport très bas',
      text: `Sous ${settings.lowIntakePct} % de ton objectif depuis ${input.nutrition.lowIntakeStreak} jours : pas de déficit en plus, reviens vers ton objectif.`,
      to: '/nutrition',
    });
  }
  if (input.nutrition.lowWeight && input.goal === 'perte') {
    hits.push({ id: 'poids-bas', level: 'nutrition', title: 'Poids déjà bas', text: 'Ton poids est déjà bas : FORGE ne propose aucun déficit.', to: '/nutrition/objectifs' });
  }
  return hits;
}
