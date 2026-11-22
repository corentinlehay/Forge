import { CALIBRATION_DAYS, MIN_DAYS_FOR_RATE, type WeightSummary } from '../../domain/weight';
import { formatSignedKg } from '../../lib/format';
import type { IconName } from '../../ui/Icon';

export interface StatusView {
  icon: IconName;
  label: string;
  tone: 'good' | 'neutral' | 'alert';
}

/** Statut affiché à côté du rythme. Pendant le calibrage, on ne juge pas encore. */
export function statusView(summary: WeightSummary): StatusView {
  if (summary.calibrating || summary.status === 'insufficient_data') return { icon: 'clock', label: 'Calibrage', tone: 'neutral' };
  if (summary.status === 'within') return { icon: 'check', label: 'Dans ta fourchette', tone: 'good' };
  if (summary.status === 'below') return { icon: 'arrowDown', label: 'Sous ta fourchette', tone: 'neutral' };
  return { icon: 'arrowUp', label: 'Au-dessus de ta fourchette', tone: 'neutral' };
}

export function rateLabel(summary: WeightSummary): string {
  if (summary.weeklyRateKg === null) {
    const missing = Math.max(1, MIN_DAYS_FOR_RATE - summary.points.length);
    return `Rythme dans ${missing} jour${missing > 1 ? 's' : ''}`;
  }
  return `${formatSignedKg(summary.weeklyRateKg)} par semaine`;
}

export function bandLabel(summary: WeightSummary): string | null {
  if (!summary.band) return null;
  const low = formatSignedKg(summary.band.lowKgPerWeek).replace(' kg', '');
  return `Fourchette visée : ${low} à ${formatSignedKg(summary.band.highKgPerWeek)} par semaine`;
}

export function calibrationLabel(summary: WeightSummary): string | null {
  if (!summary.calibrating) return null;
  const measured = summary.points.filter((p) => p.measured).length;
  return `Calibrage : ${measured} jour${measured > 1 ? 's' : ''} pesé${measured > 1 ? 's' : ''} sur ${CALIBRATION_DAYS}. La tendance se stabilise ensuite.`;
}
