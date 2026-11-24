import { useState } from 'react';
import { applyKey, toKeypadValue, type KeypadKey } from '../../domain/keypadInput';
import { rpeFromRir, type Suggestion } from '../../domain/progression';
import { formatNumber, parseDecimal } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Keypad } from '../../ui/Keypad';
import { haptic } from '../../services/haptics';

type FieldName = 'weight' | 'reps';
const RIR_VALUES = [0, 1, 2, 3, 4, 5];

interface SetFormProps {
  initialWeight: number | null;
  initialReps: number | null;
  initialRir: number | null;
  /** Objectif proposé : appliqué seulement si tu le touches. */
  suggestion?: Suggestion | null;
  targetRir?: number | null;
  editing: boolean;
  onSave: (weightKg: number, reps: number, rir: number | null) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const kgText = (v: number) => formatNumber(v, v % 1 ? (Math.round(v * 100) % 10 ? 2 : 1) : 0);

/**
 * Saisie d'une série : charge et répétitions au pavé, RIR en un toucher.
 * La valeur proposée (dernière série) est remplacée dès la première touche.
 */
export function SetForm({ initialWeight, initialReps, initialRir, suggestion, targetRir, editing, onSave, onDelete }: SetFormProps) {
  const [weight, setWeight] = useState(initialWeight !== null ? toKeypadValue(initialWeight) : '');
  const [reps, setReps] = useState(initialReps !== null ? String(initialReps) : '');
  const [rir, setRir] = useState<number | null>(initialRir);
  const [active, setActive] = useState<FieldName>('weight');
  const [fresh, setFresh] = useState<Record<FieldName, boolean>>({
    weight: initialWeight !== null,
    reps: initialReps !== null,
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const press = (key: KeypadKey) => {
    setError(null);
    const limits = active === 'weight' ? { maxIntDigits: 3, maxDecimals: 2 } : { maxIntDigits: 3, maxDecimals: 0 };
    const setter = active === 'weight' ? setWeight : setReps;
    const replace = fresh[active] && key !== 'back';
    setter((v) => applyKey(replace ? '' : v, key, limits));
    setFresh((f) => ({ ...f, [active]: false }));
  };

  const useSuggestion = () => {
    if (!suggestion) return;
    setWeight(toKeypadValue(suggestion.weightKg));
    setReps(String(suggestion.reps));
    setFresh({ weight: false, reps: false });
  };

  const save = async () => {
    const w = parseDecimal(weight);
    const r = Number(reps);
    if (w === null || w < 0 || w > 500) return setError('Charge entre 0 et 500 kg (0 pour le poids du corps).');
    if (!Number.isInteger(r) || r < 1 || r > 100) return setError('Entre 1 et 100 répétitions.');
    setBusy(true);
    haptic('light');
    try {
      await onSave(w, r, rir);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'L’enregistrement a échoué.');
      setBusy(false);
    }
  };

  const box = (name: FieldName, value: string, unit: string, label: string) => (
    <button
      type="button"
      onClick={() => {
        setActive(name);
        setFresh((f) => ({ ...f, [name]: true }));
      }}
      aria-pressed={active === name}
      aria-label={`${label} : ${value || 'vide'}`}
      className={`flex flex-1 flex-col items-start gap-0.5 rounded-[16px] border-2 px-4 py-2.5 text-left ${active === name ? 'border-citron bg-graphite' : 'border-graphite'}`}
    >
      <span className="text-[13px] text-cendre">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className={`font-metal text-[40px] ${value ? (fresh[name] && active === name ? 'text-cendre' : 'text-craie') : 'text-graphite'}`}>{value || '0'}</span>
        <span className="text-[15px] text-cendre">{unit}</span>
      </span>
    </button>
  );

  const suggestionApplied = suggestion && parseDecimal(weight) === suggestion.weightKg && Number(reps) === suggestion.reps;

  return (
    <div className="flex flex-col gap-3 pb-1">
      {suggestion && !editing && (
        <button
          type="button"
          onClick={useSuggestion}
          aria-pressed={Boolean(suggestionApplied)}
          className={`flex items-center justify-between gap-3 rounded-[14px] border px-3.5 py-2 text-left ${suggestionApplied ? 'border-citron' : 'border-graphite'}`}
        >
          <span className="min-w-0">
            <span className="block text-[12px] text-cendre">Objectif proposé</span>
            <span className="block text-[15px] font-semibold">
              {kgText(suggestion.weightKg)} kg × {suggestion.reps}, sur chaque série
            </span>
          </span>
          {suggestionApplied ? <Icon name="check" size={18} strokeWidth={2.4} className="shrink-0 text-citron" /> : <span className="shrink-0 text-[13px] text-citron">Utiliser</span>}
        </button>
      )}
      <div className="flex gap-3">
        {box('weight', weight, 'kg', 'Charge')}
        {box('reps', reps, 'rép.', 'Répétitions')}
      </div>
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 flex w-full justify-between text-[13px] text-cendre">
          <span>
            Répétitions en réserve (RIR)
            {targetRir !== null && targetRir !== undefined ? `, visé ${targetRir}` : ''}
          </span>
          <span>{rir !== null ? `RPE ${rpeFromRir(rir)}` : 'facultatif'}</span>
        </legend>
        <div className="grid grid-cols-6 gap-1.5">
          {RIR_VALUES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={rir === n}
              aria-label={n === 0 ? 'RIR 0, à l’échec' : n === 5 ? 'RIR 5 ou plus' : `RIR ${n}`}
              onClick={() => setRir((cur) => (cur === n ? null : n))}
              className={`h-11 rounded-[12px] font-display text-[18px] font-semibold ${rir === n ? 'bg-citron text-noir' : 'bg-graphite text-craie'}`}
            >
              {n === 5 ? '5+' : n}
            </button>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Keypad onKey={press} />
      <Button onClick={() => void save()} disabled={busy || !weight || !reps}>
        {editing ? 'Enregistrer' : 'Valider la série'}
      </Button>
      {onDelete &&
        (confirmDelete ? (
          <Button variant="danger" onClick={() => void onDelete()}>
            Confirmer la suppression
          </Button>
        ) : (
          <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirmDelete(true)}>
            Supprimer la série
          </Button>
        ))}
    </div>
  );
}
