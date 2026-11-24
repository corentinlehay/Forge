import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { repos, useCheckIns, useMoodLogs, usePains, useToday } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { CheckIn, MoodLog, Pain, Scale5 } from '../../db/types';
import { sleepFromTimes } from '../../domain/mind';
import { zoneLabel } from '../../domain/body';
import { recoveryLabel, recoveryScore } from '../../domain/wellbeing';
import { formatDayShort, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { ScaleChips } from '../../ui/ScaleChips';
import { Sheet } from '../../ui/Sheet';
import { Stepper } from '../../ui/Stepper';
import { useToast } from '../../ui/Toast';
import { haptic } from '../../services/haptics';

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
        {date && <CheckInLoader key={date} date={date} onDone={() => setDate(null)} />}
      </Sheet>
    </Ctx.Provider>
  );
}

const formatHours = (h: number) => {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}`;
};

/**
 * Check-in unifié du matin (cahier PULSE, section 5) : cinq questions, toutes facultatives.
 * Sommeil, énergie, fatigue, courbatures et douleur inhabituelle vont dans le check-in ;
 * le stress va dans le journal Mind du jour (même donnée que l'écran Mind, préremplie si déjà notée).
 */
/** Le formulaire n'apparaît qu'une fois les réponses déjà enregistrées chargées : il part toujours d'elles, jamais d'un formulaire vide. */
function CheckInLoader({ date, onDone }: { date: string; onDone: () => void }) {
  const checkIns = useCheckIns();
  const moodLogs = useMoodLogs();
  const pains = usePains();
  if (!checkIns || !moodLogs || !pains) return <div className="h-96 animate-pulse rounded-[18px] bg-anthracite" aria-busy="true" aria-label="Chargement" />;
  return (
    <CheckInForm
      date={date}
      onDone={onDone}
      existing={checkIns.find((c) => c.date === date && !c.deletedAt)}
      mood={moodLogs.find((m) => m.date === date && !m.deletedAt)}
      pains={pains}
    />
  );
}

function CheckInForm({ date, onDone, existing, mood, pains }: { date: string; onDone: () => void; existing: CheckIn | undefined; mood: MoodLog | undefined; pains: Pain[] }) {
  const today = useToday();
  const toast = useToast();
  const navigate = useNavigate();
  const [sleepHours, setSleep] = useState<number | null>(existing?.sleepHours ?? null);
  const [energy, setEnergy] = useState<Scale5 | null>(existing?.energy ?? null);
  const [fatigue, setFatigue] = useState<Scale5 | null>(existing?.fatigue ?? null);
  const [soreness, setSoreness] = useState<Scale5 | null>(existing?.soreness ?? null);
  const [stress, setStress] = useState<Scale5 | null | undefined>(undefined);
  const [unusualPain, setUnusualPain] = useState<boolean | null>(existing?.unusualPain ?? null);
  const [bedTime, setBedTime] = useState(existing?.bedTime ?? '');
  const [wakeTime, setWakeTime] = useState(existing?.wakeTime ?? '');
  const [awakenings, setAwakenings] = useState<number | null>(existing?.awakenings ?? null);
  const [quality, setQuality] = useState<Scale5 | null>(existing?.sleepQuality ?? null);
  const [details, setDetails] = useState(Boolean(existing?.bedTime || existing?.wakeTime || existing?.sleepQuality || (existing?.awakenings ?? null) !== null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Le stress noté dans le journal Mind du jour sert de valeur de départ tant que rien n'est touché. */
  const stressValue = stress === undefined ? (mood?.stress ?? null) : stress;
  const stressFromJournal = stress === undefined && !!mood?.stress;
  const activePains = pains.filter((p) => !p.deletedAt && p.resolvedOn === null && p.startedOn <= date);

  /** Les deux heures renseignées : la durée de la nuit se calcule (elle reste modifiable). */
  const setTime = (which: 'bed' | 'wake', value: string) => {
    const bed = which === 'bed' ? value : bedTime;
    const wake = which === 'wake' ? value : wakeTime;
    if (which === 'bed') setBedTime(value);
    else setWakeTime(value);
    if (/^\d{2}:\d{2}$/.test(bed) && /^\d{2}:\d{2}$/.test(wake)) setSleep(sleepFromTimes(bed, wake));
  };

  const answers = [sleepHours !== null, energy !== null, fatigue !== null, soreness !== null].filter(Boolean).length;
  const checkInAnswered = answers > 0 || unusualPain !== null || quality !== null || awakenings !== null;
  const anything = checkInAnswered || stressValue !== null || existing !== undefined || (stress !== undefined && !!mood?.stress);
  const score = answers ? recoveryScore({ sleepHours, energy, fatigue, soreness }) : null;
  const locatePain = unusualPain === true;

  const save = async () => {
    setBusy(true);
    haptic('success');
    try {
      const time = (v: string) => (/^\d{2}:\d{2}$/.test(v) ? v : null);
      const input = { date, sleepHours, energy, fatigue, soreness, unusualPain, bedTime: time(bedTime), wakeTime: time(wakeTime), awakenings, sleepQuality: quality };
      if (checkInAnswered) {
        if (existing) await repos.checkIns.update(existing.id, input);
        else await repos.checkIns.add(input);
      } else if (existing) await repos.checkIns.remove(existing.id);
      if (stress !== undefined) {
        if (mood) await repos.moodLogs.update(mood.id, { stress });
        else if (stress !== null) await repos.moodLogs.add({ date, stress });
      }
      toast.show(checkInAnswered || stressValue !== null ? 'Check-in enregistré' : 'Check-in effacé');
      onDone();
      if (locatePain) void navigate('/progression?vue=douleurs', { viewTransition: true });
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'L’enregistrement a échoué. Réessaie.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-1">
      <div className="flex flex-col gap-1">
        <p className="text-[15px]">{date === today ? 'Comment tu te sens ce matin ?' : formatDayShort(date)}</p>
        <p className="text-[13px] text-cendre">Chaque question est facultative : passe celles que tu veux et complète plus tard. Un second appui efface une réponse.</p>
      </div>

      <section aria-label="Sommeil" className="flex flex-col gap-2">
        <Stepper label="Durée de la nuit" value={sleepHours} step={0.25} min={0} max={16} start={7.5} format={formatHours} onChange={setSleep} onClear={() => setSleep(null)} />
        {details ? (
          <div className="flex flex-col gap-4 rounded-[18px] border border-graphite p-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Coucher" type="time" value={bedTime} onChange={(e) => setTime('bed', e.target.value)} />
              <Field label="Réveil" type="time" value={wakeTime} onChange={(e) => setTime('wake', e.target.value)} />
            </div>
            <Stepper
              label="Réveils dans la nuit"
              value={awakenings}
              step={1}
              min={0}
              max={20}
              start={0}
              format={(v) => (v === 0 ? 'Aucun' : String(v))}
              onChange={setAwakenings}
              onClear={() => setAwakenings(null)}
            />
            <ScaleChips label="Qualité ressentie" value={quality} onChange={setQuality} onClear={() => setQuality(null)} low="Très mauvaise" high="Excellente" />
          </div>
        ) : (
          <button type="button" onClick={() => setDetails(true)} className="self-start py-1 text-[15px] text-citron">
            Ajouter les détails de la nuit
          </button>
        )}
      </section>

      <ScaleChips label="Énergie" value={energy} onChange={setEnergy} onClear={() => setEnergy(null)} low="Vide" high="Au top" />

      <div className="flex flex-col gap-1">
        <ScaleChips label="Stress" value={stressValue} onChange={setStress} onClear={() => setStress(null)} low="Aucun" high="Très élevé" />
        {stressFromJournal && <p className="text-[12px] text-cendre">Repris de ton journal Mind du jour.</p>}
      </div>

      <section aria-label="Physiquement" className="flex flex-col gap-4">
        <ScaleChips label="Fatigue physique" value={fatigue} onChange={setFatigue} onClear={() => setFatigue(null)} low="Aucune" high="Épuisé" />
        <ScaleChips label="Courbatures" value={soreness} onChange={setSoreness} onClear={() => setSoreness(null)} low="Aucune" high="Fortes" />
      </section>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-[15px] font-semibold">Douleur inhabituelle ?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              [false, 'Non'],
              [true, 'Oui'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={unusualPain === v}
              onClick={() => setUnusualPain(unusualPain === v ? null : v)}
              className={`h-12 rounded-[12px] text-[17px] font-semibold transition-colors ${unusualPain === v ? 'bg-citron text-noir' : 'bg-graphite text-craie'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {activePains.length > 0 && (
          <p className="text-[12px] text-cendre">
            Déjà suivie{activePains.length > 1 ? 's' : ''} : {activePains.map((p) => zoneLabel(p.zone).toLocaleLowerCase('fr-FR')).join(', ')}.
          </p>
        )}
        {locatePain && <p className="text-[13px] leading-snug">Après l’enregistrement, situe-la sur la silhouette : PULSE en tiendra compte pour ta séance.</p>}
      </fieldset>

      <p className="text-[15px]" aria-live="polite">
        {score !== null ? (
          <>
            Récupération estimée : <span className="font-semibold">{formatNumber(score, 0)}/100</span>{' '}
            <span className="text-cendre">
              ({recoveryLabel(score).toLowerCase()}
              {answers < 4 ? `, sur ${answers} réponse${answers > 1 ? 's' : ''} sur 4` : ''})
            </span>
          </>
        ) : (
          <span className="text-cendre">Réponds au sommeil, à l’énergie, à la fatigue ou aux courbatures pour estimer ta récupération.</span>
        )}
      </p>
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <Button onClick={() => void save()} disabled={!anything || busy}>
          {locatePain ? 'Enregistrer et situer la douleur' : 'Enregistrer'}
        </Button>
        <Button variant="quiet" onClick={onDone}>
          Plus tard
        </Button>
      </div>
    </div>
  );
}
