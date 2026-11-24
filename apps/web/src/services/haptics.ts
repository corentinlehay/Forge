/**
 * Retour haptique, quand la plateforme le permet :
 * - Android et navigateurs compatibles : l'API de vibration ;
 * - iPhone (Safari, iOS 18 et plus) : le retour natif d'un interrupteur système, déclenché sans rien afficher.
 * Ailleurs, rien ne se passe. À appeler pendant un geste (appui), sinon l'iPhone l'ignore.
 */
export type HapticKind = 'light' | 'success' | 'warning';

const PATTERNS: Record<HapticKind, number | number[]> = { light: 12, success: [14, 60, 22], warning: [30, 50, 30] };

let label: HTMLLabelElement | null = null;

function iosSwitch(): HTMLLabelElement | null {
  if (label) return label;
  if (typeof document === 'undefined') return null;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.id = 'forge-haptic';
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  label = document.createElement('label');
  label.htmlFor = input.id;
  label.setAttribute('aria-hidden', 'true');
  Object.assign(label.style, { position: 'fixed', width: '1px', height: '1px', overflow: 'hidden', opacity: '0', pointerEvents: 'none', left: '-10px', top: '0' });
  label.appendChild(input);
  document.body.appendChild(label);
  return label;
}

export function haptic(kind: HapticKind = 'light'): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind]);
      return;
    }
    const l = iosSwitch();
    if (!l) return;
    const focused = document.activeElement as HTMLElement | null;
    l.click();
    if (kind !== 'light') window.setTimeout(() => l.click(), 90);
    focused?.focus?.({ preventScroll: true });
  } catch {
    // Pas de retour haptique disponible : sans conséquence.
  }
}
