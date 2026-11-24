import { useMemo } from 'react';
import { isActiveDay } from '../../domain/lifeIndex';
import { weekReview } from '../../domain/review';
import { isoWeekday, weekStart } from '../../domain/training';
import { addDays } from '../../lib/dates';
import { LinkCard } from '../../ui/LinkCard';
import { useLifeData } from './useLifeData';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Accueil : la semaine en un coup d'œil ; le lundi, le bilan de la semaine passée. */
export function WeekCard() {
  const model = useLifeData();
  const view = useMemo(() => {
    if (!model) return null;
    const current = weekStart(model.today);
    const last = addDays(current, -7);
    const lastReview = weekReview(model.index, model.data, last, model.today, model.badges);
    const monday = isoWeekday(model.today) === 1 && lastReview.stats.activeDays > 0;
    const review = monday ? lastReview : weekReview(model.index, model.data, current, model.today, model.badges);
    const start = monday ? last : current;
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((date) => ({ date, active: isActiveDay(model.index.get(date)), future: date > model.today }));
    return { monday, review, start, days, today: model.today };
  }, [model]);

  if (!view) return null;
  const { review, monday, days } = view;
  const s = review.stats;
  const top = review.highlights[0]?.text;
  return (
    <LinkCard
      to={monday ? `/progression/bilans?semaine=${view.start}` : '/progression/bilans'}
      title={monday ? 'Bilan de la semaine dernière' : 'Ta semaine'}
      label={`${monday ? 'Bilan de la semaine dernière' : 'Ta semaine'} : ${s.activeDays} jours actifs. Ouvrir les bilans`}
    >
      <ol className="grid grid-cols-7 gap-1.5" aria-hidden="true">
        {days.map((d, i) => (
          <li key={d.date} className="flex flex-col items-center gap-1">
            <span
              className={`h-2 w-full rounded-full ${d.active ? 'bg-citron' : d.future ? 'bg-graphite/50' : 'bg-graphite'} ${d.date === view.today ? 'ring-1 ring-craie ring-offset-2 ring-offset-anthracite' : ''}`}
            />
            <span className="text-[11px] text-cendre">{LETTERS[i]}</span>
          </li>
        ))}
      </ol>
      <p className="text-[15px] leading-snug">
        {s.activeDays === 0
          ? 'Rien de noté pour l’instant cette semaine.'
          : `${s.activeDays} jour${s.activeDays > 1 ? 's' : ''} actif${s.activeDays > 1 ? 's' : ''}${top ? `. ${top}` : '.'}`}
      </p>
      <p className="text-[12px] text-cendre">Bilans, calendrier, liens entre tes données et badges.</p>
    </LinkCard>
  );
}
