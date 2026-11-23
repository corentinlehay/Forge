import { describe, expect, it, vi } from 'vitest';
import { handleOffSearch } from './index';

const upstream = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const req = (q: string, method = 'GET') => new Request(`https://forge.example/api/off/search?q=${encodeURIComponent(q)}`, { method });

describe('relais de recherche Open Food Facts', () => {
  it('interroge Search-a-licious et ne renvoie que les champs utiles', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        upstream({
          hits: [{ code: '1', product_name: 'Skyr', brands: ['Isey'], nutriments: { 'energy-kcal_100g': 64, proteins_100g: 11, salt_100g: 0.1 }, ingredients: 'lait' }],
          count: 1,
        }),
      );
    const res = await handleOffSearch(req(' skyr  nature '), { fetcher, cache: null });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('max-age=3600');
    const body = (await res.json()) as { hits: Record<string, unknown>[] };
    expect(body.hits).toEqual([{ code: '1', product_name: 'Skyr', brands: ['Isey'], nutriments: { 'energy-kcal_100g': 64, proteins_100g: 11 } }]);
    const url = String(fetcher.mock.calls[0]![0]);
    expect(url).toContain('search.openfoodfacts.org/search?q=skyr%20nature');
    expect(fetcher.mock.calls[0]![1].headers['user-agent']).toContain('FORGE');
  });

  it('refuse une recherche trop courte ou une autre méthode', async () => {
    const fetcher = vi.fn();
    expect((await handleOffSearch(req('s'), { fetcher, cache: null })).status).toBe(400);
    expect((await handleOffSearch(req('skyr', 'POST'), { fetcher, cache: null })).status).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('signale une panne ou une limite d’Open Food Facts', async () => {
    expect((await handleOffSearch(req('skyr'), { fetcher: vi.fn().mockRejectedValue(new Error('timeout')), cache: null })).status).toBe(502);
    expect((await handleOffSearch(req('skyr'), { fetcher: vi.fn().mockResolvedValue(upstream({}, 503)), cache: null })).status).toBe(502);
    expect((await handleOffSearch(req('skyr'), { fetcher: vi.fn().mockResolvedValue(upstream({}, 429)), cache: null })).status).toBe(429);
  });
});
