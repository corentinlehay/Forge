/**
 * Durabilité du stockage local sur iPhone.
 * Une app installée sur l'écran d'accueil a son propre stockage, séparé de Safari :
 * l'app vérifie qu'elle est installée avant l'onboarding, puis demande un stockage persistant.
 */

export type PersistResult = 'granted' | 'denied' | 'unsupported';

export async function requestPersistentStorage(): Promise<PersistResult> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage || typeof storage.persist !== 'function') return 'unsupported';
  if (await storage.persisted()) return 'granted';
  return (await storage.persist()) ? 'granted' : 'denied';
}

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
}

export async function storageUsage(): Promise<StorageUsage | null> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage || typeof storage.estimate !== 'function') return null;
  const { usage = 0, quota = 0 } = await storage.estimate();
  return { usedBytes: usage, quotaBytes: quota };
}

/** Vrai quand FORGE tourne en app installée (écran d'accueil), pas dans un onglet Safari. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}
