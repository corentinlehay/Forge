import { Link } from 'react-router';
import { ANALYSIS_LABELS, freshnessText, scoreText } from '../../domain/pulse/analysis';
import type { PulseResult } from '../../domain/pulse/pulse';
import type { ComponentResult } from '../../domain/pulse/readiness';
import { LEVEL_LABELS, levelRange } from '../../domain/pulse/settings';
import { formatDayLong, formatDayMonth, formatDayShort } from '../../lib/format';
import { BarChart } from '../../ui/BarChart';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { Ring } from '../../ui/Ring';
import { Card, Screen } from '../../ui/Screen';
import { StatusChip } from '../../ui/StatusChip';
import { useHistoryBack } from '../mind/mindShared';
import { useCheckInSheet } from '../wellbeing/CheckInSheet';
import { PlanSection } from './PlanSection';
import { ProposalCard } from './ProposalCard';
import { ReviewSection } from './ReviewSection';
import { ANALYSIS_ORDER, CONFIDENCE_LABELS, LEVEL_LINES, levelChip, nutritionChip, PULSE_DISCLAIMER, signed } from './pulseShared';
import { usePulse, type PulseModel } from './usePulse';

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

type Model = PulseModel;

function PulseBody({ model }: { model: Model }) {
  const r = model.result;
  const alerts = r.rules.filter((h) => h.level !== 'nutrition');
  const sources = [
    ...new Set([
      ...r.plan.flatMap((x) => (x.source ? [x.source] : [])),
      ...alerts.flatMap((a) => (a.source ? [a.source] : [])),
      ...(r.proposal?.source ? [r.proposal.source] : []),
    ]),
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
      <QuickLinks />
      <DimensionsSection model={model} />
      <AnalysisSection result={r} />
      <PlanSection plan={r.plan} />
      <ProposalCard model={model} />
      <ReviewSection model={model} hour={new Date().getHours()} />
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

function QuickLinks() {
  const links: [string, string, IconName][] = [
    ['/training', 'Training', 'training'],
    ['/nutrition', 'Nutrition', 'nutrition'],
    ['/mind', 'Mind', 'mind'],
  ];
  return (
    <nav aria-label="Accès rapides" className="grid grid-cols-3 gap-2">
      {links.map(([to, label, icon]) => (
        <Link key={to} to={to} viewTransition className="flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] bg-anthracite px-2 py-2.5 text-[14px] active:opacity-80">
          <Icon name={icon} size={18} className="text-cendre" />
          {label}
        </Link>
      ))}
    </nav>
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
      {r.recent.filter((p) => p.score !== null).length >= 2 && (
        <BarChart
          title="Indicateur PULSE, 14 derniers jours"
          height={72}
          bars={r.recent.map((p, i) => ({
            key: p.date,
            label: i % 3 === (r.recent.length - 1) % 3 ? String(Number(p.date.slice(8, 10))) : '',
            value: p.score ?? 0,
            detail: `${formatDayShort(p.date)} : ${p.score === null ? 'pas de score' : `${p.score}/100`}`,
          }))}
        />
      )}
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
    <Card label="Les cinq dimensions">
      <h2 className="text-[17px] font-semibold">Les cinq dimensions</h2>
      <ul className="flex flex-col divide-y divide-graphite">
        {rd.components.map((c) => (
          <li key={c.key} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
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
              <details>
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
    </Card>
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
