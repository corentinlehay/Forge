import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useFoods, useMealTemplates, useToday } from '../../db/hooks';
import type { Food, MealSlot, MealTemplate } from '../../db/types';
import { searchLocal, type OffProduct } from '../../domain/food';
import { MEAL_LABELS } from '../../domain/nutrition';
import { isDateKey } from '../../lib/dates';
import { formatDayShort, formatNumber } from '../../lib/format';
import { loadCiqual, type CiqualFood } from '../../services/ciqual';
import { OffError, searchProducts } from '../../services/openFoodFacts';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { CustomFoodForm } from './CustomFoodForm';
import { defaultMeal, FoodForm } from './FoodSheet';
import { applyTemplate, choiceFromCiqual, choiceFromFood, choiceFromOff, type FoodChoice } from './foodActions';
import { MEAL_OPTIONS, QuantityForm } from './QuantityForm';
import { ScannerPanel } from './ScannerPanel';

type Tab = 'recents' | 'favoris' | 'perso' | 'habituels';
const tabs = [
  { value: 'recents', label: 'Récents' },
  { value: 'favoris', label: 'Favoris' },
  { value: 'perso', label: 'Perso' },
  { value: 'habituels', label: 'Repas' },
] as const;

type SheetState =
  | { kind: 'none' }
  | { kind: 'quantity'; choice: FoodChoice; nonce: number }
  | { kind: 'scanner' }
  | { kind: 'custom'; barcode?: string; editing?: Food }
  | { kind: 'quick' }
  | { kind: 'template'; template: MealTemplate };

type Row = { kind: 'food'; food: Food; name: string; brand?: string } | { kind: 'ciqual'; food: CiqualFood; name: string; brand?: string };

const MEALS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const SOURCE = { off: 'Open Food Facts', ciqual: 'Ciqual', custom: 'Perso' } as const;

/** Ajouter un aliment : recherche (tes aliments, Ciqual, Open Food Facts), scanner, favoris, récents, repas habituels. */
export function AddFoodScreen() {
  const today = useToday();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const foods = useFoods();
  const templates = useMealTemplates();
  const askedDate = params.get('jour');
  const date = askedDate && isDateKey(askedDate) && askedDate <= today ? askedDate : today;
  const askedMeal = params.get('repas') as MealSlot | null;
  const [meal, setMeal] = useState<MealSlot>(askedMeal && MEALS.includes(askedMeal) ? askedMeal : date === today ? defaultMeal() : 'lunch');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('recents');
  const [sheet, setSheet] = useState<SheetState>({ kind: 'none' });
  const [ciqual, setCiqual] = useState<{ version: string; foods: CiqualFood[] } | null>(null);
  const [off, setOff] = useState<{ query: string; state: 'loading' | 'done' | 'error'; results: OffProduct[]; error?: string } | null>(null);

  useEffect(() => {
    void loadCiqual().then(setCiqual);
  }, []);

  const local = useMemo<Row[]>(() => {
    if (!query.trim()) return [];
    const rows: Row[] = [
      ...(foods ?? []).map((food): Row => ({ kind: 'food', food, name: food.name, ...(food.brand ? { brand: food.brand } : {}) })),
      ...(ciqual?.foods ?? [])
        .filter((c) => !foods?.some((f) => f.source === 'ciqual' && f.sourceId === c.code))
        .map((food): Row => ({ kind: 'ciqual', food, name: food.name })),
    ];
    return searchLocal(rows, query, 40);
  }, [query, foods, ciqual]);

  const listed = useMemo(() => {
    const all = foods ?? [];
    if (tab === 'favoris') return all.filter((f) => f.favorite).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    if (tab === 'perso') return all.filter((f) => f.source === 'custom').sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return all.filter((f) => f.lastUsedAt).sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '')).slice(0, 30);
  }, [foods, tab]);

  const searchOff = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setOff({ query: q, state: 'loading', results: [] });
    try {
      setOff({ query: q, state: 'done', results: await searchProducts(q) });
    } catch (e) {
      setOff({ query: q, state: 'error', results: [], error: e instanceof OffError ? e.message : 'La recherche a échoué. Réessaie.' });
    }
  };

  const open = (choice: FoodChoice) => setSheet({ kind: 'quantity', choice, nonce: Date.now() });
  const close = () => setSheet({ kind: 'none' });
  const backTo = `/nutrition${date === today ? '' : `?jour=${date}`}`;

  return (
    <Screen withTabBar={false}>
      <Link to={backTo} viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
        <Icon name="back" size={20} />
        Nutrition
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[40px]">Ajouter</h1>
        <p className="text-[15px] text-cendre">
          {MEAL_LABELS[meal]}, {date === today ? 'aujourd’hui' : formatDayShort(date).toLocaleLowerCase('fr-FR')}
        </p>
      </div>
      <Segmented label="Repas" options={MEAL_OPTIONS} value={meal} onChange={setMeal} />

      <form
        role="search"
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void searchOff();
        }}
      >
        <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-[14px] bg-anthracite px-3 focus-within:outline-2 focus-within:outline-citron">
          <Icon name="search" size={20} className="shrink-0 text-cendre" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOff(null);
            }}
            enterKeyHint="search"
            placeholder="Aliment, produit ou marque"
            aria-label="Chercher un aliment"
            className="h-full min-w-0 flex-1 bg-transparent text-[17px] outline-none focus-visible:outline-none placeholder:text-cendre"
          />
        </label>
        <button type="button" onClick={() => setSheet({ kind: 'scanner' })} aria-label="Scanner un code-barres" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-citron text-noir">
          <Icon name="barcode" size={22} strokeWidth={2} />
        </button>
      </form>

      {query.trim() ? (
        <>
          <section aria-label="Résultats hors ligne" className="flex flex-col">
            <h2 className="mb-1 text-[13px] text-cendre">Tes aliments{ciqual?.version ? ' et Ciqual' : ''}</h2>
            {local.length === 0 ? (
              <p className="py-2 text-[15px] text-cendre">Aucun résultat hors ligne.</p>
            ) : (
              <ul>
                {local.map((row) => (
                  <ResultRow
                    key={row.kind === 'food' ? row.food.id : `c-${row.food.code}`}
                    name={row.name}
                    detail={row.kind === 'food' ? [row.food.brand, SOURCE[row.food.source], stateLabel(row.food.state)] : ['Ciqual', stateLabel(row.food.state)]}
                    kcal={row.food.per100.kcal}
                    protein={row.food.per100.proteinG}
                    unit={row.kind === 'food' ? row.food.unit : 'g'}
                    favorite={row.kind === 'food' && row.food.favorite}
                    onPick={() => open(row.kind === 'food' ? choiceFromFood(row.food) : choiceFromCiqual(row.food))}
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Open Food Facts" className="flex flex-col gap-2">
            <h2 className="text-[13px] text-cendre">Produits du commerce</h2>
            {!off || off.query !== query.trim() ? (
              <Button variant="secondary" onClick={() => void searchOff()} disabled={query.trim().length < 2}>
                <Icon name="search" size={18} />
                Chercher « {query.trim()} » dans Open Food Facts
              </Button>
            ) : off.state === 'loading' ? (
              <p className="text-[15px] text-cendre" aria-live="polite">
                Recherche dans Open Food Facts…
              </p>
            ) : off.state === 'error' ? (
              <p className="text-[15px] text-braise" role="alert">
                {off.error}
              </p>
            ) : off.results.length === 0 ? (
              <p className="text-[15px] text-cendre">Aucun produit trouvé. Essaie un autre nom, la marque, ou scanne le code-barres.</p>
            ) : (
              <ul>
                {off.results.map((p) => (
                  <ResultRow
                    key={p.code}
                    name={p.name}
                    detail={[p.brand, p.packageLabel, p.complete ? undefined : 'fiche incomplète']}
                    kcal={p.per100.kcal}
                    protein={p.per100.proteinG}
                    unit={p.unit}
                    onPick={() => open(choiceFromOff(p))}
                  />
                ))}
              </ul>
            )}
            <p className="text-[12px] text-cendre">Données Open Food Facts, base collaborative (licence ODbL) : vérifie les valeurs sur l’étiquette en cas de doute.</p>
          </section>
        </>
      ) : (
        <>
          <Segmented label="Liste" options={tabs} value={tab} onChange={setTab} />
          {tab === 'habituels' ? (
            templates?.length ? (
              <ul className="flex flex-col gap-2">
                {templates.map((t) => {
                  const kcal = t.items.reduce((s, i) => s + i.kcal, 0);
                  return (
                    <li key={t.id}>
                      <button type="button" onClick={() => setSheet({ kind: 'template', template: t })} className="flex min-h-[60px] w-full items-center justify-between gap-3 rounded-[18px] bg-anthracite px-4 py-3 text-left">
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-semibold">{t.name}</span>
                          <span className="block text-[13px] text-cendre">
                            {t.items.length} aliment{t.items.length > 1 ? 's' : ''}, {formatNumber(kcal, 0)} kcal
                          </span>
                        </span>
                        <Icon name="plus" size={20} className="shrink-0 text-citron" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[15px] leading-snug text-cendre">Aucun repas habituel. Dans le journal, enregistre un repas complet comme repas habituel pour le retrouver ici.</p>
            )
          ) : listed.length ? (
            <ul>
              {listed.map((food) => (
                <ResultRow
                  key={food.id}
                  name={food.name}
                  detail={[food.brand, SOURCE[food.source], stateLabel(food.state)]}
                  kcal={food.per100.kcal}
                  protein={food.per100.proteinG}
                  unit={food.unit}
                  favorite={food.favorite}
                  onPick={() => open(choiceFromFood(food))}
                  onEdit={food.source === 'custom' ? () => setSheet({ kind: 'custom', editing: food }) : undefined}
                />
              ))}
            </ul>
          ) : (
            <p className="text-[15px] leading-snug text-cendre">
              {tab === 'favoris'
                ? 'Aucun favori. Touche l’étoile d’un aliment pour le retrouver ici.'
                : tab === 'perso'
                  ? 'Aucun aliment perso. Crée-en un à partir de son étiquette.'
                  : 'Rien d’ajouté pour l’instant. Cherche un aliment ou scanne un produit.'}
            </p>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button variant="secondary" onClick={() => setSheet({ kind: 'custom' })}>
          Créer un aliment
        </Button>
        <Button variant="secondary" onClick={() => setSheet({ kind: 'quick' })}>
          Saisie rapide
        </Button>
      </div>
      {ciqual && !ciqual.version && <p className="text-[12px] leading-snug text-cendre">La table Ciqual (aliments de base, hors ligne) n’est pas encore intégrée à cette version.</p>}

      <Sheet
        open={sheet.kind !== 'none'}
        title={
          sheet.kind === 'quantity'
            ? sheet.choice.name
            : sheet.kind === 'scanner'
              ? 'Scanner'
              : sheet.kind === 'custom'
                ? sheet.editing
                  ? 'Modifier l’aliment'
                  : 'Nouvel aliment'
                : sheet.kind === 'template'
                  ? sheet.template.name
                  : 'Saisie rapide'
        }
        onClose={close}
      >
        {sheet.kind === 'quantity' && (
          <QuantityForm
            key={sheet.nonce}
            choice={sheet.choice}
            date={date}
            meal={meal}
            onDone={() => {
              close();
              navigate(backTo, { viewTransition: true });
            }}
          />
        )}
        {sheet.kind === 'scanner' && <ScannerPanel onFound={open} onNotFound={(code) => setSheet({ kind: 'custom', barcode: code })} />}
        {sheet.kind === 'custom' && <CustomFoodForm editing={sheet.editing} barcode={sheet.barcode} onSaved={(food) => (sheet.editing ? close() : open(choiceFromFood(food)))} />}
        {sheet.kind === 'quick' && (
          <FoodForm
            date={date}
            meal={meal}
            editing={null}
            onDone={() => {
              close();
              navigate(backTo, { viewTransition: true });
            }}
          />
        )}
        {sheet.kind === 'template' && (
          <div className="flex flex-col gap-3 pb-1">
            <ul className="flex flex-col">
              {sheet.template.items.map((item, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 border-b border-graphite py-2 text-[15px] last:border-b-0">
                  <span className="min-w-0 truncate">
                    {item.name} {item.quantity && <span className="text-cendre">{item.quantity}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatNumber(item.kcal, 0)}</span>
                </li>
              ))}
            </ul>
            <Button
              onClick={async () => {
                const n = await applyTemplate(sheet.template, date, meal);
                toast.show(`${n} aliment${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''}`);
                close();
                navigate(backTo, { viewTransition: true });
              }}
            >
              Ajouter au {MEAL_LABELS[meal].toLocaleLowerCase('fr-FR')}
            </Button>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

function stateLabel(state: Food['state']): string | undefined {
  return state === 'raw' ? 'cru' : state === 'cooked' ? 'cuit' : undefined;
}

function ResultRow({
  name,
  detail,
  kcal,
  protein,
  unit,
  favorite,
  onPick,
  onEdit,
}: {
  name: string;
  detail: (string | undefined | null)[];
  kcal: number;
  protein: number;
  unit: 'g' | 'ml';
  favorite?: boolean;
  onPick: () => void;
  onEdit?: () => void;
}) {
  const info = detail.filter(Boolean).join(', ');
  return (
    <li className="flex items-center border-b border-anthracite last:border-b-0">
      <button type="button" onClick={onPick} className="flex min-h-[52px] min-w-0 flex-1 items-center justify-between gap-3 py-2 text-left">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[15px]">
            {favorite && <Icon name="star" size={14} fill="currentColor" className="shrink-0 text-citron" />}
            <span className="truncate">{name}</span>
          </span>
          {info && <span className="block truncate text-[12px] text-cendre">{info}</span>}
        </span>
        <span className="shrink-0 text-right text-[12px] text-cendre">
          <span className="text-[15px] font-semibold text-craie tabular-nums">{formatNumber(kcal, 0)}</span> kcal
          <br />P {formatNumber(protein, protein % 1 ? 1 : 0)} g / 100 {unit}
        </span>
      </button>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={`Modifier ${name}`} className="flex h-11 w-11 shrink-0 items-center justify-center text-cendre">
          <Icon name="edit" size={18} />
        </button>
      )}
    </li>
  );
}
