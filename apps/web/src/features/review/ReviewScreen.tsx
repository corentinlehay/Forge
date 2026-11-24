import { useSearchParams } from 'react-router';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { BadgesView } from './BadgesView';
import { CalendarView } from './CalendarView';
import { InsightsView } from './InsightsView';
import { ReviewBack } from './reviewShared';
import { useLifeData } from './useLifeData';
import { WeekView } from './WeekView';

type View = 'semaine' | 'calendrier' | 'analyses' | 'badges';
const views = [
  { value: 'semaine', label: 'Semaine' },
  { value: 'calendrier', label: 'Calendrier' },
  { value: 'analyses', label: 'Analyses' },
  { value: 'badges', label: 'Badges' },
] as const;

/** Bilans : la semaine, le calendrier de tous les espaces, les liens entre tes données, les badges. */
export function ReviewScreen() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('vue');
  const view: View = raw === 'calendrier' || raw === 'analyses' || raw === 'badges' ? raw : 'semaine';
  const model = useLifeData();

  return (
    <Screen withTabBar={false}>
      <ReviewBack />
      <h1 className="font-metal -mt-2 text-[40px]">Bilans</h1>
      <Segmented label="Vue" options={views} value={view} onChange={(v) => setParams(v === 'semaine' ? {} : { vue: v }, { replace: true })} />
      {!model ? (
        <div className="h-64 animate-pulse rounded-[22px] bg-anthracite" aria-busy="true" aria-label="Chargement" />
      ) : view === 'semaine' ? (
        <WeekView model={model} />
      ) : view === 'calendrier' ? (
        <CalendarView model={model} />
      ) : view === 'analyses' ? (
        <InsightsView model={model} />
      ) : (
        <BadgesView model={model} />
      )}
    </Screen>
  );
}
