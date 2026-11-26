/**
 * Emblème FORGE de la carte joueur : un écusson hexagonal avec l'initiale et le niveau.
 * Version de départ ; il deviendra personnalisable (couleurs, cadres débloqués) avec l'avatar.
 */
export function Emblem({ name, level, size = 72 }: { name: string | null; level: number; size?: number }) {
  const initial = name?.trim().charAt(0).toLocaleUpperCase('fr-FR') || 'F';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Emblème, niveau ${level}`} className="shrink-0">
      <defs>
        <linearGradient id="emblem-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--forge-surface-secondary)" />
          <stop offset="1" stopColor="var(--forge-bg)" />
        </linearGradient>
      </defs>
      <path d="M50 4 90 27v46L50 96 10 73V27z" fill="url(#emblem-fill)" stroke="var(--forge-module)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 14 81 32v36L50 86 19 68V32z" fill="none" stroke="var(--forge-module)" strokeOpacity="0.35" strokeWidth="1.5" strokeLinejoin="round" />
      <text x="50" y="54" textAnchor="middle" dominantBaseline="middle" className="font-metal" fontSize="44" fill="var(--forge-text)">
        {initial}
      </text>
    </svg>
  );
}
