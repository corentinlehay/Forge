import { useState } from 'react';
import { repos } from '../../db/hooks';
import { ONBOARDING_KEY, type OnboardingState, type OnboardingStep } from '../../domain/onboarding';
import { nowIso } from '../../lib/ids';
import { requestPersistentStorage } from '../../services/storage';
import { enterDemo } from '../../services/demo';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { ImportBackup } from '../backup/ImportBackup';
import { useWeighInSheet } from '../weight/WeighInSheet';
import { InstallGuide, InstallWhy, isIos } from './InstallGuide';
import { PlanQuestionnaire } from '../plan/PlanQuestionnaire';

const merge = (patch: Partial<OnboardingState>) => repos.meta.merge<OnboardingState>(ONBOARDING_KEY, patch);

export function OnboardingFlow({ step }: { step: Exclude<OnboardingStep, 'done'> }) {
  if (step === 'install') return <InstallStep />;
  if (step === 'welcome') return <WelcomeStep />;
  if (step === 'plan') return <PlanQuestionnaire mode="onboarding" onFinished={() => void merge({ planDone: true })} onSkip={() => void merge({ planSkipped: true })} />;
  return <FirstWeighInStep />;
}

function Title({ children }: { children: string }) {
  return <h1 className="font-metal text-[56px]">{children}</h1>;
}

function InstallStep() {
  const ios = isIos();
  return (
    <Screen withTabBar={false}>
      <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-48px)] flex-col gap-6">
        <div className="flex flex-col gap-3 pt-6">
          <Title>FORGE</Title>
          <p className="text-[17px] leading-snug">{ios ? 'Installe l’app sur ton écran d’accueil.' : 'Bienvenue.'}</p>
          {ios && <InstallWhy />}
        </div>
        <InstallGuide />
        <div className="mt-auto flex flex-col gap-2">
          {ios ? (
            <>
              <p className="text-[13px] leading-snug text-cendre">Pour tester sans installer, tu peux continuer ici : les données resteront dans Safari.</p>
              <Button variant="secondary" onClick={() => void merge({ installSkipped: true })}>
                Continuer dans Safari
              </Button>
            </>
          ) : (
            <Button onClick={() => void merge({ installSkipped: true })}>Continuer</Button>
          )}
        </div>
      </div>
    </Screen>
  );
}

function WelcomeStep() {
  const [firstName, setFirstName] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    void requestPersistentStorage();
    const name = firstName.trim();
    if (name) await repos.profile.update({ firstName: name.slice(0, 80) });
    await merge({ welcomeDone: true });
  };

  return (
    <Screen withTabBar={false}>
      <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-48px)] flex-col gap-6">
        <div className="flex flex-col gap-3 pt-6">
          <Title>FORGE</Title>
          <p className="text-[17px] leading-snug">
            Musculation, nutrition, poids et récupération, au même endroit. Tes données restent sur ton appareil.
          </p>
          <p className="text-[15px] leading-snug text-cendre">
            Quelques questions et FORGE construit ton plan de départ : programme d’entraînement et objectifs nutritionnels. Tout reste modifiable.
          </p>
        </div>

        {restoring ? (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] leading-snug text-cendre">Choisis un fichier forge-sauvegarde, dans Fichiers ou iCloud Drive.</p>
            <ImportBackup variant="primary" onImported={() => void merge({ welcomeDone: true, completedAt: nowIso() })} />
            <Button variant="quiet" onClick={() => setRestoring(false)}>
              Retour
            </Button>
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-2">
              <span className="text-[15px] font-semibold">Ton prénom</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void start()}
                autoComplete="given-name"
                enterKeyHint="go"
                maxLength={80}
                placeholder="Facultatif"
                className="h-[52px] rounded-[14px] bg-anthracite px-4 text-[17px] placeholder:text-cendre"
              />
            </label>
            <div className="mt-auto flex flex-col gap-2">
              <Button onClick={() => void start()} disabled={busy}>
                Commencer
              </Button>
              <Button variant="quiet" onClick={() => setRestoring(true)}>
                J’ai déjà une sauvegarde
              </Button>
              <Button variant="quiet" onClick={() => void enterDemo()}>
                Explorer avec des données de démonstration
              </Button>
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}

function FirstWeighInStep() {
  const { openNew } = useWeighInSheet();
  return (
    <Screen withTabBar={false}>
      <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-48px)] flex-col gap-6">
        <div className="flex flex-col gap-3 pt-6">
          <Title>Première pesée</Title>
          <p className="text-[17px] leading-snug">Ce qui compte, c’est le rythme de ton poids sur plusieurs semaines, pas une pesée isolée.</p>
          <p className="text-[15px] leading-snug text-cendre">
            Chaque matin, au réveil, à jeun, après être passé aux toilettes. FORGE lisse les variations d’un jour à l’autre (eau, sel, repas) pour
            calculer ton poids tendance et ton rythme par semaine.
          </p>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <Button onClick={openNew}>Me peser maintenant</Button>
          <Button variant="quiet" onClick={() => void merge({ firstWeighInSkipped: true })}>
            Plus tard
          </Button>
        </div>
      </div>
    </Screen>
  );
}
