import type { PulseComponentKey, PulseConfidence } from '../../db/types';
import { addDays } from '../../lib/dates';
import { formatHours, formatNumber } from '../../lib/format';
import type { DayIndex } from '../lifeIndex';
import type { Trend } from './history';
import type { ComponentResult, HealthConflict, Readiness } from './readiness';
import { LEVEL_LABELS, type PulseSettings } from './settings';

/**
 * Analyse du jour (cahier PULSE, section 4) : ce qui influence le score, en séparant
 * ce qui est mesuré ou calculé (observé), ce que tu as noté (déclaré), ce que PULSE calcule (estimé),
 * les pistes possibles (hypothèses, jamais des causes établies) et ce qui manque.
 */
export type AnalysisKind = 'observe' | 'declare' | 'estime' | 'hypothese' | 'manquant';

export const ANALYSIS_LABELS: Record<AnalysisKind, string> = {
  observe: 'Observé',
  declare: 'Déclaré',
  estime: 'Estimé',
  hypothese: 'Hypothèse',
  manquant: 'Manquant',
};

export interface AnalysisItem {
  kind: AnalysisKind;
  text: string;
}

export interface Factor {
  key: PulseComponentKey;
  label: string;
  direction: 'favorable' | 'defavorable';
  /** Écart à ta moyenne des 7 jours précédents, en points ; null sans référence. */
  delta: number | null;
  text: string;
}

export interface DayAnalysis {
  headline: string | null;
  factors: Factor[];
  items: AnalysisItem[];
}

/** Score arrondi à 5 et précédé de « ≈ » quand la confiance est basse : pas de précision artificielle. */
export function scoreText(score: number, confidence: PulseConfidence | null): string {
  return confidence === 'basse' ? `≈ ${Math.round(score / 5) * 5}` : String(score);
}

const CONFIDENCE_WORDS: Record<PulseConfidence, string> = { haute: 'haute', moyenne: 'moyenne', basse: 'basse' };

/** Comment dire qu'une dimension tire le score vers le haut ou vers le bas, par rapport à ta moyenne… */
const PHRASES: Record<PulseComponentKey, { up: string; down: string }> = {
  sommeil: { up: 'un meilleur sommeil', down: 'un sommeil plus court ou moins bon' },
  physiologie: { up: 'des mesures de la montre favorables', down: 'des mesures de la montre moins favorables' },
  ressenti: { up: 'un meilleur ressenti physique', down: 'un ressenti physique moins bon (énergie, fatigue ou courbatures)' },
  charge: { up: 'une charge d’entraînement dans ta zone habituelle', down: 'une charge d’entraînement plus haute que d’habitude' },
  mental: { up: 'moins de stress ou une meilleure humeur', down: 'plus de stress ou une humeur plus basse' },
};
/** … ou dans l'absolu, quand il n'y a pas encore de moyenne. */
const ABSOLUTE: Record<PulseComponentKey, { up: string; down: string }> = {
  sommeil: { up: 'un bon sommeil', down: 'un sommeil court ou de faible qualité' },
  physiologie: { up: 'des mesures de la montre favorables', down: 'des mesures de la montre défavorables' },
  ressenti: { up: 'un bon ressenti physique', down: 'un ressenti physique difficile (énergie, fatigue ou courbatures)' },
  charge: { up: 'une charge d’entraînement dans ta zone habituelle', down: 'une charge d’entraînement plus haute que d’habitude' },
  mental: { up: 'un mental plutôt serein', down: 'du stress ou une humeur basse' },
};

/** Écart minimal (points) à la moyenne de la dimension pour la citer ; seuils absolus sans référence. */
const FACTOR_DELTA = 10;
const LOW_SCORE = 50;
const HIGH_SCORE = 85;

/** Les dimensions qui pèsent le plus aujourd'hui, trois au plus, de la plus influente à la moins influente. */
export function mainFactors(readiness: Readiness, trend: Trend | null): Factor[] {
  const out: (Factor & { impact: number })[] = [];
  for (const c of readiness.components) {
    if (c.score === null || c.weight === 0) continue;
    const ref = trend?.components7[c.key] ?? null;
    const delta = ref === null ? null : Math.round(c.score - ref);
    let direction: Factor['direction'] | null = null;
    let impact = 0;
    if (delta !== null && Math.abs(delta) >= FACTOR_DELTA) {
      direction = delta < 0 ? 'defavorable' : 'favorable';
      impact = Math.abs(delta) * c.weight;
    } else if (c.score < LOW_SCORE) {
      direction = 'defavorable';
      impact = (LOW_SCORE + 10 - c.score) * c.weight;
    } else if (delta === null && c.score >= HIGH_SCORE) {
      direction = 'favorable';
      impact = (c.score - HIGH_SCORE + 10) * c.weight;
    }
    if (!direction) continue;
    const detail = c.summary ? ` (${c.summary})` : '';
    const text =
      delta !== null && Math.abs(delta) >= FACTOR_DELTA
        ? `${c.label} ${c.score}/100, ${Math.abs(delta)} points ${delta < 0 ? 'sous' : 'au-dessus de'} ta moyenne des 7 derniers jours${detail}.`
        : `${c.label} ${c.score}/100${detail}.`;
    out.push({ key: c.key, label: c.label, direction, delta, text, impact });
  }
  return out
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3)
    .map(({ impact: _impact, ...f }) => f);
}

const lowerFirst = (s: string) => s.replace(/^./, (x) => x.toLocaleLowerCase('fr-FR'));
const joinFr = (list: readonly string[]) => (list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} et ${list.at(-1)}`);

function conflictText(c: HealthConflict): string {
  const value = (v: number) => (c.metric === 'sleepHours' ? formatHours(v) : `${formatNumber(v, 0)}${c.metric === 'hrvMs' ? ' ms' : ' bpm'}`);
  const what = c.metric === 'sleepHours' ? 'le sommeil' : c.metric === 'hrvMs' ? 'la VFC' : 'la fréquence au repos';
  return `Deux sources ne concordent pas sur ${what} : ${c.kept.source} ${value(c.kept.value)}, ${c.other.source} ${value(c.other.value)}. PULSE retient ${c.kept.source}.`;
}

export interface AnalysisInput {
  date: string;
  index: DayIndex;
  readiness: Readiness;
  trend: Trend | null;
  loadRatio: number | null;
  settings: PulseSettings;
}

export function analyzeDay({ date, index, readiness, trend, loadRatio, settings }: AnalysisInput): DayAnalysis {
  const items: AnalysisItem[] = [];
  const by = (k: PulseComponentKey): ComponentResult | undefined => readiness.components.find((c) => c.key === k);
  const score = (k: PulseComponentKey) => by(k)?.score ?? null;

  for (const c of readiness.components) {
    if (c.score === null || !c.summary) continue;
    if (c.source === 'mesure') items.push({ kind: 'observe', text: `Mesuré par ${c.sourceLabel} : ${c.summary}.` });
    if (c.source === 'calcule') items.push({ kind: 'observe', text: `D’après tes séances enregistrées : ${c.summary}.` });
  }
  for (const c of readiness.conflicts) items.push({ kind: 'observe', text: conflictText(c) });

  const declared = new Map<string, string[]>();
  for (const c of readiness.components) {
    if (c.score === null || c.source !== 'declare' || !c.summary) continue;
    const where = c.sourceLabel === 'Check-in du matin' ? 'ton check-in du matin' : (c.sourceLabel ?? '').replace(/^Journal/, 'ton journal');
    declared.set(where, [...(declared.get(where) ?? []), c.summary]);
  }
  for (const [where, parts] of declared) items.push({ kind: 'declare', text: `Noté dans ${where} : ${parts.join(', ')}.` });

  const factors = readiness.score === null ? [] : mainFactors(readiness, trend);
  let headline: string | null = null;
  if (readiness.score !== null && readiness.confidence) {
    const { present, total } = readiness.coverage;
    items.push({
      kind: 'estime',
      text: `Indicateur ${scoreText(readiness.score, readiness.confidence)}/100 (${LEVEL_LABELS[readiness.level!].toLocaleLowerCase('fr-FR')}), calculé sur ${present} dimension${present > 1 ? 's' : ''} sur ${total}, confiance ${CONFIDENCE_WORDS[readiness.confidence]}.`,
    });
    const refs = [
      trend?.mean7 !== null && trend?.mean7 !== undefined ? `${trend.mean7} sur 7 jours` : null,
      trend?.mean30 !== null && trend?.mean30 !== undefined ? `${trend.mean30} sur 30 jours` : null,
    ].filter(Boolean);
    if (refs.length) items.push({ kind: 'estime', text: `Tes moyennes : ${joinFr(refs as string[])}.` });

    const phrase = (f: Factor) => (f.delta !== null && Math.abs(f.delta) >= FACTOR_DELTA ? PHRASES : ABSOLUTE)[f.key][f.direction === 'favorable' ? 'up' : 'down'];
    const down = factors.filter((f) => f.direction === 'defavorable').map(phrase);
    const up = factors.filter((f) => f.direction === 'favorable').map(phrase);
    const reference = trend?.vs7 !== null && trend?.vs7 !== undefined ? 'ta moyenne des 7 derniers jours' : 'ta moyenne des 30 derniers jours';
    const opening =
      trend?.direction === 'baisse'
        ? `Ton indicateur de disponibilité est en baisse par rapport à ${reference}.`
        : trend?.direction === 'hausse'
          ? `Ton indicateur de disponibilité est en hausse par rapport à ${reference}.`
          : trend?.direction === 'stable'
            ? `Ton indicateur de disponibilité est stable par rapport à ${reference}.`
            : 'Pas encore assez de jours pour comparer à ta moyenne.';
    const elements = [...down, ...up];
    headline = elements.length ? `${opening} ${trend?.direction ? 'Les principaux éléments' : 'Ce qui compte le plus aujourd’hui'} : ${joinFr(elements)}.` : opening;
  }

  const sleep = score('sommeil');
  const feeling = score('ressenti');
  const mental = score('mental');
  const hypotheses: string[] = [];
  if (sleep !== null && feeling !== null && sleep < 60 && feeling < 60) hypotheses.push('La nuit plus courte ou moins bonne peut expliquer une partie de la fatigue ressentie.');
  if (loadRatio !== null && loadRatio > settings.loadHigh && feeling !== null && feeling < 60)
    hypotheses.push('La hausse de ta charge sur 7 jours peut peser sur ton ressenti physique.');
  const yesterdayStress = index.get(addDays(date, -1))?.mood?.stress ?? null;
  if (yesterdayStress !== null && yesterdayStress >= 4 && sleep !== null && sleep < 60) hypotheses.push('Le stress noté hier peut avoir joué sur ta nuit.');
  if (mental !== null && mental < 50 && (feeling ?? 0) >= 70 && (sleep ?? 70) >= 70)
    hypotheses.push('Le corps semble disponible : c’est surtout la charge mentale qui pèse aujourd’hui.');
  for (const h of hypotheses.slice(0, 2)) items.push({ kind: 'hypothese', text: h });

  for (const c of readiness.components) {
    if (c.score === null && c.baseWeight > 0 && c.missing) items.push({ kind: 'manquant', text: `${c.label} : ${lowerFirst(c.missing).replace(/\.$/, '')}.` });
  }
  if (readiness.score === null && readiness.unavailable) items.push({ kind: 'manquant', text: readiness.unavailable });
  return { headline, factors, items };
}

/** « aujourd’hui », « hier » ou « le 12 nov. » : fraîcheur d'une donnée. */
export function freshnessText(dataDate: string | null, date: string, formatDay: (d: string) => string): string | null {
  if (!dataDate) return null;
  if (dataDate === date) return 'aujourd’hui';
  if (dataDate === addDays(date, -1)) return 'hier';
  return `le ${formatDay(dataDate)}`;
}
