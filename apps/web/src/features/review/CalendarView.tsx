import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CAL_MODULES, dayItems, dayModules, monthGrid, shiftMonth, type CalItem, type CalModule } from '../../domain/calendar';
import { weekStart } from '../../domain/training';
import { addDays, isDateKey } from '../../lib/dates';
import { capitalize, formatDayLong, formatDayShort } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Card } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { ModuleMark, WeekNav } from './reviewShared';
import type { LifeModel } from './useLifeData';
import { weekRange } from './WeekView';

type Scale = 'jour' | 'semaine' | 'mois';
const scales = [
  { value: 'jour', label: 'Jour' },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
] as const;
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthLabel = (month: string) => capitalize(monthName.format(new Date(`${month}-15T12:00:00Z`)));

export function CalendarView({ model }: { model: LifeModel }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('echelle');
  const scale: Scale = raw === 'jour' || raw === 'semaine' ? raw : 'mois';
  const asked = params.get('jour');
  const focus = asked && isDateKey(asked) ? asked : model.today;
  const items = useMemo(() => (date: string) => dayItems(model.index.get(date), date, model.today, model.data), [model]);

  const set = (next: { echelle?: Scale; jour?: string }, replace = false) => {
    const n = new URLSearchParams(params);
    n.set('vue', 'calendrier');
    if (next.echelle) n.set('echelle', next.echelle);
    if (next.jour) {
      if (next.jour === model.today) n.delete('jour');
      else n.set('jour', next.jour);
    }
    setParams(n, { replace });
  };

  const step = scale === 'jour' ? 1 : 7;
  const prev = scale === 'mois' ? `${shiftMonth(focus.slice(0, 7), -1)}-01` : addDays(focus, -step);
  const next = scale === 'mois' ? `${shiftMonth(focus.slice(0, 7), 1)}-01` : addDays(focus, step);
  const onToday = scale === 'mois' ? focus.slice(0, 7) === model.today.slice(0, 7) : scale === 'semaine' ? weekStart(focus) === weekStart(model.today) : focus === model.today;

  return (
    <>
      <Segmented label="Échelle" options={scales} value={scale} onChange={(v) => set({ echelle: v }, true)} />
      <WeekNav
        label={scale === 'mois' ? monthLabel(focus.slice(0, 7)) : scale === 'semaine' ? `Semaine ${weekRange(weekStart(focus))}` : formatDayLong(focus)}
        onPrev={() => set({ jour: prev }, true)}
        onNext={() => set({ jour: next }, true)}
        prevLabel={scale === 'mois' ? 'Mois précédent' : scale === 'semaine' ? 'Semaine précédente' : 'Jour précédent'}
        nextLabel={scale === 'mois' ? 'Mois suivant' : scale === 'semaine' ? 'Semaine suivante' : 'Jour suivant'}
      />
      {!onToday && (
        <Button variant="quiet" className="-mt-3 self-center" onClick={() => set({ jour: model.today }, true)}>
          Revenir à aujourd’hui
        </Button>
      )}
      {scale === 'mois' && <MonthGrid month={focus.slice(0, 7)} today={model.today} items={items} onPick={(d) => set({ echelle: 'jour', jour: d }, true)} />}
      {scale === 'semaine' && <WeekList start={weekStart(focus)} today={model.today} items={items} onPick={(d) => set({ echelle: 'jour', jour: d }, true)} />}
      {scale === 'jour' && <DayDetail date={focus} today={model.today} list={items(focus)} />}
      <Legend />
    </>
  );
}

function marks(list: CalItem[]) {
  const { done, planned } = dayModules(list);
  return CAL_MODULES.map((m) => ({ module: m.key, state: done.has(m.key) ? ('done' as const) : planned.has(m.key) ? ('planned' as const) : ('none' as const) }));
}

function describe(date: string, list: CalItem[]): string {
  const { done, planned } = dayModules(list);
  const names = (set: Set<CalModule>) => CAL_MODULES.filter((m) => set.has(m.key)).map((m) => m.label);
  const parts = [done.size ? names(done).join(', ') : '', planned.size ? `prévu : ${names(planned).join(', ')}` : ''].filter(Boolean);
  return `${formatDayShort(date)} : ${parts.length ? parts.join(' ; ') : 'rien de noté'}`;
}

function MonthGrid({ month, today, items, onPick }: { month: string; today: string; items: (d: string) => CalItem[]; onPick: (d: string) => void }) {
  const grid = monthGrid(month);
  return (
    <Card label="Mois" className="gap-2 px-3">
      <div className="grid grid-cols-7 text-center text-[12px] text-cendre" aria-hidden="true">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {grid.flat().map(({ date, inMonth }) => {
          if (!inMonth) return <span key={date} aria-hidden="true" />;
          const list = items(date);
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onPick(date)}
              aria-label={describe(date, list)}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-[12px] active:bg-graphite ${isToday ? 'bg-graphite' : ''}`}
            >
              <span className={`text-[15px] tabular-nums ${isToday ? 'font-semibold text-module' : date > today ? 'text-cendre' : ''}`}>{Number(date.slice(8))}</span>
              <span className="grid grid-cols-4 gap-[3px]">
                {marks(list).map((m) => (
                  <ModuleMark key={m.module} module={m.module} state={m.state} size={6} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function WeekList({ start, today, items, onPick }: { start: string; today: string; items: (d: string) => CalItem[]; onPick: (d: string) => void }) {
  return (
    <ul className="flex flex-col gap-2">
      {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((date) => {
        const list = items(date);
        return (
          <li key={date}>
            <button
              type="button"
              onClick={() => onPick(date)}
              className={`flex w-full items-start gap-3 rounded-[16px] bg-anthracite p-3.5 text-left active:opacity-80 ${date === today ? 'ring-1 ring-module' : ''}`}
            >
              <span className="w-[86px] shrink-0">
                <span className={`block text-[15px] font-semibold ${date === today ? 'text-module' : ''}`}>{formatDayShort(date).split(' ').slice(0, 2).join(' ')}</span>
                {date === today && <span className="block text-[12px] text-cendre">Aujourd’hui</span>}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                {list.length === 0 ? (
                  <span className="text-[13px] text-cendre">{date > today ? 'Rien de prévu' : 'Rien de noté'}</span>
                ) : (
                  list.slice(0, 4).map((it, k) => (
                    <span key={k} className="flex items-center gap-2 text-[13px]">
                      <ModuleMark module={it.module} state={it.planned ? 'planned' : 'done'} />
                      <span className={`truncate ${it.planned ? 'text-cendre' : ''}`}>{it.title}</span>
                    </span>
                  ))
                )}
                {list.length > 4 && <span className="text-[12px] text-cendre">et {list.length - 4} de plus</span>}
              </span>
              <Icon name="chevron" size={16} className="mt-1 shrink-0 text-cendre" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DayDetail({ date, today, list }: { date: string; today: string; list: CalItem[] }) {
  if (list.length === 0) {
    return <p className="rounded-[18px] bg-anthracite p-4 text-[15px] leading-snug text-cendre">{date > today ? 'Rien de prévu pour l’instant.' : 'Rien de noté ce jour-là.'}</p>;
  }
  return (
    <>
      {CAL_MODULES.filter((m) => list.some((i) => i.module === m.key)).map((m) => (
        <section key={m.key} aria-label={m.label} className="flex flex-col">
          <h2 className="mb-1 flex items-center gap-2 text-[17px] font-semibold">
            <ModuleMark module={m.key} state="done" size={9} />
            {m.label}
          </h2>
          <ul>
            {list
              .filter((i) => i.module === m.key)
              .map((it, k) => {
                const body = (
                  <>
                    <span className="min-w-0">
                      <span className={`block text-[15px] ${it.planned ? 'text-cendre' : ''}`}>{it.title}</span>
                      {it.detail && <span className="block text-[12px] text-cendre">{it.detail}</span>}
                    </span>
                    {it.to && <Icon name="chevron" size={16} className="shrink-0 text-cendre" />}
                  </>
                );
                return (
                  <li key={k} className="border-b border-anthracite last:border-b-0">
                    {it.to ? (
                      <Link to={it.to} viewTransition className="flex min-h-11 items-center justify-between gap-3 py-2">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex min-h-11 items-center justify-between gap-3 py-2">{body}</div>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </>
  );
}

function Legend() {
  return (
    <section aria-label="Légende" className="flex flex-col gap-2 text-[13px]">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {CAL_MODULES.map((m) => (
          <li key={m.key} className="flex items-center gap-1.5">
            <ModuleMark module={m.key} state="done" size={9} />
            {m.label}
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-cendre">
        <ModuleMark module="training" state="planned" size={9} />
        Anneau : prévu (séance du programme, repas du planning). Un jour passé sans séance n’est jamais signalé.
      </p>
    </section>
  );
}
