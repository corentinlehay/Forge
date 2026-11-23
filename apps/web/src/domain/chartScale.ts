/** Échelle verticale « ronde » : graduations à 1, 2, 2,5 ou 5 × 10ⁿ. */
export function niceScale(min: number, max: number, target = 4, minSpan = 0): { min: number; max: number; ticks: number[] } {
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  const span = Math.max(hi - lo, minSpan, Math.abs(hi) * 0.02, 1e-6);
  if (hi - lo < span) {
    const mid = (lo + hi) / 2;
    lo = mid - span / 2;
    hi = mid + span / 2;
  }
  const raw = (hi - lo) / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { min: start, max: end, ticks };
}
