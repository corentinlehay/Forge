import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { getDb } from '../../db/schema';
import { nowIso } from '../../lib/ids';
import { backupFileName, exportBackup, markBackupDone, serializeBackup } from '../../services/backup';
import { saveFile } from '../../services/share';

export type ExportState = 'idle' | 'working' | 'done' | 'cancelled' | 'error';

/**
 * Export en un geste. La sauvegarde est préparée à l'avance (lecture réactive) pour que
 * le partage parte directement du toucher : iOS refuse un partage trop éloigné du geste.
 */
export function useBackupExport() {
  const snapshot = useLiveQuery(() => exportBackup(getDb()), []);
  const [state, setState] = useState<ExportState>('idle');

  const run = async () => {
    if (!snapshot) return;
    setState('working');
    try {
      const now = new Date();
      const text = serializeBackup({ ...snapshot, exportedAt: nowIso(now) });
      const file = new File([text], backupFileName(now), { type: 'application/json' });
      const result = await saveFile(file);
      if (result === 'cancelled') {
        setState('cancelled');
        return;
      }
      await markBackupDone(getDb(), now);
      setState('done');
    } catch {
      setState('error');
    }
  };

  return { ready: snapshot !== undefined, run, state };
}

export function exportMessage(state: ExportState): string | null {
  if (state === 'done') return 'Sauvegarde enregistrée.';
  if (state === 'cancelled') return 'Export annulé : rien n’a été enregistré.';
  if (state === 'error') return 'L’export a échoué. Réessaie.';
  return null;
}
