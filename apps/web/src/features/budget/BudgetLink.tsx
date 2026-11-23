import { useMemo } from 'react';
import { Link } from 'react-router';
import { useFoodEntries, useMeta, useToday } from '../../db/hooks';
import { BUDGET_KEY, costSummary, type BudgetSettings } from '../../domain/budget';
import { formatEur } from '../../domain/kitchen';
import { useCostContext } from './BudgetScreen';

/** Raccourci vers Budget, avec le coût du jour affiché. */
export function BudgetLink({ date }: { date: string }) {
  const entries = useFoodEntries();
  const cost = useCostContext();
  const settings = useMeta<BudgetSettings>(BUDGET_KEY);
  const today = useToday();
  const day = useMemo(() => (entries && cost ? costSummary(entries, date, date, cost.ctx) : null), [entries, cost, date]);
  const sub = !day
    ? 'Coût de tes repas'
    : day.total > 0
      ? `${formatEur(day.total)}${settings?.dailyEur ? ` sur ${formatEur(settings.dailyEur)}` : ''}${date === today ? ' aujourd’hui' : ' ce jour-là'}`
      : 'Prix à renseigner';
  return (
    <Link to="/nutrition/budget" viewTransition className="flex min-h-[72px] flex-col justify-between rounded-[18px] bg-anthracite p-3.5 active:scale-[0.99]">
      <span className="text-[17px] font-semibold">Budget</span>
      <span className="text-[12px] text-cendre">{sub}</span>
    </Link>
  );
}
