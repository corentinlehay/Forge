import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/Button';

const HOUR = 60 * 60 * 1000;

/**
 * Mise à jour proposée, jamais imposée : la nouvelle version s'installe quand tu le décides.
 * La vérification se fait à l'ouverture, puis toutes les heures.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) window.setInterval(() => void registration.update(), HOUR);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(max(env(safe-area-inset-bottom),10px)+72px)] z-30 mx-auto flex max-w-[536px] animate-fade-in items-center gap-3 rounded-[18px] bg-graphite p-3 pl-4 shadow-xl lg:bottom-6"
    >
      <p className="flex-1 text-[15px]">Une nouvelle version de FORGE est prête.</p>
      <Button variant="quiet" onClick={() => setNeedRefresh(false)}>
        Plus tard
      </Button>
      <Button size="small" onClick={() => void updateServiceWorker(true)}>
        Mettre à jour
      </Button>
    </div>
  );
}
