import { Link } from 'react-router';
import { formatDayShort, formatNumber } from '../../lib/format';
import { useTargetAnalysis } from './useTargetAnalysis';

/** Raccourci vers Objectifs, avec l'état de l'analyse ; mis en avant quand un ajustement est proposé. */
export function ObjectivesLink() {
  const result = useTargetAnalysis();
  const a = result?.analysis;
  const proposed = a?.proposal && !result?.dismissedUntil;
  const sub = !a
    ? 'Analyse de tes données'
    : a.proposal && result?.dismissedUntil
      ? `Proposition écartée jusqu’au ${formatDayShort(result.dismissedUntil).toLocaleLowerCase('fr-FR')}`
      : proposed
        ? `Ajustement proposé : ${a.proposal!.deltaKcal > 0 ? '+' : '−'}${formatNumber(Math.abs(a.proposal!.deltaKcal), 0)} kcal`
        : a.status === 'no-targets'
          ? 'Pas encore d’objectifs'
          : a.status === 'waiting'
            ? `Analyse possible le ${formatDayShort(a.availableOn!).toLocaleLowerCase('fr-FR')}`
            : a.status === 'insufficient'
              ? 'Données insuffisantes pour l’instant'
              : a.rateStatus === 'within'
                ? 'Dans ta fourchette'
                : a.advice
                  ? 'Un conseil sur ton suivi'
                  : 'Analyse à jour';
  return (
    <Link
      to="/nutrition/objectifs"
      viewTransition
      className={`flex min-h-[72px] flex-col justify-between rounded-[18px] p-3.5 active:scale-[0.99] ${proposed ? 'bg-citron-voile outline-1 outline-citron/60' : 'bg-anthracite'}`}
    >
      <span className="text-[17px] font-semibold">Objectifs</span>
      <span className={`text-[12px] ${proposed ? 'text-citron' : 'text-cendre'}`}>{sub}</span>
    </Link>
  );
}
