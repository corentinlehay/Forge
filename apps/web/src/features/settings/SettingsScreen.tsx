import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { repos, useMeta, useProfile, useToday, useWeighIns } from '../../db/hooks';
import { clearAllData } from '../../db/maintenance';
import { DEFAULT_GAIN_RATE, ProfileError } from '../../db/repositories/profile';
import { getDb } from '../../db/schema';
import type { GainRate } from '../../db/types';
import { gainBandKg, summarizeWeight } from '../../domain/weight';
import { toLocalDateKey } from '../../lib/dates';
import { capitalize, formatBytes, formatDaysAgo, formatFullDate, formatPct, formatSignedKg } from '../../lib/format';
import { LAST_BACKUP_KEY } from '../../services/backup';
import { isStandalone, requestPersistentStorage, storageUsage, type StorageUsage } from '../../services/storage';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { ImportBackup } from '../backup/ImportBackup';
import { exportMessage, useBackupExport } from '../backup/useBackupExport';
import { InstallGuide } from '../onboarding/InstallGuide';
import { isDemoMode } from '../../db/dataMode';
import { enterDemo, exitDemo, reloadDemo } from '../../services/demo';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[15px]">
      <span className="text-cendre">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export function SettingsScreen() {
  return (
    <Screen withTabBar={false}>
      <div className="flex flex-col gap-2">
        <Link to="/" className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
          <Icon name="back" size={20} />
          Accueil
        </Link>
        <h1 className="font-metal text-[40px]">Réglages</h1>
      </div>
      <ProfileSection />
      <GainRateSection />
      <DemoSection />
      {!isDemoMode() && <BackupSection />}
      <DeviceSection />
      {!isDemoMode() && <ResetSection />}
      <p className="px-1 text-[13px] text-cendre">
        FORGE, version {__FORGE_VERSION__} du {formatFullDate(__FORGE_BUILT_AT__)}
      </p>
    </Screen>
  );
}

function ProfileSection() {
  const profile = useProfile();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? profile?.firstName ?? '';

  const save = async () => {
    if (draft === null) return;
    const name = draft.trim().slice(0, 80);
    await repos.profile.update({ firstName: name || undefined });
    setDraft(null);
  };

  return (
    <Section title="Profil">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] text-cendre">Prénom</span>
        <input
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          autoComplete="given-name"
          enterKeyHint="done"
          maxLength={80}
          placeholder="Facultatif"
          className="h-11 rounded-[12px] bg-graphite px-3 text-[17px] placeholder:text-cendre"
        />
      </label>
      <p className="text-[13px] leading-snug text-cendre">
        Taille, âge et niveau te seront demandés avec la nutrition et l’entraînement, quand ils serviront.
      </p>
    </Section>
  );
}

const STEP = 0.05;
const round2 = (v: number) => Math.round(v * 100) / 100;

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px]">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label} : diminuer`}
          disabled={value - STEP < min - 1e-9}
          onClick={() => onChange(round2(value - STEP))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-graphite disabled:opacity-40"
        >
          <Icon name="minus" size={18} />
        </button>
        <span className="w-[76px] text-center text-[17px] font-semibold tabular-nums" aria-live="polite">
          {formatPct(value)}
        </span>
        <button
          type="button"
          aria-label={`${label} : augmenter`}
          disabled={value + STEP > max + 1e-9}
          onClick={() => onChange(round2(value + STEP))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-graphite disabled:opacity-40"
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    </div>
  );
}

function GainRateSection() {
  const profile = useProfile();
  const weighIns = useWeighIns();
  const [error, setError] = useState<string | null>(null);
  const rate = profile?.gainRate ?? DEFAULT_GAIN_RATE;
  const trend = useMemo(() => summarizeWeight(weighIns ?? [], rate).latestTrendKg, [weighIns, rate]);
  const isDefault =
    rate.lowPctPerWeek === DEFAULT_GAIN_RATE.lowPctPerWeek && rate.highPctPerWeek === DEFAULT_GAIN_RATE.highPctPerWeek;

  const save = async (next: GainRate) => {
    setError(null);
    try {
      await repos.profile.update({ gainRate: next });
    } catch (e) {
      setError(e instanceof ProfileError ? e.message : 'Enregistrement impossible.');
    }
  };

  const band = trend !== null ? gainBandKg(trend, rate) : null;

  return (
    <Section title="Rythme de prise visé">
      <p className="text-[13px] leading-snug text-cendre">
        En % de ton poids par semaine. Point de départ conseillé pour une prise de masse contrôlée : 0,25 à 0,5 % (Iraki et al., 2019).
      </p>
      <Stepper
        label="Au moins"
        value={rate.lowPctPerWeek}
        min={0}
        max={rate.highPctPerWeek - STEP}
        onChange={(v) => void save({ ...rate, lowPctPerWeek: v })}
      />
      <Stepper
        label="Au plus"
        value={rate.highPctPerWeek}
        min={rate.lowPctPerWeek + STEP}
        max={2}
        onChange={(v) => void save({ ...rate, highPctPerWeek: v })}
      />
      {band && (
        <p className="text-[15px]">
          Soit {formatSignedKg(band.lowKgPerWeek).replace(' kg', '')} à {formatSignedKg(band.highKgPerWeek)} par semaine aujourd’hui.
        </p>
      )}
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      {!isDefault && (
        <Button variant="quiet" className="-ml-2 self-start" onClick={() => void save({ ...DEFAULT_GAIN_RATE })}>
          Revenir à 0,25 à 0,5 %
        </Button>
      )}
    </Section>
  );
}

function BackupSection() {
  const lastBackupAt = useMeta<string>(LAST_BACKUP_KEY);
  const today = useToday();
  const backup = useBackupExport();
  const message = exportMessage(backup.state);
  const lastLabel =
    lastBackupAt === undefined ? '' : lastBackupAt ? capitalize(formatDaysAgo(toLocalDateKey(new Date(lastBackupAt)), today)) : 'Jamais';

  return (
    <Section title="Sauvegarde">
      <Row label="Dernière sauvegarde" value={lastLabel} />
      <p className="text-[13px] leading-snug text-cendre">
        Un fichier complet de tes données, à enregistrer dans Fichiers ou iCloud Drive. Il permet de tout retrouver sur un autre appareil ou
        après un effacement.
      </p>
      <Button variant="secondary" onClick={() => void backup.run()} disabled={!backup.ready || backup.state === 'working'}>
        <Icon name="share" size={20} />
        Exporter mes données
      </Button>
      {message && (
        <p className="text-[15px] text-cendre" role="status">
          {message}
        </p>
      )}
      <ImportBackup />
    </Section>
  );
}

function DeviceSection() {
  const standalone = useMemo(isStandalone, []);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const supported = typeof navigator !== 'undefined' && typeof navigator.storage?.persisted === 'function';

  useEffect(() => {
    if (supported) void navigator.storage.persisted().then(setPersisted);
    void storageUsage().then(setUsage);
    // Le service worker actif garde une copie complète de l'app : elle s'ouvre sans réseau.
    void navigator.serviceWorker?.getRegistration().then((reg) => setOfflineReady(Boolean(reg?.active)));
  }, [supported]);

  const ask = async () => {
    const result = await requestPersistentStorage();
    setPersisted(result === 'granted');
  };

  return (
    <Section title="Appareil">
      <Row label="Application" value={standalone ? 'Installée' : 'Ouverte dans le navigateur'} />
      <Row label="Hors ligne" value={offlineReady ? 'Disponible' : 'Pas encore prête'} />
      {!standalone && (
        <Button variant="quiet" className="-ml-2 self-start" onClick={() => setGuideOpen(true)}>
          Installer sur l’écran d’accueil
        </Button>
      )}
      <Row label="Stockage protégé" value={!supported ? 'Non pris en charge' : persisted === null ? '' : persisted ? 'Oui' : 'Non'} />
      {supported && persisted === false && (
        <>
          <p className="text-[13px] leading-snug text-cendre">
            Sans protection, iOS peut effacer les données d’un site peu utilisé quand l’espace manque. Installée et ouverte souvent, l’app est
            protégée plus facilement. La sauvegarde reste la vraie sécurité.
          </p>
          <Button variant="quiet" className="-ml-2 self-start" onClick={() => void ask()}>
            Demander la protection
          </Button>
        </>
      )}
      {usage && <Row label="Espace utilisé" value={formatBytes(usage.usedBytes)} />}
      <Sheet open={guideOpen} title="Installer FORGE" onClose={() => setGuideOpen(false)}>
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[13px] leading-snug text-cendre">
            L’app installée a son propre stockage : exporte d’abord tes données ici, puis importe-les dans l’app.
          </p>
          <InstallGuide />
        </div>
      </Sheet>
    </Section>
  );
}

function ResetSection() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const backup = useBackupExport();

  const reset = async () => {
    setBusy(true);
    await clearAllData(getDb());
    navigate('/', { replace: true });
  };

  return (
    <Section title="Effacer les données">
      {confirming ? (
        <>
          <p className="flex items-start gap-2 text-[15px] leading-snug">
            <Icon name="warning" size={20} className="mt-0.5 shrink-0 text-braise" />
            Ton profil, tes pesées et tes réglages seront effacés de cet appareil. Sans sauvegarde, ils sont perdus.
          </p>
          <Button variant="secondary" onClick={() => void backup.run()} disabled={!backup.ready || backup.state === 'working'}>
            {backup.state === 'done' ? 'Sauvegarde enregistrée' : 'Exporter d’abord'}
          </Button>
          <Button variant="danger" onClick={() => void reset()} disabled={busy}>
            Tout effacer
          </Button>
          <Button variant="quiet" onClick={() => setConfirming(false)}>
            Annuler
          </Button>
        </>
      ) : (
        <>
          <p className="text-[13px] leading-snug text-cendre">
            Remet l’app à zéro sur cet appareil. Tu pourras réimporter une sauvegarde ensuite.
          </p>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Tout effacer…
          </Button>
        </>
      )}
    </Section>
  );
}

function DemoSection() {
  const demo = isDemoMode();
  const [busy, setBusy] = useState(false);
  const run = (action: () => Promise<void>) => {
    setBusy(true);
    void action();
  };
  return (
    <section id="demo" aria-label="Données de démonstration" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
      <h2 className="text-[17px] font-semibold">Données de démonstration</h2>
      {demo ? (
        <>
          <p className="text-[13px] leading-snug text-cendre">
            Tu explores FORGE avec des données fictives, dans un espace séparé. Tes vraies données sont intactes et réapparaissent dès que tu quittes la
            démo. La sauvegarde et l’effacement sont désactivés ici.
          </p>
          <Button variant="secondary" disabled={busy} onClick={() => run(reloadDemo)}>
            Régénérer la démo
          </Button>
          <Button disabled={busy} onClick={() => run(exitDemo)}>
            Quitter la démo et supprimer les données fictives
          </Button>
        </>
      ) : (
        <>
          <p className="text-[13px] leading-snug text-cendre">
            Explore FORGE avec 12 semaines de données fictives : pesées, séances, repas, check-ins. Elles vivent dans un espace séparé : tes données ne
            sont ni modifiées ni mélangées, et un bandeau reste affiché tant que tu es dans la démo.
          </p>
          <Button variant="secondary" disabled={busy} onClick={() => run(enterDemo)}>
            Explorer la démo
          </Button>
        </>
      )}
    </section>
  );
}
