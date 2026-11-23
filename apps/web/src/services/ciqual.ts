import type { Per100 } from '../db/types';

/**
 * Table Ciqual (ANSES), embarquée dans l'app sous forme compacte : recherche hors ligne des aliments de base.
 * Fichier généré par scripts/build-ciqual.py à partir de la table officielle (Licence Ouverte Etalab).
 * Tant que le fichier n'est pas présent, la liste est vide : rien n'est inventé.
 */
export interface CiqualFood {
  code: string;
  name: string;
  group: string;
  state: 'raw' | 'cooked' | null;
  per100: Per100;
}

interface CiqualFile {
  version: string;
  /** [code, nom, groupe, état (r/c/-), kcal, protéines, glucides, lipides, fibres ou null] */
  foods: [string, string, string, string, number, number, number, number, number | null][];
}

let cache: Promise<{ version: string; foods: CiqualFood[] }> | null = null;

export function loadCiqual(): Promise<{ version: string; foods: CiqualFood[] }> {
  cache ??= fetch('/data/ciqual.json')
    .then((r) => (r.ok ? (r.json() as Promise<CiqualFile>) : null))
    .then((file) => ({
      version: file?.version ?? '',
      foods: (file?.foods ?? []).map(([code, name, group, state, kcal, proteinG, carbsG, fatG, fiberG]): CiqualFood => ({
        code,
        name,
        group,
        state: state === 'r' ? 'raw' : state === 'c' ? 'cooked' : null,
        per100: { kcal, proteinG, carbsG, fatG, fiberG },
      })),
    }))
    .catch(() => {
      cache = null;
      return { version: '', foods: [] };
    });
  return cache;
}
