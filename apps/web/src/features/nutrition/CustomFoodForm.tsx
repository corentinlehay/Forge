import { useState } from 'react';
import { repos } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { Food, FoodState } from '../../db/types';
import { kcalFromMacros } from '../../domain/nutrition';
import { formatNumber, parseDecimal } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Segmented } from '../../ui/Segmented';
import { useToast } from '../../ui/Toast';

const text = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v).replace('.', ','));
const num = (t: string): number | null => (t.trim() === '' ? null : parseDecimal(t));

const unitOptions = [
  { value: 'g', label: 'Pour 100 g' },
  { value: 'ml', label: 'Pour 100 ml' },
] as const;
const stateOptions = [
  { value: 'none', label: 'Non précisé' },
  { value: 'raw', label: 'Cru' },
  { value: 'cooked', label: 'Cuit' },
] as const;

/** Crée ou modifie un aliment perso, à partir de son étiquette (valeurs pour 100 g ou 100 ml). */
export function CustomFoodForm({ editing, barcode, onSaved }: { editing?: Food; barcode?: string; onSaved: (food: Food) => void }) {
  const toast = useToast();
  const [name, setName] = useState(editing?.name ?? '');
  const [brand, setBrand] = useState(editing?.brand ?? '');
  const [unit, setUnit] = useState<'g' | 'ml'>(editing?.unit ?? 'g');
  const [state, setState] = useState<FoodState | 'none'>(editing?.state ?? 'none');
  const [kcal, setKcal] = useState(text(editing?.per100.kcal));
  const [p, setP] = useState(text(editing?.per100.proteinG));
  const [c, setC] = useState(text(editing?.per100.carbsG));
  const [f, setF] = useState(text(editing?.per100.fatG));
  const [fiber, setFiber] = useState(text(editing?.per100.fiberG));
  const [serving, setServing] = useState(text(editing?.servingG));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const computed = kcalFromMacros(num(p) ?? 0, num(c) ?? 0, num(f) ?? 0);

  const save = async () => {
    setError(null);
    const fields = [kcal, p, c, f, fiber, serving];
    if (fields.some((t) => t.trim() !== '' && num(t) === null)) return setError('Vérifie les nombres saisis.');
    if (num(p) === null || num(c) === null || num(f) === null) return setError('Renseigne protéines, glucides et lipides (0 si l’étiquette l’indique).');
    setBusy(true);
    try {
      const input = {
        name: name.trim(),
        ...(brand.trim() ? { brand: brand.trim() } : {}),
        unit,
        state: state === 'none' ? null : state,
        per100: { kcal: Math.round(num(kcal) ?? computed), proteinG: num(p)!, carbsG: num(c)!, fatG: num(f)!, fiberG: num(fiber) },
        servingG: num(serving),
      };
      const food = editing
        ? await repos.foods.update(editing.id, input)
        : await repos.foods.add({ ...input, source: 'custom', sourceId: barcode ?? null, favorite: false, useCount: 0, lastUsedAt: null });
      toast.show(editing ? 'Aliment modifié' : 'Aliment créé');
      onSaved(food);
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'L’enregistrement a échoué.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-1">
      {barcode && <p className="text-[13px] text-cendre">Code-barres {barcode} : produit absent d’Open Food Facts. Recopie l’étiquette ; FORGE le reconnaîtra au prochain scan.</p>}
      <Field label="Nom" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} placeholder="Ex. galettes de riz" />
      <Field label="Marque (facultatif)" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} />
      <Segmented label="Unité" options={unitOptions} value={unit} onChange={setUnit} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calories" value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="decimal" placeholder={computed ? String(computed) : '0'} suffix="kcal" />
        <Field label="Fibres" value={fiber} onChange={(e) => setFiber(e.target.value)} inputMode="decimal" placeholder="Inconnu" suffix="g" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Protéines" value={p} onChange={(e) => setP(e.target.value)} inputMode="decimal" suffix="g" />
        <Field label="Glucides" value={c} onChange={(e) => setC(e.target.value)} inputMode="decimal" suffix="g" />
        <Field label="Lipides" value={f} onChange={(e) => setF(e.target.value)} inputMode="decimal" suffix="g" />
      </div>
      {kcal.trim() === '' && computed > 0 && <p className="text-[13px] text-cendre">Sans calories saisies, FORGE retient {formatNumber(computed, 0)} kcal pour 100 {unit}, calculées d’après les macros.</p>}
      <Field label={`Portion habituelle (facultatif)`} value={serving} onChange={(e) => setServing(e.target.value)} inputMode="decimal" suffix={unit} />
      <Segmented label="État" options={stateOptions} value={state} onChange={setState} />
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void save()} disabled={busy || !name.trim()}>
        {editing ? 'Enregistrer l’aliment' : 'Créer l’aliment'}
      </Button>
    </div>
  );
}
