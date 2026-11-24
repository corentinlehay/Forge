import { Link } from 'react-router';
import { scoreText } from '../../domain/pulse/analysis';
import { LEVEL_LABELS } from '../../domain/pulse/settings';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { LinkCard } from '../../ui/LinkCard';
import { Ring } from '../../ui/Ring';
import { Card } from '../../ui/Screen';
import { StatusChip } from '../../ui/StatusChip';
import { useCheckInSheet } from '../wellbeing/CheckInSheet';
import { CONFIDENCE_LABELS, levelChip, NUTRITION_SHORT, nutritionChip } from './pulseShared';
import { usePulse } from './usePulse';

/** Accueil : le score du jour, son niveau, sa couverture et son évolution ; le Nutrition Status à part ; la première alerte ou recommandation. */
export function PulseCard() {
  const model = usePulse();
  const { openCheckIn } = useCheckInSheet();
  if (!model) return null;
  const { readiness, level, nutrition, rules, trend, plan, proposal } = model.result;
  const pending = proposal && !model.record?.choice ? proposal : null;
  const alert = rules.find((r) => r.level === 'securite' || r.level === 'tendance');

  if (readiness.score === null || !level) {
    return (
      <Card label="PULSE du jour">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] text-cendre">PULSE du jour</h2>
          <Link to="/pulse" viewTransition className="text-[13px] text-cendre underline underline-offset-2">
            Détail
          </Link>
        </div>
        <p className="text-[15px] leading-snug">{readiness.unavailable}</p>
        <Button size="small" className="self-start" onClick={() => openCheckIn()}>
          Faire le check-in
        </Button>
      </Card>
    );
  }

  const chip = levelChip(level);
  const nChip = nutritionChip(nutrition.kind);
  const shown = scoreText(readiness.score, readiness.confidence);
  const first = plan[0]?.title;
  const evolution =
    trend.vs7 !== null
      ? trend.vs7 === 0
        ? 'Au niveau de ta moyenne sur 7 jours'
        : `${Math.abs(trend.vs7)} point${Math.abs(trend.vs7) > 1 ? 's' : ''} ${trend.vs7 > 0 ? 'au-dessus de' : 'sous'} ta moyenne sur 7 jours`
      : null;
  return (
    <LinkCard to="/pulse" title="PULSE du jour" label={`PULSE du jour : ${shown} sur 100, ${LEVEL_LABELS[level].toLocaleLowerCase('fr-FR')}. Ouvrir le détail`}>
      <div className="flex items-center gap-4">
        <Ring value={readiness.score / 100} size={92} stroke={9} label={`Indicateur PULSE : ${shown} sur 100`}>
          <span className="font-metal text-[30px] leading-none">{shown}</span>
        </Ring>
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <StatusChip icon={chip.icon} tone={chip.tone} label={LEVEL_LABELS[level]} />
          <p className="text-[12px] leading-snug text-cendre">
            {readiness.coverage.present} dimension{readiness.coverage.present > 1 ? 's' : ''} sur {readiness.coverage.total}
            {readiness.confidence ? `, ${CONFIDENCE_LABELS[readiness.confidence].toLocaleLowerCase('fr-FR')}` : ''}
          </p>
          {evolution && <p className="text-[12px] leading-snug text-cendre">{evolution}</p>}
          <StatusChip icon={nChip.icon} tone={nChip.tone} label={NUTRITION_SHORT[nutrition.kind]} />
        </div>
      </div>
      {pending ? (
        <p className="flex items-start gap-2 text-[15px] leading-snug">
          <Icon name="info" size={18} className="mt-0.5 shrink-0 text-citron" />
          {pending.kind === 'lighten'
            ? `Version allégée de ${pending.templateName} proposée, à valider`
            : `Récupération active proposée à la place de ${pending.templateName}, à valider`}
        </p>
      ) : alert ? (
        <p className="flex items-start gap-2 text-[15px] leading-snug">
          <Icon name="warning" size={18} className="mt-0.5 shrink-0 text-braise" />
          {alert.title}
        </p>
      ) : (
        first && <p className="text-[15px] leading-snug">{first}</p>
      )}
    </LinkCard>
  );
}
