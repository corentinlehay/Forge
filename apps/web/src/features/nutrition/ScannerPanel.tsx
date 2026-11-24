import { useEffect, useRef, useState } from 'react';
import { repos } from '../../db/hooks';
import { isBarcode } from '../../domain/food';
import { fetchProduct, OffError } from '../../services/openFoodFacts';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { choiceFromFood, choiceFromOff, type FoodChoice } from './foodActions';

type Phase = 'starting' | 'scanning' | 'looking' | 'error';

const CAMERA_MESSAGES = {
  denied: 'Accès à la caméra refusé. Autorise-le dans Réglages > Safari > Caméra (ou dans les réglages de l’app installée), puis réessaie. Tu peux aussi taper le code ci-dessous.',
  unavailable: 'Caméra indisponible sur cet appareil. Tape le code-barres ci-dessous.',
  insecure: 'La caméra exige une connexion sécurisée (https).',
} as const;

/**
 * Scanner de codes-barres : caméra arrière, lecture continue, puis fiche Open Food Facts.
 * Rien n'est enregistré avant la confirmation de la quantité.
 */
export function ScannerPanel({ onFound, onNotFound }: { onFound: (choice: FoodChoice) => void; onNotFound: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);

  const lookup = async (code: string) => {
    if (busy.current) return;
    busy.current = true;
    setPhase('looking');
    setMessage(`Code ${code} : recherche…`);
    try {
      const known = (await repos.foods.listActive()).find((f) => f.sourceId === code);
      if (known) return onFound(choiceFromFood(known));
      const product = await fetchProduct(code);
      if (product) return onFound(choiceFromOff(product));
      onNotFound(code);
    } catch (e) {
      setPhase('error');
      setMessage(e instanceof OffError ? e.message : 'La recherche a échoué. Réessaie.');
      busy.current = false;
    }
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let cancelled = false;
    busy.current = false;
    setPhase('starting');
    setMessage(null);
    (async () => {
      try {
        const scanner = await import('../../services/scanner');
        stream = await scanner.openCamera();
        if (cancelled || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setPhase('scanning');
        const tick = async () => {
          if (cancelled || busy.current || !video.current) return;
          try {
            const code = await scanner.detectBarcode(video.current);
            if (code && isBarcode(code)) {
              navigator.vibrate?.(30);
              void lookup(code);
              return;
            }
          } catch {
            // image illisible : on continue
          }
          timer = window.setTimeout(() => void tick(), 220);
        };
        void tick();
      } catch (e) {
        const kind = (e as { kind?: keyof typeof CAMERA_MESSAGES }).kind ?? 'unavailable';
        setPhase('error');
        setMessage(CAMERA_MESSAGES[kind]);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <div className="flex flex-col gap-4 pb-1">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-noir">
        <video ref={video} playsInline muted className="h-full w-full object-cover" aria-label="Aperçu de la caméra" />
        {phase === 'scanning' && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] top-1/2 h-[34%] -translate-y-1/2 rounded-[14px] border-2 border-module/80 shadow-[0_0_0_999px_rgb(0_0_0/0.35)]" />
        )}
      </div>
      <p className="min-h-[20px] text-[15px] leading-snug" aria-live="polite">
        {phase === 'starting' && <span className="text-cendre">Ouverture de la caméra…</span>}
        {phase === 'scanning' && <span className="text-cendre">Vise le code-barres, à 15 cm environ.</span>}
        {(phase === 'looking' || phase === 'error') && message}
      </p>
      {phase === 'error' && (
        <Button
          variant="secondary"
          onClick={() => {
            busy.current = false;
            setAttempt((a) => a + 1);
          }}
        >
          Réessayer
        </Button>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (isBarcode(manual)) void lookup(manual.trim());
          else setMessage('Un code-barres compte 8, 12, 13 ou 14 chiffres.');
        }}
      >
        <Field label="Ou tape le code" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={14} className="flex-1" />
        <Button type="submit" size="small" variant="secondary" className="h-12" disabled={!manual}>
          Chercher
        </Button>
      </form>
    </div>
  );
}
