import { Link } from 'react-router';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { LinkCard } from '../../ui/LinkCard';
import { Ring } from '../../ui/Ring';
import { Card } from '../../ui/Screen';
import { StatusChip } from '../../ui/StatusChip';
import { useCheckInSheet } from '../wellbeing/CheckInSheet';
import { CONFIDENCE_LABELS, MODE_LABELS, modeChip, NUTRITION_SHORT, nutritionChip } from './pulseShared';
import { usePulse } from './usePulse';

/** Accueil : le Readiness Score du jour, le mode et la première recommandation ; le Nutrition Status à part. */
export function PulseCard() {
  const model = usePulse();
  const { openCheckIn } = useCheckInSheet();
  if (!model) return null;
  const { readiness, mode, training, nutrition, rules } = model.result;
  const alert = rules.find((r) => r.level === 'securite' || r.level === 'tendance');

  if (readiness.score === null || !mode) {
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

  const chip = modeChip(mode);
  const nChip = nutritionChip(nutrition.kind);
  const first = training.recos[0]?.text;
  return (
    <LinkCard to="/pulse" title="PULSE du jour" label={`PULSE du jour : ${readiness.score} sur 100, ${MODE_LABELS[mode]}. Ouvrir le détail`}>
      <div className="flex items-center gap-4">
        <Ring value={readiness.score / 100} size={92} stroke={9} label={`Readiness Score : ${readiness.score} sur 100`}>
          <span className="font-metal text-[30px] leading-none">{readiness.score}</span>
        </Ring>
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <StatusChip icon={chip.icon} tone={chip.tone} label={MODE_LABELS[mode]} />
          <p className="text-[12px] text-cendre">{readiness.confidence ? CONFIDENCE_LABELS[readiness.confidence] : ''}</p>
          <StatusChip icon={nChip.icon} tone={nChip.tone} label={NUTRITION_SHORT[nutrition.kind]} />
        </div>
      </div>
      {alert ? (
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
