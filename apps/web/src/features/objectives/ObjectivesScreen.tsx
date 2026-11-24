import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { repos, useProfile, useTargetChanges, useToday, useWeighIns } from '../../db/hooks';
import { DEFAULT_GAIN_RATE } from '../../db/repositories/profile';
import { getDb } from '../../db/schema';
import { saveTargets } from '../../db/targets';
import type { NutritionTargets, TargetChange } from '../../db/types';
import { summarizeWeight } from '../../domain/weight';
import { formatDayShort, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { TargetsForm } from '../nutrition/FoodSheet';
import { DISMISS_DAYS, DISMISS_KEY, useTargetAnalysis } from './useTargetAnalysis';

const SOURCE_LABELS: Record<TargetChange['source'], string> = { proposition: 'Proposition acceptée', manuel: 'Modifié à la main', questionnaire: 'Questionnaire de départ' };
/** Termine une phrase sans doubler le point d'une abréviation (« déc. »). */
const endSentence = (s: string) => (s.endsWith('.') ? s : `${s}.`);
const signedPct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Math.abs(v))}`;

function TargetsLine({ t }: { t: NutritionTargets }) {
  return (
    <span>
      {formatNumber(t.kcal, 0)} kcal, {formatNumber(t.proteinG, 0)} g P, {formatNumber(t.carbsG, 0)} g G, {formatNumber(t.fatG, 0)} g L
    </span>
  );
}

/** Objectifs dynamiques : analyse des 2 à 4 dernières semaines, proposition expliquée, validation, historique. */
export function ObjectivesScreen() {
  const profile = useProfile();
  const weighIns = useWeighIns();
  const changes = useTargetChanges();
  const result = useTargetAnalysis();
  const today = useToday();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const trendKg = useMemo(() => summarizeWeight(weighIns ?? [], profile?.gainRate ?? DEFAULT_GAIN_RATE).latestTrendKg, [weighIns, profile]);

  if (!profile || !changes || !result)
    return (
      <Screen withTabBar={false}>
        <BackLink />
      </Screen>
    );
  const { analysis: a, dismissedUntil } = result;
  const targets = profile.nutritionTargets ?? null;
  const rate = profile.gainRate ?? DEFAULT_GAIN_RATE;

  const accept = async () => {
    if (!a.proposal) return;
    setBusy(true);
    await saveTargets(getDb(), a.proposal.targets, 'proposition', [a.proposal.reasons[0], a.findings[0]].filter(Boolean).join(' '));
    await repos.meta.set(DISMISS_KEY, null);
    toast.show(`Objectif mis à jour : ${formatNumber(a.proposal.targets.kcal, 0)} kcal`);
    setBusy(false);
  };

  return (
    <Screen withTabBar={false}>
      <BackLink />
      <h1 className="font-metal text-[40px] leading-none">Objectifs</h1>

      <section aria-label="Objectifs actuels" className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-[18px]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold">Objectifs actuels</h2>
          <Button size="small" variant="secondary" onClick={() => setEditing(true)}>
            {targets ? 'Modifier' : 'Définir'}
          </Button>
        </div>
        {targets ? (
          <>
            <p className="font-metal text-[40px] leading-none">
              {formatNumber(targets.kcal, 0)} <span className="font-sans text-[15px] font-normal text-cendre">kcal par jour</span>
            </p>
            <p className="text-[15px] text-cendre">
              {formatNumber(targets.proteinG, 0)} g de protéines, {formatNumber(targets.carbsG, 0)} g de glucides, {formatNumber(targets.fatG, 0)} g de lipides
            </p>
          </>
        ) : (
          <p className="text-[15px] text-cendre">Pas encore d’objectifs. Définis-les, ou réponds au questionnaire de départ dans Réglages.</p>
        )}
        <p className="border-t border-graphite pt-2 text-[13px] text-cendre">
          Rythme de poids visé : {signedPct(rate.lowPctPerWeek)} à {signedPct(rate.highPctPerWeek)} % par semaine.{' '}
          <Link to="/reglages" viewTransition className="text-module">
            Changer
          </Link>
        </p>
      </section>

      <section aria-label="Analyse" className="flex flex-col gap-3">
        <h2 className="text-[17px] font-semibold">Analyse</h2>
        {a.status === 'no-targets' && <p className="text-[15px] text-cendre">L’analyse démarre dès que tu as des objectifs.</p>}
        {a.status === 'waiting' && (
          <p className="text-[15px] leading-snug text-cendre">
            Objectifs changés récemment : FORGE attend 14 jours de données avant d’analyser, pour ne pas réagir à quelques pesées. Prochaine analyse possible le{' '}
            {endSentence(formatDayShort(a.availableOn!).toLocaleLowerCase('fr-FR'))}
          </p>
        )}
        {a.status === 'insufficient' && (
          <div className="flex flex-col gap-1 rounded-[18px] border border-graphite p-4 text-[15px] leading-snug">
            <p>Pas encore assez de données sur les {a.days} derniers jours :</p>
            <ul className="list-disc pl-5 text-cendre">
              {a.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <p className="text-[13px] text-cendre">Pèse-toi le matin et note tes repas en entier : l’analyse se fera d’elle-même.</p>
          </div>
        )}
        {a.status === 'ok' && (
          <>
            <ul className="flex flex-col gap-2 text-[15px] leading-snug">
              {a.findings.map((f) => (
                <li key={f} className="flex gap-2">
                  <Icon name="info" size={16} className="mt-0.5 shrink-0 text-cendre" />
                  {f}
                </li>
              ))}
            </ul>
            {a.rateStatus === 'within' && (
              <p className="flex items-center gap-2 rounded-[18px] bg-anthracite p-4 text-[15px]">
                <Icon name="check" size={18} strokeWidth={2.4} className="text-citron" />
                Tu es dans ta fourchette : aucun changement à faire.
              </p>
            )}
            {a.advice && <p className="rounded-[18px] border border-graphite p-4 text-[15px] leading-snug">{a.advice}</p>}
            {a.proposal &&
              (dismissedUntil ? (
                <p className="text-[13px] text-cendre">
                  Proposition refusée : FORGE la reproposera après le {formatDayShort(dismissedUntil).toLocaleLowerCase('fr-FR')} si la tendance se confirme.
                </p>
              ) : (
                <div className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px] outline-1 outline-citron/50">
                  <p className="text-[13px] text-cendre">Ajustement proposé</p>
                  <p className="font-metal text-[36px] leading-none">
                    {a.proposal.deltaKcal > 0 ? '+' : '−'}
                    {formatNumber(Math.abs(a.proposal.deltaKcal), 0)} kcal
                  </p>
                  <p className="text-[15px]">
                    Nouveaux objectifs : <TargetsLine t={a.proposal.targets} />
                  </p>
                  <ul className="flex flex-col gap-1.5 text-[13px] leading-snug text-cendre">
                    {a.proposal.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => void accept()} disabled={busy}>
                      Accepter
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void repos.meta.set(DISMISS_KEY, { date: today }).then(() => toast.show(`Proposition écartée pour ${DISMISS_DAYS} jours`))}
                    >
                      Refuser
                    </Button>
                  </div>
                </div>
              ))}
          </>
        )}
        <p className="text-[12px] leading-snug text-cendre">
          Méthode : FORGE compare la pente du poids tendance (pesées lissées, jamais une pesée seule) à ta fourchette, sur 14 à 28 jours depuis le dernier changement, avec les
          jours notés en entier. Un kilo correspond à environ 7 700 kcal : approximation (Wishnofsky, 1958) qui surestime souvent chez les personnes minces (Hall, 2008) ; c’est
          pourquoi chaque pas est plafonné à 200 kcal et réévalué 14 jours plus tard. Rien ne change sans ta validation.
        </p>
      </section>

      <section aria-label="Historique des objectifs" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">Historique</h2>
        {changes.length === 0 ? (
          <p className="text-[15px] text-cendre">Les changements d’objectifs s’afficheront ici, avec leur raison.</p>
        ) : (
          <ul>
            {changes.map((c) => (
              <li key={c.id} className="flex flex-col gap-0.5 border-b border-anthracite py-2.5 last:border-b-0">
                <span className="flex justify-between gap-3 text-[15px]">
                  <span>{formatDayShort(c.date)}</span>
                  <span className="text-cendre">{SOURCE_LABELS[c.source]}</span>
                </span>
                <span className="text-[13px]">
                  {c.before ? `${formatNumber(c.before.kcal, 0)} → ` : ''}
                  <TargetsLine t={c.after} />
                </span>
                {c.reason && <span className="text-[12px] leading-snug text-cendre">{c.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={editing} title="Objectifs" onClose={() => setEditing(false)}>
        {editing && <TargetsForm current={targets ?? undefined} trendKg={trendKg} onDone={() => setEditing(false)} />}
      </Sheet>
    </Screen>
  );
}

function BackLink() {
  return (
    <Link to="/nutrition" viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      Nutrition
    </Link>
  );
}
