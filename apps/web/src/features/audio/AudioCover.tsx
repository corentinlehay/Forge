import { coverUrl, FORMAT_LABELS, type AudioFormat, type AudioItem } from '../../domain/audio';

/**
 * Couvertures générées (quand le créateur n'a pas ajouté d'image) : toutes dans le violet de Mind,
 * chaque format avec sa lumière (position et intensité du halo). Le format est écrit sur la grande couverture.
 */
const TINTS: Record<AudioFormat, { at: string; glow: number; depth: number }> = {
  hypnose: { at: '70% 25%', glow: 80, depth: 30 },
  relaxation: { at: '30% 30%', glow: 60, depth: 22 },
  meditation: { at: '50% 20%', glow: 70, depth: 26 },
  visualisation: { at: '75% 70%', glow: 65, depth: 24 },
  sommeil: { at: '25% 80%', glow: 45, depth: 16 },
  respiration: { at: '50% 50%', glow: 55, depth: 20 },
  preparation: { at: '80% 15%', glow: 90, depth: 34 },
};

/** Couverture d'une séance : l'image du créateur, sinon un dégradé propre au format. */
export function AudioCover({ item, size }: { item: AudioItem; size: number | 'full' }) {
  const url = coverUrl(item);
  const t = TINTS[item.format];
  const box = size === 'full' ? 'aspect-square w-full rounded-[28px]' : 'shrink-0 rounded-[12px]';
  const style = size === 'full' ? undefined : { width: size, height: size };
  if (url) return <img src={url} alt="" className={`${box} object-cover`} style={style} loading="lazy" />;
  return (
    <span
      className={`${box} relative flex items-end overflow-hidden`}
      style={{
        ...style,
        background: `radial-gradient(circle at ${t.at}, color-mix(in oklab, var(--forge-mind) ${t.glow}%, transparent), color-mix(in oklab, var(--forge-mind) ${t.depth}%, var(--forge-bg)) 60%, var(--forge-bg))`,
      }}
      aria-hidden="true"
    >
      {size === 'full' && <span className="p-5 font-metal text-[28px] text-craie/90">{FORMAT_LABELS[item.format]}</span>}
    </span>
  );
}
