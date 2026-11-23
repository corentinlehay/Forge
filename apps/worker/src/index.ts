/**
 * Serveur Cloudflare de FORGE. Il ne voit passer que les requêtes /api/* ;
 * l'app elle-même est servie directement comme fichiers statiques.
 *
 * /api/off/search : recherche Open Food Facts par nom ou marque.
 * Le moteur de recherche d'Open Food Facts n'autorise pas les autres sites à lire ses réponses
 * (pas d'en-tête CORS) : Safari les bloque. Ce relais l'interroge côté serveur, sans rien stocker
 * de personnel, et met les résultats en cache une heure.
 *
 * /api/audio et /api/admin : séances audio de FORGE MIND (voir audio.ts).
 */

import { handleAudio, type AudioEnv } from './audio';

export interface Env extends AudioEnv {
  ASSETS: Fetcher;
}

const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const FIELDS = 'code,product_name,product_name_fr,generic_name_fr,brands,nutriments,serving_size,serving_quantity,quantity';
const USER_AGENT = 'FORGE/1.0 (application personnelle de suivi nutritionnel; github.com/corentinlehay/forge)';
const KEEP_NUTRIMENTS = ['energy-kcal_100g', 'energy-kj_100g', 'energy_100g', 'energy_unit', 'proteins_100g', 'carbohydrates_100g', 'fat_100g', 'fiber_100g'];

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', ...extra },
  });
}

/** Ne garde que les champs utiles à FORGE (réponse plus légère pour le téléphone). */
function slim(hit: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of FIELDS.split(',')) if (hit[key] !== undefined && key !== 'nutriments') out[key] = hit[key];
  const n = (hit.nutriments ?? {}) as Record<string, unknown>;
  out.nutriments = Object.fromEntries(KEEP_NUTRIMENTS.filter((k) => n[k] !== undefined).map((k) => [k, n[k]]));
  return out;
}

interface Deps {
  fetcher?: typeof fetch;
  cache?: Cache | null;
  waitUntil?: (p: Promise<unknown>) => void;
}

export async function handleOffSearch(request: Request, deps: Deps = {}): Promise<Response> {
  if (request.method !== 'GET') return json({ erreur: 'Méthode non autorisée.' }, 405, { allow: 'GET' });
  const query = (new URL(request.url).searchParams.get('q') ?? '').trim().replace(/\s+/g, ' ');
  if (query.length < 2 || query.length > 100) return json({ erreur: 'La recherche doit compter entre 2 et 100 caractères.' }, 400);

  const fetcher = deps.fetcher ?? fetch;
  const cache = deps.cache === undefined ? (typeof caches !== 'undefined' ? caches.default : null) : deps.cache;
  const cacheKey = new Request(`https://forge.cache/off-search?q=${encodeURIComponent(query.toLocaleLowerCase('fr-FR'))}`);
  const cached = cache ? await cache.match(cacheKey) : undefined;
  if (cached) return cached;

  let upstream: Response;
  try {
    upstream = await fetcher(`${SEARCH_URL}?q=${encodeURIComponent(query)}&langs=fr&page_size=24&fields=${FIELDS}`, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return json({ erreur: 'Open Food Facts ne répond pas.' }, 502);
  }
  if (upstream.status === 429) return json({ erreur: 'Open Food Facts limite les demandes : réessaie dans une minute.' }, 429);
  if (!upstream.ok) return json({ erreur: `Open Food Facts a répondu avec une erreur (${upstream.status}).` }, 502);

  let data: { hits?: unknown };
  try {
    data = (await upstream.json()) as { hits?: unknown };
  } catch {
    return json({ erreur: 'Réponse illisible d’Open Food Facts.' }, 502);
  }
  const hits = Array.isArray(data.hits) ? data.hits.filter((h): h is Record<string, unknown> => !!h && typeof h === 'object').map(slim) : [];
  const response = json({ hits }, 200, { 'cache-control': 'public, max-age=3600' });
  if (cache) {
    const store = cache.put(cacheKey, response.clone());
    if (deps.waitUntil) deps.waitUntil(store);
    else await store;
  }
  return response;
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/off/search') return handleOffSearch(request, { waitUntil: (p) => ctx.waitUntil(p) });
    const audio = await handleAudio(request, env, (p) => ctx.waitUntil(p));
    if (audio) return audio;
    if (pathname.startsWith('/api/')) return json({ erreur: 'Route inconnue.' }, 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
