import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { repos, useMealPlans, useProfile, useToday } from '../../db/hooks';
import type { MealPlan, MealSlot } from '../../db/types';
import { recipeNutrition, type Recipe } from '../../domain/kitchen';
import { MEAL_LABELS } from '../../domain/nutrition';
import { weekStart } from '../../domain/training';
import { addDays } from '../../lib/dates';
import { formatDayMonth, formatDayShort, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { createShoppingList, markPlanEaten, portionsText } from './kitchenActions';
import { PlanPanel } from './RecipeScreen';
import { RecipeChooser } from './RecipeChooser';
import { useKitchen } from './useKitchen';

const MEAL_ORDER: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/** Planning de la semaine : repas prévus (distincts du journal) jusqu'à ce qu'ils soient marqués « mangés ». */
export function PlanningScreen() {
  const kitchen = useKitchen();
  const plans = useMealPlans();
  const profile = useProfile();
  const today = useToday();
  const navigate = useNavigate();
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState<{ date: string; recipe: Recipe | null } | null>(null);

  if (!kitchen || !plans || profile === undefined)
    return (
      <Screen withTabBar={false}>
        <BackLink />
      </Screen>
    );
  const start = addDays(weekStart(today), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const week = plans.filter((p) => p.date >= start && p.date <= days[6]!);
  const pending = week.filter((p) => p.status === 'planned');
  const target = profile?.nutritionTargets?.kcal ?? null;

  const kcalOf = (p: MealPlan) => {
    const r = kitchen.byKey.get(p.recipeKey);
    return r ? recipeNutrition(r, p.servings).total.kcal : 0;
  };

  const weekList = async () => {
    const selections = pending
      .map((p) => ({ recipe: kitchen.byKey.get(p.recipeKey), servings: p.servings }))
      .filter((s): s is { recipe: Recipe; servings: number } => Boolean(s.recipe));
    const list = await createShoppingList(`Semaine du ${formatDayMonth(start)}`, selections);
    toast.show('Liste de courses créée');
    navigate(`/nutrition/courses/${list.id}`, { viewTransition: true });
  };

  return (
    <Screen withTabBar={false}>
      <BackLink />
      <h1 className="font-metal text-[40px] leading-none">Planning</h1>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Semaine précédente"
          onClick={() => setOffset((o) => o - 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-anthracite"
        >
          <Icon name="back" size={18} />
        </button>
        <p className="text-[15px] font-semibold">{offset === 0 ? 'Cette semaine' : offset === 1 ? 'Semaine prochaine' : `Semaine du ${formatDayMonth(start)}`}</p>
        <button
          type="button"
          aria-label="Semaine suivante"
          onClick={() => setOffset((o) => o + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-anthracite"
        >
          <Icon name="chevron" size={18} />
        </button>
      </div>
      <p className="-mt-2 text-[13px] leading-snug text-cendre">Les repas planifiés ne comptent pas dans ton journal tant que tu ne les marques pas « mangé ».</p>

      {days.map((date) => {
        const items = week.filter((p) => p.date === date).sort((a, b) => MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal));
        const planned = items.reduce((s, p) => s + kcalOf(p), 0);
        return (
          <section
            key={date}
            aria-label={formatDayShort(date)}
            className={`flex flex-col gap-2 rounded-[18px] p-3.5 ${date === today ? 'bg-anthracite outline-1 outline-module/50' : 'bg-anthracite'}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold">{formatDayShort(date)}</h2>
              {items.length > 0 && (
                <span className="text-[12px] text-cendre">
                  {formatNumber(planned, 0)} kcal prévues{target ? ` sur ${formatNumber(target, 0)}` : ''}
                </span>
              )}
            </div>
            {items.map((p) => {
              const r = kitchen.byKey.get(p.recipeKey);
              return (
                <div key={p.id} className="flex items-center gap-2 border-t border-graphite pt-2">
                  <div className="min-w-0 flex-1">
                    {r ? (
                      <Link to={`/nutrition/recettes/${r.key}`} viewTransition className="block text-[15px] leading-tight">
                        {r.name}
                      </Link>
                    ) : (
                      <p className="text-[15px] text-cendre">Recette supprimée</p>
                    )}
                    <p className="text-[12px] text-cendre">
                      {MEAL_LABELS[p.meal]}, {portionsText(p.servings)}, {formatNumber(kcalOf(p), 0)} kcal
                    </p>
                  </div>
                  {p.status === 'eaten' ? (
                    <span className="flex shrink-0 items-center gap-1 text-[13px] text-module">
                      <Icon name="check" size={16} strokeWidth={2.4} />
                      Mangé
                    </span>
                  ) : (
                    <>
                      {r && (
                        <Button size="small" variant="secondary" onClick={() => void markPlanEaten(p, r, kitchen.prices).then(() => toast.show('Ajouté au journal'))}>
                          J’ai mangé
                        </Button>
                      )}
                      <button
                        type="button"
                        aria-label="Retirer du planning"
                        onClick={() => void repos.mealPlans.remove(p.id)}
                        className="flex h-11 w-10 shrink-0 items-center justify-center text-cendre"
                      >
                        <Icon name="close" size={18} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
            <button type="button" onClick={() => setAdding({ date, recipe: null })} className="flex min-h-10 items-center gap-1.5 self-start text-[13px] text-module">
              <Icon name="plus" size={16} />
              Prévoir un repas
            </button>
          </section>
        );
      })}

      <Button onClick={() => void weekList()} disabled={!pending.length}>
        Liste de courses de la semaine
      </Button>
      {!pending.length && <p className="-mt-2 text-center text-[13px] text-cendre">Planifie des repas pour générer la liste.</p>}

      <Sheet open={adding !== null} title={adding?.recipe ? 'Planifier' : 'Choisir une recette'} onClose={() => setAdding(null)}>
        {adding && !adding.recipe && <RecipeChooser kitchen={kitchen} onPick={(recipe) => setAdding({ ...adding, recipe })} />}
        {adding?.recipe && <PlanPanel recipe={adding.recipe} defaultServings={1} initialDate={adding.date} onDone={() => setAdding(null)} />}
      </Sheet>
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
