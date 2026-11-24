import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { repos } from '../../db/hooks';
import type { PulseChoice } from '../../db/types';
import { pulseSnapshot, type PulseResult, type Reco } from '../../domain/pulse/pulse';
import type { ComponentResult } from '../../domain/pulse/readiness';
import { formatDayLong } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Ring } from '../../ui/Ring';
import { Card, Screen } from '../../ui/Screen';
import { StatusChip } from '../../ui/StatusChip';
import { useToast } from '../../ui/Toast';
import { useHistoryBack } from '../mind/mindShared';
import { startWorkout } from '../training/workoutActions';
import { useCheckInSheet } from '../wellbeing/CheckInSheet';
import { CONFIDENCE_LABELS, MODE_LABELS, MODE_LINES, modeChip, nutritionChip, PULSE_DISCLAIMER } from './pulseShared';
import { usePulse } from './usePulse';

const CHOICE_TEXT: Record<PulseChoice, string> = {
  alleger: 'Tu as choisi la version allégée.',
  garder: 'Tu as gardé la séance prévue.',
  deplacer: 'Tu as déplacé la séance à demain : PULSE te la proposera demain.',
};

export function PulseBack({ fallback = '/' }: { fallback?: string }) {
  const back = useHistoryBack(fallback);
  return (
    <button type="button" onClick={back} className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      Retour
    </button>
  );
}

/** PULSE : Readiness Score et Nutrition Status du jour, règles prioritaires, recommandations et leurs raisons. */
export function PulseScreen() {
  const model = usePulse();
  return (
    <Screen withTabBar={false}>
      <PulseBack />
      <div className="-mt-2 flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-metal text-[40px] leading-none">PULSE</h1>
          <p className="text-[15px] text-cendre">{model ? formatDayLong(model.today) : ' '}</p>
        </div>
        <Link to="/pulse/reglages" viewTransition className="flex min-h-11 items-center text-[15px] text-cendre underline underline-offset-2">
          Réglages
        </Link>
      </div>
      {!model ? <div className="h-64 animate-pulse rounded-[22px] bg-anthracite" aria-busy="true" aria-label="Chargement" /> : <PulseBody model={model} />}
    </Screen>
  );
}

function PulseBody({ model }: { model: NonNullable<ReturnType<typeof usePulse>> }) {
  const r = model.result;
  const alerts = r.rules.filter((h) => h.level !== 'nutrition');
  const sources = [
    ...new Set(
      [r.training.recos, r.nutritionRecos, r.mindRecos, r.recoveryRecos]
        .flat()
        .flatMap((x) => (x.source ? [x.source] : []))
        .concat(alerts.flatMap((a) => (a.source ? [a.source] : []))),
    ),
  ];
  return (
    <>
      <ReadinessCard result={r} />
      {alerts.map((a) => (
        <section key={a.id + (a.zone ?? '')} aria-label={a.title} className="flex flex-col gap-1.5 rounded-[18px] border-l-2 border-braise bg-anthracite p-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Icon name="warning" size={18} className="shrink-0 text-braise" />
            {a.title}
          </h2>
          <p className="text-[15px] leading-snug">{a.text}</p>
          {a.to && (
            <Link to={a.to} viewTransition className="self-start text-[13px] text-cendre underline underline-offset-2">
              Voir la fiche
            </Link>
          )}
        </section>
      ))}
      <TrainingSection model={model} />
      <RecoSection title="Nutrition" recos={r.nutritionRecos} />
      <RecoSection title="Mind" recos={r.mindRecos} />
      <RecoSection title="Recovery" recos={r.recoveryRecos} />
      {r.readiness.score !== null && <ComponentsSection components={r.readiness.components} />}
      <NutritionCard result={r} />
      <section aria-label="À propos de PULSE" className="flex flex-col gap-2 text-[12px] leading-snug text-cendre">
        <p>{PULSE_DISCLAIMER}</p>
        {sources.length > 0 && (
          <ul className="flex flex-col gap-1">
            {sources.map((s) => (
              <li key={s}>Source : {s}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function ReadinessCard({ result: r }: { result: PulseResult }) {
  const { openCheckIn } = useCheckInSheet();
  if (r.readiness.score === null || !r.mode) {
    return (
      <Card label="Readiness Score">
        <h2 className="text-[13px] text-cendre">Readiness Score</h2>
        <p className="text-[15px] leading-snug">{r.readiness.unavailable}</p>
        <Button size="small" className="self-start" onClick={() => openCheckIn()}>
          Faire le check-in
        </Button>
      </Card>
    );
  }
  const chip = modeChip(r.mode);
  const capped = r.readiness.modeFromScore !== r.mode;
  return (
    <Card label="Readiness Score">
      <h2 className="text-[13px] text-cendre">Readiness Score, disponibilité physique et mentale</h2>
      <div className="flex items-center gap-4">
        <Ring value={r.readiness.score / 100} size={112} label={`Readiness Score : ${r.readiness.score} sur 100`}>
          <span className="font-metal text-[38px] leading-none">{r.readiness.score}</span>
          <span className="text-[12px] text-cendre">sur 100</span>
        </Ring>
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <StatusChip icon={chip.icon} tone={chip.tone} label={MODE_LABELS[r.mode]} />
          <p className="text-[15px] leading-snug">{MODE_LINES[r.mode]}</p>
        </div>
      </div>
      {capped && r.readiness.modeFromScore && (
        <p className="text-[13px] leading-snug text-cendre">
          Le score seul donnerait « {MODE_LABELS[r.readiness.modeFromScore]} » : une règle de sécurité ou de tendance passe avant.
        </p>
      )}
      <p className="text-[13px] leading-snug text-cendre">
        {r.readiness.confidence ? `${CONFIDENCE_LABELS[r.readiness.confidence]}. ` : ''}
        {r.readiness.confidenceText}
      </p>
    </Card>
  );
}

function RecoList({ recos }: { recos: Reco[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {recos.map((x) => {
        const body = (
          <>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[15px] leading-snug">{x.text}</span>
              {x.reason && <span className="text-[13px] leading-snug text-cendre">{x.reason}</span>}
              {x.source && <span className="text-[12px] text-cendre">Source : {x.source}</span>}
            </span>
            {x.to && <Icon name="chevron" size={16} className="mt-1 shrink-0 text-cendre" />}
          </>
        );
        return (
          <li key={x.id}>
            {x.to ? (
              <Link to={x.to} viewTransition className="flex items-start gap-2.5 rounded-[16px] bg-anthracite p-3.5 active:opacity-80">
                {body}
              </Link>
            ) : (
              <div className="flex items-start gap-2.5 rounded-[16px] bg-anthracite p-3.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RecoSection({ title, recos }: { title: string; recos: Reco[] }) {
  if (!recos.length) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <RecoList recos={recos} />
    </section>
  );
}

function TrainingSection({ model }: { model: NonNullable<ReturnType<typeof usePulse>> }) {
  const r = model.result;
  const t = r.training;
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (t.kind === 'blocked') return null;

  async function choose(choice: PulseChoice) {
    setBusy(true);
    try {
      await repos.pulseDays.saveSnapshot(pulseSnapshot(r));
      await repos.pulseDays.choose(r.date, choice);
      if (choice === 'alleger' && t.template) {
        const id = await startWorkout(t.template, new Date(), t.adjustment);
        navigate(`/training/seance/${id}`, { viewTransition: true });
        return;
      }
      toast.show(choice === 'garder' ? 'Séance prévue gardée' : 'Séance déplacée à demain');
    } catch {
      toast.show('Choix non enregistré. Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  const choice = model.record?.choice ?? null;
  return (
    <section aria-label="Training" className="flex flex-col gap-2">
      <h2 className="text-[17px] font-semibold">Training</h2>
      <RecoList recos={t.recos} />
      {t.actions.length > 0 && (
        <div className="flex flex-col gap-2">
          {choice && <p className="text-[13px] text-cendre">{CHOICE_TEXT[choice]}</p>}
          {t.actions.includes('alleger') && (
            <Button disabled={busy} onClick={() => void choose('alleger')}>
              Démarrer la version allégée
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            {t.actions.includes('garder') && (
              <Button variant="quiet" disabled={busy || choice === 'garder'} onClick={() => void choose('garder')}>
                Garder la séance prévue
              </Button>
            )}
            {t.actions.includes('deplacer') && (
              <Button variant="quiet" disabled={busy || choice === 'deplacer'} onClick={() => void choose('deplacer')}>
                Déplacer à demain
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ComponentsSection({ components }: { components: ComponentResult[] }) {
  return (
    <section aria-label="Détail du score" className="flex flex-col gap-2">
      <h2 className="text-[17px] font-semibold">Détail du score</h2>
      <ul className="flex flex-col gap-2">
        {components
          .filter((c) => c.baseWeight > 0)
          .map((c) => (
            <li key={c.key} className="flex flex-col gap-1.5 rounded-[16px] bg-anthracite p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] font-semibold">{c.label}</span>
                <span className="text-[15px] tabular-nums">{c.score === null ? 'pas de donnée' : `${c.score}/100`}</span>
              </div>
              {c.score !== null && (
                <div className="h-1.5 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
                  <span className="block h-full rounded-full bg-citron" style={{ width: `${c.score}%` }} />
                </div>
              )}
              <p className="text-[12px] text-cendre">
                {c.score === null
                  ? `Poids réglé ${c.baseWeight}, réparti sur les autres composantes.`
                  : `Compte pour ${c.weight} % du score. Source : ${c.sourceLabel}${c.source === 'declare' ? ' (déclaré)' : c.source === 'mesure' ? ' (mesuré)' : ' (calculé)'}.`}
              </p>
              {c.lines.map((l) => (
                <p key={l} className="text-[13px] leading-snug">
                  {l}
                </p>
              ))}
              {c.missing && <p className="text-[13px] leading-snug text-cendre">{c.missing}</p>}
            </li>
          ))}
      </ul>
    </section>
  );
}

function NutritionCard({ result: r }: { result: PulseResult }) {
  const n = r.nutrition;
  const chip = nutritionChip(n.kind);
  const hits = r.rules.filter((h) => h.level === 'nutrition');
  return (
    <Card label="Nutrition Status">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] text-cendre">Nutrition Status, cohérence avec tes objectifs</h2>
        {n.score !== null && <span className="text-[15px] tabular-nums">{n.score}/100</span>}
      </div>
      <StatusChip icon={chip.icon} tone={chip.tone} label={n.label} />
      {hits.map((h) => (
        <p key={h.id} className="flex items-start gap-2 text-[15px] leading-snug">
          <Icon name="warning" size={18} className="mt-0.5 shrink-0 text-braise" />
          {h.text}
        </p>
      ))}
      {n.lines.map((l) => (
        <p key={l} className="text-[13px] leading-snug">
          {l}
        </p>
      ))}
      <p className="text-[12px] leading-snug text-cendre">Indicateur séparé : il ne change pas ton Readiness Score. Les repas d’aujourd’hui ne comptent pas encore.</p>
      <Link to="/nutrition" viewTransition className="self-start text-[13px] text-cendre underline underline-offset-2">
        Ouvrir Nutrition
      </Link>
    </Card>
  );
}
