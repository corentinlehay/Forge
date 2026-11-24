import { useEffect, useMemo } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { repos, useMeta, useWeighIns } from '../db/hooks';
import { nextOnboardingStep, ONBOARDING_KEY, type OnboardingState } from '../domain/onboarding';
import { isDemoMode } from '../db/dataMode';
import { OnboardingFlow } from '../features/onboarding/OnboardingFlow';
import { CheckInSheetProvider } from '../features/wellbeing/CheckInSheet';
import { AudioPlayerProvider, MiniPlayer } from '../features/audio/AudioPlayer';
import { ToastProvider } from '../ui/Toast';
import { DemoBanner } from './DemoBanner';
import { WeighInSheetProvider } from '../features/weight/WeighInSheet';
import { nowIso } from '../lib/ids';
import { isStandalone, requestPersistentStorage } from '../services/storage';
import { TabBar } from '../ui/TabBar';
import { UpdateBanner } from './UpdateBanner';
import { moduleOf } from './modules';

/** Coquille de l'app : onboarding tant qu'il n'est pas terminé, puis les 5 espaces. */
export function AppShell() {
  const demo = useMemo(isDemoMode, []);
  // En démo, le bandeau occupe le haut de l'écran : les écrans descendent d'autant.
  useEffect(() => {
    document.documentElement.style.setProperty('--demo-offset', demo ? '40px' : '0px');
  }, [demo]);
  return (
    <ToastProvider>
      <WeighInSheetProvider>
        <CheckInSheetProvider>
          <AudioPlayerProvider>
            {demo && <DemoBanner />}
            <ShellContent />
            <UpdateBanner />
            <ScrollRestoration />
          </AudioPlayerProvider>
        </CheckInSheetProvider>
      </WeighInSheetProvider>
    </ToastProvider>
  );
}

function ShellContent() {
  const onboarding = useMeta<OnboardingState>(ONBOARDING_KEY);
  const weighIns = useWeighIns();
  const standalone = useMemo(isStandalone, []);
  const { pathname } = useLocation();

  const loading = onboarding === undefined || weighIns === undefined;
  const step = loading ? null : nextOnboardingStep(onboarding, { standalone, hasWeighIns: weighIns.length > 0 });

  useEffect(() => {
    if (step === 'done' && !onboarding?.completedAt) void repos.meta.merge<OnboardingState>(ONBOARDING_KEY, { completedAt: nowIso() });
  }, [step, onboarding?.completedAt]);

  // Dans l'app installée, on redemande la protection du stockage à chaque ouverture (sans effet si déjà accordée).
  useEffect(() => {
    if (standalone) void requestPersistentStorage();
  }, [standalone]);

  if (step === null) return <div className="min-h-dvh bg-noir" aria-busy="true" />;
  if (step !== 'done') return <OnboardingFlow step={step} />;

  const withTabBar = !['/reglages', '/training/', '/nutrition/', '/mind/', '/progression/', '/coach', '/pulse'].some((p) => pathname.startsWith(p));
  return (
    <div className="lg:pl-24" data-module={moduleOf(pathname)}>
      <Outlet />
      {withTabBar && <TabBar />}
      {!pathname.startsWith('/training/seance') && <MiniPlayer withTabBar={withTabBar} />}
    </div>
  );
}
