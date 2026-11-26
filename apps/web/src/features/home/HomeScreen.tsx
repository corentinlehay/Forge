import { Link } from 'react-router';
import { countLabel, formatDayLong, formatLitres, formatDaysAgo, formatMeasuredKg, formatNumber, formatSignedKg } from '../../lib/format';
import { MEAL_LABELS } from '../../domain/nutrition';
import type { GainRate, Profile } from '../../db/types';
import { recoveryLabel } from '../../domain/wellbeing';
import { Icon } from '../../ui/Icon';
import { LinkCard } from '../../ui/LinkCard';
import { Meter } from '../../ui/Meter';
import { Ring } from '../../ui/Ring';
import { Screen } from '../../ui/Screen';
import { StatusChip } from '../../ui/StatusChip';
import { useDashboardData, type DashboardData } from '../dashboard/useDashboardData';
import { useCheckInSheet } from '../wellbeing/CheckInSheet';
import { TrendSparkline } from '../weight/WeightChart';
import { useWeighInSheet } from '../weight/WeighInSheet';
import { statusView } from '../weight/weightStatus';
import { SessionHero } from '../training/SessionHero';
import { CoachButton } from '../../ui/CoachButton';
import { UserEmblem } from '../level/Emblem';
import { LevelCard } from '../level/LevelCard';
import { BackupReminder } from './BackupReminder';
import { WeekCard } from '../review/WeekCard';
import { PulseCard } from '../pulse/PulseCard';
import { LiveValue } from '../../ui/LiveValue';
import { homeFocus } from '../../domain/homeFocus';

const kcal = (v: number) => `${formatNumber(v, 0)} kcal`;

/** Le centre de commande : chaque carte vient des données enregistrées et mène à son espace. */
export function HomeScreen() {
  const data = useDashboardData();
  const greeting = data?.profile.firstName ? `Bonjour, ${data.profile.firstName}` : 'Bonjour';

  return (
    <Screen>
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[15px] text-cendre">{data ? formatDayLong(data.today) : ' '}</p>
          <h1 className="font-metal text-[40px]">{greeting}</h1>
        </div>
        <div className="flex gap-2">
          <CoachButton />
          <Link to="/reglages" viewTransition aria-label="Profil et réglages" className="flex h-11 w-11 shrink-0 items-center justify-center active:opacity-80">
            <UserEmblem level={1} size={42} bare />
          </Link>
        </div>
      </header>

      {data ? <Dashboard data={data} /> : <DashboardSkeleton />}
    </Screen>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-[18px]" aria-busy="true" aria-label="Chargement">
      {[220, 180, 160].map((h) => (
        <div key={h} className="animate-pulse rounded-[22px] bg-anthracite" style={{ height: h }} />
      ))}
    </div>
  );
}

function Dashboard({ data }: { data: DashboardData }) {
  const now = new Date();
  const focus = homeFocus({
    minutes: now.getHours() * 60 + now.getMinutes(),
    plannedToday: Boolean(data.training.plannedToday),
    inProgress: Boolean(data.training.inProgress),
    doneToday: Boolean(data.training.doneToday),
    weighInTime: data.weighedToday?.time ?? null,
  });
  const { openNew } = useWeighInSheet();
  const { openCheckIn } = useCheckInSheet();
  const todo = [
    !data.weighedToday && { label: 'Se peser', icon: 'progression' as const, run: openNew },
    !data.wellbeing.today && { label: 'Check-in', icon: 'moon' as const, run: () => openCheckIn() },
  ].filter(Boolean) as { label: string; icon: 'progression' | 'moon'; run: () => void }[];

  return (
    <>
      {todo.length > 0 && (
        <div className="flex gap-2" role="group" aria-label="À faire aujourd’hui">
          {todo.map((t) => (
            <button key={t.label} type="button" onClick={t.run} className="flex h-11 items-center gap-2 rounded-full bg-graphite px-4 text-[15px] font-semibold active:opacity-80">
              <Icon name={t.icon} size={18} className="text-citron" />
              {t.label}
            </button>
          ))}
        </div>
      )}
      <PulseCard />
      {focus.reason && <p className="motion-rise -mt-1 text-[13px] text-cendre">{focus.reason}</p>}
      {focus.order.map((card, i) => (
        <div key={card} className="motion-rise flex flex-col" style={{ ['--i' as string]: i + 1 }}>
          {card === 'session' && <SessionHero data={data} />}
          {card === 'nutrition' && <NutritionCard data={data} />}
          {card === 'physique' && <PhysiqueCard data={data} />}
          {card === 'tiles' && (
            <div className="grid grid-cols-2 gap-3">
              <RecoveryTile data={data} />
              <WeekTile data={data} />
            </div>
          )}
          {card === 'training' && <TrainingCard data={data} />}
          {card === 'week' && <WeekCard />}
          {card === 'evening' && <EveningCard />}
        </div>
      ))}
      <LevelCard />
      <CoachCard data={data} />
      <BackupReminder />
    </>
  );
}

function NutritionCard({ data }: { data: DashboardData }) {
  const { totals, targets, remainingKcal, progress, entries } = data.nutrition;
  const lastMeal = entries.at(-1);
  return (
    <LinkCard to="/nutrition" module="nutrition" title="Nutrition" label={`Nutrition : ${kcal(totals.kcal)} consommées. Ouvrir Nutrition`}>
      <div className="flex items-center gap-5">
        <Ring value={progress?.kcal ?? 0} size={112} label={targets ? `${kcal(totals.kcal)} sur ${kcal(targets.kcal)}` : `${kcal(totals.kcal)}`} overTone="alert">
          <LiveValue value={totals.kcal} className="font-metal text-[28px]">
            {formatNumber(totals.kcal, 0)}
          </LiveValue>
          <span className="text-[11px] text-cendre">{targets ? `sur ${formatNumber(targets.kcal, 0)}` : 'kcal'}</span>
        </Ring>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {remainingKcal !== null ? (
            <>
              <p className="text-[13px] text-cendre">{remainingKcal >= 0 ? 'Restant' : 'Dépassement'}</p>
              <p className="font-metal text-[32px]">
                {formatNumber(Math.abs(remainingKcal), 0)} <span className="font-sans text-[15px] font-normal text-cendre">kcal</span>
              </p>
            </>
          ) : (
            <p className="text-[15px] leading-snug">Objectif calorique à définir dans Nutrition.</p>
          )}
          <p className="truncate text-[13px] text-cendre">
            {lastMeal ? `Dernier ajout : ${MEAL_LABELS[lastMeal.meal].toLocaleLowerCase('fr-FR')}` : 'Rien d’enregistré aujourd’hui'}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <Meter label="Protéines" value={totals.proteinG} target={targets?.proteinG} />
        <Meter label="Glucides" value={totals.carbsG} target={targets?.carbsG} />
        <Meter label="Lipides" value={totals.fatG} target={targets?.fatG} />
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-graphite pt-3 text-[13px]">
        <span>
          <span className="text-cendre">Fibres </span>
          {formatNumber(totals.fiberG, 0)} g{targets?.fiberG ? <span className="text-cendre"> / {formatNumber(targets.fiberG, 0)}</span> : null}
        </span>
        <span>
          <span className="text-cendre">Boissons </span>
          {formatLitres(data.waterMl)}
          {targets?.waterMl ? <span className="text-cendre"> / {formatLitres(targets.waterMl)}</span> : null}
        </span>
      </p>
    </LinkCard>
  );
}

function PhysiqueCard({ data }: { data: DashboardData }) {
  const { weight, lastWeighIn, weekAverage, gainRate } = data;
  if (!lastWeighIn) {
    return (
      <LinkCard to="/progression" module="progression" title="Physique" label="Physique : aucune pesée. Ouvrir Progression">
        <p className="text-[15px] leading-snug">Aucune pesée pour l’instant. Pèse-toi au réveil, à jeun : la tendance démarre dès la première.</p>
      </LinkCard>
    );
  }
  const status = statusView(weight);
  return (
    <LinkCard to="/progression" module="progression" title="Physique" label={`Dernier poids ${formatMeasuredKg(lastWeighIn.weightKg)}. Ouvrir Progression`}>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Dernier" value={formatNumber(lastWeighIn.weightKg, 1)} sub={`kg, ${formatDaysAgo(lastWeighIn.date, data.today)}`} />
        <Stat
          label="Moy. 7 jours"
          value={weekAverage ? formatNumber(weekAverage.averageKg, 1) : '—'}
          sub={weekAverage ? `kg, ${weekAverage.days} pesée${weekAverage.days > 1 ? 's' : ''}` : 'aucune pesée'}
        />
        <Stat
          label="Évolution"
          value={weight.weeklyRateKg !== null ? formatSignedKg(weight.weeklyRateKg).replace(' kg', '') : '—'}
          sub={weight.weeklyRateKg !== null ? 'kg par semaine' : 'après 7 jours'}
        />
      </div>
      <TrendSparkline points={weight.points.slice(-84)} width={320} height={36} />
      <div className="flex flex-col gap-2 border-t border-graphite pt-3">
        <p className="text-[13px] leading-snug">
          <span className="text-cendre">Objectif : </span>
          {goalText(data.goal, gainRate)},{' '}
          {weight.band
            ? `de ${formatSignedKg(weight.band.lowKgPerWeek).replace(' kg', '')} à ${formatSignedKg(weight.band.highKgPerWeek)} par semaine`
            : `de ${formatNumber(gainRate.lowPctPerWeek, 2)} à ${formatNumber(gainRate.highPctPerWeek, 2)} % du poids par semaine`}
        </p>
        <div className="self-start">
          <StatusChip {...status} />
        </div>
      </div>
    </LinkCard>
  );
}

const GOAL_TEXT: Record<NonNullable<Profile['goal']>, string> = {
  muscle: 'prise de muscle',
  perte: 'perte de gras',
  recompo: 'recomposition, poids stable',
  force: 'gain de force',
  forme: 'forme, poids stable',
};

/** L'objectif choisi au questionnaire ; sans questionnaire, il se lit dans la fourchette de poids. */
function goalText(goal: Profile['goal'] | null, rate: GainRate): string {
  if (goal) return GOAL_TEXT[goal];
  if (rate.highPctPerWeek <= 0) return 'perte de poids';
  if (rate.lowPctPerWeek > 0) return 'prise de masse contrôlée';
  return 'poids stable';
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="truncate text-[12px] text-cendre">{label}</p>
      <p className="font-metal text-[28px]">{value}</p>
      <p className="truncate text-[12px] text-cendre">{sub}</p>
    </div>
  );
}

function RecoveryTile({ data }: { data: DashboardData }) {
  const { openCheckIn } = useCheckInSheet();
  const today = data.wellbeing.today;
  if (!today) {
    return (
      <button type="button" onClick={() => openCheckIn()} className="flex flex-col gap-3 rounded-[18px] bg-anthracite p-3.5 text-left active:scale-[0.985]">
        <p className="text-[13px] text-cendre">Récupération</p>
        <p className="text-[15px] leading-snug">Check-in du jour à faire</p>
        <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-citron">
          <Icon name="plus" size={16} strokeWidth={2.5} />
          Faire le check-in
        </span>
      </button>
    );
  }
  const { checkIn, score } = today;
  return (
    <Link
      to="/progression?vue=bien-etre"
      viewTransition
      aria-label={score !== null ? `Récupération estimée ${score} sur 100. Voir le bien-être` : 'Check-in partiel. Voir le bien-être'}
      className="flex flex-col gap-3 rounded-[18px] bg-anthracite p-3.5 active:scale-[0.985]"
    >
      <p className="text-[13px] text-cendre">Récupération estimée</p>
      {score !== null ? (
        <div className="flex items-center gap-3">
          <Ring value={score / 100} size={56} stroke={6} label={`${score} sur 100`}>
            <span className="font-metal text-[20px]">{score}</span>
          </Ring>
          <span className="text-[13px] font-semibold">{recoveryLabel(score)}</span>
        </div>
      ) : (
        <p className="text-[13px] leading-snug">Questions passées : complète ton check-in pour l’estimer.</p>
      )}
      <dl className="flex flex-col gap-1 text-[13px]">
        {[
          ['Sommeil', checkIn.sleepHours !== null ? `${formatNumber(checkIn.sleepHours, checkIn.sleepHours % 1 ? 1 : 0)} h` : '—'],
          ['Énergie', checkIn.energy ? `${checkIn.energy}/5` : '—'],
          ['Fatigue', checkIn.fatigue ? `${checkIn.fatigue}/5` : '—'],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2">
            <dt className="text-cendre">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

function WeekTile({ data }: { data: DashboardData }) {
  const { weekSessions, perWeek, volumes } = data.training;
  const current = volumes.at(-1)?.volumeKg ?? 0;
  const previous = volumes.at(-2)?.volumeKg ?? 0;
  return (
    <Link
      to="/training"
      viewTransition
      aria-label={`${weekSessions} séances cette semaine. Ouvrir Training`}
      className="flex flex-col gap-3 rounded-[18px] bg-anthracite p-3.5 active:scale-[0.985]"
    >
      <p className="text-[13px] text-cendre">Cette semaine</p>
      <p>
        <span className="font-metal text-[36px]">{weekSessions}</span>
        <span className="text-[15px] text-cendre">{perWeek ? ` / ${perWeek} séance${perWeek > 1 ? 's' : ''}` : ` séance${weekSessions > 1 ? 's' : ''}`}</span>
      </p>
      {perWeek > 0 && (
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: perWeek }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < weekSessions ? 'bg-citron' : 'bg-graphite'}`} />
          ))}
        </div>
      )}
      <dl className="flex flex-col gap-1 text-[13px]">
        <div className="flex justify-between gap-2">
          <dt className="text-cendre">Volume</dt>
          <dd className="font-semibold">{formatNumber(current, 0)} kg</dd>
        </div>
        {previous > 0 && (
          <div className="flex justify-between gap-2">
            <dt className="text-cendre">Sem. passée</dt>
            <dd>{formatNumber(previous, 0)} kg</dd>
          </div>
        )}
      </dl>
    </Link>
  );
}

function TrainingCard({ data }: { data: DashboardData }) {
  const { lastWorkout, records } = data.training;
  return (
    <LinkCard to="/training" module="training" title="Entraînement" label="Entraînement : dernière séance et records. Ouvrir Training">
      {lastWorkout ? (
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-cendre">Dernière séance, {formatDaysAgo(lastWorkout.workout.date, data.today)}</p>
            <p className="truncate text-[17px] font-semibold">{lastWorkout.workout.name}</p>
          </div>
          <p className="shrink-0 text-right text-[13px] text-cendre">
            {countLabel(lastWorkout.setCount, 'série')}
            <br />
            {formatNumber(lastWorkout.volumeKg, 0)} kg
          </p>
        </div>
      ) : (
        <p className="text-[15px] text-cendre">Aucune séance enregistrée.</p>
      )}
      {records.length > 0 && (
        <ul className="flex flex-col gap-2 border-t border-graphite pt-3">
          <li className="text-[13px] text-cendre">Records récents</li>
          {records.slice(0, 2).map((r) => (
            <li key={`${r.workoutId}-${r.exerciseId}`} className="flex items-center justify-between gap-3 text-[15px]">
              <span className="flex min-w-0 items-center gap-2">
                <Icon name="trophy" size={16} className="shrink-0 text-citron" />
                <span className="truncate">{r.exerciseName}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatNumber(r.weightKg, r.weightKg % 1 ? 1 : 0)} kg × {r.reps}
              </span>
            </li>
          ))}
        </ul>
      )}
    </LinkCard>
  );
}

function CoachCard({ data }: { data: DashboardData }) {
  const { brief } = data;
  return (
    <LinkCard to="/coach" title="Analyse du jour" label="Analyse du jour. Ouvrir Coach" aside={<Icon name="sparkle" size={16} className="text-citron" />}>
      {brief.enoughData ? (
        <>
          <p className="text-[15px] leading-snug">{brief.summary.slice(0, 2).join(' ')}</p>
          {brief.top && (
            <p className="flex items-start gap-2 text-[15px] leading-snug">
              <Icon
                name={brief.top.tone === 'good' ? 'check' : 'warning'}
                size={18}
                className={`mt-0.5 shrink-0 ${brief.top.tone === 'good' ? 'text-citron' : brief.top.tone === 'alert' ? 'text-braise' : 'text-cendre'}`}
              />
              {brief.top.observation}
            </p>
          )}
          {brief.recommendation?.recommendation && <p className="border-l-2 border-citron pl-3 text-[15px] leading-snug">{brief.recommendation.recommendation}</p>}
        </>
      ) : (
        <p className="text-[15px] leading-snug text-cendre">Pas encore assez de données pour une analyse. Commence par une pesée, un check-in ou un repas.</p>
      )}
      <p className="text-[12px] text-cendre">Calculée sur ton appareil à partir de tes données. Sans IA pour l’instant.</p>
    </LinkCard>
  );
}

/** Le soir : le rituel et le sommeil, à portée de main (Mind). */
function EveningCard() {
  return (
    <section aria-label="Ce soir" data-module="mind" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
      <h2 className="flex items-center gap-2 text-[13px] text-cendre">
        <Icon name="moon" size={16} className="text-module" />
        Ce soir
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/mind/routine/soir" viewTransition className="motion-press flex min-h-[72px] flex-col justify-between rounded-[16px] bg-graphite p-3">
          <span className="text-[15px] font-semibold">Rituel du soir</span>
          <span className="text-[12px] text-cendre">Ralentir avant de dormir</span>
        </Link>
        <Link to="/mind/sommeil" viewTransition className="motion-press flex min-h-[72px] flex-col justify-between rounded-[16px] bg-graphite p-3">
          <span className="text-[15px] font-semibold">Sommeil</span>
          <span className="text-[12px] text-cendre">Tes nuits et ton heure de coucher</span>
        </Link>
      </div>
    </section>
  );
}
