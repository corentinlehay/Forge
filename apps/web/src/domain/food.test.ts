import { describe, expect, it } from 'vitest';
import { detectState, isBarcode, normalize, nutrientsFor, parseOffProduct, searchLocal } from './food';

describe('quantités', () => {
  it('calcule les valeurs pour la quantité pesée', () => {
    expect(nutrientsFor({ kcal: 130, proteinG: 2.7, carbsG: 28.6, fatG: 0.3, fiberG: 0.4 }, 250)).toEqual({ kcal: 325, proteinG: 6.8, carbsG: 71.5, fatG: 0.8, fiberG: 1 });
  });
  it('garde les fibres inconnues comme inconnues', () => {
    expect(nutrientsFor({ kcal: 100, proteinG: 1, carbsG: 1, fatG: 1, fiberG: null }, 50).fiberG).toBeNull();
  });
});

describe('recherche locale', () => {
  const items = [
    { name: 'Riz basmati, cuit', brand: '' },
    { name: 'Riz complet, cru' },
    { name: 'Galette de riz' },
    { name: 'Skyr nature', brand: 'Siggi’s' },
    { name: 'Œufs brouillés' },
  ];
  it('ignore accents et casse, et classe le début du nom en premier', () => {
    expect(searchLocal(items, 'riz').map((i) => i.name)).toEqual(['Riz complet, cru', 'Riz basmati, cuit', 'Galette de riz']);
    expect(searchLocal(items, 'oeufs')[0]?.name).toBe('Œufs brouillés');
  });
  it('exige chaque mot et cherche aussi dans la marque', () => {
    expect(searchLocal(items, 'riz cuit').map((i) => i.name)).toEqual(['Riz basmati, cuit']);
    expect(searchLocal(items, 'siggi').map((i) => i.name)).toEqual(['Skyr nature']);
    expect(searchLocal(items, '')).toEqual([]);
  });
  it('normalise', () => {
    expect(normalize('  Pâtes  complètes ! ')).toBe('pates completes');
  });
});

describe('cru ou cuit', () => {
  it('lit le nom sans deviner', () => {
    expect(detectState('Riz basmati, cuit')).toBe('cooked');
    expect(detectState('Blanc de poulet, cru')).toBe('raw');
    expect(detectState('Poulet rôti')).toBe('cooked');
    expect(detectState('Skyr nature')).toBeNull();
  });
});

describe('fiches Open Food Facts', () => {
  it('lit les valeurs pour 100 g et la portion', () => {
    const p = parseOffProduct({
      code: '3017620422003',
      product_name_fr: 'Nutella',
      brands: 'Ferrero, Nutella',
      quantity: '400 g',
      serving_quantity: '15',
      serving_size: '15 g',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, fiber_100g: 0 },
    });
    expect(p).toMatchObject({ code: '3017620422003', name: 'Nutella', brand: 'Ferrero', complete: true, servingG: 15, unit: 'g' });
    expect(p?.per100).toEqual({ kcal: 539, proteinG: 6.3, carbsG: 57.5, fatG: 30.9, fiberG: 0 });
  });
  it('convertit les kJ et signale une fiche incomplète', () => {
    const p = parseOffProduct({ code: '123', product_name: 'Boisson', quantity: '1 l', nutriments: { energy_100g: 418.4, carbohydrates_100g: 10 } });
    expect(p?.per100.kcal).toBe(100);
    expect(p?.complete).toBe(false);
    expect(p?.unit).toBe('ml');
    expect(p?.per100.fiberG).toBeNull();
  });
  it('rejette une fiche sans nom', () => {
    expect(parseOffProduct({ code: '1' })).toBeNull();
  });
  it('reconnaît un code-barres', () => {
    expect(isBarcode('3017620422003')).toBe(true);
    expect(isBarcode('nutella')).toBe(false);
  });
});
