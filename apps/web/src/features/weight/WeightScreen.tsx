import { useMemo, useState } from 'react';
import { useProfile, useToday, useWeighIns } from '../../db/hooks';
import { DEFAULT_GAIN_RATE } from '../../db/repositories/profile';
import type { WeighIn } from '../../db/types';
import { summarizeWeight } from '../../domain/weight';
import { buildWeightChart, type ChartPeriod } from '../../domain/weightChart';
import { formatDayMonthLong, formatDayShort, formatMeasuredKg, formatNumber, formatTime } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Card, Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { StatusChip } from '../../ui/StatusChip';
import { useWeighInSheet } from './WeighInSheet';
import { WeightChart } from './WeightChart';
import { bandLabel, calibrationLabel, rateLabel, statusView } from './weightStatus';

const periods = [
  { value: '1m', label: '1 mois' },
  { value: '3m', label: '3 mois' },
  { value: '1y', label: '1 an' },
  { value: 'all', label: 'Tout' },
] as const;

const LIST_PREVIEW = 7;

export function WeightScreen() {
  const weighIns = useWeighIns();
  const profile = useProfile();
  const today = useToday();
  const { openNew, openEdit, lastSaved } = useWeighInSheet();
  const [period, setPeriod] = useState<ChartPeriod>('3m');
  const [showAll, setShowAll] = useState(false);

  const gainRate = profile?.gainRate ?? DEFAULT_GAIN_RATE;
  const summary = useMemo(() => summarizeWeight(weighIns ?? [], gainRate), [weighIns, gainRate]);
  const model = useMemo(() => buildWeightChart(summary.points, period, gainRate, today), [summary, period, gainRate, today]);
  const pulseKey = lastSaved && Date.now() - lastSaved.at < 4000 ? lastSaved.id : null;

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h1 className="font-metal text-[40px]">Poids</h1>
      <Button size="small" onClick={openNew}>
        Se peser
      </Button>
    </div>
  );

  if (weighIns === undefined) return <Screen>{header}</Screen>;

  if (weighIns.length === 0) {
    return (
      <Screen>
        {header}
        <Card>
          <p className="text-[17px] font-semibold">Aucune pesée pour l'instant.</p>
          <p className="text-[15px] leading-snug text-cendre">
            Pèse-toi au réveil, à jeun, après être passé aux toilettes. La tendance se dessine dès les premiers jours et se stabilise après deux semaines.
          </p>
        </Card>
      </Screen>
    );
  }

  const status = statusView(summary);
  const band = bandLabel(summary);
  const calibration = calibrationLabel(summary);
  const lastPoint = summary.points.at(-1)!;

  return (
    <Screen>
      {header}
      <Segmented label="Période du graphique" options={periods} value={period} onChange={setPeriod} />

      <div className="flex flex-col gap-1.5">
        <p className="flex items-baseline gap-1.5">
          <span className="font-metal text-[64px]">{formatNumber(summary.latestTrendKg ?? lastPoint.trendKg, 1)}</span>
          <span className="text-xl text-cendre">kg</span>
        </p>
        <p className="text-[15px] text-cendre">Poids tendance au {formatDayMonthLong(lastPoint.date)}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[17px] font-semibold">{rateLabel(summary)}</p>
          <StatusChip {...status} />
        </div>
        {band && <p className="text-[13px] text-cendre">{band}</p>}
        {calibration && <p className="text-[13px] text-cendre">{calibration}</p>}
      </div>

      {model && model.measuredCount >= 2 ? (
        <WeightChart model={model} pulseKey={pulseKey} />
      ) : (
        <p className="rounded-[18px] bg-anthracite p-4 text-[15px] text-cendre">
          {model && model.measuredCount === 1 ? 'La courbe apparaît dès la deuxième pesée.' : 'Aucune pesée sur cette période.'}
        </p>
      )}

      <WeighInList weighIns={weighIns} showAll={showAll} onShowAll={() => setShowAll(true)} onEdit={openEdit} today={today} />
    </Screen>
  );
}

function WeighInList({
  weighIns,
  showAll,
  onShowAll,
  onEdit,
  today,
}: {
  weighIns: WeighIn[];
  showAll: boolean;
  onShowAll: () => void;
  onEdit: (w: WeighIn) => void;
  today: string;
}) {
  // La première pesée de chaque jour compte pour la tendance (la liste arrive triée par date et heure).
  const counted = new Set<string>();
  const seenDates = new Set<string>();
  for (const w of weighIns) {
    if (!seenDates.has(w.date)) {
      seenDates.add(w.date);
      counted.add(w.id);
    }
  }
  const newestFirst = [...weighIns].reverse();
  const visible = showAll ? newestFirst : newestFirst.slice(0, LIST_PREVIEW);
  const thisYear = today.slice(0, 4);

  return (
    <section aria-label="Pesées" className="flex flex-col">
      <h2 className="mb-1 text-[15px] font-semibold">Dernières pesées</h2>
      <ul>
        {visible.map((w) => (
          <li key={w.id} className="border-b border-anthracite last:border-b-0">
            <button
              type="button"
              onClick={() => onEdit(w)}
              className="flex min-h-11 w-full items-center justify-between gap-3 py-2.5 text-left text-[15px]"
              aria-label={`Corriger la pesée du ${formatDayShort(w.date)}, ${formatMeasuredKg(w.weightKg)}`}
            >
              <span>
                {formatDayShort(w.date)}
                {w.date.slice(0, 4) !== thisYear && ` ${w.date.slice(0, 4)}`}{' '}
                <span className="text-cendre">
                  {w.context === 'morning_fasted' ? 'au réveil' : `à ${formatTime(w.time)}`}
                  {!counted.has(w.id) && ', non comptée'}
                </span>
              </span>
              <span className="flex items-center gap-2 font-semibold tabular-nums">
                {formatMeasuredKg(w.weightKg)}
                <Icon name="chevron" size={16} className="text-cendre" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!showAll && newestFirst.length > LIST_PREVIEW && (
        <Button variant="quiet" className="-ml-2 self-start" onClick={onShowAll}>
          Afficher les {newestFirst.length} pesées
        </Button>
      )}
    </section>
  );
}
