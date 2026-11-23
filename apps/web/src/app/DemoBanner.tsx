import { useState } from 'react';
import { exitDemo } from '../services/demo';

/** Bandeau permanent en mode démo : impossible de confondre ces chiffres avec les tiens. */
export function DemoBanner() {
  const [busy, setBusy] = useState(false);
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-40 flex h-[calc(env(safe-area-inset-top)+40px)] items-end justify-center bg-citron-voile px-4 pb-2 text-[13px] text-citron"
    >
      <span className="flex items-center gap-3">
        <span className="font-semibold">Démonstration : données fictives</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void exitDemo();
          }}
          className="min-h-8 rounded-full border border-citron/60 px-3 font-semibold"
        >
          {busy ? 'Sortie…' : 'Quitter'}
        </button>
      </span>
    </div>
  );
}
