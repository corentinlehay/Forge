import type { FoodState, Per100 } from '../db/types';

/**
 * Aliments : calcul des valeurs pour une quantité, recherche locale, lecture des fiches Open Food Facts.
 */

export interface Nutrients {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Valeurs pour une quantité en grammes (ou ml), à partir des valeurs pour 100. */
export function nutrientsFor(per100: Per100, grams: number): Nutrients {
  const k = grams / 100;
  return {
    kcal: Math.round(per100.kcal * k),
    proteinG: r1(per100.proteinG * k),
    carbsG: r1(per100.carbsG * k),
    fatG: r1(per100.fatG * k),
    fiberG: per100.fiberG === null ? null : r1(per100.fiberG * k),
  };
}

/** Minuscules, sans accents ni ponctuation : « Œufs brouillés » → « oeufs brouilles ». */
export function normalize(text: string): string {
  return text
    .toLocaleLowerCase('fr-FR')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

const RAW = /\b(cru|crue|crus|crues)\b/;
const COOKED = /\b(cuit|cuite|cuits|cuites|bouilli|bouillie|bouillis|grille|grillee|grilles|roti|rotie|poele|poelee|vapeur|frit|frite|frits|braise|braisee|au four|mijote)\b/;

/** Cru ou cuit, quand le nom le dit ; sinon rien (on ne devine pas). */
export function detectState(name: string): FoodState | null {
  const n = normalize(name);
  if (RAW.test(n)) return 'raw';
  if (COOKED.test(n)) return 'cooked';
  return null;
}

export interface Searchable {
  name: string;
  brand?: string | null;
}

/**
 * Recherche locale : chaque mot tapé doit commencer un mot du nom ou de la marque.
 * Classement : début du nom, mots entiers, puis noms les plus courts.
 */
export function searchLocal<T extends Searchable>(items: readonly T[], query: string, limit = 30): T[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const name = normalize(item.name);
    const words = `${name} ${normalize(item.brand ?? '')}`.split(' ').filter(Boolean);
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      const hit = words.find((w) => w.startsWith(t));
      if (!hit) {
        ok = false;
        break;
      }
      score += hit === t ? 3 : 1;
    }
    if (!ok) continue;
    if (name.startsWith(tokens[0]!)) score += 4;
    score -= name.length / 100;
    scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.item);
}

/** Fiche produit Open Food Facts, réduite à ce dont FORGE a besoin. */
export interface OffProduct {
  code: string;
  name: string;
  brand?: string;
  per100: Per100;
  /** Toutes les valeurs essentielles (kcal, protéines, glucides, lipides) sont présentes. */
  complete: boolean;
  servingG: number | null;
  servingLabel?: string;
  packageLabel?: string;
  unit: 'g' | 'ml';
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Lit une fiche Open Food Facts (API produit ou recherche). Renvoie null sans nom ni code. */
export function parseOffProduct(raw: unknown): OffProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const code = typeof p.code === 'string' ? p.code : typeof p._id === 'string' ? p._id : null;
  const nameRaw = [p.product_name_fr, p.product_name, p.generic_name_fr].find((v) => typeof v === 'string' && v.trim());
  if (!code || typeof nameRaw !== 'string') return null;
  const brandsRaw = Array.isArray(p.brands) ? p.brands.join(', ') : typeof p.brands === 'string' ? p.brands : '';
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const kj = num(n['energy-kj_100g']) ?? (n['energy_unit'] === 'kcal' ? null : num(n['energy_100g']));
  const kcal = num(n['energy-kcal_100g']) ?? (kj !== null ? kj / 4.184 : null);
  const protein = num(n['proteins_100g']);
  const carbs = num(n['carbohydrates_100g']);
  const fat = num(n['fat_100g']);
  const fiber = num(n['fiber_100g']);
  const quantity = typeof p.quantity === 'string' ? p.quantity : '';
  const servingG = num(p.serving_quantity);
  return {
    code,
    name: nameRaw.trim(),
    ...(brandsRaw.trim() ? { brand: brandsRaw.split(',')[0]!.trim() } : {}),
    per100: { kcal: Math.round(kcal ?? 0), proteinG: protein ?? 0, carbsG: carbs ?? 0, fatG: fat ?? 0, fiberG: fiber },
    complete: kcal !== null && protein !== null && carbs !== null && fat !== null,
    servingG: servingG && servingG > 0 && servingG < 2000 ? servingG : null,
    ...(typeof p.serving_size === 'string' && p.serving_size.trim() ? { servingLabel: p.serving_size.trim() } : {}),
    ...(quantity.trim() ? { packageLabel: quantity.trim() } : {}),
    unit: /\b(ml|cl|l)\b/i.test(quantity) && !/\b(g|kg)\b/i.test(quantity) ? 'ml' : 'g',
  };
}

/** Un code-barres alimentaire plausible : 8, 12, 13 ou 14 chiffres. */
export function isBarcode(text: string): boolean {
  return /^(\d{8}|\d{12,14})$/.test(text.trim());
}
