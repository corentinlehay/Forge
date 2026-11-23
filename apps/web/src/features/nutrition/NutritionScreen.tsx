import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useFoodEntries, useProfile, useToday, useWeighIns } from '../../db/hooks';
import type { FoodEntry, MealSlot } from '../../db/types';
import { dailyKcal, dayNutrition, MEAL_LABELS, MEAL_ORDER, sumEntries } from '../../domain/nutrition';
import { summarizeWeight } from '../../domain/weight';
import { DEFAULT_GAIN_RATE } from '../../db/repositories/profile';
import { addDays, isDateKey } from '../../lib/dates';
import { formatDayMonth, formatDayShort, formatNumber } from '../../lib/format';
import { BarChart } from '../../ui/BarChart';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Meter } from '../../ui/Meter';
import { Ring } from '../../ui/Ring';
import { Card, Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { defaultMeal, FoodForm, TargetsForm } from './FoodSheet';

type SheetState = { kind: 'none' } | { kind: 'add'; meal: MealSlot; nonce: number } | { kind: 'edit'; entry: FoodEntry } | { kind: 'targets' };

export function NutritionScreen() {
  const today = useToday();
  const entries = useFoodEntries();
  const profile = useProfile();
  const weighIns = useWeighIns();
  const [params, setParams] = useSearchParams();
  const [sheet, setSheet] = useState<SheetState>({ kind: 'none' });

  const asked = params.get('jour');
  const date = asked && isDateKey(asked) && asked <= today ? asked : today;
  const setDate = (d: string) => setParams(d === today ? {} : { jour: d }, { replace: true });

  const day = useMemo(() => dayNutrition(entries ?? [], date, profile?.nutritionTargets), [entries, date, profile]);
  const week = useMemo(() => dailyKcal(entries ?? [], date, 7), [entries, date]);
  const trendKg = useMemo(() => summarizeWeight(weighIns ?? [], profile?.gainRate ?? DEFAULT_GAIN_RATE).latestTrendKg, [weighIns, profile]);
  const { totals, targets, remainingKcal, progress } = day;
  const close = () => setSheet({ kind: 'none' });

  return (
    <Screen>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-metal text-[40px]">Nutrition</h1>
        <Button size="small" onClick={() => setSheet({ kind: 'add', meal: date === today ? defaultMeal() : 'lunch', nonce: Date.now() })}>
          <Icon name="plus" size={18} strokeWidth={2.5} />
          Ajouter
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-[14px] bg-anthracite p-1">
        <button type="button" aria-label="Jour précédent" onClick={() => setDate(addDays(date, -1))} className="flex h-10 w-11 items-center justify-center rounded-[10px] text-cendre active:bg-graphite">
          <Icon name="back" size={20} />
        </button>
        <p className="text-[15px] font-semibold">{date === today ? 'Aujourd’hui' : date === addDays(today, -1) ? 'Hier' : formatDayShort(date)}</p>
        <button
          type="button"
          aria-label="Jour suivant"
          disabled={date >= today}
          onClick={() => setDate(addDays(date, 1))}
          className="flex h-10 w-11 items-center justify-center rounded-[10px] text-cendre active:bg-graphite disabled:opacity-30"
        >
          <Icon name="chevron" size={20} />
        </button>
      </div>

      <Card label="Bilan du jour">
        <div className="flex items-center gap-5">
          <Ring value={progress?.kcal ?? 0} size={124} label={targets ? `${totals.kcal} kcal sur ${targets.kcal}` : `${totals.kcal} kcal`} overTone="alert">
            <span className="font-metal text-[32px]">{formatNumber(totals.kcal, 0)}</span>
            <span className="text-[11px] text-cendre">{targets ? `sur ${formatNumber(targets.kcal, 0)} kcal` : 'kcal'}</span>
          </Ring>
          <div className="flex flex-col gap-1">
            {remainingKcal !== null ? (
              <>
                <p className="text-[13px] text-cendre">{remainingKcal >= 0 ? 'Restant' : 'Au-delà de l’objectif'}</p>
                <p className="font-metal text-[36px]">{formatNumber(Math.abs(remainingKcal), 0)}</p>
                <p className="text-[13px] text-cendre">kcal</p>
              </>
            ) : (
              <p className="text-[15px] leading-snug">Pas encore d’objectif calorique.</p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <Meter label="Protéines" value={totals.proteinG} target={targets?.proteinG} />
          <Meter label="Glucides" value={totals.carbsG} target={targets?.carbsG} />
          <Meter label="Lipides" value={totals.fatG} target={targets?.fatG} />
        </div>
        <Button variant={targets ? 'quiet' : 'secondary'} className={targets ? '-ml-2 self-start' : ''} onClick={() => setSheet({ kind: 'targets' })}>
          {targets ? 'Modifier les objectifs' : 'Définir mes objectifs'}
        </Button>
      </Card>

      {entries !== undefined && (
        <div className="flex flex-col gap-3">
          {MEAL_ORDER.map((meal) => {
            const list = day.entries.filter((e) => e.meal === meal);
            const sum = sumEntries(list);
            return (
              <section key={meal} aria-label={MEAL_LABELS[meal]} className="rounded-[18px] bg-anthracite px-4 py-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[15px] font-semibold">
                    {MEAL_LABELS[meal]} {list.length > 0 && <span className="font-normal text-cendre">{formatNumber(sum.kcal, 0)} kcal</span>}
                  </h2>
                  <button
                    type="button"
                    aria-label={`Ajouter au ${MEAL_LABELS[meal].toLocaleLowerCase('fr-FR')}`}
                    onClick={() => setSheet({ kind: 'add', meal, nonce: Date.now() })}
                    className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-citron"
                  >
                    <Icon name="plus" size={20} strokeWidth={2.5} />
                  </button>
                </div>
                {list.length > 0 ? (
                  <ul className="pb-1">
                    {list.map((e) => (
                      <li key={e.id} className="border-t border-graphite">
                        <button type="button" onClick={() => setSheet({ kind: 'edit', entry: e })} className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left">
                          <span className="min-w-0">
                            <span className="block truncate text-[15px]">{e.name}</span>
                            <span className="block text-[12px] text-cendre">
                              {e.quantity ? `${e.quantity}, ` : ''}P {formatNumber(e.proteinG, 0)} G {formatNumber(e.carbsG, 0)} L {formatNumber(e.fatG, 0)}
                            </span>
                          </span>
                          <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatNumber(e.kcal, 0)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pb-2 text-[13px] text-cendre">Rien d’enregistré.</p>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Card label="Calories sur 7 jours">
        <h2 className="text-[13px] text-cendre">7 derniers jours</h2>
        <BarChart
          title="Calories par jour"
          target={targets?.kcal}
          bars={week.map((d) => ({
            key: d.date,
            label: formatDayMonth(d.date).split(' ')[0] ?? '',
            value: d.kcal,
            detail: `${formatDayShort(d.date)} : ${d.count ? `${formatNumber(d.kcal, 0)} kcal` : 'rien d’enregistré'}${targets && d.count ? `, ${Math.round((d.kcal / targets.kcal) * 100)} % de l’objectif` : ''}`,
          }))}
        />
      </Card>

      <p className="px-1 text-[13px] leading-snug text-cendre">
        Saisie manuelle pour l’instant. La recherche dans la table Ciqual, le scanner de codes-barres et Open Food Facts arrivent avec le module Nutrition complet.
      </p>

      <Sheet open={sheet.kind !== 'none'} title={sheet.kind === 'targets' ? 'Objectifs du jour' : sheet.kind === 'edit' ? 'Modifier l’aliment' : 'Ajouter un aliment'} onClose={close}>
        {sheet.kind === 'add' && <FoodForm key={sheet.nonce} date={date} meal={sheet.meal} editing={null} onDone={close} />}
        {sheet.kind === 'edit' && <FoodForm key={sheet.entry.id} date={date} meal={sheet.entry.meal} editing={sheet.entry} onDone={close} />}
        {sheet.kind === 'targets' && <TargetsForm current={profile?.nutritionTargets} trendKg={trendKg} onDone={close} />}
      </Sheet>
    </Screen>
  );
}
