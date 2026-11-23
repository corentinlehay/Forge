import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { repos, useToday, useWeighIns } from '../../db/hooks';
import { WeighInError } from '../../db/repositories/weighIns';
import type { WeighIn, WeighInContext } from '../../db/types';
import { applyKey, toKeypadValue, type KeypadKey } from '../../domain/keypadInput';
import { toLocalDateKey, toLocalTimeKey } from '../../lib/dates';
import { formatDayShort, formatMeasuredKg, formatTime, parseWeightKg, WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Keypad } from '../../ui/Keypad';
import { Segmented } from '../../ui/Segmented';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';

interface WeighInSheetApi {
  openNew: () => void;
  openEdit: (weighIn: WeighIn) => void;
  /** Dernière pesée enregistrée, avec l'heure (pour éclairer la courbe juste après). */
  lastSaved: { id: string; at: number } | null;
}

const Ctx = createContext<WeighInSheetApi | null>(null);

export function useWeighInSheet(): WeighInSheetApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useWeighInSheet doit être utilisé sous <WeighInSheetProvider>.');
  return api;
}

type Mode = { kind: 'closed' } | { kind: 'new'; nonce: number } | { kind: 'edit'; weighIn: WeighIn };

export function WeighInSheetProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>({ kind: 'closed' });
  const [lastSaved, setLastSaved] = useState<{ id: string; at: number } | null>(null);

  const openNew = useCallback(() => setMode({ kind: 'new', nonce: Date.now() }), []);
  const openEdit = useCallback((weighIn: WeighIn) => setMode({ kind: 'edit', weighIn }), []);
  const close = useCallback(() => setMode({ kind: 'closed' }), []);
  const api = useMemo(() => ({ openNew, openEdit, lastSaved }), [openNew, openEdit, lastSaved]);

  const key = mode.kind === 'new' ? `new-${mode.nonce}` : mode.kind === 'edit' ? `edit-${mode.weighIn.id}` : 'closed';

  return (
    <Ctx.Provider value={api}>
      {children}
      <Sheet open={mode.kind !== 'closed'} title={mode.kind === 'edit' ? 'Corriger la pesée' : 'Pesée'} onClose={close}>
        {mode.kind !== 'closed' && (
          <WeighInForm
            key={key}
            editing={mode.kind === 'edit' ? mode.weighIn : null}
            onDone={(id) => {
              if (id) setLastSaved({ id, at: Date.now() });
              close();
            }}
          />
        )}
      </Sheet>
    </Ctx.Provider>
  );
}

const contextOptions = [
  { value: 'morning_fasted', label: 'Au réveil, à jeun' },
  { value: 'other', label: 'Autre moment' },
] as const;

/** Avant 11 h, la pesée est proposée « au réveil, à jeun » ; tu peux changer. */
function defaultContext(now: Date): WeighInContext {
  return now.getHours() < 11 ? 'morning_fasted' : 'other';
}

function WeighInForm({ editing, onDone }: { editing: WeighIn | null; onDone: (savedId: string | null) => void }) {
  const today = useToday();
  const weighIns = useWeighIns();
  const [now] = useState(() => new Date());
  const [value, setValue] = useState(() => (editing ? toKeypadValue(editing.weightKg) : ''));
  const [context, setContext] = useState<WeighInContext>(() => editing?.context ?? (editing ? 'other' : defaultContext(now)));
  const [date, setDate] = useState(() => editing?.date ?? toLocalDateKey(now));
  const [time, setTime] = useState(() => editing?.time ?? toLocalTimeKey(now));
  const [editingWhen, setEditingWhen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const last = weighIns?.at(-1);
  const sameDay = !editing && weighIns?.some((w) => w.date === date);

  const press = (key: KeypadKey) => {
    setError(null);
    setValue((v) => applyKey(v, key));
  };

  const save = async () => {
    const weightKg = parseWeightKg(value);
    if (weightKg === null) {
      setError(`Saisis un poids entre ${WEIGHT_MIN_KG} et ${WEIGHT_MAX_KG} kg.`);
      return;
    }
    if (date > today) {
      setError('La date ne peut pas être dans le futur.');
      return;
    }
    setBusy(true);
    try {
      const input = { date, time, weightKg, context };
      const saved = editing ? await repos.weighIns.update(editing.id, input) : await repos.weighIns.add(input);
      toast.show(editing ? 'Pesée corrigée' : 'Pesée enregistrée');
      onDone(saved.id);
    } catch (e) {
      setError(e instanceof WeighInError ? e.message : "L'enregistrement a échoué. Réessaie.");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await repos.weighIns.remove(editing.id);
      toast.show('Pesée supprimée');
      onDone(null);
    } catch {
      setError('La suppression a échoué. Réessaie.');
      setBusy(false);
    }
  };

  const whenLabel = `${date === today ? "Aujourd'hui" : formatDayShort(date)} à ${formatTime(time)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5" aria-live="polite">
        <p className="flex items-baseline gap-2">
          <span className={`font-metal text-[64px] ${value ? 'text-craie' : 'text-graphite'}`} aria-label={value ? `${value} kilos` : 'Aucune saisie'}>
            {value || '00,0'}
          </span>
          <span className="text-xl text-cendre">kg</span>
        </p>
        {error ? (
          <p className="text-[15px] text-braise" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-[15px] text-cendre">
            {last && !editing ? `Dernière pesée : ${formatMeasuredKg(last.weightKg)}, ${formatDayShort(last.date).toLowerCase()}` : 'Une pesée par jour suffit.'}
          </p>
        )}
      </div>

      <Segmented label="Moment de la pesée" options={contextOptions} value={context} onChange={setContext} />

      {editingWhen ? (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="flex flex-col gap-1 text-[13px] text-cendre">
            Jour
            <input
              type="date"
              value={date}
              max={today}
              required
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-11 rounded-[12px] bg-graphite px-3 text-base text-craie"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-cendre">
            Heure
            <input
              type="time"
              value={time}
              required
              onChange={(e) => e.target.value && setTime(e.target.value)}
              className="h-11 rounded-[12px] bg-graphite px-3 text-base text-craie"
            />
          </label>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px]">{whenLabel}</p>
          <Button variant="quiet" onClick={() => setEditingWhen(true)}>
            Changer
          </Button>
        </div>
      )}

      {sameDay && (
        <p className="text-[13px] text-cendre">Il y a déjà une pesée ce jour-là : la plus matinale compte pour la tendance.</p>
      )}

      <Keypad onKey={press} />

      <Button onClick={save} disabled={!value || busy}>
        Enregistrer
      </Button>

      {editing &&
        (confirmDelete ? (
          <div className="flex flex-col gap-2 pb-1">
            <Button variant="danger" onClick={remove} disabled={busy}>
              Confirmer la suppression
            </Button>
            <Button variant="quiet" onClick={() => setConfirmDelete(false)}>
              Garder la pesée
            </Button>
          </div>
        ) : (
          <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirmDelete(true)}>
            Supprimer la pesée
          </Button>
        ))}
    </div>
  );
}
