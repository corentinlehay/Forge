import type { Per100 } from '../db/types';
import { detectState } from '../domain/food';

/**
 * Table Ciqual 2025 (ANSES), embarquée dans l'app : recherche hors ligne des aliments de base.
 * Fichier généré par scripts/build-ciqual.py à partir des fichiers officiels publiés sur Zenodo
 * (sommes de contrôle vérifiées). Licence CC BY 4.0 : la source est citée dans l'app.
 */
export const CIQUAL_CREDIT = 'Aliments de base : table Ciqual 2025, Anses (licence CC BY 4.0).';

export interface CiqualFood {
  code: string;
  name: string;
  group: string;
  state: 'raw' | 'cooked' | null;
  per100: Per100;
}

interface CiqualFile {
  version: string;
  /** [code, nom, groupe, kcal, protéines, glucides, lipides, fibres ou null] pour 100 g */
  foods: [string, string, string, number, number, number, number, number | null][];
}

let cache: Promise<{ version: string; foods: CiqualFood[] }> | null = null;

export function loadCiqual(): Promise<{ version: string; foods: CiqualFood[] }> {
  cache ??= fetch('/data/ciqual.json')
    .then((r) => (r.ok ? (r.json() as Promise<CiqualFile>) : null))
    .then((file) => ({
      version: file?.version ?? '',
      foods: (file?.foods ?? []).map(
        ([code, name, group, kcal, proteinG, carbsG, fatG, fiberG]): CiqualFood => ({
          code,
          name,
          group,
          state: detectState(name),
          per100: { kcal, proteinG, carbsG, fatG, fiberG },
        }),
      ),
    }))
    .catch(() => {
      cache = null;
      return { version: '', foods: [] };
    });
  return cache;
}
