import { useState } from 'react';
import { repos, useFoods } from '../../db/hooks';
import type { FoodEntry, MealSlot } from '../../db/types';
import { nutrientsFor } from '../../domain/food';
import { applyKey, toKeypadValue, type KeypadKey } from '../../domain/keypadInput';
import { formatNumber, parseDecimal } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Keypad } from '../../ui/Keypad';
import { Segmented } from '../../ui/Segmented';
import { useToast } from '../../ui/Toast';
import { addWeighedEntry, ensureFood, updateWeighedEntry, type FoodChoice } from './foodActions';

export const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Petit-déj.' },
  { value: 'lunch', label: 'Déjeuner' },
  { value: 'snack', label: 'Collation' },
  { value: 'dinner', label: 'Dîner' },
] as const;

const SOURCE_LABEL = { off: 'Open Food Facts', ciqual: 'Ciqual (ANSES)', custom: 'Aliment perso' } as const;
const g1 = (v: number) => formatNumber(v, v % 1 ? 1 : 0);

interface QuantityFormProps {
  choice: FoodChoice;
  date: string;
  meal: MealSlot;
  editing?: FoodEntry;
  onDone: () => void;
}

/** Quantité d'un aliment : pavé, portions rapides, valeurs recalculées en direct. */
export function QuantityForm({ choice, date, meal: initialMeal, editing, onDone }: QuantityFormProps) {
  const toast = useToast();
  const foods = useFoods();
  const initial = editing?.grams ?? choice.servingG ?? 100;
  const [value, setValue] = useState(toKeypadValue(initial, { maxIntDigits: 4, maxDecimals: 1 }));
  const [fresh, setFresh] = useState(true);
  const [meal, setMeal] = useState<MealSlot>(editing?.meal ?? initialMeal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const stored = foods?.find((f) => f.id === (editing?.foodId ?? choice.foodId) || (choice.sourceId && f.source === choice.source && f.sourceId === choice.sourceId));
  const grams = parseDecimal(value) ?? 0;
  const n = nutrientsFor(choice.per100, grams);
  const unit = choice.unit;

  const press = (key: KeypadKey) => {
    setError(null);
    setValue((v) => applyKey(fresh && key !== 'back' ? '' : v, key, { maxIntDigits: 4, maxDecimals: 1 }));
    setFresh(false);
  };
  const pick = (g: number) => {
    setValue(toKeypadValue(g, { maxIntDigits: 4, maxDecimals: 1 }));
    setFresh(true);
  };

  const save = async () => {
    if (grams <= 0 || grams > 5000) return setError(`Quantité entre 0,1 et 5 000 ${unit}.`);
    setBusy(true);
    try {
      if (editing) {
        await updateWeighedEntry(editing, grams, meal);
        toast.show('Quantité modifiée');
      } else {
        await addWeighedEntry(choice, grams, date, meal);
        toast.show('Ajouté au journal');
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'L’enregistrement a échoué.');
      setBusy(false);
    }
  };

  const toggleFavorite = async () => {
    const id = stored?.id ?? (await ensureFood(choice));
    const on = await repos.foods.toggleFavorite(id);
    toast.show(on ? 'Ajouté aux favoris' : 'Retiré des favoris');
  };

  const quick = [...(choice.servingG ? [choice.servingG, choice.servingG * 2] : []), 50, 100, 150, 200, 250].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="flex flex-col gap-4 pb-1">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] leading-snug text-cendre">
          {choice.brand ? `${choice.brand}, ` : ''}
          {SOURCE_LABEL[choice.source]}
          {choice.state ? `, ${choice.state === 'raw' ? 'cru' : 'cuit'}` : ''}
          <br />
          Pour 100 {unit} : {formatNumber(choice.per100.kcal, 0)} kcal, P {g1(choice.per100.proteinG)}, G {g1(choice.per100.carbsG)}, L {g1(choice.per100.fatG)}
          {choice.per100.fiberG !== null ? `, fibres ${g1(choice.per100.fiberG)}` : ''}
        </p>
        <button
          type="button"
          onClick={() => void toggleFavorite()}
          aria-pressed={Boolean(stored?.favorite)}
          aria-label={stored?.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-graphite ${stored?.favorite ? 'text-citron' : 'text-cendre'}`}
        >
          <Icon name="star" size={20} fill={stored?.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      {choice.incomplete && (
        <p className="flex items-start gap-2 text-[13px] leading-snug text-braise">
          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
          Fiche Open Food Facts incomplète : les valeurs manquantes comptent pour 0. Vérifie l’étiquette, ou crée l’aliment toi-même.
        </p>
      )}

      <div className="flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-1.5">
          <span className={`font-metal text-[56px] ${fresh ? 'text-cendre' : 'text-craie'}`}>{value || '0'}</span>
          <span className="text-xl text-cendre">{unit}</span>
        </p>
        <p className="pb-2 text-right text-[13px] leading-snug" aria-live="polite">
          <span className="font-metal text-[28px]">{formatNumber(n.kcal, 0)}</span> <span className="text-cendre">kcal</span>
          <br />
          <span className="text-cendre">
            P {g1(n.proteinG)}, G {g1(n.carbsG)}, L {g1(n.fatG)}
            {n.fiberG !== null ? `, F ${g1(n.fiberG)}` : ''}
          </span>
        </p>
      </div>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {quick.map((g) => (
          <button key={g} type="button" onClick={() => pick(g)} className="h-10 shrink-0 rounded-full bg-graphite px-3.5 text-[14px] whitespace-nowrap">
            {choice.servingG === g ? `1 portion (${g1(g)} ${unit})` : choice.servingG && g === choice.servingG * 2 ? `2 portions` : `${g} ${unit}`}
          </button>
        ))}
      </div>

      <Keypad onKey={press} />
      <Segmented label="Repas" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void save()} disabled={busy || grams <= 0}>
        {editing ? 'Enregistrer' : 'Ajouter au journal'}
      </Button>
      {editing &&
        (confirmDelete ? (
          <Button
            variant="danger"
            onClick={async () => {
              await repos.food.remove(editing.id);
              toast.show('Aliment supprimé');
              onDone();
            }}
          >
            Confirmer la suppression
          </Button>
        ) : (
          <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirmDelete(true)}>
            Retirer du journal
          </Button>
        ))}
    </div>
  );
}
