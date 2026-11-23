/** Saisie et affichage des nombres à la française (virgule décimale). */

export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 300;

const oneDecimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDecimals = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Lit « 89,6 », « 89.6 » ou « 89 » ; renvoie null si la saisie n'est pas un nombre. */
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Poids saisi, arrondi au centième ; null s'il est illisible ou hors de [30 ; 300] kg. */
export function parseWeightKg(input: string): number | null {
  const value = parseDecimal(input);
  if (value === null || value < WEIGHT_MIN_KG || value > WEIGHT_MAX_KG) return null;
  return Math.round(value * 100) / 100;
}

/** 89.56 → « 89,6 kg » */
export function formatKg(value: number): string {
  return `${oneDecimal.format(value)} kg`;
}

/** 0.274 → « +0,27 kg » ; -0.1 → « −0,10 kg » */
export function formatSignedKg(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${twoDecimals.format(Math.abs(value))} kg`;
}

const fr = 'fr-FR';
const numberFormats = new Map<number, Intl.NumberFormat>();

/** Nombre à la française avec un nombre fixe de décimales : 89.56 → « 89,6 ». */
export function formatNumber(value: number, decimals = 1): string {
  let format = numberFormats.get(decimals);
  if (!format) {
    format = new Intl.NumberFormat(fr, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    numberFormats.set(decimals, format);
  }
  return format.format(value);
}

/** 0.25 → « 0,25 % » (valeur déjà exprimée en pourcentage). */
export function formatPct(value: number): string {
  return `${formatNumber(value, 2)} %`;
}

/** Taille de stockage lisible : « 412 Ko », « 1,4 Mo ». */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  if (bytes < 1024 ** 3) return `${formatNumber(bytes / 1024 ** 2, 1)} Mo`;
  return `${formatNumber(bytes / 1024 ** 3, 1)} Go`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase(fr) + text.slice(1);
}

/** Les clés AAAA-MM-JJ sont lues à midi UTC et formatées en UTC : aucun décalage de jour possible. */
function keyToDate(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

const dayLong = new Intl.DateTimeFormat(fr, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const dayShort = new Intl.DateTimeFormat(fr, { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayMonth = new Intl.DateTimeFormat(fr, { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayMonthLong = new Intl.DateTimeFormat(fr, { day: 'numeric', month: 'long', timeZone: 'UTC' });
const dayMonthYear = new Intl.DateTimeFormat(fr, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Le premier du mois s'écrit « 1er » en français. */
function firstOfMonth(text: string): string {
  return text.replace(/(^|\s)1(?=\s)/, '$11er');
}

/** « Lundi 23 novembre » */
export function formatDayLong(key: string): string {
  return capitalize(firstOfMonth(dayLong.format(keyToDate(key))));
}

/** « Lundi 23 nov. » */
export function formatDayShort(key: string): string {
  return capitalize(firstOfMonth(dayShort.format(keyToDate(key))));
}

/** « 1er sept. », « 13 oct. » (axes des graphiques) */
export function formatDayMonth(key: string): string {
  return firstOfMonth(dayMonth.format(keyToDate(key)));
}

/** « 23 novembre » */
export function formatDayMonthLong(key: string): string {
  return firstOfMonth(dayMonthLong.format(keyToDate(key)));
}

/** « 23 novembre 2026 » */
export function formatFullDate(key: string): string {
  return firstOfMonth(dayMonthYear.format(keyToDate(key)));
}

/** « aujourd'hui », « hier », « il y a 9 jours » entre deux jours locaux. */
export function formatDaysAgo(fromKey: string, todayKey: string): string {
  const diff = Math.round((keyToDate(todayKey).getTime() - keyToDate(fromKey).getTime()) / 86_400_000);
  if (diff <= 0) return "aujourd'hui";
  if (diff === 1) return 'hier';
  return `il y a ${diff} jours`;
}

/** Poids saisi, tel quel : une décimale, ou deux si la balance en donne deux (89,45). */
export function formatMeasured(value: number): string {
  return formatNumber(value, Math.round(value * 100) % 10 === 0 ? 1 : 2);
}

export function formatMeasuredKg(value: number): string {
  return `${formatMeasured(value)} kg`;
}

/** « 07:42 » → « 7 h 42 » */
export function formatTime(time: string): string {
  const [h = '0', m = '00'] = time.split(':');
  return `${Number(h)} h ${m}`;
}

/** « 1 série », « 3 séries » (pluriel régulier en s). */
export function countLabel(n: number, word: string): string {
  return `${formatNumber(n, 0)} ${word}${Math.abs(n) >= 2 ? 's' : ''}`;
}

const litresFormat = new Intl.NumberFormat(fr, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 1000 → « 1 L », 1250 → « 1,25 L » */
export function formatLitres(ml: number): string {
  return `${litresFormat.format(ml / 1000)} L`;
}
