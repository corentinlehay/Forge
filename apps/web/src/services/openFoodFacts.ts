import { parseOffProduct, type OffProduct } from '../domain/food';

/**
 * Open Food Facts, interrogé directement depuis l'appareil (lecture seule, sans compte).
 * Limites demandées par Open Food Facts : 10 recherches et 100 fiches produit par minute.
 * FORGE reste en dessous : 10 recherches et 15 fiches par minute, et ne cherche jamais à chaque frappe.
 */

const FIELDS = 'code,product_name,product_name_fr,generic_name_fr,brands,nutriments,serving_size,serving_quantity,quantity';

export type OffErrorKind = 'offline' | 'rate' | 'network';

export class OffError extends Error {
  constructor(
    readonly kind: OffErrorKind,
    message: string,
  ) {
    super(message);
  }
}

/** Fenêtre glissante : au plus `max` appels par `windowMs`. */
export class RateLimiter {
  private stamps: number[] = [];
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Réserve un appel ; renvoie le délai d'attente en ms si la limite est atteinte (0 = accordé). */
  take(now: number = Date.now()): number {
    this.stamps = this.stamps.filter((t) => now - t < this.windowMs);
    if (this.stamps.length >= this.max) return this.windowMs - (now - this.stamps[0]!);
    this.stamps.push(now);
    return 0;
  }
}

const searchLimiter = new RateLimiter(10, 60_000);
const productLimiter = new RateLimiter(15, 60_000);

type Fetcher = typeof fetch;

function ensureOnline(): void {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new OffError('offline', 'Hors connexion : Open Food Facts est indisponible. Tes aliments et la table Ciqual restent accessibles.');
  }
}

function ensureAllowed(limiter: RateLimiter): void {
  const wait = limiter.take();
  if (wait > 0) throw new OffError('rate', `Trop de demandes d’affilée : réessaie dans ${Math.ceil(wait / 1000)} s.`);
}

async function getJson(url: string, fetcher: Fetcher): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new OffError('network', 'Open Food Facts ne répond pas. Vérifie ta connexion et réessaie.');
  }
  if (response.status === 404) return null;
  if (response.status === 429) throw new OffError('rate', 'Open Food Facts limite les demandes : réessaie dans une minute.');
  if (!response.ok) throw new OffError('network', `Open Food Facts a répondu avec une erreur (${response.status}).`);
  return response.json();
}

/** Fiche d'un produit par son code-barres ; null s'il est inconnu d'Open Food Facts. */
export async function fetchProduct(code: string, fetcher: Fetcher = fetch): Promise<OffProduct | null> {
  ensureOnline();
  ensureAllowed(productLimiter);
  const data = (await getJson(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`, fetcher)) as {
    status?: number;
    product?: unknown;
  } | null;
  if (!data || data.status === 0 || !data.product) return null;
  return parseOffProduct({ code, ...(data.product as object) });
}

/**
 * Recherche par nom ou marque. Essaie le moteur Search-a-licious, puis l'ancienne API de recherche.
 */
export async function searchProducts(query: string, fetcher: Fetcher = fetch): Promise<OffProduct[]> {
  ensureOnline();
  ensureAllowed(searchLimiter);
  const q = encodeURIComponent(query.trim());
  const parse = (list: unknown): OffProduct[] =>
    Array.isArray(list) ? list.map(parseOffProduct).filter((p): p is OffProduct => p !== null) : [];

  try {
    const data = (await getJson(`https://search.openfoodfacts.org/search?q=${q}&langs=fr&page_size=24&fields=${FIELDS}`, fetcher)) as { hits?: unknown } | null;
    const hits = parse(data?.hits);
    if (hits.length) return hits;
  } catch (error) {
    if (error instanceof OffError && error.kind === 'rate') throw error;
    // Moteur indisponible : on passe à l'ancienne API.
  }
  const data = (await getJson(
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=24&lc=fr&fields=${FIELDS}`,
    fetcher,
  )) as { products?: unknown } | null;
  return parse(data?.products);
}
