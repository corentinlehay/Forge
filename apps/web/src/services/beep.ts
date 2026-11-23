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
