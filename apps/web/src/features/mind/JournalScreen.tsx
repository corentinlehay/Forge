import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { repos, useMoodLogs, useToday } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { MoodLog, Scale5 } from '../../db/types';
import { EMOTION_LABELS, MIND_EMOTIONS, MOOD_FIELDS, moodAverages, type MoodKey } from '../../domain/mind';
import { addDays, isDateKey } from '../../lib/dates';
import { formatDayMonth, formatDayShort, formatNumber } from '../../lib/format';
import { BarChart } from '../../ui/BarChart';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Icon } from '../../ui/Icon';
import { ScaleChips } from '../../ui/ScaleChips';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { TextArea } from '../../ui/TextArea';
import { useToast } from '../../ui/Toast';
import { MindBack, MindCaution } from './mindShared';

type Values = Partial<Record<MoodKey, Scale5 | null>>;

/** Journal émotionnel : saisie libre (rien d'obligatoire), évolution et historique. */
export function JournalScreen() {
  const logs = useMoodLogs();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const asked = params.get('jour');
  const date = asked && isDateKey(asked) && asked <= today ? asked : today;
  const [measure, setMeasure] = useState<MoodKey>('mood');
  const setDate = (d: string) => setParams(d === today ? {} : { jour: d }, { replace: true });

  const chart = useMemo(() => {
    if (!logs) return null;
    const byDate = new Map(logs.map((l) => [l.date, l]));
    const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
    return days.map((d, i) => {
      const v = (byDate.get(d)?.[measure] as Scale5 | null | undefined) ?? null;
      return { key: d, label: i % 5 === 4 ? String(Number(d.slice(8, 10))) : '', value: v ?? 0, detail: `${formatDayMonth(d)} : ${v ?? 'pas de saisie'}` };
    });
  }, [logs, measure, today]);

  if (!logs)
    return (
      <Screen withTabBar={false}>
        <MindBack />
      </Screen>
    );
  const entry = logs.find((l) => l.date === date) ?? null;
  const field = MOOD_FIELDS.find((f) => f.key === measure)!;
  const avg = moodAverages(logs, measure, today);
  const recent = [...logs].reverse().slice(0, 14);

  return (
    <Screen withTabBar={false}>
      <MindBack />
      <h1 className="font-metal text-[40px] leading-none">Journal</h1>

      <section aria-label="Saisie" className="flex flex-col gap-4 rounded-[22px] bg-anthracite p-[18px]">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setDate(addDays(date, -1))} aria-label="Jour précédent" className="flex h-11 w-11 items-center justify-center text-cendre">
            <Icon name="back" size={20} />
          </button>
          <p className="text-[17px] font-semibold">{date === today ? 'Aujourd’hui' : formatDayShort(date)}</p>
          <button
            type="button"
            disabled={date >= today}
            onClick={() => setDate(addDays(date, 1))}
            aria-label="Jour suivant"
            className="flex h-11 w-11 items-center justify-center text-cendre disabled:opacity-30"
          >
            <Icon name="chevron" size={20} />
          </button>
        </div>
        <EntryForm key={`${date}-${entry?.updatedAt ?? 'new'}`} date={date} entry={entry} />
      </section>

      <section aria-label="Évolution" className="flex flex-col gap-3">
        <h2 className="text-[17px] font-semibold">Évolution sur 30 jours</h2>
        <Segmented
          label="Mesure"
          value={measure}
          onChange={setMeasure}
          options={[
            { value: 'mood', label: 'Humeur' },
            { value: 'stress', label: 'Stress' },
            { value: 'mentalEnergy', label: 'Énergie' },
          ]}
        />
        <Segmented
          label="Autres mesures"
          value={measure}
          onChange={setMeasure}
          options={[
            { value: 'motivation', label: 'Motivation' },
            { value: 'mentalLoad', label: 'Charge' },
            { value: 'recovery', label: 'Récup.' },
          ]}
        />
        {chart && chart.some((b) => b.value > 0) ? (
          <div className="rounded-[18px] bg-anthracite p-4">
            <BarChart tone="brume" title={field.label} bars={chart} height={110} />
            <p className="mt-2 text-[13px] text-cendre">
              1 : {field.low.toLocaleLowerCase('fr-FR')}, 5 : {field.high.toLocaleLowerCase('fr-FR')}.
              {avg.current !== null &&
                ` Moyenne sur 7 jours : ${formatNumber(avg.current, 1)}${avg.previous !== null ? ` (${formatNumber(avg.previous, 1)} la semaine d’avant)` : ''}.`}
            </p>
          </div>
        ) : (
          <p className="text-[15px] text-cendre">Pas encore de saisie pour cette mesure.</p>
        )}
      </section>

      {recent.length > 0 && (
        <section aria-label="Historique" className="flex flex-col">
          <h2 className="mb-1 text-[17px] font-semibold">Historique</h2>
          <ul>
            {recent.map((l) => (
              <li key={l.id} className="border-b border-anthracite last:border-b-0">
                <button type="button" onClick={() => setDate(l.date)} className="flex w-full flex-col gap-0.5 py-2.5 text-left">
                  <span className="flex justify-between gap-3 text-[15px]">
                    <span>{formatDayShort(l.date)}</span>
                    <span className="text-cendre tabular-nums">
                      {MOOD_FIELDS.filter((f) => l[f.key])
                        .slice(0, 3)
                        .map((f) => `${f.label.split(' ')[0]} ${l[f.key]}`)
                        .join(', ')}
                    </span>
                  </span>
                  {(l.emotions?.length ?? 0) > 0 && <span className="text-[13px] text-brume">{l.emotions!.map((e) => EMOTION_LABELS.get(e) ?? e).join(', ')}</span>}
                  {l.note && <span className="line-clamp-2 text-[13px] text-cendre">{l.note}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <MindCaution />
    </Screen>
  );
}

function EntryForm({ date, entry }: { date: string; entry: MoodLog | null }) {
  const toast = useToast();
  const [values, setValues] = useState<Values>(() => Object.fromEntries(MOOD_FIELDS.map((f) => [f.key, (entry?.[f.key] as Scale5 | null | undefined) ?? null])));
  const [emotions, setEmotions] = useState<string[]>(entry?.emotions ?? []);
  const [note, setNote] = useState(entry?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const empty = Object.values(values).every((v) => !v) && emotions.length === 0 && !note.trim();

  const save = async () => {
    setError(null);
    try {
      const input = { ...values, emotions, note: note.trim() };
      if (entry) await repos.moodLogs.update(entry.id, input);
      else await repos.moodLogs.add({ date, ...input });
      toast.show('Journal enregistré');
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'L’enregistrement a échoué. Réessaie.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {MOOD_FIELDS.map((f) => (
        <ScaleChips tone="brume" key={f.key} label={f.label} value={values[f.key] ?? null} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} low={f.low} high={f.high} />
      ))}
      <Chips
        tone="brume"
        label="Émotions du jour"
        options={MIND_EMOTIONS.map((e) => ({ value: e.key, label: e.label }))}
        selected={emotions}
        onToggle={(k) => setEmotions((list) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]))}
      />
      <TextArea label="Commentaire (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} />
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button variant="calm" onClick={() => void save()} disabled={empty && !entry}>
        Enregistrer
      </Button>
      {entry && (
        <Button
          variant="quiet"
          className="self-center"
          onClick={() =>
            void repos.moodLogs.remove(entry.id).then(() => {
              toast.show('Entrée supprimée');
            })
          }
        >
          Supprimer cette entrée
        </Button>
      )}
    </div>
  );
}
