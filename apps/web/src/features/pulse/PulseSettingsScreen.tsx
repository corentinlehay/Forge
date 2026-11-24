import { repos, useMeta } from '../../db/hooks';
import {
  COMPONENT_LABELS,
  COMPONENT_ORDER,
  DEFAULT_PULSE_SETTINGS,
  LEVEL_BOUNDS,
  MODE_BOUNDS,
  PULSE_SETTINGS_KEY,
  resolveSettings,
  SETTING_BOUNDS,
  WEIGHT_BOUNDS,
  type PulseSettings,
} from '../../domain/pulse/settings';
import { formatHours, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Card, Screen } from '../../ui/Screen';
import { Stepper } from '../../ui/Stepper';
import { useToast } from '../../ui/Toast';
import { PulseBack } from './PulseScreen';
import { PULSE_DISCLAIMER } from './pulseShared';

const pct = (v: number) => `${formatNumber(v, 0)} %`;
const ratio = (v: number) => formatNumber(v, 2);

/** Réglages PULSE : poids et seuils, gardés sur l'iPhone et dans la sauvegarde. */
export function PulseSettingsScreen() {
  const stored = useMeta<unknown>(PULSE_SETTINGS_KEY);
  const toast = useToast();
  const s = resolveSettings(stored);
  const save = (next: PulseSettings) => void repos.meta.set(PULSE_SETTINGS_KEY, resolveSettings(next));
  const total = COMPONENT_ORDER.reduce((n, k) => n + s.weights[k], 0);
  const isDefault = JSON.stringify(s) === JSON.stringify(DEFAULT_PULSE_SETTINGS);

  return (
    <Screen withTabBar={false}>
      <PulseBack fallback="/pulse" />
      <h1 className="font-metal -mt-2 text-[40px]">Réglages PULSE</h1>
      <p className="text-[15px] leading-snug text-cendre">
        Les valeurs de départ sont des exemples de conception. Ajuste-les à tes vraies journées : le score se recalcule tout de suite.
      </p>

      <Card label="Poids des composantes">
        <h2 className="text-[17px] font-semibold">Poids des composantes</h2>
        <p className="text-[13px] leading-snug text-cendre">
          Poids relatifs (total actuel : {total}). Une composante à 0 est ignorée ; une composante sans donnée voit son poids réparti sur les autres.
        </p>
        {COMPONENT_ORDER.map((k) => (
          <Stepper
            key={k}
            label={COMPONENT_LABELS[k]}
            value={s.weights[k]}
            {...WEIGHT_BOUNDS}
            start={DEFAULT_PULSE_SETTINGS.weights[k]}
            format={(v) => formatNumber(v, 0)}
            onChange={(v) => save({ ...s, weights: { ...s.weights, [k]: v } })}
          />
        ))}
      </Card>

      <Card label="Niveaux de lecture">
        <h2 className="text-[17px] font-semibold">Niveaux de lecture</h2>
        <p className="text-[13px] leading-snug text-cendre">
          Score à partir duquel chaque niveau s’affiche ; en dessous du premier, disponibilité basse. Des conventions d’interface, pas des seuils médicaux.
        </p>
        <Stepper
          label="Modérée"
          value={s.levels.moderee}
          {...LEVEL_BOUNDS}
          start={40}
          format={(v) => formatNumber(v, 0)}
          onChange={(v) => save({ ...s, levels: { ...s.levels, moderee: v } })}
        />
        <Stepper
          label="Satisfaisante"
          value={s.levels.satisfaisante}
          {...LEVEL_BOUNDS}
          start={60}
          format={(v) => formatNumber(v, 0)}
          onChange={(v) => save({ ...s, levels: { ...s.levels, satisfaisante: v } })}
        />
        <Stepper
          label="Élevée"
          value={s.levels.elevee}
          {...LEVEL_BOUNDS}
          start={80}
          format={(v) => formatNumber(v, 0)}
          onChange={(v) => save({ ...s, levels: { ...s.levels, elevee: v } })}
        />
      </Card>

      <Card label="Proposition de séance">
        <h2 className="text-[17px] font-semibold">Proposition de séance</h2>
        <p className="text-[13px] leading-snug text-cendre">
          Score à partir duquel chaque proposition s’applique ; en dessous du dernier seuil, récupération active. Ce n’est qu’une proposition : tu peux toujours garder la séance
          prévue.
        </p>
        <Stepper
          label="Progression"
          value={s.modes.feuVert}
          {...MODE_BOUNDS}
          start={75}
          format={(v) => formatNumber(v, 0)}
          onChange={(v) => save({ ...s, modes: { ...s.modes, feuVert: v } })}
        />
        <Stepper
          label="Séance prévue"
          value={s.modes.normal}
          {...MODE_BOUNDS}
          start={55}
          format={(v) => formatNumber(v, 0)}
          onChange={(v) => save({ ...s, modes: { ...s.modes, normal: v } })}
        />
        <Stepper
          label="Version allégée"
          value={s.modes.allege}
          {...MODE_BOUNDS}
          start={40}
          format={(v) => formatNumber(v, 0)}
          onChange={(v) => save({ ...s, modes: { ...s.modes, allege: v } })}
        />
      </Card>

      <Card label="Sommeil et charge">
        <h2 className="text-[17px] font-semibold">Sommeil et charge</h2>
        <Stepper
          label="Sommeil visé"
          value={s.sleepTargetHours}
          {...SETTING_BOUNDS.sleepTargetHours}
          start={7}
          format={formatHours}
          onChange={(v) => save({ ...s, sleepTargetHours: v })}
        />
        <Stepper
          label="Nuit courte"
          value={s.shortNightHours}
          {...SETTING_BOUNDS.shortNightHours}
          start={5}
          format={formatHours}
          onChange={(v) => save({ ...s, shortNightHours: v })}
        />
        <Stepper label="Charge basse" value={s.loadLow} {...SETTING_BOUNDS.loadLow} start={0.8} format={ratio} onChange={(v) => save({ ...s, loadLow: v })} />
        <Stepper label="Charge élevée" value={s.loadHigh} {...SETTING_BOUNDS.loadHigh} start={1.3} format={ratio} onChange={(v) => save({ ...s, loadHigh: v })} />
        <Stepper label="Charge très élevée" value={s.loadVeryHigh} {...SETTING_BOUNDS.loadVeryHigh} start={1.5} format={ratio} onChange={(v) => save({ ...s, loadVeryHigh: v })} />
        <p className="text-[12px] leading-snug text-cendre">
          Sous la nuit courte, la proposition ne dépasse pas la version allégée. Charge : séries des 7 derniers jours rapportées à ta moyenne par semaine sur 4 semaines ; basse
          sous le premier seuil, élevée et très élevée au-delà des deux autres. Un repère, pas un prédicteur de blessure.
        </p>
      </Card>

      <Card label="Nutrition Status">
        <h2 className="text-[17px] font-semibold">Nutrition Status</h2>
        <Stepper
          label="Écart calories toléré"
          value={s.kcalTolerancePct}
          {...SETTING_BOUNDS.kcalTolerancePct}
          start={10}
          format={pct}
          onChange={(v) => save({ ...s, kcalTolerancePct: v })}
        />
        <Stepper label="Apport bas sous" value={s.lowIntakePct} {...SETTING_BOUNDS.lowIntakePct} start={75} format={pct} onChange={(v) => save({ ...s, lowIntakePct: v })} />
        <Stepper
          label="Protéines suffisantes"
          value={s.proteinMinPct}
          {...SETTING_BOUNDS.proteinMinPct}
          start={90}
          format={pct}
          onChange={(v) => save({ ...s, proteinMinPct: v })}
        />
        <p className="text-[12px] leading-snug text-cendre">
          Écart toléré autour des calories visées ; apport bas sous le pourcentage indiqué de ton objectif ; protéines jugées suffisantes à partir du pourcentage indiqué.
        </p>
      </Card>

      <Button
        variant="quiet"
        disabled={isDefault}
        onClick={() => {
          void repos.meta.set(PULSE_SETTINGS_KEY, DEFAULT_PULSE_SETTINGS);
          toast.show('Valeurs de départ remises');
        }}
      >
        Revenir aux valeurs de départ
      </Button>
      <p className="text-[12px] leading-snug text-cendre">{PULSE_DISCLAIMER}</p>
    </Screen>
  );
}
