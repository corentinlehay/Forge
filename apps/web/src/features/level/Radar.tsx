import { CHARACTERISTIC_LABELS, type Characteristic } from '../../domain/level/characteristics';

/**
 * Les six caractéristiques en hexagone. Une seule série, dans la couleur de l'espace ; chaque note est écrite à côté
 * de son axe. Une caractéristique sans note n'a pas de point : le tracé s'interrompt plutôt que d'inventer un zéro.
 */
export function Radar({ items, size = 300, animate = true }: { items: readonly Characteristic[]; size?: number; animate?: boolean }) {
  const cx = 150;
  const cy = 150;
  const r = 92;
  const n = items.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const at = (i: number, v: number) => [cx + Math.cos(angle(i)) * r * (v / 100), cy + Math.sin(angle(i)) * r * (v / 100)] as const;
  const ring = (v: number) => items.map((_, i) => at(i, v).join(',')).join(' ');
  const scored = items.map((c) => c.score);
  const all = scored.every((s) => s !== null);
  // Segments entre deux axes notés consécutifs (et la fermeture si les six le sont).
  const segments: string[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (scored[i] === null || scored[j] === null || (j === 0 && !all)) continue;
    const [x1, y1] = at(i, scored[i]!);
    const [x2, y2] = at(j, scored[j]!);
    segments.push(`M${x1},${y1}L${x2},${y2}`);
  }
  const summary = items.map((c) => `${CHARACTERISTIC_LABELS[c.key]} ${c.score ?? 'sans note'}`).join(', ');
  return (
    <svg viewBox="-55 0 410 300" width="100%" style={{ maxWidth: size * 1.35 }} role="img" aria-label={`Caractéristiques : ${summary}`} className="mx-auto block">
      {[25, 50, 75, 100].map((v) => (
        <polygon key={v} points={ring(v)} fill="none" stroke="var(--forge-surface-secondary)" strokeWidth={v === 100 ? 1.5 : 1} />
      ))}
      {items.map((_, i) => {
        const [x, y] = at(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--forge-surface-secondary)" strokeWidth="1" />;
      })}
      <g className={animate ? 'origin-center motion-pop' : undefined} style={{ transformOrigin: '150px 150px', transformBox: 'view-box' }}>
        {all && <polygon points={items.map((c, i) => at(i, c.score!).join(',')).join(' ')} fill="color-mix(in oklab, var(--forge-module) 22%, transparent)" stroke="none" />}
        <path d={segments.join('')} fill="none" stroke="var(--forge-module)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {items.map((c, i) => {
          if (c.score === null) return null;
          const [x, y] = at(i, c.score);
          return <circle key={c.key} cx={x} cy={y} r="4.5" fill="var(--forge-module)" stroke="var(--forge-surface)" strokeWidth="2" />;
        })}
      </g>
      {items.map((c, i) => {
        const [x, y] = at(i, 128);
        const anchor = Math.abs(x - cx) < 4 ? 'middle' : x > cx ? 'start' : 'end';
        return (
          <text key={c.key} x={x} y={y} textAnchor={anchor} dominantBaseline="middle">
            <tspan x={x} dy="-0.55em" fontSize="12" fill="var(--forge-text-secondary)">
              {CHARACTERISTIC_LABELS[c.key]}
            </tspan>
            <tspan x={x} dy="1.25em" fontSize="17" fontWeight="700" fill={c.score === null ? 'var(--forge-text-secondary)' : 'var(--forge-text)'}>
              {c.score ?? '–'}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

/** Petite courbe d'une note sur 12 semaines ; les semaines sans note restent vides. */
export function Sparkline({ values, width = 120, height = 32 }: { values: readonly (number | null)[]; width?: number; height?: number }) {
  const n = values.length;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * (width - 8) + 4 : width / 2);
  const y = (v: number) => height - 4 - (v / 100) * (height - 8);
  let d = '';
  values.forEach((v, i) => {
    if (v === null) return;
    d += `${i > 0 && values[i - 1] !== null ? 'L' : 'M'}${x(i)},${y(v)}`;
  });
  const last = values
    .map((v, i) => [v, i] as const)
    .filter(([v]) => v !== null)
    .at(-1);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      <line x1="4" x2={width - 4} y1={y(50)} y2={y(50)} stroke="var(--forge-surface-secondary)" strokeDasharray="2 3" />
      <path d={d} fill="none" stroke="var(--forge-module)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={x(last[1])} cy={y(last[0]!)} r="3.5" fill="var(--forge-module)" />}
    </svg>
  );
}
