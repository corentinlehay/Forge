import { useMemo, useState } from 'react';
import { useMeta, usePulseDays } from '../../db/hooks';
import type { PulseComponentKey, PulseDay } from '../../db/types';
import { scoreText } from '../../domain/pulse/analysis';
import { decisionText, FEEL_MIN_TEXT, REVIEW_CHANGE_LABELS, reviewSummary } from '../../domain/pulse/decisions';
import { toLocalTimeKey } from '../../lib/dates';
import { periodSummary, proposalOf, readinessSeries, type PeriodSummary, type SeriesPoint } from '../../domain/pulse/history';
import { COMPONENT_LABELS, COMPONENT_ORDER, LEVEL_LABELS, levelFor, PULSE_SETTINGS_KEY, resolveSettings, type PulseSettings } from '../../domain/pulse/settings';
import { checkInSummary } from '../../domain/wellbeing';
import { addDays } from '../../lib/dates';
import { formatDayLong, formatDayMonth, formatDayShort, formatHours, formatNumber, formatTime } from '../../lib/format';
import { BarChart } from '../../ui/BarChart';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Card, Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { useLifeData, type LifeModel } from '../review/useLifeData';
import { PulseBack } from './PulseScreen';
import { CHOICE_SHORT, MODE_LABELS, RULE_LABELS, signed } from './pulseShared';

type View = 'jour' | 'semaine' | 'mois' | 'periode';
const VIEWS: { value: View; label: string }[] = [
  { value: 'jour', label: 'Jour' },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
  { value: 'periode', label: 'Période' },
];
const LENGTH: Record<'semaine' | 'mois', number> = { semaine: 7, mois: 30 };
/** Une période personnalisée va jusqu'à 180 jours (et autant pour la période précédente). */
const MAX_DAYS = 180;

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;

/** Historique PULSE : un jour, une semaine, un mois ou une période choisie, comparés à la période précédente de même durée. */
export function PulseHistoryScreen() {
  const life = useLifeData();
  const journal = usePulseDays();
  const stored = useMeta<unknown>(PULSE_SETTINGS_KEY);
  const ready = life && journal && stored !== undefined;
  return (
    <Screen withTabBar={false}>
      <PulseBack fallback="/pulse" />
      <h1 className="font-metal -mt-2 text-[40px]">Historique PULSE</h1>
      {!ready ? (
        <div className="h-64 animate-pulse rounded-[22px] bg-anthracite" aria-busy="true" aria-label="Chargement" />
      ) : (
        <HistoryBody life={life} journal={journal} settings={resolveSettings(stored)} />
      )}
    </Screen>
  );
}

function HistoryBody({ life, journal, settings }: { life: LifeModel; journal: PulseDay[]; settings: PulseSettings }) {
  const today = life.today;
  const [view, setView] = useState<View>('semaine');
  const [end, setEnd] = useState(today);
  const [day, setDay] = useState(today);
  const [from, setFrom] = useState(addDays(today, -13));
  const [to, setTo] = useState(today);

  const range = useMemo(() => {
    if (view === 'jour') return { from: day, to: day };
    if (view === 'periode') {
      const t = to > today ? today : to;
      const f = from > t ? t : from < addDays(t, -(MAX_DAYS - 1)) ? addDays(t, -(MAX_DAYS - 1)) : from;
      return { from: f, to: t };
    }
    return { from: addDays(end, -(LENGTH[view] - 1)), to: end };
  }, [view, day, end, from, to, today]);
  const length = daysBetween(range.from, range.to);
  const previous = { from: addDays(range.from, -length), to: addDays(range.from, -1) };

  const series = useMemo(
    () => readinessSeries({ index: life.index, health: [], settings }, view === 'jour' ? range.from : previous.from, range.to),
    [life.index, settings, view, range.from, range.to, previous.from],
  );

  return (
    <>
      <Segmented label="Période affichée" options={VIEWS} value={view} onChange={setView} />
      {view === 'jour' && <Field label="Jour" type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} />}
      {(view === 'semaine' || view === 'mois') && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Période précédente"
            onClick={() => setEnd(addDays(end, -LENGTH[view]))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-anthracite"
          >
            <Icon name="back" size={18} />
          </button>
          <p className="text-[15px]">
            Du {formatDayMonth(range.from)} au {formatDayMonth(range.to)}
          </p>
          <button
            type="button"
            aria-label="Période suivante"
            disabled={end >= today}
            onClick={() => setEnd(addDays(end, LENGTH[view]) > today ? today : addDays(end, LENGTH[view]))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-anthracite disabled:opacity-40"
          >
            <Icon name="chevron" size={18} />
          </button>
        </div>
      )}
      {view === 'periode' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Du" type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            <Field label="Au" type="date" value={range.to} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </div>
          <p className="-mt-2 text-[12px] text-cendre">
            Jusqu’à {MAX_DAYS} jours, comparés aux {MAX_DAYS} jours précédents au plus.
          </p>
        </>
      )}

      {view === 'jour' ? (
        <DayView
          date={day}
          point={series.find((p) => p.date === day) ?? null}
          record={journal.find((d) => d.date === day && !d.deletedAt) ?? null}
          life={life}
          settings={settings}
        />
      ) : (
        <PeriodView series={series} journal={journal} range={range} previous={previous} />
      )}

      <p className="text-[12px] leading-snug text-cendre">
        Scores recalculés à partir des données de chaque jour, avec tes réglages actuels. Les propositions et tes choix viennent du journal PULSE, tenu depuis PULSE 1. Une
        comparaison décrit un écart : elle ne dit pas ce qui l’a causé.
      </p>
    </>
  );
}

function DayView({ date, point, record, life, settings }: { date: string; point: SeriesPoint | null; record: PulseDay | null; life: LifeModel; settings: PulseSettings }) {
  const checkIn = life.index.get(date)?.checkIn ?? null;
  const proposal = record ? proposalOf(record) : null;
  return (
    <>
      <Card label="Score du jour">
        <h2 className="text-[13px] text-cendre">{formatDayLong(date)}</h2>
        {point?.score !== null && point?.score !== undefined ? (
          <>
            <p className="flex items-baseline gap-2">
              <span className="font-metal text-[44px] leading-none">{scoreText(point.score, point.confidence)}</span>
              <span className="text-[15px] text-cendre">sur 100, {LEVEL_LABELS[levelFor(point.score, settings)].toLocaleLowerCase('fr-FR')}</span>
            </p>
            <dl className="flex flex-col gap-1 text-[13px]">
              {COMPONENT_ORDER.map((k) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-cendre">{COMPONENT_LABELS[k]}</dt>
                  <dd className="tabular-nums">{point.components[k] === null ? 'pas de donnée' : `${point.components[k]}/100`}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="text-[15px] leading-snug">Pas de score ce jour-là : il faut au moins le sommeil ou le ressenti du check-in.</p>
        )}
        <p className="text-[13px] leading-snug text-cendre">Check-in : {checkIn ? checkInSummary(checkIn) : 'pas de check-in'}.</p>
      </Card>
      <Card label="Journal du jour">
        <h2 className="text-[17px] font-semibold">Journal PULSE</h2>
        {record ? (
          <>
            {record.readiness !== null && (
              <p className="text-[13px] leading-snug">
                Affiché ce jour-là : {record.readiness}/100 (règles v{record.engineVersion}).
              </p>
            )}
            <p className="text-[13px] leading-snug">
              Proposition :{' '}
              {proposal === 'lighten'
                ? MODE_LABELS.allege.toLocaleLowerCase('fr-FR')
                : proposal === 'replace'
                  ? MODE_LABELS.recuperation.toLocaleLowerCase('fr-FR')
                  : record.mode
                    ? MODE_LABELS[record.mode].toLocaleLowerCase('fr-FR')
                    : 'aucune'}
              {record.choice ? `, ${CHOICE_SHORT[record.choice]}` : proposal === 'lighten' || proposal === 'replace' ? ', sans réponse' : ''}.
            </p>
            {record.rules.length > 0 && <p className="text-[13px] leading-snug">Règles : {record.rules.map((id) => RULE_LABELS[id] ?? id).join(', ')}.</p>}
            {(record.decisions ?? []).length > 0 && (
              <div className="flex flex-col gap-0.5">
                <p className="text-[12px] text-cendre">Décisions</p>
                <ol className="flex flex-col gap-0.5 text-[13px] leading-snug">
                  {record.decisions!.map((d) => (
                    <li key={d.at + d.action}>
                      {formatTime(toLocalTimeKey(new Date(d.at)))} : {decisionText(d)}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {record.plan && record.plan.length > 0 && (
              <p className="text-[13px] leading-snug">
                Plan proposé : {record.plan.length} élément{record.plan.length > 1 ? 's' : ''}
                {record.review ? `, ${record.review.done.length} noté${record.review.done.length > 1 ? 's' : ''} comme fait${record.review.done.length > 1 ? 's' : ''}` : ''}.
              </p>
            )}
            {record.review ? (
              <div className="flex flex-col gap-0.5">
                <p className="text-[12px] text-cendre">Bilan du soir</p>
                <p className="text-[13px] leading-snug">{reviewSummary(record.review)}.</p>
                {record.review.changes.length > 0 && (
                  <p className="text-[13px] leading-snug">
                    Modifications :{' '}
                    {record.review.changes
                      .map((c) => REVIEW_CHANGE_LABELS.get(c) ?? c)
                      .join(', ')
                      .toLocaleLowerCase('fr-FR')}
                    .
                  </p>
                )}
                {record.review.note && <p className="text-[13px] leading-snug text-cendre">« {record.review.note} »</p>}
              </div>
            ) : (
              <p className="text-[13px] leading-snug text-cendre">Pas de bilan du soir ce jour-là.</p>
            )}
          </>
        ) : (
          <p className="text-[13px] leading-snug text-cendre">PULSE n’a pas été ouvert ce jour-là.</p>
        )}
      </Card>
    </>
  );
}

type Range = { from: string; to: string };

/** Moyennes par semaine au-delà de 31 jours, pour garder des barres lisibles. */
function chartBars(points: SeriesPoint[]) {
  if (points.length <= 31) {
    return points.map((p, i) => ({
      key: p.date,
      label: points.length <= 7 || i % 5 === (points.length - 1) % 5 ? String(Number(p.date.slice(8, 10))) : '',
      value: p.score ?? 0,
      detail: `${formatDayShort(p.date)} : ${p.score === null ? 'pas de score' : `${p.score}/100`}`,
    }));
  }
  const weeks: SeriesPoint[][] = [];
  for (let i = points.length; i > 0; i -= 7) weeks.unshift(points.slice(Math.max(0, i - 7), i));
  return weeks.map((w) => {
    const scored = w.filter((p) => p.score !== null);
    const avg = scored.length ? Math.round(scored.reduce((n, p) => n + p.score!, 0) / scored.length) : null;
    return {
      key: w[0]!.date,
      label: String(Number(w[0]!.date.slice(8, 10))),
      value: avg ?? 0,
      detail: `Semaine du ${formatDayMonth(w[0]!.date)} : ${avg === null ? 'pas de score' : `${avg}/100 en moyenne`}`,
    };
  });
}

function PeriodView({ series, journal, range, previous }: { series: SeriesPoint[]; journal: PulseDay[]; range: Range; previous: Range }) {
  const now = periodSummary(series, journal, range.from, range.to);
  const before = periodSummary(series, journal, previous.from, previous.to);
  const points = series.filter((p) => p.date >= range.from && p.date <= range.to);
  return (
    <>
      <Card label="Évolution du score">
        <h2 className="text-[13px] text-cendre">
          Indicateur PULSE{points.length > 31 ? ', moyenne par semaine' : ', par jour'} ({now.scoredDays} jour{now.scoredDays > 1 ? 's' : ''} avec un score sur {now.days})
        </h2>
        {now.scoredDays ? (
          <BarChart title="Indicateur PULSE" bars={chartBars(points)} />
        ) : (
          <p className="text-[15px] leading-snug">Aucun score sur cette période : il faut au moins un check-in.</p>
        )}
      </Card>
      <ComparisonCard now={now} before={before} />
      <AcceptanceCard now={now} before={before} />
      <ReviewsCard now={now} />
    </>
  );
}

const value = (v: number | null, f: (n: number) => string) => (v === null ? '—' : f(v));
const delta = (a: number | null, b: number | null, digits = 0) => (a === null || b === null ? null : Math.round((a - b) * 10 ** digits) / 10 ** digits);

function ComparisonCard({ now, before }: { now: PeriodSummary; before: PeriodSummary }) {
  const n0 = (v: number) => formatNumber(v, 0);
  const rows: { label: string; a: string; b: string; d: string | null }[] = [
    {
      label: 'Indicateur moyen',
      a: value(now.avgScore, n0),
      b: value(before.avgScore, n0),
      d: (() => {
        const x = delta(now.avgScore, before.avgScore);
        return x === null ? null : signed(x);
      })(),
    },
    ...COMPONENT_ORDER.map((k: PulseComponentKey) => {
      const x = delta(now.components[k], before.components[k]);
      return { label: COMPONENT_LABELS[k], a: value(now.components[k], n0), b: value(before.components[k], n0), d: x === null ? null : signed(x) };
    }),
    {
      label: `Sommeil moyen (${now.sleepNights} nuit${now.sleepNights > 1 ? 's' : ''})`,
      a: value(now.avgSleep, formatHours),
      b: value(before.avgSleep, formatHours),
      d: (() => {
        const x = delta(now.avgSleep, before.avgSleep, 2);
        if (x === null) return null;
        const sign = x > 0 ? '+' : x < 0 ? '−' : '';
        return Math.abs(x) < 1 ? `${sign}${Math.round(Math.abs(x) * 60)} min` : `${sign}${formatHours(Math.abs(x))}`;
      })(),
    },
    {
      label: `Stress moyen (${now.stressDays} jour${now.stressDays > 1 ? 's' : ''})`,
      a: value(now.avgStress, (v) => `${formatNumber(v, 1)}/5`),
      b: value(before.avgStress, (v) => `${formatNumber(v, 1)}/5`),
      d: (() => {
        const x = delta(now.avgStress, before.avgStress, 1);
        return x === null ? null : `${x > 0 ? '+' : x < 0 ? '−' : ''}${formatNumber(Math.abs(x), 1)}`;
      })(),
    },
    { label: 'Séries par semaine', a: n0(now.setsPerWeek), b: n0(before.setsPerWeek), d: signed(now.setsPerWeek - before.setsPerWeek) },
  ];
  return (
    <Card label="Comparaison">
      <h2 className="text-[17px] font-semibold">Comparaison avec la période précédente</h2>
      <p className="-mt-1 text-[12px] text-cendre">
        Du {formatDayMonth(before.from)} au {formatDayMonth(before.to)}, même durée.
      </p>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-cendre">
            <th className="py-1 font-normal">Moyenne</th>
            <th className="py-1 text-right font-normal">Période</th>
            <th className="py-1 text-right font-normal">Avant</th>
            <th className="py-1 text-right font-normal">Écart</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-graphite">
              <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                {r.label}
              </th>
              <td className="py-1.5 text-right tabular-nums">{r.a}</td>
              <td className="py-1.5 text-right tabular-nums text-cendre">{r.b}</td>
              <td className="py-1.5 text-right tabular-nums">{r.d ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function AcceptanceCard({ now, before }: { now: PeriodSummary; before: PeriodSummary }) {
  const a = now.acceptance;
  const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)} %`);
  return (
    <Card label="Propositions et choix">
      <h2 className="text-[17px] font-semibold">Propositions et choix</h2>
      {a.proposals === 0 ? (
        <p className="text-[15px] leading-snug">Aucune version allégée ni récupération active proposée sur cette période.</p>
      ) : (
        <>
          <p className="text-[15px] leading-snug">
            {a.proposals} proposition{a.proposals > 1 ? 's' : ''} de version allégée ou de récupération active : {a.accepted} acceptée{a.accepted > 1 ? 's' : ''}, {a.kept} fois la
            séance prévue gardée, {a.unanswered} sans réponse.
          </p>
          <p className="text-[13px] leading-snug">
            Taux d’acceptation : {pct(a.rate)}
            {before.acceptance.rate !== null ? `, contre ${pct(before.acceptance.rate)} la période précédente` : ''}.
          </p>
        </>
      )}
      <p className="text-[12px] leading-snug text-cendre">
        Accepter, c’est choisir la version allégée, la récupération active ou le report. Garder la séance prévue reste toujours possible.
      </p>
    </Card>
  );
}

function ReviewsCard({ now }: { now: PeriodSummary }) {
  const v = now.reviews;
  return (
    <Card label="Bilans du soir">
      <h2 className="text-[17px] font-semibold">Bilans du soir</h2>
      {v.count === 0 ? (
        <p className="text-[15px] leading-snug">Aucun bilan sur cette période. Le bilan se fait dans PULSE à partir de 17 h, ou le lendemain.</p>
      ) : (
        <>
          <p className="text-[15px] leading-snug">
            {v.count} bilan{v.count > 1 ? 's' : ''}. Plan suivi : oui {v.followed.oui}, en partie {v.followed.partiel}, non {v.followed.non}. Recommandations utiles : oui{' '}
            {v.useful.oui}, un peu {v.useful['un-peu']}, non {v.useful.non}.
          </p>
          {(v.avgDay !== null || v.avgSession !== null) && (
            <p className="text-[13px] leading-snug">
              {[
                v.avgDay !== null ? `Journées vécues à ${formatNumber(v.avgDay, 1)}/5 en moyenne` : null,
                v.avgSession !== null ? `séances à ${formatNumber(v.avgSession, 1)}/5` : null,
              ]
                .filter(Boolean)
                .join(', ')}
              .
            </p>
          )}
          {v.dayAfterAccepted !== null && v.dayAfterKept !== null ? (
            <p className="text-[13px] leading-snug">
              Les jours où tu as accepté une proposition, journée à {formatNumber(v.dayAfterAccepted, 1)}/5 ({v.acceptedReviews} bilans) ; les jours où tu as gardé la séance
              prévue, {formatNumber(v.dayAfterKept, 1)}/5 ({v.keptReviews} bilans). Un écart observé, pas une preuve de cause.
            </p>
          ) : (
            <p className="text-[12px] leading-snug text-cendre">{FEEL_MIN_TEXT}</p>
          )}
        </>
      )}
    </Card>
  );
}
