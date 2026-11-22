/**
 * Dates « par jour » : FORGE raisonne en jour local (clé AAAA-MM-JJ).
 * Les calculs entre clés se font en UTC pour éviter les pièges des changements d'heure.
 */

const DAY_MS = 86_400_000;
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_KEY = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDateKey(value: string): boolean {
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.toISOString().slice(0, 10) === value;
}

export function isTimeKey(value: string): boolean {
  return TIME_KEY.test(value);
}

/** Jour local de l'appareil pour une date donnée. */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Heure locale HH:mm de l'appareil. */
export function toLocalTimeKey(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function keyToUtcMs(key: string): number {
  const match = DATE_KEY.exec(key);
  if (!match) throw new Error(`Date invalide : ${key}`);
  const [, y, m, d] = match;
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

export function addDays(key: string, days: number): string {
  return new Date(keyToUtcMs(key) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Nombre de jours de `from` à `to` (positif si `to` est après `from`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((keyToUtcMs(to) - keyToUtcMs(from)) / DAY_MS);
}
