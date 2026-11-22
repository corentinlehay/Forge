import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Feuille qui monte du bas de l'écran (élément <dialog> natif : focus, touche Échap, couche supérieure).
 * Un toucher hors de la feuille la referme.
 */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
    } else if (dialog.open) {
      dialog.close();
    }
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-craie open:animate-fade-in"
    >
      {open && (
        <div className="pb-safe absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] w-full max-w-[560px] animate-sheet-in overflow-y-auto rounded-t-[28px] bg-anthracite px-5 pt-3">
          <div aria-hidden="true" className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-graphite" />
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={titleId} className="font-metal text-[28px]">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-graphite text-cendre"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
