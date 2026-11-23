import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ToastApi {
  show: (text: string) => void;
}

const Ctx = createContext<ToastApi>({ show: () => undefined });

export function useToast(): ToastApi {
  return useContext(Ctx);
}

/** Confirmation brève après une action (« Pesée enregistrée »), en haut de l'écran. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const show = useCallback((text: string) => setToast({ text, key: Date.now() }), []);
  const api = useMemo(() => ({ show }), [show]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+8px+var(--demo-offset,0px))] z-50 flex justify-center px-4">
        {toast && (
          <p key={toast.key} role="status" className="flex animate-fade-in items-center gap-2 rounded-full bg-graphite px-4 py-2.5 text-[15px] shadow-xl">
            <Icon name="check" size={16} strokeWidth={3} className="text-citron" />
            {toast.text}
          </p>
        )}
      </div>
    </Ctx.Provider>
  );
}
