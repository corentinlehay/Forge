import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AISLE_LABELS, CATEGORY_LABELS, CIQUAL_TAGS, type Aisle, type Glyph, type RecipeCategory } from '../../data/recipes';
import { repos, useFoods } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { Food, RecipeIngredient } from '../../db/types';
import { normalize, searchLocal, type OffProduct } from '../../domain/food';
import { recipeNutrition } from '../../domain/kitchen';
import { formatNumber, parseDecimal } from '../../lib/format';
import { CIQUAL_CREDIT, loadCiqual, type CiqualFood } from '../../services/ciqual';
import { OffError, searchProducts } from '../../services/openFoodFacts';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { SelectField } from '../../ui/SelectField';
import { Sheet } from '../../ui/Sheet';
import { TextArea } from '../../ui/TextArea';
import { useToast } from '../../ui/Toast';
import { IconButton } from '../training/TemplateScreen';
import { moveItem } from '../../domain/workoutFlow';
import { GLYPH_OPTIONS, GLYPHS } from './RecipeVisual';
import { useKitchen } from './useKitchen';

const CATEGORIES = Object.keys(CATEGORY_LABELS).filter((c) => c !== 'rapide' && c !== 'proteine') as RecipeCategory[];
const AISLES = (Object.keys(AISLE_LABELS) as Aisle[]).map((a) => ({ value: a, label: AISLE_LABELS[a] }));

/** Rayon probable d'un aliment Ciqual, d'après son groupe et son nom. */
export function aisleFor(group: string, name: string): Aisle {
  const n = normalize(name);
  const g = normalize(group);
  if (n.includes('surgel')) return 'surgeles';
  if (n.includes('appertis') || n.includes('conserve')) return 'conserves';
  if (/fruits|legumes|herbes|pommes de terre|crudites|algues/.test(g) && !g.includes('fruits a coque')) return 'fruits-legumes';
  if (/viandes|charcuteries|poissons|mollusques|crustaces|produits a base de poissons/.test(g)) return 'viandes-poissons';
  if (/laits|laitiers|fromages|oeufs|beurres|cremes/.test(g)) return 'cremerie';
  if (/pains|pates, riz|farines|cereales|legumineuses|pates a tarte/.test(g)) return 'feculents';
  return 'epicerie';
}

interface Draft {
  name: string;
  description: string;
  categories: RecipeCategory[];
  servings: string;
  prepMin: string;
  cookMin: string;
  difficulty: 1 | 2 | 3;
  glyph: Glyph;
  ingredients: RecipeIngredient[];
  steps: string;
  storage: string;
}

/** Création et modification d'une recette perso : valeurs et coût recalculés à chaque changement. */
export function RecipeEditor() {
  const { key } = useParams();
  const kitchen = useKitchen();
  if (!kitchen)
    return (
      <Screen withTabBar={false}>
        <BackLink to="/nutrition/recettes" />
      </Screen>
    );
  const record = key ? kitchen.records.find((r) => r.id === key) : null;
  if (key && !record) {
    return (
      <Screen withTabBar={false}>
        <BackLink to="/nutrition/recettes" />
        <p className="text-[17px]">Seules tes recettes perso se modifient. Duplique une recette FORGE pour l’adapter.</p>
      </Screen>
    );
  }
  const initial: Draft = record
    ? {
        name: record.name,
        description: record.description,
        categories: record.categories,
        servings: String(record.servings),
        prepMin: String(record.prepMin),
        cookMin: String(record.cookMin),
        difficulty: record.difficulty,
        glyph: record.glyph,
        ingredients: record.ingredients,
        steps: record.steps.join('\n'),
        storage: record.storage,
      }
    : { name: '', description: '', categories: [], servings: '2', prepMin: '10', cookMin: '0', difficulty: 1, glyph: 'assiette', ingredients: [], steps: '', storage: '' };
  return <Editor key={key ?? 'nouvelle'} recordId={record?.id ?? null} initial={initial} />;
}

function Editor({ recordId, initial }: { recordId: string | null; initial: Draft }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [d, setD] = useState<Draft>(initial);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Draft>) => {
    setError(null);
    setD((cur) => ({ ...cur, ...patch }));
  };
  const servings = Number(d.servings) || 1;
  const n = recipeNutrition({ ingredients: d.ingredients, servings }, servings);
  const back = recordId ? `/nutrition/recettes/${recordId}` : '/nutrition/recettes';

  const updateIngredient = (index: number, patch: Partial<RecipeIngredient>) => set({ ingredients: d.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)) });

  const save = async () => {
    const s = Number(d.servings);
    const prep = Number(d.prepMin || 0);
    const cook = Number(d.cookMin || 0);
    if (!d.name.trim()) return setError('Donne un nom à la recette.');
    if (!Number.isInteger(s) || s < 1 || s > 50) return setError('Nombre de portions entre 1 et 50.');
    if (!Number.isInteger(prep) || !Number.isInteger(cook) || prep < 0 || cook < 0 || prep > 1440 || cook > 1440) return setError('Temps en minutes entières, 1 440 au plus.');
    if (!d.ingredients.length) return setError('Ajoute au moins un ingrédient.');
    const fields = {
      name: d.name.trim(),
      description: d.description.trim(),
      categories: d.categories,
      servings: s,
      prepMin: prep,
      cookMin: cook,
      difficulty: d.difficulty,
      glyph: d.glyph,
      ingredients: d.ingredients,
      steps: d.steps
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean),
      storage: d.storage.trim(),
    };
    setBusy(true);
    try {
      const saved = recordId ? await repos.recipes.update(recordId, fields) : await repos.recipes.add({ ...fields, origin: null });
      toast.show(recordId ? 'Recette enregistrée' : 'Recette créée');
      navigate(`/nutrition/recettes/${saved.id}`, { replace: true, viewTransition: true });
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'L’enregistrement a échoué. Réessaie.');
      setBusy(false);
    }
  };

  return (
    <Screen withTabBar={false}>
      <BackLink to={back} />
      <h1 className="font-metal text-[40px] leading-none">{recordId ? 'Modifier la recette' : 'Nouvelle recette'}</h1>
      <Field label="Nom" value={d.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} placeholder="Ex. Bowl de la semaine" />
      <TextArea label="Description (facultatif)" value={d.description} onChange={(e) => set({ description: e.target.value })} maxLength={400} rows={2} />
      <Chips
        label="Catégories"
        options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
        selected={d.categories}
        onToggle={(c) => set({ categories: d.categories.includes(c) ? d.categories.filter((x) => x !== c) : [...d.categories, c] })}
      />
      <div className="grid grid-cols-3 gap-2">
        <Field label="Portions" inputMode="numeric" value={d.servings} onChange={(e) => set({ servings: e.target.value.replace(/\D/g, '') })} maxLength={2} />
        <Field label="Préparation" suffix="min" inputMode="numeric" value={d.prepMin} onChange={(e) => set({ prepMin: e.target.value.replace(/\D/g, '') })} maxLength={4} />
        <Field label="Cuisson" suffix="min" inputMode="numeric" value={d.cookMin} onChange={(e) => set({ cookMin: e.target.value.replace(/\D/g, '') })} maxLength={4} />
      </div>
      <Chips
        label="Difficulté"
        options={[
          { value: 1, label: 'Facile' },
          { value: 2, label: 'Moyen' },
          { value: 3, label: 'Plus technique' },
        ]}
        selected={[d.difficulty]}
        onToggle={(v) => set({ difficulty: v as 1 | 2 | 3 })}
      />
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-[13px] text-cendre">Visuel (sans photo)</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {GLYPH_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={d.glyph === g}
              aria-label={`Pictogramme ${g}`}
              onClick={() => set({ glyph: g })}
              className={`flex aspect-square items-center justify-center rounded-[10px] ${d.glyph === g ? 'bg-citron text-noir' : 'bg-graphite text-craie'}`}
            >
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={GLYPHS[g]} />
              </svg>
            </button>
          ))}
        </div>
      </fieldset>

      <section aria-label="Ingrédients" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold">Ingrédients</h2>
          <span className="text-[13px] text-cendre">
            pour {servings} portion{servings > 1 ? 's' : ''}
          </span>
        </div>
        {d.ingredients.map((ing, i) => (
          <div key={`${ing.key}-${i}`} className="flex flex-col gap-2 rounded-[16px] bg-anthracite p-3">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 pt-2 text-[15px] leading-tight">
                {ing.name}
                {!ing.per100 && <span className="block text-[12px] text-braise">Sans valeurs nutritionnelles</span>}
              </p>
              <div className="-mr-1.5 flex shrink-0">
                <IconButton icon="up" label={`Monter ${ing.name}`} disabled={i === 0} onClick={() => set({ ingredients: moveItem(d.ingredients, i, -1) })} />
                <IconButton icon="close" label={`Retirer ${ing.name}`} onClick={() => set({ ingredients: d.ingredients.filter((_, j) => j !== i) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Quantité"
                suffix={ing.ml ? 'ml' : 'g'}
                inputMode="decimal"
                defaultValue={formatNumber(ing.grams, ing.grams % 1 ? 1 : 0).replace(/\s/g, '')}
                onChange={(e) => {
                  const v = parseDecimal(e.target.value);
                  if (v !== null && v > 0) updateIngredient(i, { grams: v });
                }}
                maxLength={6}
              />
              <SelectField label="Rayon" value={ing.aisle} onChange={(e) => updateIngredient(i, { aisle: e.target.value as Aisle })} options={AISLES} />
            </div>
          </div>
        ))}
        <Button variant="secondary" onClick={() => setPicking(true)}>
          <Icon name="plus" size={18} />
          Ajouter un ingrédient
        </Button>
        {d.ingredients.length > 0 && (
          <p className="text-[15px]">
            Par portion : <span className="font-semibold">{formatNumber(n.perServing.kcal, 0)} kcal</span>, {formatNumber(n.perServing.proteinG, 0)} g de protéines,{' '}
            {formatNumber(n.perServing.carbsG, 0)} g de glucides, {formatNumber(n.perServing.fatG, 0)} g de lipides
            {n.missing.length ? ` (sans : ${n.missing.join(', ')})` : ''}.
          </p>
        )}
      </section>

      <TextArea label="Étapes" hint="une par ligne" value={d.steps} onChange={(e) => set({ steps: e.target.value })} maxLength={6000} rows={6} />
      <TextArea label="Conservation (facultatif)" value={d.storage} onChange={(e) => set({ storage: e.target.value })} maxLength={600} rows={2} />
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void save()} disabled={busy}>
        {recordId ? 'Enregistrer la recette' : 'Créer la recette'}
      </Button>

      <Sheet open={picking} title="Ajouter un ingrédient" onClose={() => setPicking(false)}>
        {picking && (
          <IngredientPicker
            onAdd={(ing) => {
              set({ ingredients: [...d.ingredients, ing] });
              setPicking(false);
            }}
          />
        )}
      </Sheet>
    </Screen>
  );
}

type Candidate =
  | { kind: 'food'; food: Food; name: string; brand?: string }
  | { kind: 'ciqual'; food: CiqualFood; name: string }
  | { kind: 'off'; product: OffProduct; name: string; brand?: string };

/** Recherche dans tes aliments, la table Ciqual et Open Food Facts ; ou ingrédient sans valeurs. */
function IngredientPicker({ onAdd }: { onAdd: (ing: RecipeIngredient) => void }) {
  const foods = useFoods();
  const [ciqual, setCiqual] = useState<CiqualFood[] | null>(null);
  const [query, setQuery] = useState('');
  const [off, setOff] = useState<{ state: 'loading' | 'done' | 'error'; results: OffProduct[]; error?: string } | null>(null);
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const [free, setFree] = useState(false);
  const [grams, setGrams] = useState('');
  const [freeName, setFreeName] = useState('');
  const [aisle, setAisle] = useState<Aisle>('epicerie');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCiqual().then((c) => setCiqual(c.foods));
  }, []);

  const local = useMemo<Candidate[]>(() => {
    if (query.trim().length < 2) return [];
    const rows: Candidate[] = [
      ...(foods ?? []).map((food): Candidate => ({ kind: 'food', food, name: food.name, ...(food.brand ? { brand: food.brand } : {}) })),
      ...(ciqual ?? []).filter((c) => !foods?.some((f) => f.source === 'ciqual' && f.sourceId === c.code)).map((food): Candidate => ({ kind: 'ciqual', food, name: food.name })),
    ];
    return searchLocal(rows, query, 25);
  }, [query, foods, ciqual]);

  const pick = (c: Candidate) => {
    setChosen(c);
    setError(null);
    setGrams('');
    setAisle(c.kind === 'ciqual' ? aisleFor(c.food.group, c.food.name) : 'epicerie');
  };

  const add = () => {
    const g = parseDecimal(grams);
    if (g === null || g <= 0 || g > 20000) return setError('Quantité entre 0,1 g et 20 kg.');
    if (free) {
      if (!freeName.trim()) return setError('Donne un nom à l’ingrédient.');
      return onAdd({ key: `libre:${normalize(freeName)}`, name: freeName.trim().slice(0, 160), grams: g, per100: null, aisle, unit: null, ml: false, tags: null });
    }
    if (!chosen) return;
    if (chosen.kind === 'ciqual') {
      return onAdd({
        key: `ciqual:${chosen.food.code}`,
        name: chosen.food.name.slice(0, 160),
        grams: g,
        per100: chosen.food.per100,
        aisle,
        unit: null,
        ml: false,
        tags: CIQUAL_TAGS[chosen.food.code] ?? null,
      });
    }
    if (chosen.kind === 'off') {
      const p = chosen.product;
      return onAdd({
        key: `off:${p.code}`,
        name: `${p.name}${p.brand ? `, ${p.brand}` : ''}`.slice(0, 160),
        grams: g,
        per100: p.per100,
        aisle,
        unit: null,
        ml: p.unit === 'ml',
        tags: null,
      });
    }
    const f = chosen.food;
    const key = f.source === 'ciqual' && f.sourceId ? `ciqual:${f.sourceId}` : f.source === 'off' && f.sourceId ? `off:${f.sourceId}` : `perso:${f.id}`;
    return onAdd({
      key,
      name: f.name.slice(0, 160),
      grams: g,
      per100: f.per100,
      aisle,
      unit: null,
      ml: f.unit === 'ml',
      tags: f.source === 'ciqual' && f.sourceId ? (CIQUAL_TAGS[f.sourceId] ?? null) : null,
    });
  };

  if (chosen || free) {
    const name = free ? null : chosen!.name;
    const ml = !free && ((chosen!.kind === 'off' && chosen!.product.unit === 'ml') || (chosen!.kind === 'food' && chosen!.food.unit === 'ml'));
    return (
      <div className="flex flex-col gap-3 pb-1">
        <Button
          variant="quiet"
          className="-ml-2 self-start"
          onClick={() => {
            setChosen(null);
            setFree(false);
          }}
        >
          <Icon name="back" size={18} />
          Retour à la recherche
        </Button>
        {name ? (
          <p className="text-[17px] font-semibold">{name}</p>
        ) : (
          <Field label="Nom de l’ingrédient" value={freeName} onChange={(e) => setFreeName(e.target.value)} maxLength={80} />
        )}
        {free && <p className="text-[13px] text-cendre">Sans valeurs nutritionnelles : il comptera dans les courses, pas dans les calories.</p>}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Quantité" suffix={ml ? 'ml' : 'g'} inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} maxLength={6} />
          <SelectField label="Rayon" value={aisle} onChange={(e) => setAisle(e.target.value as Aisle)} options={AISLES} />
        </div>
        {error && (
          <p className="text-[15px] text-braise" role="alert">
            {error}
          </p>
        )}
        <Button onClick={add}>Ajouter à la recette</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-1">
      <Field
        label="Chercher un aliment"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOff(null);
        }}
        maxLength={60}
        placeholder="Ex. riz basmati, skyr"
        enterKeyHint="search"
      />
      <ul className="flex flex-col">
        {local.map((c) => (
          <li key={c.kind === 'food' ? c.food.id : c.kind === 'ciqual' ? c.food.code : c.product.code} className="border-b border-graphite last:border-b-0">
            <button type="button" onClick={() => pick(c)} className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left">
              <span className="min-w-0 text-[15px] leading-snug">
                {c.name}
                <span className="block text-[12px] text-cendre">{c.kind === 'food' ? (c.food.source === 'custom' ? 'Perso' : 'Mes aliments') : 'Ciqual'}</span>
              </span>
              <Icon name="plus" size={18} className="shrink-0 text-module" />
            </button>
          </li>
        ))}
        {off?.results.map((p) => (
          <li key={p.code} className="border-b border-graphite last:border-b-0">
            <button
              type="button"
              onClick={() => pick({ kind: 'off', product: p, name: p.name, ...(p.brand ? { brand: p.brand } : {}) })}
              className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left"
            >
              <span className="min-w-0 text-[15px] leading-snug">
                {p.name}
                <span className="block text-[12px] text-cendre">{p.brand ? `${p.brand}, ` : ''}Open Food Facts</span>
              </span>
              <Icon name="plus" size={18} className="shrink-0 text-module" />
            </button>
          </li>
        ))}
      </ul>
      {query.trim().length >= 2 && (!off || off.state === 'error') && (
        <Button
          variant="secondary"
          onClick={() => {
            setOff({ state: 'loading', results: [] });
            void searchProducts(query.trim())
              .then((results) => setOff({ state: 'done', results }))
              .catch((e: unknown) => setOff({ state: 'error', results: [], error: e instanceof OffError ? e.message : 'La recherche a échoué.' }));
          }}
        >
          Chercher « {query.trim()} » dans Open Food Facts
        </Button>
      )}
      {off?.state === 'loading' && <p className="text-[15px] text-cendre">Recherche dans Open Food Facts…</p>}
      {off?.state === 'error' && <p className="text-[15px] text-braise">{off.error}</p>}
      <Button
        variant="quiet"
        onClick={() => {
          setFree(true);
          setFreeName(query.trim());
          setGrams('');
          setAisle('epicerie');
        }}
      >
        Ajouter un ingrédient sans valeurs nutritionnelles
      </Button>
      <p className="text-[12px] text-cendre">{CIQUAL_CREDIT}</p>
    </div>
  );
}

function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      Retour
    </Link>
  );
}
