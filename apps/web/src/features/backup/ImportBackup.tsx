import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { countRecords } from '../../db/maintenance';
import { getDb } from '../../db/schema';
import { formatFullDate } from '../../lib/format';
import { toLocalDateKey } from '../../lib/dates';
import { importBackup, parseBackup, type Backup, type ImportMode, type ImportReport } from '../../services/backup';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';

type Step = { kind: 'pick' } | { kind: 'preview'; backup: Backup } | { kind: 'done'; report: ImportReport };

const modes: { value: ImportMode; title: string; detail: string }[] = [
  { value: 'merge', title: 'Fusionner', detail: 'Ajoute ce qui manque ; pour une même donnée, la version la plus récente gagne.' },
  { value: 'replace', title: 'Remplacer', detail: 'Efface les données de cet appareil, puis restaure la sauvegarde telle quelle.' },
];

/** Import d'une sauvegarde : tout est vérifié avant d'écrire, puis écrit en une seule fois. */
export function ImportBackup({ onImported, variant = 'secondary' }: { onImported?: () => void; variant?: 'primary' | 'secondary' }) {
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [mode, setMode] = useState<ImportMode>('merge');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const local = useLiveQuery(() => countRecords(getDb()), []);
  const deviceEmpty = local ? local.weighIns === 0 && !local.hasProfile : false;

  const pick = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setStep({ kind: 'preview', backup: parsed.backup });
  };

  const confirm = async (backup: Backup) => {
    setBusy(true);
    try {
      const report = await importBackup(getDb(), backup, deviceEmpty ? 'replace' : mode);
      setStep({ kind: 'done', report });
      onImported?.();
    } catch {
      setError('L’import a échoué : aucune donnée n’a été modifiée.');
    } finally {
      setBusy(false);
    }
  };

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="application/json,.json"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        void pick(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  if (step.kind === 'done') {
    const { added, updated, unchanged } = step.report;
    return (
      <p className="flex items-start gap-2 text-[15px]" role="status">
        <Icon name="check" size={18} strokeWidth={3} className="mt-0.5 shrink-0 text-citron" />
        Import terminé : {added} ajout{added > 1 ? 's' : ''}, {updated} mise{updated > 1 ? 's' : ''} à jour, {unchanged} inchangé{unchanged > 1 ? 's' : ''}.
      </p>
    );
  }

  if (step.kind === 'preview') {
    const { backup } = step;
    const weighIns = backup.tables.weighIns.filter((w) => !w.deletedAt).length;
    const day = toLocalDateKey(new Date(backup.exportedAt));
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-[14px] bg-graphite p-3.5">
          <p className="text-[15px] font-semibold">Sauvegarde du {formatFullDate(day)}</p>
          <p className="text-[13px] text-cendre">
            {weighIns} pesée{weighIns > 1 ? 's' : ''}
            {backup.tables.profile.length ? ', profil inclus' : ''}
          </p>
        </div>
        {!deviceEmpty && (
          <div role="radiogroup" aria-label="Mode d'import" className="flex flex-col gap-2">
            {modes.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => setMode(m.value)}
                className={`flex flex-col gap-0.5 rounded-[14px] border p-3.5 text-left ${mode === m.value ? 'border-citron bg-graphite' : 'border-graphite'}`}
              >
                <span className="text-[15px] font-semibold">{m.title}</span>
                <span className="text-[13px] text-cendre">{m.detail}</span>
              </button>
            ))}
          </div>
        )}
        {error && (
          <p className="text-[15px] text-braise" role="alert">
            {error}
          </p>
        )}
        <Button variant="primary" onClick={() => void confirm(backup)} disabled={busy}>
          {deviceEmpty ? 'Restaurer cette sauvegarde' : mode === 'replace' ? 'Remplacer mes données' : 'Fusionner'}
        </Button>
        <Button variant="quiet" onClick={() => setStep({ kind: 'pick' })}>
          Choisir un autre fichier
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {fileInput}
      <Button variant={variant} onClick={() => input.current?.click()}>
        <Icon name="import" size={20} />
        Importer une sauvegarde
      </Button>
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
