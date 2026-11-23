import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { repos, useCheckIns, useToday } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { CheckIn, Scale5 } from '../../db/types';
import { recoveryLabel, recoveryScore } from '../../domain/wellbeing';
import { formatDayShort, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const complete = sleepHours !== null && energy && fatigue && soreness;
  const score = complete ? recoveryScore({ sleepHours, energy, fatigue, soreness }) : null;

  const save = async () => {
    if (!complete) return;
    setBusy(true);
    try {
      const input = { date, sleepHours, energy, fatigue, soreness };
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
