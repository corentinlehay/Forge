import type { Glyph } from '../../data/recipes';
import type { Recipe } from '../../domain/kitchen';

/** Pictogrammes dessinés pour FORGE (traits, 24 × 24). */
const GLYPHS: Record<Glyph, string> = {
  bol: 'M3 11h18a9 9 0 0 1-18 0zM9 8c0-1.5 1.5-1.5 1.5-3M13.5 8c0-1.5 1.5-1.5 1.5-3',
  pancake: 'M4 11c0-2.5 16-2.5 16 0M4 11h16v2H4zM4 15h16v2H4zM4 19h16M12 7V5',
  poele: 'M2.5 11a7.5 7.5 0 0 0 15 0zM17.5 11H22M10 9.5a1.6 1.6 0 1 0 0 .01',
  tartine: 'M5 20V10.5A4.5 4.5 0 0 1 8.5 4h7A4.5 4.5 0 0 1 19 10.5V20zM9 12h6',
  boite: 'M3 9h18v10H3zM3 9l2-4h14l2 4M12 9v10',
  wok: 'M2 10h18a9 6 0 0 1-18 0zM20 10l3-4M8 7.5c0-1 1-1 1-2.5M12.5 7.5c0-1 1-1 1-2.5',
  cocotte: 'M4 9h16v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM2 11h2M20 11h2M9 9V7h6v2',
  assiette: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  salade: 'M3 12h18a9 8 0 0 1-18 0zM8 12c0-4 3-6 3-6s1 4-1 6M14 12c1-3 4-4 4-4s0 3-2 4',
  pizza: 'M12 21L3 6c6-3 12-3 18 0zM9 9.5h.01M14.5 9h.01M12 14h.01',
  burger: 'M4 10a8 5 0 0 1 16 0zM3 13h18M4 16h16v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
  wrap: 'M5 19c5-1 11-7 12-13l3 2c-1 6-7 12-13 13zM17 6l3 2M8 15l6-6',
  quiche: 'M3 13h18l-2 5H5zM3 13c3-2 6-2 9 0s6 2 9 0',
  pates: 'M3 12h18a9 8 0 0 1-18 0zM7 12c1-3 3-3 4 0s3 3 4 0M7 3l5 7',
  gratin: 'M3 10h18v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM1 12h2M21 12h2M7 13h.01M11 14h.01M15 13h.01',
  verre: 'M7 3h10l-1.5 18h-7zM7.5 8h9M13 3l2-2',
  billes: 'M8 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM16 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  mug: 'M5 9h11v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zM16 11h2a2 2 0 0 1 0 4h-2M9 3.5c0 2 1.5 2 1.5 4',
  verrine: 'M7 3h10v13a5 5 0 0 1-10 0zM7 10h10',
  gateau: 'M3 20h18v-8L3 8zM3 14l18 2M8 6.5V3',
};

const warm = (r: Pick<Recipe, 'categories'>) => r.categories.includes('plaisir') || r.categories.includes('dessert');

/**
 * Visuel d'une recette : ta photo si tu en as ajouté une, sinon le visuel graphique FORGE
 * (pictogramme du plat, citron pour la cuisine sportive, braise pour la cuisine plaisir).
 */
export function RecipeVisual({
  recipe,
  photo,
  className = '',
  size = 'card',
}: {
  recipe: Pick<Recipe, 'name' | 'glyph' | 'categories'>;
  photo?: string | undefined;
  className?: string;
  size?: 'card' | 'hero' | 'thumb';
}) {
  if (photo) return <img src={photo} alt={`Photo : ${recipe.name}`} className={`object-cover ${className}`} />;
  const hot = warm(recipe);
  const icon = size === 'hero' ? 96 : size === 'thumb' ? 30 : 56;
  return (
    <div
      role="img"
      aria-label={`Visuel FORGE : ${recipe.name}`}
      className={`relative flex items-center justify-center overflow-hidden ${hot ? 'bg-[#2c1a14] text-braise' : 'bg-citron-voile text-citron'} ${className}`}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={GLYPHS[recipe.glyph]} />
      </svg>
      {size !== 'thumb' && (
        <svg
          className="absolute -right-6 -bottom-6 opacity-15"
          width={icon * 1.8}
          height={icon * 1.8}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={0.8}
          aria-hidden="true"
        >
          <path d={GLYPHS[recipe.glyph]} />
        </svg>
      )}
    </div>
  );
}

export const GLYPH_OPTIONS = Object.keys(GLYPHS) as Glyph[];
export { GLYPHS };
