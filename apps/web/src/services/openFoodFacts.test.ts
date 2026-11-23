import { describe, expect, it, vi } from 'vitest';
import { fetchProduct, OffError, RateLimiter, searchProducts } from './openFoodFacts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const nutriments = { 'energy-kcal_100g': 120, proteins_100g: 10, carbohydrates_100g: 4, fat_100g: 7 };

describe('limite de débit', () => {
  it('accorde max appels par fenêtre puis indique l’attente', () => {
    const limiter = new RateLimiter(2, 60_000);
    expect(limiter.take(0)).toBe(0);
    expect(limiter.take(1000)).toBe(0);
    expect(limiter.take(2000)).toBe(58_000);
    expect(limiter.take(61_000)).toBe(0);
  });
});

describe('Open Food Facts', () => {
  it('lit une fiche produit, et null si inconnue', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ status: 1, product: { product_name: 'Skyr', nutriments } })).mockResolvedValueOnce(json({ status: 0 }, 404));
    expect(await fetchProduct('3033490004743', fetcher)).toMatchObject({ code: '3033490004743', name: 'Skyr', complete: true });
    expect(await fetchProduct('0000000000000', fetcher)).toBeNull();
    expect(fetcher.mock.calls[0]![0]).toContain('/api/v2/product/3033490004743.json');
  });

  it('cherche avec Search-a-licious puis bascule sur l’ancienne API', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json({ products: [{ code: '1', product_name: 'Skyr nature', brands: 'Siggi’s', nutriments }] }));
    const results = await searchProducts('skyr', fetcher);
    expect(results.map((r) => r.name)).toEqual(['Skyr nature']);
    expect(fetcher.mock.calls[0]![0]).toContain('search.openfoodfacts.org');
    expect(fetcher.mock.calls[1]![0]).toContain('cgi/search.pl');
  });

  it('signale clairement une limite atteinte', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({}, 429));
    await expect(fetchProduct('3017620422003', fetcher)).rejects.toBeInstanceOf(OffError);
  });
});
