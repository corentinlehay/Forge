import { useMemo } from 'react';
import { Link } from 'react-router';
import { useMeta, useProfile, useToday, useWeighIns } from '../../db/hooks';
import { DEFAULT_GAIN_RATE } from '../../db/repositories/profile';
import { summarizeWeight } from '../../domain/weight';
import { toLocalDateKey } from '../../lib/dates';
import { formatDayLong, formatDaysAgo, formatMeasured, formatNumber, formatSignedKg, formatTime } from '../../lib/format';
import { isBackupOverdue, LAST_BACKUP_KEY } from '../../services/backup';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Card, Screen } from '../../ui/Screen';
import { exportMessage, useBackupExport } from '../backup/useBackupExport';
import { useWeighInSheet } from '../weight/WeighInSheet';
import { TrendSparkline } from '../weight/WeightChart';
import { calibrationLabel } from '../weight/weightStatus';

const SPARKLINE_DAYS = 84;

const upcoming = [
  { label: 'La séance du jour, avec la performance à battre', phase: 'Phase 2' },
  { label: 'Calories et macros de la journée', phase: 'Phase 3' },
  { label: 'Le check-in bien-être et la disponibilité du jour', phase: 'Phase 4' },
];

export function HomeScreen() {
  const today = useToday();
  const weighIns = useWeighIns();
  const profile = useProfile();
  const lastBackupAt = useMeta<string>(LAST_BACKUP_KEY);
  const { openNew, openEdit } = useWeighInSheet();
  const backup = useBackupExport();

  const gainRate = profile?.gainRate ?? DEFAULT_GAIN_RATE;
  const summary = useMemo(() => summarizeWeight(weighIns ?? [], gainRate), [weighIns, gainRate]);
  const todays = weighIns?.find((w) => w.date === today);
  const initial = profile?.firstName?.trim().charAt(0).toLocaleUpperCase('fr-FR');
  const hasData = (weighIns?.length ?? 0) > 0;
  const backupDue = hasData && lastBackupAt !== undefined && isBackupOverdue(lastBackupAt);
  const message = exportMessage(backup.state);

  return (
    <Screen>
      <div className="flex items-center justify-between">
        <p className="text-[15px] text-cendre">{formatDayLong(today)}</p>
        <Link
          to="/reglages"
          aria-label="Profil et réglages"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-graphite text-base font-semibold"
        >
          {initial ?? <Icon name="user" size={20} />}
        </Link>
      </div>

      {weighIns !== undefined &&
        (todays ? (
          <Card label="Pesée du jour">
            <p className="text-[15px] text-cendre">Pesée du jour</p>
            <p className="flex items-baseline gap-1.5">
              <span className="font-metal text-[48px]">{formatMeasured(todays.weightKg)}</span>
              <span className="text-[17px] text-cendre">kg</span>
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] text-cendre">
                {todays.context === 'morning_fasted' ? 'Au réveil, à jeun' : `À ${formatTime(todays.time)}`}
              </p>
              <Button variant="quiet" onClick={() => openEdit(todays)}>
                Corriger
              </Button>
            </div>
          </Card>
        ) : (
          <Card label="Pesée du jour" className="gap-[14px]">
            <div className="flex flex-col gap-1">
              <h1 className="font-metal text-[48px]">Pesée du jour</h1>
              <p className="text-[15px] leading-snug text-cendre">Au réveil, à jeun, après être passé aux toilettes : la mesure la plus stable.</p>
            </div>
            <Button onClick={openNew}>Se peser</Button>
          </Card>
        ))}

      {summary.latestTrendKg !== null && (
        <Link to="/progression" className="flex items-end justify-between gap-4 rounded-[18px] bg-anthracite p-3.5" aria-label="Voir le détail du poids">
          <div className="flex flex-col gap-1.5">
            <p className="text-[13px] text-cendre">Poids tendance</p>
            <p className="flex items-baseline gap-1">
              <span className="font-metal text-[36px]">{formatNumber(summary.latestTrendKg, 1)}</span>
              <span className="text-[15px] text-cendre">kg</span>
            </p>
            <p className="flex items-center gap-1.5 text-[13px]">
              {summary.weeklyRateKg !== null ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={summary.weeklyRateKg < 0 ? 'rotate-180' : ''}>
                    <path d="M5 1L9.5 8.5H0.5z" fill="var(--color-citron)" />
                  </svg>
                  {formatSignedKg(summary.weeklyRateKg)}/sem.
                </>
              ) : (
                <span className="text-cendre">{calibrationLabel(summary)?.split('.')[0]}</span>
              )}
            </p>
          </div>
          <TrendSparkline points={summary.points.slice(-SPARKLINE_DAYS)} />
        </Link>
      )}

      {backupDue && (
        <Card label="Sauvegarde">
          <div className="flex items-start gap-3">
            <Icon name="shield" size={22} className="mt-0.5 shrink-0 text-cendre" />
            <div className="flex flex-col gap-1">
              <p className="text-[15px] font-semibold">
                {lastBackupAt ? `Dernière sauvegarde ${formatDaysAgo(toLocalDateKey(new Date(lastBackupAt)), today)}` : 'Aucune sauvegarde pour l’instant'}
              </p>
              <p className="text-[13px] leading-snug text-cendre">
                Tes données ne vivent que sur cet appareil. Exporte-les dans Fichiers ou iCloud Drive, une fois par semaine.
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => void backup.run()} disabled={!backup.ready || backup.state === 'working'}>
            <Icon name="share" size={20} />
            Exporter mes données
          </Button>
        </Card>
      )}
      {message && !backupDue && (
        <p className="text-[15px] text-cendre" role="status">
          {message}
        </p>
      )}

      <section aria-label="À venir" className="flex flex-col pt-2">
        <h2 className="mb-1 text-[15px] font-semibold">Bientôt sur l’Accueil</h2>
        <ul>
          {upcoming.map((item) => (
            <li key={item.label} className="flex items-baseline justify-between gap-3 border-b border-anthracite py-2.5 text-[15px] text-cendre last:border-b-0">
              <span>{item.label}</span>
              <span className="shrink-0 text-[13px]">{item.phase}</span>
            </li>
          ))}
        </ul>
      </section>
    </Screen>
  );
}
