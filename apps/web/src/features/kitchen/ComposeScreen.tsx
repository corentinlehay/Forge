import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useFoodEntries, useProfile, useToday } from '../../db/hooks';
import type { MealSlot } from '../../db/types';
import { composeMeal, formatEur } from '../../domain/kitchen';
import { dayNutrition } from '../../domain/nutrition';
import { formatNumber, parseDecimal } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { useToast } from '../../ui/Toast';
import { defaultMeal } from '../nutrition/FoodSheet';
import { MEAL_OPTIONS } from '../nutrition/QuantityForm';
import { eatRecipe, portionsText } from './kitchenActions';
import { RecipeVisual } from './RecipeVisual';
import { useKitchen, type KitchenData } from './useKitchen';

const g0 = (v: number) => formatNumber(Math.max(0, Math.round(v)), 0);

/** Compose mon repas : les recettes qui collent à ce qu'il te reste à manger aujourd'hui. */
export function ComposeScreen() {
  const kitchen = useKitchen();
  const profile = useProfile();
  const entries = useFoodEntries();
  const today = useToday();
  if (!kitchen || profile === undefined || !entries)
    return (
      <Screen withTabBar={false}>
        <BackLink />
      </Screen>
    );
  const day = dayNutrition(entries, today, profile?.nutritionTargets);
  const remaining = day.targets ? { kcal: day.targets.kcal - day.totals.kcal, proteinG: day.targets.proteinG - day.totals.proteinG } : null;
  return <Compose kitchen={kitchen} remaining={remaining} />;
}

function Compose({ kitchen, remaining }: { kitchen: KitchenData; remaining: { kcal: number; proteinG: number } | null }) {
  const today = useToday();
  const toast = useToast();
  const [kcal, setKcal] = useState(remaining ? g0(remaining.kcal).replace(/\s/g, '') : '');
  const [protein, setProtein] = useState(remaining ? g0(remaining.proteinG).replace(/\s/g, '') : '');
  const [meal, setMeal] = useState<MealSlot>(defaultMeal());
  const [minutes, setMinutes] = useState<number | null>(kitchen.prefs.maxMinutes);
  const [budget, setBudget] = useState(kitchen.prefs.budgetPerServing !== null ? String(kitchen.prefs.budgetPerServing).replace('.', ',') : '');
  const [available, setAvailable] = useState('');
  const [added, setAdded] = useState<string | null>(null);

  const request = useMemo(
    () => ({
      kcal: parseDecimal(kcal) ?? 0,
      proteinG: parseDecimal(protein) ?? 0,
      meal,
      maxMinutes: minutes,
      maxCost: budget.trim() ? parseDecimal(budget) : null,
      available: available
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean),
    }),
    [kcal, protein, meal, minutes, budget, available],
  );
  const suggestions = useMemo(() => composeMeal(kitchen.recipes, request, kitchen), [kitchen, request]);

  return (
    <Screen withTabBar={false}>
      <BackLink />
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[40px] leading-none">Compose mon repas</h1>
        <p className="text-[15px] leading-snug text-cendre">
          {remaining
            ? `Il te reste ${g0(remaining.kcal)} kcal et ${g0(remaining.proteinG)} g de protéines aujourd’hui.`
            : 'Sans objectifs nutritionnels, indique ce que tu veux manger. Tu peux les définir dans Nutrition.'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Calories visées" suffix="kcal" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value.replace(/\D/g, ''))} maxLength={4} />
        <Field label="Protéines visées" suffix="g" inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value.replace(/\D/g, ''))} maxLength={3} />
      </div>
      <Segmented label="Repas" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
      <Chips
        label="Temps disponible"
        options={[
          { value: 15, label: '15 min' },
          { value: 30, label: '30 min' },
          { value: 45, label: '45 min' },
          { value: 0, label: 'Sans limite' },
        ]}
        selected={[minutes ?? 0]}
        onToggle={(v) => setMinutes(v === 0 ? null : v)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Budget du repas" suffix="€" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} maxLength={6} placeholder="Libre" />
        <Field label="Ingrédients à utiliser" value={available} onChange={(e) => setAvailable(e.target.value)} maxLength={120} placeholder="Ex. thon, riz" />
      </div>
      <p className="-mt-2 text-[12px] text-cendre">Préférences et exclusions appliquées. Avec un budget, seules les recettes dont tous les prix sont connus sont proposées.</p>

      <section aria-label="Propositions" className="flex flex-col gap-3">
        <h2 className="text-[17px] font-semibold">Propositions</h2>
        {request.kcal <= 0 ? (
          <p className="text-[15px] text-cendre">Indique les calories visées pour ce repas.</p>
        ) : suggestions.length === 0 ? (
          <p className="text-[15px] text-cendre">Aucune recette ne rentre dans ces critères. Élargis le temps, le budget ou les ingrédients.</p>
        ) : (
          suggestions.map((s) => (
            <article key={s.recipe.key} className="flex flex-col gap-3 rounded-[18px] bg-anthracite p-3">
              <Link to={`/nutrition/recettes/${s.recipe.key}`} viewTransition className="flex items-center gap-3">
                <RecipeVisual recipe={s.recipe} photo={kitchen.photos.get(s.recipe.key)} size="thumb" className="h-16 w-16 shrink-0 rounded-[12px]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-tight font-semibold">{s.recipe.name}</span>
                  <span className="block text-[13px] text-cendre">
                    {portionsText(s.servings)} : {formatNumber(s.kcal, 0)} kcal, {formatNumber(s.proteinG, 0)} g de protéines
                    {s.cost !== null ? `, ${formatEur(s.cost)}` : ''}
                  </span>
                </span>
                <Icon name="chevron" size={16} className="shrink-0 text-cendre" />
              </Link>
              <Button
                variant={added === s.recipe.key ? 'secondary' : 'primary'}
                size="small"
                disabled={added === s.recipe.key}
                onClick={() =>
                  void eatRecipe(s.recipe, s.servings, today, meal, kitchen.prices).then(() => {
                    setAdded(s.recipe.key);
                    toast.show(`Ajouté au journal : ${s.recipe.name}`);
                  })
                }
              >
                {added === s.recipe.key ? 'Ajouté au journal' : `J’en mange ${portionsText(s.servings)}`}
              </Button>
            </article>
          ))
        )}
      </section>
    </Screen>
  );
}

function BackLink() {
  return (
    <Link to="/nutrition/recettes" viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      Recettes
    </Link>
  );
}
