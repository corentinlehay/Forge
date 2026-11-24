import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { BADGE_FAMILIES, nextBadges, regularity, ACTIVE_WEEK_DAYS, type BadgeProgress } from '../../domain/motivation';
import { findRecords } from '../../domain/training';
import { addDays } from '../../lib/dates';
import { formatDayMonth, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Meter } from '../../ui/Meter';
import { Card } from '../../ui/Screen';
import type { LifeModel } from './useLifeData';

const UNITS: Record<BadgeProgress['def']['counter'], string> = {
  seances: 'séances',
  records: 'records',
  tonnage: 'kg',
  joursRepas: 'jours',
  joursPesee: 'jours',
  mensurations: 'fois',
  checkins: 'check-ins',
  pratiques: 'pratiques',
  minutesMind: 'min',
  joursJournal: 'jours',
  semainesActives: 'semaines',
};

/** Records, régularité et badges : ce qui est acquis reste acquis. */
export function BadgesView({ model }: { model: LifeModel }) {
  const weeks = useMemo(() => regularity(model.index, model.today, 12), [model]);
  const records = useMemo(() => findRecords(model.data.workouts, model.data.sets).filter((r) => r.date >= addDays(model.today, -90)), [model]);
  const earned = model.badges.filter((b) => b.earnedOn).sort((a, b) => b.earnedOn!.localeCompare(a.earnedOn!));
  const next = nextBadges(model.badges);
  const activeCount = weeks.filter((w) => w.active).length;
  const kg = (v: number) => formatNumber(v, v % 1 ? 1 : 0);
  const [all, setAll] = useState(false);

  return (
    <>
      <Card label="Régularité">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[13px] text-cendre">Régularité, 12 dernières semaines</h2>
          <p className="text-[15px] leading-snug">
            {activeCount === 0 ? 'Pas encore de semaine active' : `${activeCount} semaine${activeCount > 1 ? 's' : ''} active${activeCount > 1 ? 's' : ''}`}
          </p>
        </div>
        <ol className="grid grid-cols-12 gap-1" aria-label="Semaines actives">
          {weeks.map((w) => (
            <li
              key={w.start}
              aria-label={`Semaine du ${formatDayMonth(w.start)} : ${w.activeDays} jour${w.activeDays > 1 ? 's' : ''} avec une donnée${w.current ? ', en cours' : ''}`}
              className={`h-7 rounded-[6px] ${w.active ? 'bg-module' : w.activeDays > 0 ? 'bg-module-voile' : 'bg-graphite'} ${w.current ? 'ring-1 ring-craie ring-offset-2 ring-offset-anthracite' : ''}`}
            />
          ))}
        </ol>
        <p className="text-[12px] leading-snug text-cendre">
          Une semaine est active à partir de {ACTIVE_WEEK_DAYS} jours avec une donnée notée, dans n’importe quel espace. Plein : semaine active ; teinté : un ou deux jours ; la
          dernière case est la semaine en cours.
        </p>
      </Card>

      <section aria-label="Records" className="flex flex-col">
        <h2 className="mb-1 text-[17px] font-semibold">Records des 90 derniers jours</h2>
        {records.length === 0 ? (
          <p className="text-[15px] text-cendre">Pas encore de record : il faut une première séance de référence par exercice.</p>
        ) : (
          <ul>
            {records.slice(0, 5).map((r) => (
              <li key={`${r.workoutId}-${r.exerciseId}`} className="border-b border-anthracite last:border-b-0">
                <Link to={`/training/exercices/${r.exerciseId}`} viewTransition className="flex min-h-11 items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon name="trophy" size={18} className="shrink-0 text-training" />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px]">{model.data.exerciseName(r.exerciseId)}</span>
                      <span className="block text-[12px] text-cendre">{formatDayMonth(r.date)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                    {kg(r.weightKg)} kg × {r.reps}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Badges obtenus" className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">
          Badges obtenus <span className="font-normal text-cendre">{earned.length}</span>
        </h2>
        {earned.length === 0 ? (
          <p className="text-[15px] leading-snug text-cendre">Le premier arrive avec ta première séance, ton premier repas noté, ta première pesée ou ta première pratique.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {(all ? earned : earned.slice(0, 6)).map((b) => (
              <li key={b.def.id} className="flex flex-col gap-1.5 rounded-[18px] bg-anthracite p-3.5">
                <Icon name={b.def.family === 'training' ? 'trophy' : 'star'} size={20} className="text-citron" />
                <span className="text-[15px] font-semibold leading-snug">{b.def.title}</span>
                <span className="text-[12px] text-cendre">
                  {BADGE_FAMILIES.find((f) => f.key === b.def.family)?.label}, le {formatDayMonth(b.earnedOn!)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!all && earned.length > 6 && (
          <Button variant="quiet" className="self-start" onClick={() => setAll(true)}>
            Voir les {earned.length} badges
          </Button>
        )}
      </section>

      {next.length > 0 && (
        <section aria-label="Prochaines étapes" className="flex flex-col gap-3">
          <h2 className="text-[17px] font-semibold">Prochaines étapes</h2>
          {next.map((b) => (
            <Meter key={b.def.id} label={b.def.title} value={b.value} target={b.def.target} unit={UNITS[b.def.counter]} />
          ))}
        </section>
      )}

      <p className="text-[12px] leading-snug text-cendre">Les badges ne se perdent jamais : une pause ne remet rien à zéro. Pas de série à tenir, pas de rappel.</p>
    </>
  );
}
