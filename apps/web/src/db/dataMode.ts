/**
 * Mode de données : tes vraies données (base « forge ») ou la démonstration (base « forge-demo »).
 * Les deux bases sont séparées : la démo ne lit ni n'écrit jamais tes données personnelles.
 */
export const REAL_DB_NAME = 'forge';
export const DEMO_DB_NAME = 'forge-demo';
const MODE_KEY = 'forge.dataMode';

export function isDemoMode(): boolean {
  try {
    return globalThis.localStorage?.getItem(MODE_KEY) === 'demo';
  } catch {
    return false;
  }
}

export function setDemoMode(on: boolean): void {
  if (on) globalThis.localStorage?.setItem(MODE_KEY, 'demo');
  else globalThis.localStorage?.removeItem(MODE_KEY);
}

export function activeDbName(): string {
  return isDemoMode() ? DEMO_DB_NAME : REAL_DB_NAME;
}
