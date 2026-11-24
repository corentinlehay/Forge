import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AISLE_LABELS, type Aisle } from '../../data/recipes';
import { repos, useShoppingLists, useToday } from '../../db/hooks';
import { formatEur, quantityText, shoppingCost, type Recipe } from '../../domain/kitchen';
import { formatDayShort } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { createShoppingList, portionsText } from './kitchenActions';
import { RecipeChooser } from './RecipeChooser';
import { useKitchen } from './useKitchen';

/** Tes listes de courses. */
export function ShoppingListsScreen() {
  const lists = useShoppingLists();
  const kitchen = useKitchen();
  const today = useToday();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Map<string, number>>(new Map());

  const create = async () => {
    if (!kitchen) return;
    const selections = [...selected.entries()].map(([key, servings]) => ({ recipe: kitchen.byKey.get(key)!, servings })).filter((s) => s.recipe);
    const list = await createShoppingList(`Courses du ${formatDayShort(today).toLocaleLowerCase('fr-FR')}`, selections);
    setCreating(false);
    setSelected(new Map());
    navigate(`/nutrition/courses/${list.id}`, { viewTransition: true });
  };

  return (
    <Screen withTabBar={false}>
      <BackLink to="/nutrition/recettes" label="Recettes" />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-metal text-[40px] leading-none">Courses</h1>
        <Button size="small" variant="secondary" onClick={() => setCreating(true)} disabled={!kitchen}>
          <Icon name="plus" size={18} />
          Nouvelle
        </Button>
      </div>
      {lists?.length === 0 && <p className="text-[15px] leading-snug text-cendre">Aucune liste. Choisis des recettes : FORGE additionne les ingrédients et les range par rayon.</p>}
      <ul className="flex flex-col gap-2">
        {lists?.map((l) => {
          const done = l.items.filter((i) => i.checked).length;
          return (
            <li key={l.id}>
              <Link to={`/nutrition/courses/${l.id}`} viewTransition className="flex min-h-[64px] items-center justify-between gap-3 rounded-[18px] bg-anthracite px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[17px] font-semibold">{l.name}</span>
                  <span className="block text-[13px] text-cendre">
                    {l.selections.length} recette{l.selections.length > 1 ? 's' : ''}, {done} sur {l.items.length} articles cochés
                  </span>
                </span>
                <Icon name="chevron" size={16} className="shrink-0 text-cendre" />
              </Link>
            </li>
          );
        })}
      </ul>

      <Sheet open={creating} title="Choisis tes recettes" onClose={() => setCreating(false)}>
        {creating && kitchen && (
          <div className="flex flex-col gap-3 pb-1">
            {selected.size > 0 && (
              <ul className="flex flex-col gap-2">
                {[...selected.entries()].map(([key, servings]) => {
                  const r = kitchen.byKey.get(key)!;
                  return (
                    <li key={key} className="flex items-center justify-between gap-2 rounded-[14px] bg-graphite px-3 py-2">
                      <span className="min-w-0 truncate text-[15px]">{r.name}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label="Une portion de moins"
                          onClick={() => setSelected((m) => new Map(m).set(key, Math.max(1, servings - 1)))}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-anthracite"
                        >
                          <Icon name="minus" size={16} />
                        </button>
                        <span className="w-[86px] text-center text-[13px]">{portionsText(servings)}</span>
                        <button
                          type="button"
                          aria-label="Une portion de plus"
                          onClick={() => setSelected((m) => new Map(m).set(key, Math.min(50, servings + 1)))}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-anthracite"
                        >
                          <Icon name="plus" size={16} />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button onClick={() => void create()} disabled={!selected.size}>
              Créer la liste{selected.size ? ` (${selected.size} recette${selected.size > 1 ? 's' : ''})` : ''}
            </Button>
            <RecipeChooser
              kitchen={kitchen}
              selected={new Set(selected.keys())}
              onPick={(r: Recipe) =>
                setSelected((m) => {
                  const next = new Map(m);
                  if (next.has(r.key)) next.delete(r.key);
                  else next.set(r.key, r.servings);
                  return next;
                })
              }
            />
          </div>
        )}
      </Sheet>
    </Screen>
  );
}

/** Une liste : articles additionnés, rangés par rayon, à cocher pendant les courses. */
export function ShoppingListScreen() {
  const { id = '' } = useParams();
  const lists = useShoppingLists();
  const kitchen = useKitchen();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!lists)
    return (
      <Screen withTabBar={false}>
        <BackLink to="/nutrition/courses" label="Courses" />
      </Screen>
    );
  const list = lists.find((l) => l.id === id);
  if (!list) {
    return (
      <Screen withTabBar={false}>
        <BackLink to="/nutrition/courses" label="Courses" />
        <p className="text-[17px]">Cette liste n’existe plus.</p>
      </Screen>
    );
  }
  const toggle = (key: string) => void repos.shoppingLists.update(list.id, { items: list.items.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i)) });
  const aisles = [...new Set(list.items.map((i) => i.aisle))] as Aisle[];
  const done = list.items.filter((i) => i.checked).length;
  const cost = kitchen ? shoppingCost(list.items, kitchen.prices) : null;

  return (
    <Screen withTabBar={false}>
      <BackLink to="/nutrition/courses" label="Courses" />
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[36px] leading-none">{list.name}</h1>
        <p className="text-[15px] text-cendre">
          {done} sur {list.items.length} articles cochés
        </p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
          <div className="h-full rounded-full bg-module transition-[width]" style={{ width: `${list.items.length ? (done / list.items.length) * 100 : 0}%` }} />
        </div>
      </div>
      {cost && (
        <p className="text-[15px]">
          {cost.missing === 0 ? (
            <>
              Coût estimé : <span className="font-semibold">{formatEur(cost.total)}</span>
            </>
          ) : cost.total > 0 ? (
            <>
              Coût estimé : au moins <span className="font-semibold">{formatEur(cost.total)}</span>, {cost.missing} article{cost.missing > 1 ? 's' : ''} sans prix
            </>
          ) : (
            <span className="text-cendre">Coût : prix à renseigner dans les fiches recettes.</span>
          )}
        </p>
      )}
      <p className="-mt-2 text-[12px] leading-snug text-cendre">Coût des quantités nécessaires aux recettes ; tu achèteras peut-être des paquets plus grands.</p>

      {aisles.map((aisle) => (
        <section key={aisle} aria-label={AISLE_LABELS[aisle]} className="flex flex-col">
          <h2 className="mb-1 text-[15px] font-semibold text-cendre">{AISLE_LABELS[aisle]}</h2>
          <ul>
            {list.items
              .filter((i) => i.aisle === aisle)
              .map((i) => (
                <li key={i.key} className="border-b border-anthracite last:border-b-0">
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                    <input type="checkbox" checked={i.checked} onChange={() => toggle(i.key)} className="h-6 w-6 shrink-0 accent-[var(--color-citron)]" />
                    <span className={`min-w-0 flex-1 text-[15px] leading-snug ${i.checked ? 'text-cendre line-through' : ''}`}>
                      {i.name}
                      {i.recipes.length > 1 && <span className="block text-[12px] text-cendre no-underline">{i.recipes.length} recettes</span>}
                    </span>
                    <span className={`shrink-0 text-right text-[14px] tabular-nums ${i.checked ? 'text-cendre' : ''}`}>{quantityText({ ...i, per100: null }, 1)}</span>
                  </label>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <section aria-label="Recettes de la liste" className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold">Recettes</h2>
        <ul className="text-[14px] text-cendre">
          {list.selections.map((s, i) => (
            <li key={`${s.recipeKey}-${i}`}>
              {kitchen?.byKey.get(s.recipeKey)?.name ?? 'Recette supprimée'}, {portionsText(s.servings)}
            </li>
          ))}
        </ul>
      </section>

      {done > 0 && (
        <Button variant="secondary" onClick={() => void repos.shoppingLists.update(list.id, { items: list.items.map((i) => ({ ...i, checked: false })) })}>
          Tout décocher
        </Button>
      )}
      {confirmDelete ? (
        <Button
          variant="danger"
          onClick={() =>
            void repos.shoppingLists.remove(list.id).then(() => {
              toast.show('Liste supprimée');
              navigate('/nutrition/courses', { replace: true });
            })
          }
        >
          Confirmer la suppression
        </Button>
      ) : (
        <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirmDelete(true)}>
          Supprimer la liste
        </Button>
      )}
    </Screen>
  );
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      {label}
    </Link>
  );
}
