import { isDemoMode } from '../../db/dataMode';
import { useMeta, useToday, useWeighIns } from '../../db/hooks';
import { toLocalDateKey } from '../../lib/dates';
import { formatDaysAgo } from '../../lib/format';
import { isBackupOverdue, LAST_BACKUP_KEY } from '../../services/backup';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { exportMessage, useBackupExport } from '../backup/useBackupExport';

/** Rappel de sauvegarde au-delà de 7 jours, seulement avec de vraies données. */
export function BackupReminder() {
  const today = useToday();
  const weighIns = useWeighIns();
  const lastBackupAt = useMeta<string>(LAST_BACKUP_KEY);
  const backup = useBackupExport();
  const message = exportMessage(backup.state);
  const due = !isDemoMode() && (weighIns?.length ?? 0) > 0 && lastBackupAt !== undefined && isBackupOverdue(lastBackupAt);

  if (!due) return message ? <p className="text-[15px] text-cendre" role="status">{message}</p> : null;
  return (
    <section aria-label="Sauvegarde" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
      <div className="flex items-start gap-3">
        <Icon name="shield" size={22} className="mt-0.5 shrink-0 text-cendre" />
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold">
            {lastBackupAt ? `Dernière sauvegarde ${formatDaysAgo(toLocalDateKey(new Date(lastBackupAt)), today)}` : 'Aucune sauvegarde pour l’instant'}
          </p>
          <p className="text-[13px] leading-snug text-cendre">Tes données ne vivent que sur cet appareil. Exporte-les dans Fichiers ou iCloud Drive, une fois par semaine.</p>
        </div>
      </div>
      <Button variant="secondary" onClick={() => void backup.run()} disabled={!backup.ready || backup.state === 'working'}>
        <Icon name="share" size={20} />
        Exporter mes données
      </Button>
    </section>
  );
}
