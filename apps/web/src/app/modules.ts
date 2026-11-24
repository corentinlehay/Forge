/**
 * Les cinq espaces de FORGE et leur couleur (FORGE SIGNATURE). La couleur d'un espace passe par l'attribut
 * data-module : les graphiques, les indicateurs et l'onglet actif la prennent, jamais les boutons principaux.
 */
export type ModuleKey = 'accueil' | 'training' | 'nutrition' | 'mind' | 'progression';

/** Espace d'un écran, d'après son adresse. PULSE et les réglages restent dans l'espace Accueil. */
export function moduleOf(pathname: string): ModuleKey {
  if (pathname.startsWith('/training')) return 'training';
  if (pathname.startsWith('/nutrition')) return 'nutrition';
  if (pathname.startsWith('/mind')) return 'mind';
  if (pathname.startsWith('/progression')) return 'progression';
  return 'accueil';
}
