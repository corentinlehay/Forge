import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { repos, useFoodEntries, useFoods, useMeta, usePrices, useToday } from '../../db/hooks';
import type { Food, Per100, PriceRecord } from '../../db/types';
import { BUDGET_KEY, consumption, costSummary, entryCost, foodPriceKey, monthlyEstimate, proteinValues, type BudgetSettings, type CostContext } from '../../domain/budget';
import { searchLocal } from '../../domain/food';
import { costPerGram, formatEur, recipeCost, recipeNutrition, type IngredientPrice } from '../../domain/kitchen';
import { MEAL_LABELS } from '../../domain/nutrition';
import { weekStart } from '../../domain/training';
import { addDays } from '../../lib/dates';
import { formatDayMonth, formatNumber, parseDecimal } from '../../lib/format';
import { loadCiqual, type CiqualFood } from '../../services/ciqual';
import { BarChart } from '../../ui/BarChart';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Meter } from '../../ui/Meter';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { PriceForm } from '../kitchen/RecipeScreen';
import { useKitchen } from '../kitchen/useKitchen';

const pct = (v: number) => `${Math.round(v * 100)} %`;
const upTo2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const qty = (grams: number, unit: 'g' | 'ml' | 'piece') =>
  unit === 'piece'
    ? `${upTo2.format(grams)} pièce${grams > 1 ? 's' : ''}`
    : grams >= 1000
      ? `${upTo2.format(grams / 1000)} ${unit === 'ml' ? 'L' : 'kg'}`
      : `${Math.round(grams)} ${unit}`;

/** Clé de prix, valeurs pour 100 g et nom pour chaque aliment connu. */
export function useCostContext() {
  const foods = useFoods();
  const prices = usePrices();
  const [ciqual, setCiqual] = useState<CiqualFood[] | null>(null);
  useEffect(() => {
    void loadCiqual().then((c) => setCiqual(c.foods));
  }, []);
  return useMemo(() => {
    if (!foods || !prices || !ciqual) return null;
    const byId = new Map(foods.map((f) => [f.id, f]));
    const ciqualByCode = new Map(ciqual.map((c) => [c.code, c]));
    const priceMap = new Map<string, IngredientPrice>(prices.map((p) => [p.key, { key: p.key, amountEur: p.amountEur, quantity: p.quantity, unit: p.unit }]));
    const ctx: CostContext = { prices: priceMap, keyOfFood: (id) => (byId.has(id) ? foodPriceKey(byId.get(id)!) : null) };
    const per100Of = (key: string): Per100 | null => {
      const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
      if (kind === 'ciqual') return ciqualByCode.get(id)?.per100 ?? null;
      const food = foods.find((f) => foodPriceKey(f) === key);
      return food?.per100 ?? null;
    };
    return { ctx, prices, per100Of, foods, ciqual };
  }, [foods, prices, ciqual]);
}

/** Budget alimentaire : coût des portions mangées, budgets, prix des produits, recommandations. */
export function BudgetScreen() {
  const entries = useFoodEntries();
  const settings = useMeta<BudgetSettings>(BUDGET_KEY);
  const cost = useCostContext();
  const kitchen = useKitchen();
  const today = useToday();
  const [sheet, setSheet] = useState<'none' | 'budgets' | 'prix'>('none');
  const [editing, setEditing] = useState<PriceRecord | null>(null);

  const model = useMemo(() => {
    if (!entries || !cost) return null;
    const start = weekStart(today);
    const day = costSummary(entries, today, today, cost.ctx);
    const week = costSummary(entries, start, addDays(start, 6), cost.ctx);
    const month = costSummary(entries, addDays(today, -29), today, cost.ctx);
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((d) => ({ date: d, total: costSummary(entries, d, d, cost.ctx).total }));
    const used = consumption(entries, addDays(today, -29), today, cost.ctx.keyOfFood, kitchen?.byKey ?? new Map());
    const values = proteinValues(
      cost.prices.map((p) => ({ key: p.key, name: p.name, amountEur: p.amountEur, quantity: p.quantity, unit: p.unit })),
      cost.per100Of,
    );
    // Produit consommé le plus cher par gramme de protéines, comparé au moins cher.
    const consumedValues = values.filter((v) => (used.get(v.key) ?? 0) > 0);
    const priciest = consumedValues.at(-1);
    const cheapest = values[0];
    const priced = (kitchen?.recipes ?? [])
      .map((r) => ({ r, c: recipeCost(r, 1, kitchen!.prices).perServing, n: recipeNutrition(r, 1).perServing }))
      .filter((x): x is { r: typeof x.r; c: number; n: typeof x.n } => x.c !== null)
      .sort((a, b) => a.c - b.c);
    const uncosted = entries.filter((e) => !e.deletedAt && e.date === today && entryCost(e, cost.ctx) === null).length;
    return { day, week, month, days, used, values, priciest, cheapest, priced, uncosted };
  }, [entries, cost, kitchen, today]);

  if (!model || !cost || settings === undefined)
    return (
      <Screen withTabBar={false}>
        <BackLink />
      </Screen>
    );
  const budget = settings ?? { dailyEur: null, weeklyEur: null };
  const monthly = monthlyEstimate(model.month);

  return (
    <Screen withTabBar={false}>
      <BackLink />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-metal text-[40px] leading-none">Budget</h1>
        <Button size="small" variant="secondary" onClick={() => setSheet('budgets')}>
          Mes budgets
        </Button>
      </div>
      <p className="-mt-2 text-[13px] leading-snug text-cendre">
        Coût de ce que tu as réellement mangé, à partir des prix que tu saisis. Le prix des paquets achetés n’est pas compté.
      </p>

      <section aria-label="Aujourd’hui" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-semibold">Aujourd’hui</h2>
          <span className="text-[13px] text-cendre">coût connu pour {pct(model.day.coverage)} des calories</span>
        </div>
        <p className="font-metal text-[44px] leading-none">{formatEur(model.day.total)}</p>
        {budget.dailyEur !== null && <Meter label="Budget du jour" value={model.day.total} target={budget.dailyEur} unit="€" decimals={2} />}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
          {(['breakfast', 'lunch', 'snack', 'dinner'] as const).map((m) => (
            <div key={m} className="flex justify-between gap-2">
              <dt className="text-cendre">{MEAL_LABELS[m]}</dt>
              <dd className="tabular-nums">{formatEur(model.day.byMeal[m])}</dd>
            </div>
          ))}
        </dl>
        {model.uncosted > 0 && (
          <p className="text-[12px] text-cendre">
            {model.uncosted} ligne{model.uncosted > 1 ? 's' : ''} du journal sans prix (aliments sans prix saisi ou ajout manuel).
          </p>
        )}
      </section>

      <dl className="grid grid-cols-2 gap-2">
        {[
          [
            'Cette semaine',
            formatEur(model.week.total),
            budget.weeklyEur !== null ? `sur ${formatEur(budget.weeklyEur)} de budget` : `${model.week.activeDays} jour${model.week.activeDays > 1 ? 's' : ''} notés`,
          ],
          [
            'Par mois (estimation)',
            monthly !== null ? formatEur(monthly) : '–',
            model.month.coverage < 0.95
              ? `lignes avec prix seulement, ${model.month.activeDays} jour${model.month.activeDays > 1 ? 's' : ''} notés`
              : `moyenne de ${model.month.activeDays} jour${model.month.activeDays > 1 ? 's' : ''} notés`,
          ],
          ['100 g de protéines', model.month.eurPer100gProtein !== null ? formatEur(model.month.eurPer100gProtein) : '–', 'sur 30 jours, lignes avec prix'],
          ['Couverture', pct(model.month.coverage), 'des calories ont un coût'],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-[16px] bg-anthracite p-3">
            <dt className="text-[12px] text-cendre">{label}</dt>
            <dd className="font-metal text-[24px] leading-tight">{value}</dd>
            <dd className="text-[12px] text-cendre">{sub}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="14 derniers jours" className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-4">
        <h2 className="text-[17px] font-semibold">14 derniers jours</h2>
        <BarChart
          title="Coût par jour"
          target={budget.dailyEur}
          targetLabel="Budget"
          bars={model.days.map((d) => ({
            key: d.date,
            label: formatDayMonth(d.date).split(' ')[0] ?? '',
            value: d.total,
            detail: `${formatDayMonth(d.date)} : ${formatEur(d.total)}`,
          }))}
        />
      </section>

      <section aria-label="Recommandations" className="flex flex-col gap-3">
        <h2 className="text-[17px] font-semibold">Pour dépenser moins</h2>
        {model.values.length === 0 ? (
          <p className="text-[15px] leading-snug text-cendre">
            Saisis le prix de tes sources de protéines (poulet, œufs, skyr, lentilles…) : FORGE les classera par coût des protéines.
          </p>
        ) : (
          <div className="flex flex-col gap-1 rounded-[18px] bg-anthracite p-4">
            <h3 className="text-[15px] font-semibold">Protéines les plus économiques</h3>
            <ul className="text-[14px]">
              {model.values.slice(0, 5).map((v) => (
                <li key={v.key} className="flex justify-between gap-3 border-b border-graphite py-1.5 last:border-b-0">
                  <span className="min-w-0 truncate">{v.name}</span>
                  <span className="shrink-0 text-cendre">{formatEur(v.eurPer100gProtein)} / 100 g de prot.</span>
                </li>
              ))}
            </ul>
            {model.priciest && model.cheapest && model.priciest.key !== model.cheapest.key && model.priciest.eurPer100gProtein > model.cheapest.eurPer100gProtein * 1.3 && (
              <p className="mt-2 text-[13px] leading-snug">
                Alternative moins chère : {model.cheapest.name.toLocaleLowerCase('fr-FR')}, {formatEur(model.cheapest.eurPer100gProtein)} les 100 g de protéines, contre{' '}
                {formatEur(model.priciest.eurPer100gProtein)} pour {model.priciest.name.toLocaleLowerCase('fr-FR')} que tu as consommé ces 30 derniers jours.
              </p>
            )}
          </div>
        )}
        {model.priced.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-[18px] bg-anthracite p-4">
            <h3 className="text-[15px] font-semibold">Recettes les moins chères par portion</h3>
            <ul className="text-[14px]">
              {model.priced.slice(0, 6).map(({ r, c, n }) => (
                <li key={r.key} className="border-b border-graphite last:border-b-0">
                  <Link to={`/nutrition/recettes/${r.key}`} viewTransition className="flex justify-between gap-3 py-1.5">
                    <span className="min-w-0 truncate">{r.name}</span>
                    <span className="shrink-0 text-cendre">
                      {formatEur(c)}, {formatNumber(n.proteinG, 0)} g prot.
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[13px] text-cendre">Les recettes dont tous les ingrédients ont un prix seront comparées ici.</p>
        )}
      </section>

      <section aria-label="Mes prix" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold">Mes prix</h2>
          <Button size="small" variant="secondary" onClick={() => setSheet('prix')}>
            <Icon name="plus" size={16} />
            Ajouter
          </Button>
        </div>
        {cost.prices.length === 0 && <p className="text-[15px] text-cendre">Aucun prix saisi. Ajoute les produits que tu achètes souvent.</p>}
        <ul>
          {[...cost.prices]
            .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
            .map((p) => {
              const perGram = costPerGram(p);
              const used = model.used.get(p.key) ?? 0;
              return (
                <li key={p.id} className="border-b border-anthracite last:border-b-0">
                  <button type="button" onClick={() => setEditing(p)} className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px]">{p.name}</span>
                      <span className="block text-[12px] text-cendre">
                        {p.unit !== 'piece' && p.quantity === 1000
                          ? `${formatEur(p.amountEur)} le ${p.unit === 'ml' ? 'litre' : 'kilo'}`
                          : `${formatEur(p.amountEur)} les ${qty(p.quantity, p.unit)}${perGram !== null && p.unit !== 'piece' ? `, ${formatEur(perGram * 1000)} le ${p.unit === 'ml' ? 'litre' : 'kilo'}` : ''}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-[12px] text-cendre">
                      {used > 0 && perGram !== null ? (
                        <>
                          30 j : {qty(Math.round(used), p.unit === 'piece' ? 'g' : p.unit)}
                          <span className="block text-craie">{formatEur(perGram * used)}</span>
                        </>
                      ) : (
                        'Pas consommé sur 30 j'
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
        </ul>
      </section>

      <Sheet open={sheet === 'budgets'} title="Mes budgets" onClose={() => setSheet('none')}>
        {sheet === 'budgets' && <BudgetForm current={budget} onDone={() => setSheet('none')} />}
      </Sheet>
      <Sheet open={sheet === 'prix'} title="Ajouter un prix" onClose={() => setSheet('none')}>
        {sheet === 'prix' && <AddPrice foods={cost.foods} ciqual={cost.ciqual} onDone={() => setSheet('none')} />}
      </Sheet>
      <Sheet open={editing !== null} title={editing?.name ?? ''} onClose={() => setEditing(null)}>
        {editing && (
          <div className="flex flex-col gap-3 pb-1">
            <PriceForm ingredient={{ key: editing.key, name: editing.name, ml: editing.unit === 'ml', unit: null }} onDone={() => setEditing(null)} />
            <Button variant="quiet" className="self-center text-braise!" onClick={() => void repos.prices.remove(editing.id).then(() => setEditing(null))}>
              Supprimer ce prix
            </Button>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

function BudgetForm({ current, onDone }: { current: BudgetSettings; onDone: () => void }) {
  const toast = useToast();
  const [daily, setDaily] = useState(current.dailyEur !== null ? String(current.dailyEur).replace('.', ',') : '');
  const [weekly, setWeekly] = useState(current.weeklyEur !== null ? String(current.weeklyEur).replace('.', ',') : '');
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const d = daily.trim() ? parseDecimal(daily) : null;
    const w = weekly.trim() ? parseDecimal(weekly) : null;
    if ((daily.trim() && (d === null || d <= 0 || d > 500)) || (weekly.trim() && (w === null || w <= 0 || w > 3000)))
      return setError('Budget entre 0,01 et 500 € par jour, 3 000 € par semaine.');
    await repos.meta.set(BUDGET_KEY, { dailyEur: d, weeklyEur: w } satisfies BudgetSettings);
    toast.show('Budgets enregistrés');
    onDone();
  };
  return (
    <div className="flex flex-col gap-4 pb-1">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Par jour" suffix="€" inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} maxLength={6} placeholder="Libre" />
        <Field label="Par semaine" suffix="€" inputMode="decimal" value={weekly} onChange={(e) => setWeekly(e.target.value)} maxLength={7} placeholder="Libre" />
      </div>
      <p className="text-[12px] text-cendre">Laisse vide pour ne pas fixer de budget. Le budget s’applique au coût des portions mangées.</p>
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void save()}>Enregistrer</Button>
    </div>
  );
}

type Candidate = { key: string; name: string; ml: boolean };

function AddPrice({ foods, ciqual, onDone }: { foods: Food[]; ciqual: CiqualFood[]; onDone: () => void }) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Candidate | null>(null);
  const results = useMemo(() => {
    if (query.trim().length < 2)
      return foods
        .filter((f) => f.useCount > 0)
        .slice(0, 12)
        .map((f): Candidate => ({ key: foodPriceKey(f), name: f.name, ml: f.unit === 'ml' }));
    const rows = [
      ...foods.map((f) => ({
        name: f.name,
        ...(f.brand ? { brand: f.brand } : {}),
        c: { key: foodPriceKey(f), name: f.brand ? `${f.name}, ${f.brand}` : f.name, ml: f.unit === 'ml' } as Candidate,
      })),
      ...ciqual.map((c) => ({ name: c.name, c: { key: `ciqual:${c.code}`, name: c.name, ml: false } as Candidate })),
    ];
    return searchLocal(rows, query, 25).map((r) => r.c);
  }, [query, foods, ciqual]);

  if (chosen) {
    return (
      <div className="flex flex-col gap-3 pb-1">
        <p className="text-[17px] font-semibold">{chosen.name}</p>
        <PriceForm ingredient={{ key: chosen.key, name: chosen.name.slice(0, 160), ml: chosen.ml, unit: null }} onDone={onDone} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 pb-1">
      <Field label="Chercher un produit" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={60} placeholder="Ex. poulet, skyr, riz" enterKeyHint="search" />
      {query.trim().length < 2 && results.length > 0 && <p className="text-[13px] text-cendre">Tes aliments les plus utilisés :</p>}
      <ul className="flex flex-col">
        {results.map((c) => (
          <li key={c.key} className="border-b border-graphite last:border-b-0">
            <button type="button" onClick={() => setChosen(c)} className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left text-[15px]">
              <span className="min-w-0">{c.name}</span>
              <Icon name="plus" size={18} className="shrink-0 text-module" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/nutrition" viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      Nutrition
    </Link>
  );
}
