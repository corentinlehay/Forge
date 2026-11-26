import { useState } from 'react';
import { repos, useActivities, useToday } from '../../db/hooks';
import type { Activity } from '../../db/types';
import { isDateKey } from '../../lib/dates';
import { formatDayMonth } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { useToast } from '../../ui/Toast';
import { useHistoryBack } from '../mind/mindShared';

const KIND_LABELS: Record<Activity['kind'], string> = { cardio: 'Cardio', mobilite: 'Mobilité' };

/**
 * Journal d'activité : cardio et mobilité, en minutes, notés à la main.
 * C'est la seule source d'Endurance et de Mobilité dans FORGE LEVEL, en attendant les connecteurs santé.
 */
export function ActivityJournalScreen() {
  const back = useHistoryBack('/progression/joueur');
  const activities = useActivities();
  const today = useToday();
  const toast = useToast();
  const [kind, setKind] = useState<Activity['kind']>('cardio');
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const m = Number(minutes.replace(',', '.'));
    if (!isDateKey(date) || date > today) return setError('Choisis une date passée ou aujourd’hui.');
    if (!Number.isInteger(m) || m < 1 || m > 600) return setError('Durée : un nombre entier de minutes, de 1 à 600.');
    setBusy(true);
    try {
      await repos.activities.add({ date, kind, minutes: m, ...(note.trim() ? { note: note.trim() } : {}) });
      setMinutes('');
      setNote('');
      setError(null);
      toast.show(`${KIND_LABELS[kind]}, ${m} min enregistré`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible. Réessaie.');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (a: Activity) => {
    await repos.activities.remove(a.id);
    toast.show('Activité supprimée, avec l’XP qu’elle rapportait');
  };

  return (
    <Screen withTabBar={false}>
      <button type="button" onClick={back} className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
        <Icon name="back" size={20} />
        Retour
      </button>
      <div className="flex flex-col gap-2">
        <h1 className="font-metal text-[40px] leading-none">Journal d’activité</h1>
        <p className="text-[15px] leading-snug text-cendre">Course, vélo, natation, marche rapide ; étirements, yoga, mobilité. Tes minutes nourrissent Endurance et Mobilité.</p>
      </div>

      <section aria-label="Ajouter une activité" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
        <Segmented
          label="Type"
          options={[
            { value: 'cardio', label: 'Cardio' },
            { value: 'mobilite', label: 'Mobilité' },
          ]}
          value={kind}
          onChange={(v) => setKind(v as Activity['kind'])}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" type="date" value={date} max={today} onChange={(e) => (setError(null), setDate(e.target.value))} />
          <Field label="Minutes" inputMode="numeric" value={minutes} onChange={(e) => (setError(null), setMinutes(e.target.value))} maxLength={3} placeholder="30" />
        </div>
        <Field
          label="Note (facultatif)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder={kind === 'cardio' ? 'Ex. course, 5 km' : 'Ex. hanches et épaules'}
        />
        {error && (
          <p className="text-[15px] text-braise" role="alert">
            {error}
          </p>
        )}
        <Button disabled={busy} onClick={() => void save()}>
          Enregistrer
        </Button>
      </section>

      <section aria-label="Activités notées" className="flex flex-col gap-2 pb-4">
        <h2 className="text-[17px] font-semibold">Activités notées</h2>
        {!activities ? null : activities.length ? (
          <ul className="flex flex-col">
            {activities.slice(0, 60).map((a) => (
              <li key={a.id} className="flex items-center gap-3 border-b border-graphite py-2 last:border-b-0">
                <span className="w-14 shrink-0 text-[13px] text-cendre tabular-nums">{formatDayMonth(a.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-tight">
                    {KIND_LABELS[a.kind]}, {a.minutes} min
                  </span>
                  {a.note && <span className="block truncate text-[13px] text-cendre">{a.note}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => void remove(a)}
                  aria-label={`Supprimer ${KIND_LABELS[a.kind].toLocaleLowerCase('fr-FR')} du ${formatDayMonth(a.date)}`}
                  className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-cendre"
                >
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-cendre">Rien pour l’instant. Note ta prochaine sortie ou ta séance d’étirements.</p>
        )}
      </section>
    </Screen>
  );
}
