import type { KeypadKey } from '../domain/keypadInput';
import { Icon } from './Icon';

const keys: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back'];

/** Pavé numérique dédié : grandes touches, utilisable d'une main. */
export function Keypad({ onKey }: { onKey: (key: KeypadKey) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Pavé numérique">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onKey(key)}
          aria-label={key === 'back' ? 'Effacer' : key === ',' ? 'Virgule' : key}
          className="flex h-[58px] items-center justify-center rounded-[14px] bg-graphite font-display text-[28px] font-semibold transition-colors active:bg-cendre/40"
        >
          {key === 'back' ? <Icon name="backspace" size={26} /> : key}
        </button>
      ))}
    </div>
  );
}
