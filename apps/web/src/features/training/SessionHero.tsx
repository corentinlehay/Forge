import { useState } from 'react';
import { useNavigate } from 'react-router';
import { isoWeekday } from '../../domain/training';
import { countLabel, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { LinkCard } from '../../ui/LinkCard';
import type { DashboardData } from '../dashboard/useDashboardData';
import { startWorkout } from './workoutActions';

const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

/** La séance du jour : à commencer, en cours, faite, ou repos. */
export function SessionHero({ data, linkToTraining = true }: { data: DashboardData; linkToTraining?: boolean }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const { plannedToday, inProgress, doneToday, hasProgram, toBeat } = data.training;

  const start = async () => {
    setBusy(true);
    const id = await startWorkout(plannedToday);
    navigate(`/training/seance/${id}`, { viewTransition: true });
  };

  const shell = 'flex flex-col gap-[14px] rounded-[22px] bg-anthracite p-[18px]';

  if (inProgress) {
    return (
      <section aria-label="Séance en cours" className={shell}>
        <p className="text-[13px] text-cendre">Séance en cours</p>
        <h2 className="font-metal text-[48px]">{inProgress.name}</h2>
        <Button onClick={() => navigate(`/training/seance/${inProgress.id}`, { viewTransition: true })}>
          <Icon name="play" size={18} />
          Reprendre la séance
        </Button>
      </section>
    );
  }

  if (doneToday) {
    const body = (
      <>
        <h2 className="font-metal text-[48px]">{doneToday.workout.name}</h2>
        <p className="flex items-center gap-2 text-[15px]">
          <Icon name="check" size={18} strokeWidth={3} className="text-citron" />
          Faite : {countLabel(doneToday.setCount, 'série')}, {formatNumber(doneToday.volumeKg, 0)} kg soulevés
        </p>
      </>
    );
    return linkToTraining ? (
      <LinkCard to={`/training/seance/${doneToday.workout.id}`} title="Séance du jour" label={`Séance faite : ${doneToday.workout.name}. Voir le détail`}>
        {body}
      </LinkCard>
    ) : (
      <section aria-label="Séance du jour" className={shell}>
        <p className="text-[13px] text-cendre">Séance du jour</p>
        {body}
      </section>
    );
  }

  if (plannedToday) {
    const setCount = plannedToday.exercises.reduce((n, e) => n + e.sets, 0);
    const perf = toBeat?.performance;
    return (
      <section aria-label="Séance du jour" className={shell}>
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] text-cendre">Séance du jour</p>
          <h2 className="font-metal text-[48px]">{plannedToday.name}</h2>
          <p className="text-[15px] text-cendre">
            {countLabel(plannedToday.exercises.length, 'exercice')}, {countLabel(setCount, 'série')}
          </p>
        </div>
        {perf && toBeat && (
          <div className="flex items-center justify-between gap-3 rounded-[14px] bg-graphite px-3.5 py-3">
            <span className="min-w-0 text-[13px] text-cendre">À battre, {toBeat.exerciseName.toLocaleLowerCase('fr-FR')}</span>
            <span className="font-metal shrink-0 text-[24px] whitespace-nowrap">
              {formatNumber(perf.weightKg, perf.weightKg % 1 ? 1 : 0)} kg × {perf.reps}
            </span>
          </div>
        )}
        <Button onClick={() => void start()} disabled={busy}>
          <Icon name="play" size={18} />
          Commencer la séance
        </Button>
      </section>
    );
  }

  if (!hasProgram) {
    const body = (
      <>
        <h2 className="font-metal text-[40px]">Pas de programme</h2>
        <p className="text-[15px] leading-snug text-cendre">
          {linkToTraining ? 'Crée tes séances dans Training : la séance du jour s’affichera ici, avec la performance à battre.' : 'Ajoute tes séances et leurs jours ci-dessous : la séance du jour s’affichera ici.'}
        </p>
      </>
    );
    return linkToTraining ? (
      <LinkCard to="/training" title="Séance du jour" label="Créer ton programme dans Training">
        {body}
      </LinkCard>
    ) : (
      <section aria-label="Séance du jour" className={shell}>
        {body}
      </section>
    );
  }

  const body = (
    <>
      <h2 className="font-metal text-[48px]">Repos</h2>
      <p className="text-[15px] text-cendre">Aucune séance prévue {WEEKDAYS[isoWeekday(data.today) - 1]}.</p>
    </>
  );
  return linkToTraining ? (
    <LinkCard to="/training" title="Séance du jour" label="Jour de repos. Voir le programme">
      {body}
    </LinkCard>
  ) : (
    <section aria-label="Séance du jour" className={shell}>
      <p className="text-[13px] text-cendre">Séance du jour</p>
      {body}
    </section>
  );
}
