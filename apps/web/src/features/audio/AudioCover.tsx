import { coverUrl, FORMAT_LABELS, type AudioFormat, type AudioItem } from '../../domain/audio';

/** Teintes des couvertures générées, par format (quand le créateur n'a pas ajouté d'image). */
const TINTS: Record<AudioFormat, [string, string]> = {
  hypnose: ['#3b3f7a', '#aebcf5'],
  relaxation: ['#24414a', '#8fd0c8'],
  meditation: ['#3a3350', '#c9b6f0'],
  visualisation: ['#4a3a2a', '#f0c98f'],
  sommeil: ['#151a33', '#7f8fd6'],
  respiration: ['#203a33', '#9fe0c0'],
  preparation: ['#3d3a1f', '#d6f64a'],
};

/** Couverture d'une séance : l'image du créateur, sinon un dégradé propre au format. */
export function AudioCover({ item, size }: { item: AudioItem; size: number | 'full' }) {
  const url = coverUrl(item);
  const [from, to] = TINTS[item.format];
  const box = size === 'full' ? 'aspect-square w-full rounded-[28px]' : 'shrink-0 rounded-[12px]';
  const style = size === 'full' ? undefined : { width: size, height: size };
  if (url) return <img src={url} alt="" className={`${box} object-cover`} style={style} loading="lazy" />;
  return (
    <span
      className={`${box} relative flex items-end overflow-hidden`}
      style={{ ...style, background: `radial-gradient(circle at 70% 25%, ${to}aa, ${from} 60%, #0b0d18)` }}
      aria-hidden="true"
    >
      {size === 'full' && <span className="p-5 font-metal text-[28px] text-craie/90">{FORMAT_LABELS[item.format]}</span>}
    </span>
  );
}
