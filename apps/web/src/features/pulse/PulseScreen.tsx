import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { repos } from '../../db/hooks';
import type { PulseChoice } from '../../db/types';
import { ANALYSIS_LABELS, freshnessText, scoreText } from '../../domain/pulse/analysis';
import { pulseSnapshot, type PulseResult, type Reco } from '../../domain/pulse/pulse';
import type { ComponentResult } from '../../domain/pulse/readiness';
import { LEVEL_LABELS, levelRange } from '../../domain/pulse/settings';
import { formatDayLong, formatDayMonth } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Ring } from '../../ui/Ring';
import { Card, Screen } from '../../ui/Screen';
import { StatusChip } from '../../ui/StatusChip';
import { useToast } from '../../ui/Toast';
import { useHistoryBack } from '../mind/mindShared';
import { startWorkout } from '../training/workoutActions';
import { useCheckInSheet } from '../wellbeing/CheckInSheet';
import { ANALYSIS_ORDER, CONFIDENCE_LABELS, LEVEL_LINES, levelChip, MODE_LABELS, modeChip, nutritionChip, PULSE_DISCLAIMER, signed } from './pulseShared';
import { usePulse } from './usePulse';

const CHOICE_TEXT: Record<PulseChoice, string> = {
  alleger: 'Tu as choisi la version allégée.',
  remplacer: 'Tu as choisi la récupération active à la place de la séance.',
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

/**
 * PULSE, dans l'ordre du cahier : le score et son niveau, l'évolution, la couverture et la confiance,
 * les cinq dimensions, l'analyse du jour, puis les recommandations (séance, nutrition, Mind, récupération).
 */
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
        <div className="flex gap-4">
          <Link to="/pulse/historique" viewTransition className="flex min-h-11 items-center text-[15px] text-cendre underline underline-offset-2">
            Historique
          </Link>
          <Link to="/pulse/reglages" viewTransition className="flex min-h-11 items-center text-[15px] text-cendre underline underline-offset-2">
            Réglages
          </Link>
        </div>
      </div>
      {!model ? <div className="h-64 animate-pulse rounded-[22px] bg-anthracite" aria-busy="true" aria-label="Chargement" /> : <PulseBody model={model} />}
    </Screen>
  );
}

type Model = NonNullable<ReturnType<typeof usePulse>>;

function PulseBody({ model }: { model: Model }) {
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
      <ScoreCard model={model} />
      {alerts.map((a) => (
        <section key={a.id + (a.zone ?? '')} aria-label={a.title} className="flex flex-col gap-1.5 rounded-[18px] border-l-2 border-braise bg-anthracite p-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Icon name="warning" size={18} className="shrink-0 text-braise" />
            {a.title}
          </h2>
          <p className="text-[15px] leading-snug">{a.text}</p>
          {a.to && (
            <Link to={a.to} viewTransition className="self-start text-[13px] text-cendre underline underline-offset-2">
              {a.id === 'douleur-signalee' ? 'Situer la douleur' : 'Voir la fiche'}
            </Link>
          )}
        </section>
      ))}
      <DimensionsSection model={model} />
      <AnalysisSection result={r} />
      <TrainingSection model={model} />
      <RecoSection title="Nutrition" recos={r.nutritionRecos} />
      <RecoSection title="Mind" recos={r.mindRecos} />
      <RecoSection title="Récupération" recos={r.recoveryRecos} />
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

function CheckInLink({ model }: { model: Model }) {
  const { openCheckIn } = useCheckInSheet();
  const c = model.checkIn;
  if (!c) return null;
  const partial = c.sleepHours === null || c.energy === null || c.fatigue === null || c.soreness === null || c.unusualPain === null || c.unusualPain === undefined;
  return (
    <button type="button" onClick={() => openCheckIn()} className="self-start py-1 text-[13px] text-cendre underline underline-offset-2">
      {partial ? 'Compléter le check-in' : 'Corriger le check-in'}
    </button>
  );
}

function ScoreCard({ model }: { model: Model }) {
  const r = model.result;
  const { openCheckIn } = useCheckInSheet();
  const rd = r.readiness;
  if (rd.score === null || !r.level || !rd.confidence) {
    return (
      <Card label="Indicateur PULSE">
        <h2 className="text-[13px] text-cendre">Indicateur PULSE, disponibilité physique et mentale</h2>
        <p className="text-[15px] leading-snug">{rd.unavailable}</p>
        <Button size="small" className="self-start" onClick={() => openCheckIn()}>
          {model.checkIn ? 'Compléter le check-in' : 'Faire le check-in'}
        </Button>
      </Card>
    );
  }
  const chip = levelChip(r.level);
  const [low, high] = levelRange(r.level, model.settings);
  const shown = scoreText(rd.score, rd.confidence);
  const t = r.trend;
  const cells: [string, number | null, number | null][] = [
    ['Hier', t.yesterday, t.vsYesterday],
    ['7 jours', t.mean7, t.vs7],
    ['30 jours', t.mean30, t.vs30],
  ];
  return (
    <Card label="Indicateur PULSE">
      <h2 className="text-[13px] text-cendre">Indicateur PULSE, disponibilité physique et mentale</h2>
      <div className="flex items-center gap-4">
        <Ring value={rd.score / 100} size={112} label={`Indicateur PULSE : ${shown} sur 100`}>
          <span className="font-metal text-[38px] leading-none">{shown}</span>
          <span className="text-[12px] text-cendre">sur 100</span>
        </Ring>
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <StatusChip icon={chip.icon} tone={chip.tone} label={LEVEL_LABELS[r.level]} />
          <p className="text-[15px] leading-snug">{LEVEL_LINES[r.level]}</p>
          <p className="text-[12px] leading-snug text-cendre">
            Niveau de {low} à {high}, une convention réglable.
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2" aria-label="Évolution">
        {cells.map(([label, value, delta]) => (
          <div key={label} className="rounded-[14px] bg-graphite px-2.5 py-2">
            <dt className="text-[12px] text-cendre">{label}</dt>
            <dd className="flex items-baseline gap-1.5">
              <span className="font-metal text-[22px] tabular-nums">{value ?? '—'}</span>
              {delta !== null && <span className="text-[12px] tabular-nums text-cendre">{signed(delta)}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-[12px] leading-snug text-cendre">
        {t.mean7 === null ? 'Les moyennes apparaissent après 3 jours de scores sur 7, et 7 sur 30. ' : 'Écart du jour par rapport à hier et à tes moyennes, le jour exclu. '}
      </p>
      <p className="text-[13px] leading-snug">
        Couverture : {rd.coverage.present} dimension{rd.coverage.present > 1 ? 's' : ''} sur {rd.coverage.total}. {CONFIDENCE_LABELS[rd.confidence]}.
      </p>
      <p className="-mt-2 text-[13px] leading-snug text-cendre">{rd.confidenceText}</p>
      <CheckInLink model={model} />
    </Card>
  );
}

function sourceText(c: ComponentResult, today: string): string {
  const when = freshnessText(c.dataDate, today, formatDayMonth);
  if (c.source === 'mesure') return `Mesuré${when ? ` ${when}` : ''} par ${c.sourceLabel}`;
  if (c.source === 'calcule') return `Calculé d’après tes séances${when ? `, la dernière ${when}` : ''}`;
  return `Déclaré${when ? ` ${when}` : ''}, ${(c.sourceLabel ?? '').replace(/^./, (x) => x.toLocaleLowerCase('fr-FR'))}`;
}

function DimensionsSection({ model }: { model: Model }) {
  const rd = model.result.readiness;
  return (
    <section aria-label="Les cinq dimensions" className="flex flex-col gap-2">
      <h2 className="text-[17px] font-semibold">Les cinq dimensions</h2>
      <ul className="flex flex-col gap-2">
        {rd.components.map((c) => (
          <li key={c.key} className="flex flex-col gap-1.5 rounded-[16px] bg-anthracite p-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-semibold">{c.label}</span>
              <span className="text-[15px] tabular-nums">{c.baseWeight === 0 ? 'ignorée' : c.score === null ? 'pas de donnée' : `${c.score}/100`}</span>
            </div>
            {c.score !== null && (
              <div className="h-1.5 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
                <span className="block h-full rounded-full bg-citron" style={{ width: `${c.score}%` }} />
              </div>
            )}
            <p className="text-[12px] leading-snug text-cendre">
              {c.baseWeight === 0
                ? 'Poids réglé à 0 dans les réglages.'
                : c.score === null
                  ? (c.missing ?? 'Pas de donnée.')
                  : `${sourceText(c, model.today)}. Compte pour ${c.weight} % du score.`}
            </p>
            {c.score !== null && c.lines.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer py-1 text-[13px] text-cendre underline underline-offset-2">Comment c’est calculé</summary>
                <div className="flex flex-col gap-1 pt-1">
                  {c.lines.map((l) => (
                    <p key={l} className="text-[13px] leading-snug">
                      {l}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AnalysisSection({ result: r }: { result: PulseResult }) {
  const a = r.analysis;
  if (!a.items.length && !a.headline) return null;
  return (
    <section aria-label="Analyse du jour" className="flex flex-col gap-2">
      <h2 className="text-[17px] font-semibold">Analyse du jour</h2>
      <div className="flex flex-col gap-3 rounded-[18px] bg-anthracite p-4">
        {a.headline && <p className="text-[15px] leading-snug">{a.headline}</p>}
        {a.factors.length > 0 && (
          <ul className="flex flex-col gap-1.5" aria-label="Principaux facteurs">
            {a.factors.map((f) => (
              <li key={f.key} className="flex items-start gap-2 text-[13px] leading-snug">
                <Icon
                  name={f.direction === 'favorable' ? 'check' : 'info'}
                  size={16}
                  className={`mt-0.5 shrink-0 ${f.direction === 'favorable' ? 'text-citron' : 'text-cendre'}`}
                />
                <span>
                  <span className="sr-only">{f.direction === 'favorable' ? 'Favorable : ' : 'Défavorable : '}</span>
                  {f.text}
                </span>
              </li>
            ))}
          </ul>
        )}
        <dl className="flex flex-col gap-2">
          {ANALYSIS_ORDER.filter((k) => a.items.some((i) => i.kind === k)).map((k) => (
            <div key={k} className="flex flex-col gap-0.5">
              <dt className="text-[12px] font-semibold text-cendre">{ANALYSIS_LABELS[k]}</dt>
              {a.items
                .filter((i) => i.kind === k)
                .map((i) => (
                  <dd key={i.text} className="text-[13px] leading-snug">
                    {i.text}
                  </dd>
                ))}
            </div>
          ))}
        </dl>
        {a.items.some((i) => i.kind === 'hypothese') && <p className="text-[12px] leading-snug text-cendre">Les hypothèses sont des pistes, pas des causes établies.</p>}
      </div>
    </section>
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

function TrainingSection({ model }: { model: Model }) {
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
      toast.show(choice === 'garder' ? 'Séance prévue gardée' : choice === 'remplacer' ? 'Récupération active choisie' : 'Séance déplacée à demain');
    } catch {
      toast.show('Choix non enregistré. Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  const choice = model.record?.choice ?? null;
  const proposal = r.mode && t.template && !['done', 'rest', 'suspended', 'none'].includes(t.kind) ? r.mode : null;
  const capped = r.readiness.modeFromScore && r.mode && r.readiness.modeFromScore !== r.mode ? r.readiness.modeFromScore : null;
  return (
    <section aria-label="Ta séance" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold">Ta séance</h2>
        {proposal && <StatusChip icon={modeChip(proposal).icon} tone={modeChip(proposal).tone} label={MODE_LABELS[proposal]} />}
      </div>
      {capped && <p className="text-[13px] leading-snug text-cendre">Le score seul proposerait « {MODE_LABELS[capped]} » : une règle de sécurité ou de tendance passe avant.</p>}
      <RecoList recos={t.recos} />
      {t.actions.length > 0 && (
        <div className="flex flex-col gap-2">
          {choice && <p className="text-[13px] text-cendre">{CHOICE_TEXT[choice]}</p>}
          {t.actions.includes('alleger') && (
            <Button disabled={busy} onClick={() => void choose('alleger')}>
              Démarrer la version allégée
            </Button>
          )}
          {t.actions.includes('remplacer') && (
            <Button disabled={busy || choice === 'remplacer'} onClick={() => void choose('remplacer')}>
              Faire la récupération active
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
      <p className="text-[12px] leading-snug text-cendre">Indicateur séparé : il ne change pas ton indicateur PULSE. Les repas d’aujourd’hui ne comptent pas encore.</p>
      <Link to="/nutrition" viewTransition className="self-start text-[13px] text-cendre underline underline-offset-2">
        Ouvrir Nutrition
      </Link>
    </Card>
  );
}
