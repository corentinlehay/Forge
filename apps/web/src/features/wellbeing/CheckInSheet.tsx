import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { repos, useCheckIns, useToday } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { CheckIn, Scale5 } from '../../db/types';
import { sleepFromTimes } from '../../domain/mind';
import { recoveryLabel, recoveryScore } from '../../domain/wellbeing';
import { formatDayShort, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { ScaleChips } from '../../ui/ScaleChips';
import { Sheet } from '../../ui/Sheet';
import { Stepper } from '../../ui/Stepper';
import { useToast } from '../../ui/Toast';

interface CheckInApi {
  openCheckIn: (date?: string) => void;
}

const Ctx = createContext<CheckInApi | null>(null);

export function useCheckInSheet(): CheckInApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useCheckInSheet doit être utilisé sous <CheckInSheetProvider>.');
  return api;
}

export function CheckInSheetProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState<string | null>(null);
  const today = useToday();
  const openCheckIn = useCallback((d?: string) => setDate(d ?? today), [today]);
  const api = useMemo(() => ({ openCheckIn }), [openCheckIn]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <Sheet open={date !== null} title="Check-in" onClose={() => setDate(null)}>
        {date && <CheckInForm key={date} date={date} onDone={() => setDate(null)} />}
      </Sheet>
    </Ctx.Provider>
  );
}

const formatHours = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

function CheckInForm({ date, onDone }: { date: string; onDone: () => void }) {
  const checkIns = useCheckIns();
  const today = useToday();
  const toast = useToast();
  const existing: CheckIn | undefined = checkIns?.find((c) => c.date === date);
  const [sleepHours, setSleep] = useState<number | null>(existing?.sleepHours ?? null);
  const [energy, setEnergy] = useState<Scale5 | null>(existing?.energy ?? null);
  const [fatigue, setFatigue] = useState<Scale5 | null>(existing?.fatigue ?? null);
  const [soreness, setSoreness] = useState<Scale5 | null>(existing?.soreness ?? null);
  const [bedTime, setBedTime] = useState(existing?.bedTime ?? '');
  const [wakeTime, setWakeTime] = useState(existing?.wakeTime ?? '');
  const [awakenings, setAwakenings] = useState<number | null>(existing?.awakenings ?? null);
  const [quality, setQuality] = useState<Scale5 | null>(existing?.sleepQuality ?? null);
  const [details, setDetails] = useState(Boolean(existing?.bedTime || existing?.wakeTime || existing?.sleepQuality || (existing?.awakenings ?? null) !== null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Les deux heures renseignées : la durée de la nuit se calcule (elle reste modifiable). */
  const setTime = (which: 'bed' | 'wake', value: string) => {
    const bed = which === 'bed' ? value : bedTime;
    const wake = which === 'wake' ? value : wakeTime;
    if (which === 'bed') setBedTime(value);
    else setWakeTime(value);
    if (/^\d{2}:\d{2}$/.test(bed) && /^\d{2}:\d{2}$/.test(wake)) setSleep(sleepFromTimes(bed, wake));
  };

  const complete = sleepHours !== null && energy && fatigue && soreness;
  const score = complete ? recoveryScore({ sleepHours, energy, fatigue, soreness }) : null;

  const save = async () => {
    if (!complete) return;
    setBusy(true);
    try {
      const time = (v: string) => (/^\d{2}:\d{2}$/.test(v) ? v : null);
      const input = { date, sleepHours, energy, fatigue, soreness, bedTime: time(bedTime), wakeTime: time(wakeTime), awakenings, sleepQuality: quality };
      if (existing) await repos.checkIns.update(existing.id, input);
      else await repos.checkIns.add(input);
      toast.show('Check-in enregistré');
      onDone();
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'L’enregistrement a échoué. Réessaie.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-1">
      <p className="text-[15px] text-cendre">{date === today ? 'Comment tu te sens ce matin ?' : formatDayShort(date)}</p>
      <div className="flex flex-col gap-2">
        <Stepper label="Sommeil" value={sleepHours} step={0.25} min={0} max={16} start={7.5} format={formatHours} onChange={setSleep} />
      </div>
      {details ? (
        <section aria-label="Détails de la nuit" className="flex flex-col gap-4 rounded-[18px] border border-graphite p-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Coucher" type="time" value={bedTime} onChange={(e) => setTime('bed', e.target.value)} />
            <Field label="Réveil" type="time" value={wakeTime} onChange={(e) => setTime('wake', e.target.value)} />
          </div>
          <Stepper label="Réveils dans la nuit" value={awakenings} step={1} min={0} max={20} start={0} format={(v) => (v === 0 ? 'Aucun' : String(v))} onChange={setAwakenings} />
          <ScaleChips label="Qualité ressentie" value={quality} onChange={setQuality} low="Très mauvaise" high="Excellente" />
        </section>
      ) : (
        <button type="button" onClick={() => setDetails(true)} className="-mt-2 self-start py-1 text-[15px] text-citron">
          Ajouter les détails de la nuit
        </button>
      )}
      <ScaleChips label="Énergie" value={energy} onChange={setEnergy} low="Vide" high="Au top" />
      <ScaleChips label="Fatigue" value={fatigue} onChange={setFatigue} low="Aucune" high="Épuisé" />
      <ScaleChips label="Courbatures" value={soreness} onChange={setSoreness} low="Aucune" high="Fortes" />
      <p className="text-[15px]" aria-live="polite">
        {score !== null ? (
          <>
            Récupération estimée : <span className="font-semibold">{formatNumber(score, 0)}/100</span> <span className="text-cendre">({recoveryLabel(score).toLowerCase()})</span>
          </>
        ) : (
          <span className="text-cendre">Renseigne les quatre réponses pour estimer ta récupération.</span>
        )}
      </p>
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void save()} disabled={!complete || busy}>
        Enregistrer
      </Button>
    </div>
  );
}
