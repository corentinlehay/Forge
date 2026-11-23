import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CATEGORY_LABELS, type FoodTag } from '../../data/recipes';
import { useFoodEntries, useMealPlans, useProfile, useShoppingLists, useToday } from '../../db/hooks';
import { dayNutrition } from '../../domain/nutrition';
import { weekStart } from '../../domain/training';
import {
  EMPTY_FILTERS,
  filterRecipes,
  formatEur,
  recipeCost,
  recipeNutrition,
  TAG_LABELS,
  totalMinutes,
  type CategoryFilter,
  type KitchenPrefs,
  type Recipe,
  type RecipeFilters,
} from '../../domain/kitchen';
import { addDays } from '../../lib/dates';
import { formatNumber, parseDecimal } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { TextArea } from '../../ui/TextArea';
import { useToast } from '../../ui/Toast';
import { ImportError, importRecipe, savePrefs } from './kitchenActions';
import { RecipeVisual } from './RecipeVisual';
import { useKitchen, type KitchenData } from './useKitchen';

const CATEGORY_CHIPS: { value: CategoryFilter | 'toutes'; label: string }[] = [
  { value: 'toutes', label: 'Toutes' },
  { value: 'favoris', label: 'Favoris' },
  { value: 'perso', label: 'Mes recettes' },
  { value: 'petit-dejeuner', label: CATEGORY_LABELS['petit-dejeuner'] },
  { value: 'dejeuner', label: CATEGORY_LABELS.dejeuner },
  { value: 'diner', label: CATEGORY_LABELS.diner },
  { value: 'collation', label: 'Collations' },
  { value: 'dessert', label: 'Desserts' },
  { value: 'rapide', label: 'Repas rapides' },
  { value: 'meal-prep', label: CATEGORY_LABELS['meal-prep'] },
  { value: 'economique', label: 'Économiques' },
  { value: 'plaisir', label: CATEGORY_LABELS.plaisir },
  { value: 'proteine', label: 'Riches en protéines' },
];

export function recipeMeta(r: Recipe): string {
  const n = recipeNutrition(r, 1).perServing;
  return `${totalMinutes(r)} min, ${formatNumber(n.kcal, 0)} kcal, ${formatNumber(n.proteinG, 0)} g de protéines`;
}

/** Bibliothèque de recettes FORGE et perso : recherche, catégories, filtres, préférences. */
export function KitchenScreen() {
  const kitchen = useKitchen();
  const navigate = useNavigate();
  const toast = useToast();
  const [filters, setFilters] = useState<RecipeFilters>(EMPTY_FILTERS);
  const [sheet, setSheet] = useState<'none' | 'filtres' | 'preferences'>('none');
  const fileInput = useRef<HTMLInputElement>(null);

  const result = useMemo(() => (kitchen ? filterRecipes(kitchen.recipes, filters, kitchen) : null), [kitchen, filters]);
  const activeFilters = [filters.maxKcal, filters.minProtein, filters.maxMinutes, filters.maxDifficulty, filters.maxCostPerServing].filter((v) => v !== null).length;

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const record = await importRecipe(await file.text());
      toast.show('Recette importée');
      navigate(`/nutrition/recettes/${record.id}`, { viewTransition: true });
    } catch (e) {
      toast.show(e instanceof ImportError ? e.message : 'Import impossible.');
    }
  };

  return (
    <Screen withTabBar={false}>
      <Link to="/nutrition" viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
        <Icon name="back" size={20} />
        Nutrition
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-metal text-[40px]">Recettes</h1>
        <Button size="small" variant="secondary" onClick={() => navigate('/nutrition/recettes/nouvelle', { viewTransition: true })}>
          <Icon name="plus" size={18} />
          Créer
        </Button>
      </div>

      <KitchenNav />

      <Field
        label="Chercher une recette ou un ingrédient"
        value={filters.query}
        onChange={(e) => setFilters({ ...filters, query: e.target.value })}
        maxLength={60}
        placeholder="Ex. poulet, pâtes, dessert"
        enterKeyHint="search"
      />
      <Chips
        label="Catégorie"
        hideLabel
        layout="scroll"
        options={CATEGORY_CHIPS}
        selected={[filters.category ?? 'toutes']}
        onToggle={(v) => setFilters({ ...filters, category: v === 'toutes' ? null : (v as CategoryFilter) })}
      />
      <div className="flex gap-2">
        <Button variant="secondary" size="small" onClick={() => setSheet('filtres')}>
          Filtres{activeFilters ? ` (${activeFilters})` : ''}
        </Button>
        <Button variant="secondary" size="small" onClick={() => setSheet('preferences')}>
          Préférences
        </Button>
      </div>

      {!kitchen || !result ? (
        <p className="text-[15px] text-cendre">Chargement des recettes…</p>
      ) : (
        <>
          {result.hiddenByPrefs > 0 && (
            <button
              type="button"
              onClick={() => setFilters({ ...filters, showBlocked: true })}
              className="self-start text-left text-[13px] text-cendre underline underline-offset-2"
            >
              {result.hiddenByPrefs} recette{result.hiddenByPrefs > 1 ? 's' : ''} masquée{result.hiddenByPrefs > 1 ? 's' : ''} par tes préférences : les afficher
            </button>
          )}
          {result.recipes.length === 0 ? (
            <p className="text-[15px] text-cendre">Aucune recette ne correspond. Élargis les filtres ou crée la tienne.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {result.recipes.map((r) => (
                <li key={r.key}>
                  <RecipeCard recipe={r} kitchen={kitchen} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onImport(e.target.files?.[0])} />
      <Button variant="quiet" className="self-center" onClick={() => fileInput.current?.click()}>
        Importer une recette (fichier FORGE)
      </Button>
      <p className="text-[12px] leading-snug text-cendre">
        Valeurs nutritionnelles des recettes FORGE calculées à partir de la table Ciqual 2025 (Anses). Les prix sont ceux que tu saisis.
      </p>

      <Sheet open={sheet === 'filtres'} title="Filtres" onClose={() => setSheet('none')}>
        {sheet === 'filtres' && <FiltersPanel filters={filters} onChange={setFilters} onDone={() => setSheet('none')} />}
      </Sheet>
      <Sheet open={sheet === 'preferences'} title="Préférences" onClose={() => setSheet('none')}>
        {sheet === 'preferences' && kitchen && (
          <PrefsPanel
            prefs={kitchen.prefs}
            onSaved={() => {
              setSheet('none');
              setFilters({ ...filters, showBlocked: false });
              toast.show('Préférences enregistrées');
            }}
          />
        )}
      </Sheet>
    </Screen>
  );
}

function RecipeCard({ recipe, kitchen }: { recipe: Recipe; kitchen: KitchenData }) {
  const cost = recipeCost(recipe, 1, kitchen.prices).perServing;
  return (
    <Link to={`/nutrition/recettes/${recipe.key}`} viewTransition className="flex h-full flex-col overflow-hidden rounded-[18px] bg-anthracite active:scale-[0.99]">
      <RecipeVisual recipe={recipe} photo={kitchen.photos.get(recipe.key)} className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-[15px] leading-tight font-semibold">
          {kitchen.favorites.has(recipe.key) && <Icon name="star" size={13} className="mr-1 inline-block align-[-1px] text-citron" />}
          {recipe.name}
        </p>
        <p className="mt-auto text-[12px] leading-snug text-cendre">{recipeMeta(recipe)}</p>
        {cost !== null && <p className="text-[12px] text-craie">{formatEur(cost)} par portion</p>}
      </div>
    </Link>
  );
}

/** Raccourcis : Compose mon repas, planning de la semaine, listes de courses. */
function KitchenNav() {
  const today = useToday();
  const profile = useProfile();
  const entries = useFoodEntries();
  const plans = useMealPlans();
  const lists = useShoppingLists();
  const day = entries && profile ? dayNutrition(entries, today, profile.nutritionTargets) : null;
  const start = weekStart(today);
  const planned = plans?.filter((p) => p.status === 'planned' && p.date >= start && p.date <= addDays(start, 6)).length ?? 0;
  const tiles = [
    {
      to: '/nutrition/compose',
      title: 'Compose mon repas',
      sub: day?.remainingKcal !== null && day?.remainingKcal !== undefined ? `${formatNumber(Math.max(0, day.remainingKcal), 0)} kcal restantes` : 'Selon ce qu’il te reste',
    },
    { to: '/nutrition/planning', title: 'Planning', sub: planned ? `${planned} repas prévu${planned > 1 ? 's' : ''}` : 'Semaine à prévoir' },
    { to: '/nutrition/courses', title: 'Courses', sub: lists?.length ? `${lists.length} liste${lists.length > 1 ? 's' : ''}` : 'Aucune liste' },
  ];
  return (
    <nav aria-label="Kitchen" className="grid grid-cols-3 gap-2">
      {tiles.map((t) => (
        <Link key={t.to} to={t.to} viewTransition className="flex min-h-[76px] flex-col justify-between rounded-[16px] bg-anthracite p-3 active:scale-[0.98]">
          <span className="text-[15px] leading-tight font-semibold">{t.title}</span>
          <span className="text-[12px] leading-tight text-cendre">{t.sub}</span>
        </Link>
      ))}
    </nav>
  );
}

function FiltersPanel({ filters, onChange, onDone }: { filters: RecipeFilters; onChange: (f: RecipeFilters) => void; onDone: () => void }) {
  const pick = <K extends keyof RecipeFilters>(key: K, value: RecipeFilters[K]) => onChange({ ...filters, [key]: filters[key] === value ? null : value });
  return (
    <div className="flex flex-col gap-4 pb-1">
      <Chips
        label="Calories par portion, au plus"
        options={[300, 500, 700, 900].map((v) => ({ value: v, label: `${v} kcal` }))}
        selected={filters.maxKcal ? [filters.maxKcal] : []}
        onToggle={(v) => pick('maxKcal', v)}
      />
      <Chips
        label="Protéines par portion, au moins"
        options={[15, 25, 35, 45].map((v) => ({ value: v, label: `${v} g` }))}
        selected={filters.minProtein ? [filters.minProtein] : []}
        onToggle={(v) => pick('minProtein', v)}
      />
      <Chips
        label="Temps total, au plus"
        options={[10, 20, 30, 45, 60].map((v) => ({ value: v, label: `${v} min` }))}
        selected={filters.maxMinutes ? [filters.maxMinutes] : []}
        onToggle={(v) => pick('maxMinutes', v)}
      />
      <Chips
        label="Difficulté"
        options={[
          { value: 1, label: 'Facile' },
          { value: 2, label: 'Jusqu’à moyen' },
        ]}
        selected={filters.maxDifficulty ? [filters.maxDifficulty] : []}
        onToggle={(v) => pick('maxDifficulty', v as 1 | 2)}
      />
      <Chips
        label="Budget par portion, au plus"
        options={[1, 2, 3, 5].map((v) => ({ value: v, label: formatEur(v) }))}
        selected={filters.maxCostPerServing ? [filters.maxCostPerServing] : []}
        onToggle={(v) => pick('maxCostPerServing', v)}
      />
      <p className="-mt-2 text-[12px] text-cendre">Le budget ne retient que les recettes dont tous les prix sont renseignés.</p>
      <Button onClick={onDone}>Voir les recettes</Button>
      <Button variant="quiet" onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query, category: filters.category })}>
        Effacer les filtres
      </Button>
    </div>
  );
}

const EXCLUDABLE: FoodTag[] = ['gluten', 'lait', 'oeuf', 'poisson', 'crustaces', 'arachide', 'fruits-a-coque', 'soja', 'moutarde', 'sesame', 'porc'];
const words = (text: string) =>
  text
    .split(/[,\n]/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 30);

function PrefsPanel({ prefs, onSaved }: { prefs: KitchenPrefs; onSaved: () => void }) {
  const [exclude, setExclude] = useState<FoodTag[]>(prefs.exclude);
  const [vegetarian, setVegetarian] = useState(prefs.vegetarian);
  const [liked, setLiked] = useState(prefs.liked.join(', '));
  const [disliked, setDisliked] = useState(prefs.disliked.join(', '));
  const [budget, setBudget] = useState(prefs.budgetPerServing !== null ? String(prefs.budgetPerServing).replace('.', ',') : '');
  const [minutes, setMinutes] = useState(prefs.maxMinutes !== null ? String(prefs.maxMinutes) : '');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const b = budget.trim() ? parseDecimal(budget) : null;
    if (budget.trim() && (b === null || b <= 0 || b > 100)) return setError('Budget par portion entre 0,01 et 100 €.');
    const m = minutes.trim() ? Number(minutes) : null;
    if (m !== null && (!Number.isInteger(m) || m < 5 || m > 600)) return setError('Temps maximal entre 5 et 600 minutes.');
    await savePrefs({ exclude, vegetarian, liked: words(liked), disliked: words(disliked), budgetPerServing: b, maxMinutes: m });
    onSaved();
  };

  return (
    <div className="flex flex-col gap-4 pb-1">
      <Chips
        label="Allergènes et exclusions"
        options={EXCLUDABLE.map((t) => ({ value: t, label: TAG_LABELS[t] }))}
        selected={exclude}
        onToggle={(t) => setExclude((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))}
      />
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-[16px] bg-graphite px-4 py-3">
        <span className="text-[15px]">Végétarien (sans viande ni poisson)</span>
        <input type="checkbox" checked={vegetarian} onChange={(e) => setVegetarian(e.target.checked)} className="h-6 w-6 accent-[var(--color-citron)]" />
      </label>
      <p className="-mt-2 text-[12px] leading-snug text-cendre">
        Allergènes repérés à partir des ingrédients des recettes FORGE. Pour tes ingrédients perso ou importés, FORGE ne les connaît pas : vérifie toujours les étiquettes.
      </p>
      <TextArea
        label="Aliments que tu aimes (mis en avant)"
        hint="séparés par des virgules"
        value={liked}
        onChange={(e) => setLiked(e.target.value)}
        rows={2}
        maxLength={600}
        placeholder="Ex. poulet, banane"
      />
      <TextArea
        label="Aliments détestés ou à éviter (recettes masquées)"
        hint="séparés par des virgules"
        value={disliked}
        onChange={(e) => setDisliked(e.target.value)}
        rows={2}
        maxLength={600}
        placeholder="Ex. champignons, feta"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Budget par portion" suffix="€" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} maxLength={6} />
        <Field label="Temps maximal" suffix="min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} maxLength={3} />
      </div>
      <p className="-mt-2 text-[12px] text-cendre">Budget et temps servent de valeurs de départ dans « Compose mon repas ».</p>
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void save()}>Enregistrer les préférences</Button>
    </div>
  );
}
