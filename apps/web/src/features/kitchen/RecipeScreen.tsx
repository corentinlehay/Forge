import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CATEGORY_LABELS } from '../../data/recipes';
import { repos, useShoppingLists, useToday } from '../../db/hooks';
import type { MealSlot } from '../../db/types';
import { buildShoppingItems, formatEur, isProteinRich, isQuick, quantityText, recipeCost, recipeNutrition, type Recipe } from '../../domain/kitchen';
import { addDays } from '../../lib/dates';
import { formatDayShort, formatNumber, parseDecimal } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { SelectField } from '../../ui/SelectField';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { defaultMeal } from '../nutrition/FoodSheet';
import { MEAL_OPTIONS } from '../nutrition/QuantityForm';
import { createShoppingList, duplicateRecipe, eatRecipe, exportRecipe, planRecipe, portionsText, resizePhoto, toggleFavorite } from './kitchenActions';
import { RecipeVisual } from './RecipeVisual';
import { useKitchen, type KitchenData } from './useKitchen';

const DIFFICULTY = { 1: 'Facile', 2: 'Moyen', 3: 'Plus technique' } as const;
const g1 = (v: number) => formatNumber(v, v % 1 ? 1 : 0);

type SheetKind = 'none' | 'manger' | 'planifier' | 'courses' | 'prix';

/** Fiche recette : portions ajustables, valeurs, coût, ingrédients, étapes, actions. */
export function RecipeScreen() {
  const { key = '' } = useParams();
  const kitchen = useKitchen();
  if (!kitchen)
    return (
      <Screen withTabBar={false}>
        <BackLink />
      </Screen>
    );
  const recipe = kitchen.byKey.get(key);
  if (!recipe) {
    return (
      <Screen withTabBar={false}>
        <BackLink />
        <p className="text-[17px]">Cette recette n’existe plus.</p>
      </Screen>
    );
  }
  return <RecipeView key={recipe.key} recipe={recipe} kitchen={kitchen} />;
}

function RecipeView({ recipe, kitchen }: { recipe: Recipe; kitchen: KitchenData }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [servings, setServings] = useState(recipe.servings);
  const [sheet, setSheet] = useState<SheetKind>('none');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const factor = servings / recipe.servings;
  const n = recipeNutrition(recipe, servings);
  const cost = recipeCost(recipe, servings, kitchen.prices);
  const favorite = kitchen.favorites.has(recipe.key);
  const photo = kitchen.photos.get(recipe.key);
  const tags = [
    ...recipe.categories.map((c) => CATEGORY_LABELS[c]),
    ...(isQuick(recipe) ? [CATEGORY_LABELS.rapide] : []),
    ...(isProteinRich(recipe) ? [CATEGORY_LABELS.proteine] : []),
  ];

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      await repos.recipePhotos.setFor(recipe.key, await resizePhoto(file));
      toast.show('Photo ajoutée');
    } catch {
      toast.show('Cette photo n’a pas pu être ajoutée.');
    }
  };

  const remove = async () => {
    await repos.recipes.remove(recipe.key);
    await repos.recipePhotos.removeFor(recipe.key);
    toast.show('Recette supprimée');
    navigate('/nutrition/recettes', { replace: true });
  };

  return (
    <Screen withTabBar={false}>
      <div className="flex items-center justify-between">
        <BackLink />
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          onClick={() => void toggleFavorite(recipe.key, kitchen.favorites).then((on) => toast.show(on ? 'Ajoutée aux favoris' : 'Retirée des favoris'))}
          className={`flex h-11 w-11 items-center justify-center rounded-full ${favorite ? 'text-citron' : 'text-cendre'}`}
        >
          <Icon name="star" size={22} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <RecipeVisual recipe={recipe} photo={photo} size="hero" className="aspect-[16/10] w-full rounded-[22px]" />
      <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
      <div className="-mt-2 flex gap-4 text-[13px]">
        <button type="button" onClick={() => photoInput.current?.click()} className="min-h-11 text-citron">
          {photo ? 'Changer la photo' : 'Ajouter ma photo'}
        </button>
        {photo && (
          <button type="button" onClick={() => void repos.recipePhotos.removeFor(recipe.key)} className="min-h-11 text-cendre">
            Retirer la photo
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="font-metal text-[36px] leading-none">{recipe.name}</h1>
        {recipe.description && <p className="text-[15px] leading-snug text-cendre">{recipe.description}</p>}
        <ul className="flex flex-wrap gap-1.5" aria-label="Catégories">
          {tags.map((t) => (
            <li key={t} className="rounded-full bg-graphite px-2.5 py-1 text-[12px]">
              {t}
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-3 gap-2 text-[13px]">
          {[
            ['Préparation', `${recipe.prepMin} min`],
            ['Cuisson', recipe.cookMin ? `${recipe.cookMin} min` : 'Aucune'],
            ['Difficulté', DIFFICULTY[recipe.difficulty]],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-cendre">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[18px] bg-anthracite px-4 py-2">
        <span className="text-[15px]">Portions</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Une portion de moins"
            disabled={servings <= 1}
            onClick={() => setServings((s) => s - 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-graphite disabled:opacity-40"
          >
            <Icon name="minus" size={18} />
          </button>
          <span className="font-metal w-10 text-center text-[26px]" aria-live="polite">
            {servings}
          </span>
          <button
            type="button"
            aria-label="Une portion de plus"
            disabled={servings >= 20}
            onClick={() => setServings((s) => s + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-graphite disabled:opacity-40"
          >
            <Icon name="plus" size={18} />
          </button>
        </div>
      </div>

      <section aria-label="Valeurs nutritionnelles" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold">Par portion</h2>
          <span className="text-[13px] text-cendre">
            {formatNumber(n.total.kcal, 0)} kcal pour {servings}
          </span>
        </div>
        <p className="font-metal text-[44px] leading-none">
          {formatNumber(n.perServing.kcal, 0)} <span className="font-sans text-[15px] font-normal text-cendre">kcal</span>
        </p>
        <dl className="grid grid-cols-4 gap-2">
          {[
            ['Protéines', n.perServing.proteinG],
            ['Glucides', n.perServing.carbsG],
            ['Lipides', n.perServing.fatG],
            ['Fibres', n.perServing.fiberG],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[12px] bg-graphite/60 p-2">
              <dt className="text-[11px] text-cendre">{label}</dt>
              <dd className="text-[16px] font-semibold whitespace-nowrap">
                {n.fiberIncomplete && label === 'Fibres' ? '≥ ' : ''}
                {g1(value as number)} g
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-[12px] leading-snug text-cendre">
          {recipe.builtin
            ? 'Calculé à partir de la table Ciqual 2025 (Anses) et des quantités de la recette.'
            : 'Calculé à partir des valeurs de tes ingrédients (Ciqual, Open Food Facts ou aliments perso).'}
          {n.missing.length > 0 && ` Non comptés, valeurs inconnues : ${n.missing.join(', ')}.`}
          {n.fiberIncomplete && ' Fibres : total minimum, une valeur manque.'}
        </p>
        <div className="flex items-center justify-between gap-3 border-t border-graphite pt-3">
          <div>
            <p className="text-[13px] text-cendre">Coût estimé</p>
            {cost.perServing !== null ? (
              <p className="text-[17px] font-semibold">
                {formatEur(cost.perServing)} par portion, {formatEur(cost.total!)} au total
              </p>
            ) : (
              <p className="text-[15px]">
                À renseigner : {cost.missing.length} ingrédient{cost.missing.length > 1 ? 's' : ''} sans prix
              </p>
            )}
          </div>
          <Button variant="secondary" size="small" onClick={() => setSheet('prix')}>
            Prix
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setSheet('manger')}>J’en mange</Button>
        <Button variant="secondary" onClick={() => setSheet('planifier')}>
          Planifier
        </Button>
      </div>
      <Button variant="secondary" onClick={() => setSheet('courses')}>
        Ajouter aux courses
      </Button>

      <section aria-label="Ingrédients" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">
          Ingrédients pour {servings} portion{servings > 1 ? 's' : ''}
        </h2>
        <ul>
          {recipe.ingredients.map((ing, i) => (
            <li key={`${ing.key}-${i}`} className="flex min-h-11 items-center justify-between gap-3 border-b border-anthracite py-2 last:border-b-0">
              <span className="min-w-0 text-[15px]">{ing.name}</span>
              <span className="shrink-0 text-right text-[15px] text-cendre tabular-nums">{quantityText(ing, factor)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Préparation" className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Préparation</h2>
        <ol className="flex flex-col gap-3">
          {recipe.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-snug">
              <span className="font-metal flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-graphite text-[15px]">{i + 1}</span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        {servings !== recipe.servings && <p className="text-[12px] text-cendre">Les quantités sont ajustées ; les temps de cuisson peuvent varier avec la quantité.</p>}
      </section>

      {recipe.storage && (
        <section aria-label="Conservation" className="flex flex-col gap-1 rounded-[18px] border border-graphite p-4">
          <h2 className="text-[15px] font-semibold">Conservation</h2>
          <p className="text-[15px] leading-snug text-cendre">{recipe.storage}</p>
        </section>
      )}

      <div className="flex flex-col gap-2">
        {recipe.builtin ? (
          <Button
            variant="secondary"
            onClick={() =>
              void duplicateRecipe(recipe).then((copy) => {
                toast.show('Copie créée : modifie-la comme tu veux');
                navigate(`/nutrition/recettes/${copy.id}/modifier`, { viewTransition: true });
              })
            }
          >
            <Icon name="edit" size={18} />
            Dupliquer pour la modifier
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => navigate(`/nutrition/recettes/${recipe.key}/modifier`, { viewTransition: true })}>
              <Icon name="edit" size={18} />
              Modifier la recette
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                void duplicateRecipe(recipe).then((copy) => {
                  toast.show('Recette dupliquée');
                  navigate(`/nutrition/recettes/${copy.id}`, { viewTransition: true });
                })
              }
            >
              <Icon name="copy" size={18} />
              Dupliquer
            </Button>
          </>
        )}
        <Button variant="quiet" onClick={() => void exportRecipe(recipe).then((r) => r !== 'cancelled' && toast.show('Recette exportée'))}>
          Exporter la recette (fichier FORGE)
        </Button>
        {!recipe.builtin &&
          (confirmDelete ? (
            <Button variant="danger" onClick={() => void remove()}>
              Confirmer la suppression
            </Button>
          ) : (
            <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirmDelete(true)}>
              Supprimer la recette
            </Button>
          ))}
      </div>

      <Sheet
        open={sheet !== 'none'}
        title={{ none: '', manger: 'J’en mange', planifier: 'Planifier', courses: 'Ajouter aux courses', prix: 'Prix des ingrédients' }[sheet]}
        onClose={() => setSheet('none')}
      >
        {sheet === 'manger' && <EatPanel recipe={recipe} kitchen={kitchen} onDone={() => setSheet('none')} />}
        {sheet === 'planifier' && <PlanPanel recipe={recipe} defaultServings={1} onDone={() => setSheet('none')} />}
        {sheet === 'courses' && <ListPanel recipe={recipe} kitchen={kitchen} servings={servings} onDone={() => setSheet('none')} />}
        {sheet === 'prix' && <PricesPanel recipe={recipe} kitchen={kitchen} />}
      </Sheet>
    </Screen>
  );
}

const PORTION_CHOICES = [0.5, 1, 1.5, 2, 3];

function EatPanel({ recipe, kitchen, onDone }: { recipe: Recipe; kitchen: KitchenData; onDone: () => void }) {
  const today = useToday();
  const toast = useToast();
  const [servings, setServings] = useState(1);
  const [meal, setMeal] = useState<MealSlot>(defaultMeal());
  const [busy, setBusy] = useState(false);
  const n = recipeNutrition(recipe, servings);
  return (
    <div className="flex flex-col gap-4 pb-1">
      <Chips label="Portions mangées" options={PORTION_CHOICES.map((v) => ({ value: v, label: formatNumber(v, v % 1 ? 1 : 0) }))} selected={[servings]} onToggle={setServings} />
      <Segmented label="Repas" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
      <p className="text-[15px]">
        {formatNumber(n.total.kcal, 0)} kcal, {g1(n.total.proteinG)} g de protéines, {g1(n.total.carbsG)} g de glucides, {g1(n.total.fatG)} g de lipides.
      </p>
      <Button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void eatRecipe(recipe, servings, today, meal, kitchen.prices).then(() => {
            toast.show(`Ajouté au journal : ${portionsText(servings)}, ${formatNumber(n.total.kcal, 0)} kcal`);
            onDone();
          });
        }}
      >
        Ajouter au journal d’aujourd’hui
      </Button>
    </div>
  );
}

export function PlanPanel({ recipe, defaultServings, onDone, initialDate }: { recipe: Recipe; defaultServings: number; onDone: () => void; initialDate?: string }) {
  const today = useToday();
  const toast = useToast();
  const days = [...new Set([...(initialDate ? [initialDate] : []), ...Array.from({ length: 14 }, (_, i) => addDays(today, i))])].sort();
  const [date, setDate] = useState(initialDate ?? today);
  const [meal, setMeal] = useState<MealSlot>('dinner');
  const [servings, setServings] = useState(defaultServings);
  return (
    <div className="flex flex-col gap-4 pb-1">
      <SelectField
        label="Jour"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        options={days.map((d, i) => ({ value: d, label: i === 0 ? 'Aujourd’hui' : i === 1 ? 'Demain' : formatDayShort(d) }))}
      />
      <Segmented label="Repas" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />
      <Chips label="Portions" options={PORTION_CHOICES.map((v) => ({ value: v, label: formatNumber(v, v % 1 ? 1 : 0) }))} selected={[servings]} onToggle={setServings} />
      <p className="text-[13px] text-cendre">Un repas planifié n’entre pas dans ton journal : tu le marqueras « mangé » dans le planning.</p>
      <Button
        onClick={() =>
          void planRecipe(recipe.key, date, meal, servings).then(() => {
            toast.show('Repas planifié');
            onDone();
          })
        }
      >
        Planifier {recipe.name.length > 24 ? 'ce repas' : recipe.name}
      </Button>
    </div>
  );
}

function ListPanel({ recipe, kitchen, servings, onDone }: { recipe: Recipe; kitchen: KitchenData; servings: number; onDone: () => void }) {
  const lists = useShoppingLists();
  const today = useToday();
  const toast = useToast();
  const navigate = useNavigate();
  const addTo = async (listId: string) => {
    const list = lists?.find((l) => l.id === listId);
    if (!list) return;
    const selections = [...list.selections, { recipeKey: recipe.key, servings }];
    const resolved = selections
      .map((s) => ({ recipe: kitchen.byKey.get(s.recipeKey), servings: s.servings }))
      .filter((s): s is { recipe: Recipe; servings: number } => Boolean(s.recipe));
    const checked = new Set(list.items.filter((i) => i.checked).map((i) => i.key));
    const items = buildShoppingItems(resolved).map((i) => ({ ...i, checked: checked.has(i.key) }));
    await repos.shoppingLists.update(list.id, { selections, items });
    toast.show(`Ajoutée à « ${list.name} »`);
    onDone();
  };
  return (
    <div className="flex flex-col gap-3 pb-1">
      <p className="text-[15px] text-cendre">
        {recipe.name}, {portionsText(servings)}.
      </p>
      <Button
        onClick={() =>
          void createShoppingList(`Courses du ${formatDayShort(today).toLocaleLowerCase('fr-FR')}`, [{ recipe, servings }]).then((list) => {
            onDone();
            navigate(`/nutrition/courses/${list.id}`, { viewTransition: true });
          })
        }
      >
        Nouvelle liste de courses
      </Button>
      {lists && lists.length > 0 && (
        <>
          <p className="text-[13px] text-cendre">Ou ajoute-la à une liste existante :</p>
          <ul className="flex flex-col gap-2">
            {lists.slice(0, 6).map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => void addTo(l.id)}
                  className="flex min-h-12 w-full items-center justify-between rounded-[14px] bg-graphite px-4 text-left text-[15px]"
                >
                  {l.name}
                  <span className="text-[13px] text-cendre">{l.items.length} articles</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const UNIT_CHOICES = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'L', label: 'L' },
  { value: 'piece', label: 'pièce(s)' },
];

/** Prix des ingrédients : ce que tu as payé et pour quelle quantité. Sert au coût des portions. */
export function PricesPanel({ recipe, kitchen }: { recipe: Recipe; kitchen: KitchenData }) {
  const [editing, setEditing] = useState<string | null>(null);
  const unique = recipe.ingredients.filter((ing, i, all) => all.findIndex((x) => x.key === ing.key) === i);
  return (
    <div className="flex flex-col gap-2 pb-1">
      <p className="text-[13px] leading-snug text-cendre">
        Indique le prix payé et la quantité du paquet : FORGE calcule le coût des quantités utilisées. Les prix servent à toutes tes recettes.
      </p>
      <ul className="flex flex-col">
        {unique.map((ing) => {
          const price = kitchen.prices.get(ing.key);
          return (
            <li key={ing.key} className="border-b border-graphite py-2 last:border-b-0">
              <div className="flex min-h-11 items-center justify-between gap-3">
                <span className="min-w-0 text-[15px]">{ing.name}</span>
                <button type="button" onClick={() => setEditing(editing === ing.key ? null : ing.key)} className="min-h-11 shrink-0 text-right text-[13px] text-citron">
                  {price ? `${formatEur(price.amountEur)} pour ${g1(price.quantity)} ${price.unit === 'piece' ? 'pièce(s)' : price.unit}` : 'Saisir le prix'}
                </button>
              </div>
              {editing === ing.key && <PriceForm ingredient={ing} onDone={() => setEditing(null)} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PriceForm({ ingredient, onDone }: { ingredient: Pick<Recipe['ingredients'][number], 'key' | 'name' | 'ml' | 'unit'>; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(ingredient.ml ? 'L' : 'kg');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const a = parseDecimal(amount);
    const q = parseDecimal(quantity);
    if (a === null || a <= 0) return setError('Indique le prix payé.');
    if (q === null || q <= 0) return setError('Indique la quantité achetée.');
    if (unit === 'piece' && !ingredient.unit) return setError('Cet ingrédient se compte en grammes : choisis g ou kg.');
    const [qty, u] = unit === 'kg' ? [q * 1000, 'g'] : unit === 'L' ? [q * 1000, 'ml'] : [q, unit];
    await repos.prices.setPrice({ key: ingredient.key, name: ingredient.name, amountEur: Math.round(a * 100) / 100, quantity: qty, unit: u as 'g' | 'ml' | 'piece' });
    onDone();
  };
  return (
    <div className="flex flex-col gap-2 pb-2">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Prix payé" suffix="€" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} maxLength={7} />
        <Field label="Quantité" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} maxLength={7} />
        <SelectField label="Unité" value={unit} onChange={(e) => setUnit(e.target.value)} options={UNIT_CHOICES.filter((u) => u.value !== 'piece' || ingredient.unit)} />
      </div>
      {error && (
        <p className="text-[13px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button size="small" onClick={() => void save()}>
        Enregistrer le prix
      </Button>
    </div>
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
