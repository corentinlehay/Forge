/**
 * Signal sonore de fin de repos (Web Audio).
 * Sur iPhone, le son doit être « débloqué » par un toucher : on le fait à la validation d'une série.
 * Le son ne passe pas si l'iPhone est en mode silencieux ou si l'app est en arrière-plan.
 */
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function beep(): void {
  try {
    if (!ctx) return;
    const start = ctx.currentTime + 0.02;
    [0, 0.22, 0.44].forEach((offset, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 2 ? 1320 : 880;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.16);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.18);
    });
    navigator.vibrate?.([120, 80, 120]);
  } catch {
    /* pas de son : le minuteur reste visible à l'écran */
  }
}

/**
 * Repère doux pour les exercices FORGE MIND : une note longue et feutrée.
 * in : montée (inspiration), out : descente (expiration), step : changement d'étape, end : fin.
 */
export function chime(kind: 'in' | 'out' | 'hold' | 'step' | 'end'): void {
  try {
    if (!ctx) return;
    const start = ctx.currentTime + 0.02;
    const notes: [number, number][] =
      kind === 'in'
        ? [[392, 523.25]]
        : kind === 'out'
          ? [[523.25, 392]]
          : kind === 'hold'
            ? [[440, 440]]
            : kind === 'step'
              ? [[659.25, 659.25]]
              : [
                  [523.25, 523.25],
                  [784, 784],
                ];
    notes.forEach(([from, to], i) => {
      const t = start + i * 0.35;
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.linearRampToValueAtTime(to, t + 0.6);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.95);
    });
  } catch {
    /* pas de son : l'exercice reste guidé à l'écran */
  }
}
