import { useState } from 'react';
import { applyKey, toKeypadValue, type KeypadKey } from '../../domain/keypadInput';
import { parseDecimal } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Keypad } from '../../ui/Keypad';

type FieldName = 'weight' | 'reps';

interface SetFormProps {
  initialWeight: number | null;
  initialReps: number | null;
  editing: boolean;
  onSave: (weightKg: number, reps: number) => Promise<void>;
  onDelete?: () => Promise<void>;
}

/**
 * Saisie d'une série : charge et répétitions au pavé.
 * La valeur proposée (dernière série) est remplacée dès la première touche.
 */
export function SetForm({ initialWeight, initialReps, editing, onSave, onDelete }: SetFormProps) {
  const [weight, setWeight] = useState(initialWeight !== null ? toKeypadValue(initialWeight) : '');
  const [reps, setReps] = useState(initialReps !== null ? String(initialReps) : '');
  const [active, setActive] = useState<FieldName>('weight');
  const [fresh, setFresh] = useState<Record<FieldName, boolean>>({ weight: initialWeight !== null, reps: initialReps !== null });
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

  const save = async () => {
    const w = parseDecimal(weight);
    const r = Number(reps);
    if (w === null || w < 0 || w > 500) return setError('Charge entre 0 et 500 kg (0 pour le poids du corps).');
    if (!Number.isInteger(r) || r < 1 || r > 100) return setError('Entre 1 et 100 répétitions.');
    setBusy(true);
    try {
      await onSave(w, r);
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
      className={`flex flex-1 flex-col items-start gap-1 rounded-[16px] border-2 px-4 py-3 text-left ${active === name ? 'border-citron bg-graphite' : 'border-graphite'}`}
    >
      <span className="text-[13px] text-cendre">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className={`font-metal text-[44px] ${value ? (fresh[name] && active === name ? 'text-cendre' : 'text-craie') : 'text-graphite'}`}>{value || '0'}</span>
        <span className="text-[15px] text-cendre">{unit}</span>
      </span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4 pb-1">
      <div className="flex gap-3">
        {box('weight', weight, 'kg', 'Charge')}
        {box('reps', reps, 'rép.', 'Répétitions')}
      </div>
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
