import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ObjectivesLink } from '../objectives/ObjectivesLink';
import { BudgetLink } from '../budget/BudgetLink';
import { repos, useFoodEntries, useFoods, useProfile, useToday, useWaterLogs, useWeighIns } from '../../db/hooks';
import { DEFAULT_GAIN_RATE } from '../../db/repositories/profile';
import type { FoodEntry, MealSlot } from '../../db/types';
import { dailyKcal, dayNutrition, FIBER_REFERENCE_G, MEAL_LABELS, MEAL_ORDER, sumEntries, waterForDay } from '../../domain/nutrition';
import { summarizeWeight } from '../../domain/weight';
import { addDays, isDateKey } from '../../lib/dates';
import { formatDayMonth, formatDayShort, formatLitres as litres, formatNumber } from '../../lib/format';
import { BarChart } from '../../ui/BarChart';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Meter } from '../../ui/Meter';
import { Ring } from '../../ui/Ring';
import { Card, Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { FoodForm, TargetsForm } from './FoodSheet';
import { choiceFromFood, copyEntries, saveAsTemplate, type FoodChoice } from './foodActions';
import { QuantityForm } from './QuantityForm';

type SheetState =
  | { kind: 'none' }
  | { kind: 'edit'; entry: FoodEntry }
  | { kind: 'weighed'; entry: FoodEntry; choice: FoodChoice }
  | { kind: 'targets' }
  | { kind: 'meal'; meal: MealSlot }
  | { kind: 'water' };


export function NutritionScreen() {
  const today = useToday();
  const navigate = useNavigate();
  const entries = useFoodEntries();
  const foods = useFoods();
  const water = useWaterLogs();
  const profile = useProfile();
  const weighIns = useWeighIns();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [sheet, setSheet] = useState<SheetState>({ kind: 'none' });

  const asked = params.get('jour');
  const date = asked && isDateKey(asked) && asked <= today ? asked : today;
  const setDate = (d: string) => setParams(d === today ? {} : { jour: d }, { replace: true });
  const addPath = (meal?: MealSlot) => `/nutrition/ajouter?${new URLSearchParams({ ...(meal ? { repas: meal } : {}), ...(date !== today ? { jour: date } : {}) })}`;

  const day = useMemo(() => dayNutrition(entries ?? [], date, profile?.nutritionTargets), [entries, date, profile]);
  const week = useMemo(() => dailyKcal(entries ?? [], date, 7), [entries, date]);
  const trendKg = useMemo(() => summarizeWeight(weighIns ?? [], profile?.gainRate ?? DEFAULT_GAIN_RATE).latestTrendKg, [weighIns, profile]);
  const waterMl = waterForDay(water ?? [], date);
  const { totals, targets, remainingKcal, progress } = day;
  const close = () => setSheet({ kind: 'none' });

  const openEntry = (entry: FoodEntry) => {
    if (!entry.per100 || !entry.grams) return setSheet({ kind: 'edit', entry });
    const food = foods?.find((f) => f.id === entry.foodId);
    const choice: FoodChoice = food
      ? { ...choiceFromFood(food), per100: entry.per100 }
      : { source: 'custom', sourceId: null, foodId: entry.foodId ?? null, name: entry.name, state: null, unit: entry.unit ?? 'g', per100: entry.per100, servingG: null };
    setSheet({ kind: 'weighed', entry, choice });
  };

  const addWater = async (ml: number) => {
    await repos.water.add({ date, ml });
    toast.show(`+${ml} ml`);
  };

  return (
    <Screen>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-metal text-[40px]">Nutrition</h1>
        <Button size="small" onClick={() => navigate(addPath(), { viewTransition: true })}>
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
          <Meter label="Fibres" value={totals.fiberG} target={targets?.fiberG ?? null} />
          {totals.fiberUnknown > 0 && day.entries.length > 0 && (
            <p className="-mt-1 text-[12px] text-cendre">
              Fibres inconnues pour {totals.fiberUnknown} aliment{totals.fiberUnknown > 1 ? 's' : ''} : le total est un minimum.
              {!targets?.fiberG ? ` Repère : ${FIBER_REFERENCE_G} g par jour.` : ''}
            </p>
          )}
        </div>
        <Button variant={targets ? 'quiet' : 'secondary'} className={targets ? '-ml-2 self-start' : ''} onClick={() => setSheet({ kind: 'targets' })}>
          {targets ? 'Modifier les objectifs' : 'Définir mes objectifs'}
        </Button>
      </Card>

      <nav aria-label="Raccourcis nutrition" className="grid grid-cols-2 gap-2">
        <Link to="/nutrition/recettes" viewTransition className="flex min-h-[72px] flex-col justify-between rounded-[18px] bg-anthracite p-3.5 active:scale-[0.99]">
          <span className="text-[17px] font-semibold">Recettes</span>
          <span className="text-[12px] text-cendre">Sportives et plaisir, planning, courses</span>
        </Link>
        <Link to="/nutrition/compose" viewTransition className="flex min-h-[72px] flex-col justify-between rounded-[18px] bg-anthracite p-3.5 active:scale-[0.99]">
          <span className="text-[17px] font-semibold">Compose mon repas</span>
          <span className="text-[12px] text-cendre">{remainingKcal !== null && date === today ? `Pour tes ${formatNumber(Math.max(0, remainingKcal), 0)} kcal restantes` : 'Selon ce qu’il te reste'}</span>
        </Link>
        <ObjectivesLink />
        <BudgetLink date={date} />
      </nav>

      <section aria-label="Hydratation" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[13px] text-cendre">
            <Icon name="drop" size={16} className="text-citron" />
            Hydratation
          </h2>
          <button type="button" onClick={() => setSheet({ kind: 'water' })} className="-mr-2 min-h-11 px-2 text-[13px] text-cendre">
            Détail
          </button>
        </div>
        <p>
          <span className="font-metal text-[36px]">{litres(waterMl)}</span>
          {targets?.waterMl ? <span className="text-[15px] text-cendre"> / {litres(targets.waterMl)}</span> : null}
        </p>
        {targets?.waterMl ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-graphite" role="progressbar" aria-label="Hydratation" aria-valuemin={0} aria-valuemax={targets.waterMl} aria-valuenow={waterMl}>
            <div className="h-full rounded-full bg-citron transition-[width] duration-700" style={{ width: `${Math.min(1, waterMl / targets.waterMl) * 100}%` }} />
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2">
          {[250, 500, 750].map((ml) => (
            <button key={ml} type="button" onClick={() => void addWater(ml)} className="h-11 rounded-[12px] bg-graphite text-[15px] font-semibold active:opacity-80">
              +{ml} ml
            </button>
          ))}
        </div>
      </section>

      {entries !== undefined && (
        <div className="flex flex-col gap-3">
          {MEAL_ORDER.map((meal) => {
            const list = day.entries.filter((e) => e.meal === meal);
            const sum = sumEntries(list);
            return (
              <section key={meal} aria-label={MEAL_LABELS[meal]} className="rounded-[18px] bg-anthracite px-4 py-2">
                <div className="flex items-center justify-between gap-1">
                  <h2 className="min-w-0 flex-1 text-[15px] font-semibold">
                    {MEAL_LABELS[meal]} {list.length > 0 && <span className="font-normal text-cendre">{formatNumber(sum.kcal, 0)} kcal, P {formatNumber(sum.proteinG, 0)} g</span>}
                  </h2>
                  <button type="button" aria-label={`Actions pour le ${MEAL_LABELS[meal].toLocaleLowerCase('fr-FR')}`} onClick={() => setSheet({ kind: 'meal', meal })} className="flex h-11 w-10 items-center justify-center text-cendre">
                    <Icon name="dots" size={22} strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Ajouter au ${MEAL_LABELS[meal].toLocaleLowerCase('fr-FR')}`}
                    onClick={() => navigate(addPath(meal), { viewTransition: true })}
                    className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-citron"
                  >
                    <Icon name="plus" size={20} strokeWidth={2.5} />
                  </button>
                </div>
                {list.length > 0 ? (
                  <ul className="pb-1">
                    {list.map((e) => (
                      <li key={e.id} className="border-t border-graphite">
                        <button type="button" onClick={() => openEntry(e)} className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left">
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

      <Sheet
        open={sheet.kind !== 'none'}
        title={
          sheet.kind === 'targets'
            ? 'Objectifs du jour'
            : sheet.kind === 'edit'
              ? 'Modifier l’aliment'
              : sheet.kind === 'weighed'
                ? sheet.choice.name
                : sheet.kind === 'meal'
                  ? MEAL_LABELS[sheet.meal]
                  : 'Boissons du jour'
        }
        onClose={close}
      >
        {sheet.kind === 'edit' && <FoodForm key={sheet.entry.id} date={date} meal={sheet.entry.meal} editing={sheet.entry} onDone={close} />}
        {sheet.kind === 'weighed' && <QuantityForm key={sheet.entry.id} choice={sheet.choice} date={date} meal={sheet.entry.meal} editing={sheet.entry} onDone={close} />}
        {sheet.kind === 'targets' && <TargetsForm current={profile?.nutritionTargets} trendKg={trendKg} onDone={close} />}
        {sheet.kind === 'meal' && <MealActions meal={sheet.meal} date={date} today={today} entries={entries ?? []} onDone={close} />}
        {sheet.kind === 'water' && <WaterDetail date={date} onDone={close} />}
      </Sheet>
    </Screen>
  );
}

/** Actions d'un repas : copier depuis hier, copier vers aujourd'hui, enregistrer comme repas habituel. */
function MealActions({ meal, date, today, entries, onDone }: { meal: MealSlot; date: string; today: string; entries: FoodEntry[]; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [naming, setNaming] = useState(false);
  const mine = entries.filter((e) => !e.deletedAt && e.date === date && e.meal === meal);
  const yesterday = addDays(date, -1);
  const fromYesterday = entries.filter((e) => !e.deletedAt && e.date === yesterday && e.meal === meal);
  const label = MEAL_LABELS[meal].toLocaleLowerCase('fr-FR');

  const copy = async (list: FoodEntry[], to: string, done: string) => {
    const n = await copyEntries(list, to, meal);
    toast.show(`${n} aliment${n > 1 ? 's' : ''} ${done}`);
    onDone();
  };

  return (
    <div className="flex flex-col gap-2 pb-1">
      <Button variant="secondary" disabled={!fromYesterday.length} onClick={() => void copy(fromYesterday, date, 'copiés')}>
        <Icon name="copy" size={18} />
        Copier le {label} de la veille {fromYesterday.length ? `(${fromYesterday.length})` : ''}
      </Button>
      {date !== today && (
        <Button variant="secondary" disabled={!mine.length} onClick={() => void copy(mine, today, 'copiés sur aujourd’hui')}>
          <Icon name="copy" size={18} />
          Copier ce {label} sur aujourd’hui
        </Button>
      )}
      {naming ? (
        <form
          className="flex flex-col gap-2 pt-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            await saveAsTemplate(name, mine, meal);
            toast.show('Repas habituel enregistré');
            onDone();
          }}
        >
          <Field label="Nom du repas habituel" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex. petit-déjeuner avoine" autoFocus />
          <Button type="submit" disabled={!name.trim()}>
            Enregistrer
          </Button>
        </form>
      ) : (
        <Button variant="secondary" disabled={!mine.length} onClick={() => setNaming(true)}>
          <Icon name="star" size={18} />
          Enregistrer comme repas habituel
        </Button>
      )}
      {!mine.length && !fromYesterday.length && <p className="pt-1 text-[13px] text-cendre">Ce repas est vide, et celui de la veille aussi.</p>}
    </div>
  );
}

function WaterDetail({ date, onDone }: { date: string; onDone: () => void }) {
  const water = useWaterLogs();
  const toast = useToast();
  const list = (water ?? []).filter((w) => w.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <div className="flex flex-col gap-2 pb-1">
      {list.length === 0 && <p className="text-[15px] text-cendre">Aucune boisson enregistrée ce jour-là.</p>}
      <ul>
        {list.map((w) => (
          <li key={w.id} className="flex min-h-11 items-center justify-between border-b border-graphite last:border-b-0">
            <span className="text-[15px]">
              {new Date(w.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} <span className="text-cendre">{w.ml} ml</span>
            </span>
            <button
              type="button"
              aria-label={`Retirer ${w.ml} ml`}
              onClick={async () => {
                await repos.water.remove(w.id);
                toast.show(`${w.ml} ml retirés`);
              }}
              className="flex h-11 w-11 items-center justify-center text-cendre"
            >
              <Icon name="close" size={18} />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="quiet" onClick={onDone}>
        Fermer
      </Button>
    </div>
  );
}
