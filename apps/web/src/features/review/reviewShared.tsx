import type { CalModule } from '../../domain/calendar';
import { Icon } from '../../ui/Icon';
import { useHistoryBack } from '../mind/mindShared';

export function ReviewBack() {
  const back = useHistoryBack('/progression');
  return (
    <button type="button" onClick={back} className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      Retour
    </button>
  );
}

export const MODULE_BG: Record<CalModule, string> = {
  training: 'bg-mod-training',
  nutrition: 'bg-mod-nutrition',
  corps: 'bg-mod-corps',
  mind: 'bg-mod-mind',
};
export const MODULE_BORDER: Record<CalModule, string> = {
  training: 'border-mod-training',
  nutrition: 'border-mod-nutrition',
  corps: 'border-mod-corps',
  mind: 'border-mod-mind',
};

/** Repère d'un espace : plein si fait, anneau si seulement prévu, vide sinon (la place reste fixe). */
export function ModuleMark({ module, state, size = 7 }: { module: CalModule; state: 'done' | 'planned' | 'none'; size?: number }) {
  const cls = state === 'done' ? MODULE_BG[module] : state === 'planned' ? `border-[1.5px] ${MODULE_BORDER[module]}` : '';
  return <span aria-hidden="true" className={`inline-block shrink-0 rounded-full ${cls}`} style={{ width: size, height: size }} />;
}

export function WeekNav({
  label,
  sub,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  label: string;
  sub?: string;
  onPrev: () => void;
  onNext: (() => void) | null;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={onPrev} aria-label={prevLabel} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-anthracite active:opacity-80">
        <Icon name="back" size={20} />
      </button>
      <div className="min-w-0 text-center">
        <p className="truncate text-[17px] font-semibold">{label}</p>
        {sub && <p className="truncate text-[13px] text-cendre">{sub}</p>}
      </div>
      <button
        type="button"
        onClick={onNext ?? undefined}
        disabled={!onNext}
        aria-label={nextLabel}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-anthracite active:opacity-80 disabled:opacity-30"
      >
        <Icon name="chevron" size={20} />
      </button>
    </div>
  );
}
