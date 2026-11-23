import { useState } from 'react';
import { normalize } from '../../domain/food';
import type { Recipe } from '../../domain/kitchen';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { recipeMeta } from './KitchenScreen';
import { RecipeVisual } from './RecipeVisual';
import type { KitchenData } from './useKitchen';

/** Liste de recettes à choisir (planning, listes de courses), avec recherche. */
export function RecipeChooser({ kitchen, selected, onPick }: { kitchen: KitchenData; selected?: ReadonlySet<string>; onPick: (r: Recipe) => void }) {
  const [query, setQuery] = useState('');
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const list = kitchen.recipes
    .filter((r) => words.every((w) => normalize(r.name).includes(w)))
    .sort((a, b) => Number(kitchen.favorites.has(b.key)) - Number(kitchen.favorites.has(a.key)) || a.name.localeCompare(b.name, 'fr'));
  return (
    <div className="flex flex-col gap-2">
      <Field label="Chercher une recette" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={60} enterKeyHint="search" />
      <ul className="flex flex-col">
        {list.map((r) => {
          const on = selected?.has(r.key) ?? false;
          return (
            <li key={r.key} className="border-b border-graphite last:border-b-0">
              <button type="button" aria-pressed={selected ? on : undefined} onClick={() => onPick(r)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
                <RecipeVisual recipe={r} photo={kitchen.photos.get(r.key)} size="thumb" className="h-11 w-11 shrink-0 rounded-[10px]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-tight">{r.name}</span>
                  <span className="block text-[12px] text-cendre">{recipeMeta(r)}</span>
                </span>
                {selected ? (
                  <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${on ? 'bg-citron text-noir' : 'border-2 border-graphite'}`}>
                    {on && <Icon name="check" size={14} strokeWidth={3} />}
                  </span>
                ) : (
                  <Icon name="plus" size={18} className="shrink-0 text-citron" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
