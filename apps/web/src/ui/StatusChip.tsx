import { Icon, type IconName } from './Icon';

type Tone = 'good' | 'neutral' | 'alert';

const tones: Record<Tone, string> = {
  good: 'text-citron',
  neutral: 'text-cendre',
  alert: 'text-braise',
};

/** Un statut porte toujours une icône et un libellé, jamais la couleur seule. */
export function StatusChip({ icon, label, tone }: { icon: IconName; label: string; tone: Tone }) {
  return (
    <p className="flex shrink-0 items-center gap-1.5 rounded-full bg-anthracite px-2.5 py-1.5 text-[13px]">
      <Icon name={icon} size={14} strokeWidth={3} className={tones[tone]} />
      {label}
    </p>
  );
}
