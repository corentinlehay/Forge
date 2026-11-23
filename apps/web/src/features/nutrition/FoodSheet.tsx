import { useState } from 'react';
import { repos, useFoodEntries } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { FoodEntry, MealSlot, NutritionTargets } from '../../db/types';
import { kcalFromMacros, recentFoods } from '../../domain/nutrition';
import { formatNumber, parseDecimal } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Segmented } from '../../ui/Segmented';
import { useToast } from '../../ui/Toast';

const mealOptions = [
  { value: 'breakfast', label: 'Petit-déj.' },
  { value: 'lunch', label: 'Déjeuner' },
  { value: 'snack', label: 'Collation' },
  { value: 'dinner', label: 'Dîner' },
] as const;

export function defaultMeal(now: Date = new Date()): MealSlot {
  const h = now.getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

const toText = (v: number | undefined) => (v === undefined ? '' : formatNumber(v, v % 1 ? 1 : 0).replace(/\s/g, ''));
const num = (text: string): number | null => (text.trim() === '' ? null : parseDecimal(text));

interface FoodFormProps {
  date: string;
  meal: MealSlot;
  editing: FoodEntry | null;
  onDone: () => void;
}

/** Ajout manuel d'un aliment. La recherche dans Ciqual et le scanner arrivent en Phase 3. */
export function FoodForm({ date, meal: initialMeal, editing, onDone }: FoodFormProps) {
  const entries = useFoodEntries();
  const toast = useToast();
  const [meal, setMeal] = useState<MealSlot>(editing?.meal ?? initialMeal);
  const [name, setName] = useState(editing?.name ?? '');
  const [quantity, setQuantity] = useState(editing?.quantity ?? '');
  const [kcal, setKcal] = useState(toText(editing?.kcal));
  const [protein, setProtein] = useState(toText(editing?.proteinG));
  const [carbs, setCarbs] = useState(toText(editing?.carbsG));
  const [fat, setFat] = useState(toText(editing?.fatG));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const p = num(protein) ?? 0;
  const c = num(carbs) ?? 0;
  const f = num(fat) ?? 0;
  const computed = kcalFromMacros(p, c, f);
  const recents = editing ? [] : recentFoods(entries ?? [], 6);

  const fill = (e: FoodEntry) => {
    setName(e.name);
    setQuantity(e.quantity ?? '');
    setKcal(toText(e.kcal));
    setProtein(toText(e.proteinG));
    setCarbs(toText(e.carbsG));
    setFat(toText(e.fatG));
  };

  const save = async () => {
    setError(null);
    const values = [num(kcal), num(protein), num(carbs), num(fat)];
    if ([kcal, protein, carbs, fat].some((t, i) => t.trim() !== '' && values[i] === null)) {
      setError('Vérifie les nombres saisis.');
      return;
    }
    const finalKcal = values[0] ?? computed;
    if (finalKcal === 0 && p + c + f === 0) {
      setError('Indique au moins les calories ou les macros.');
      return;
    }
    setBusy(true);
    try {
      const input = { date, meal, name: name.trim(), kcal: Math.round(finalKcal), proteinG: p, carbsG: c, fatG: f, ...(quantity.trim() ? { quantity: quantity.trim() } : {}) };
      if (editing) await repos.food.update(editing.id, input);
      else await repos.food.add(input);
      toast.show(editing ? 'Aliment modifié' : 'Aliment ajouté');
      onDone();
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'L’enregistrement a échoué. Réessaie.');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    setBusy(true);
    await repos.food.remove(editing.id);
    toast.show('Aliment supprimé');
    onDone();
  };

  return (
    <div className="flex flex-col gap-4 pb-1">
      <Segmented label="Repas" options={mealOptions} value={meal} onChange={setMeal} />
      {recents.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-cendre">Récents</p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {recents.map((e) => (
              <button key={e.id} type="button" onClick={() => fill(e)} className="h-10 shrink-0 rounded-full bg-graphite px-3.5 text-[14px] whitespace-nowrap">
                {e.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <Field label="Aliment" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex. riz basmati cuit" enterKeyHint="next" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantité" value={quantity} onChange={(e) => setQuantity(e.target.value)} maxLength={40} placeholder="Ex. 150 g" />
        <Field label="Calories" value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="decimal" placeholder={computed ? String(computed) : '0'} suffix="kcal" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Protéines" value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="decimal" placeholder="0" suffix="g" />
        <Field label="Glucides" value={carbs} onChange={(e) => setCarbs(e.target.value)} inputMode="decimal" placeholder="0" suffix="g" />
        <Field label="Lipides" value={fat} onChange={(e) => setFat(e.target.value)} inputMode="decimal" placeholder="0" suffix="g" />
      </div>
      {kcal.trim() === '' && computed > 0 && <p className="text-[13px] text-cendre">Sans calories saisies, FORGE retient {formatNumber(computed, 0)} kcal, calculées d’après les macros.</p>}
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void save()} disabled={busy || !name.trim()}>
        {editing ? 'Enregistrer' : 'Ajouter'}
      </Button>
      {editing &&
        (confirmDelete ? (
          <Button variant="danger" onClick={() => void remove()} disabled={busy}>
            Confirmer la suppression
          </Button>
        ) : (
          <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirmDelete(true)}>
            Supprimer l’aliment
          </Button>
        ))}
    </div>
  );
}

export function TargetsForm({ current, trendKg, onDone }: { current: NutritionTargets | undefined; trendKg: number | null; onDone: () => void }) {
  const toast = useToast();
  const [kcal, setKcal] = useState(toText(current?.kcal));
  const [protein, setProtein] = useState(toText(current?.proteinG));
  const [carbs, setCarbs] = useState(toText(current?.carbsG));
  const [fat, setFat] = useState(toText(current?.fatG));
  const [fiber, setFiber] = useState(toText(current?.fiberG));
  const [water, setWater] = useState(current?.waterMl ? toText(current.waterMl / 1000) : '');
  const [error, setError] = useState<string | null>(null);
  const values = [num(kcal), num(protein), num(carbs), num(fat)];
  const macrosKcal = kcalFromMacros(values[1] ?? 0, values[2] ?? 0, values[3] ?? 0);

  const save = async () => {
    setError(null);
    if (values.some((v) => v === null)) {
      setError('Renseigne calories, protéines, glucides et lipides.');
      return;
    }
    if ((fiber.trim() && num(fiber) === null) || (water.trim() && num(water) === null)) {
      setError('Vérifie les fibres et l’hydratation.');
      return;
    }
    const [k, p, c, f] = values as number[];
    const fiberG = num(fiber);
    const waterL = num(water);
    try {
      await repos.profile.update({
        nutritionTargets: {
          kcal: Math.round(k!),
          proteinG: p!,
          carbsG: c!,
          fatG: f!,
          ...(fiberG !== null ? { fiberG } : {}),
          ...(waterL !== null ? { waterMl: Math.round(waterL * 1000) } : {}),
        },
      });
      toast.show('Objectifs enregistrés');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-1">
      <p className="text-[15px] leading-snug text-cendre">
        Tes objectifs du jour. Le calcul adaptatif, qui propose des ajustements à partir de ta tendance de poids, arrivera avec la livraison « objectifs dynamiques ».
      </p>
      <Field label="Calories" value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="decimal" suffix="kcal" />
      <div className="grid grid-cols-3 gap-3">
        <Field label="Protéines" value={protein} onChange={(e) => setProtein(e.target.value)} inputMode="decimal" suffix="g" />
        <Field label="Glucides" value={carbs} onChange={(e) => setCarbs(e.target.value)} inputMode="decimal" suffix="g" />
        <Field label="Lipides" value={fat} onChange={(e) => setFat(e.target.value)} inputMode="decimal" suffix="g" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fibres (facultatif)" value={fiber} onChange={(e) => setFiber(e.target.value)} inputMode="decimal" suffix="g" />
        <Field label="Boissons (facultatif)" value={water} onChange={(e) => setWater(e.target.value)} inputMode="decimal" suffix="L" />
      </div>
      <ul className="flex flex-col gap-1 text-[13px] leading-snug text-cendre">
        {macrosKcal > 0 && <li>Tes macros représentent {formatNumber(macrosKcal, 0)} kcal.</li>}
        {trendKg !== null && (
          <li>
            Repère protéines pour la prise de muscle : 1,6 à 2,2 g par kg, soit {formatNumber(1.6 * trendKg, 0)} à {formatNumber(2.2 * trendKg, 0)} g à {formatNumber(trendKg, 1)} kg (Morton et al., 2018).
          </li>
        )}
        <li>Repère fibres pour un adulte : 30 g par jour (ANSES).</li>
        <li>Repère eau pour un homme adulte : 2,5 L par jour au total, dont environ 80 % apportés par les boissons (EFSA, 2010).</li>
      </ul>
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void save()}>Enregistrer les objectifs</Button>
    </div>
  );
}
