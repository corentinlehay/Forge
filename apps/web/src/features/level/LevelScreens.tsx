import { useMemo, useState } from 'react';
import { BADGE_CATEGORY_LABELS, BADGES, type BadgeCategory } from '../../domain/level/badges';
import { badgeProgress, characteristicHistory, timeline, xpByWeek, type TimelineEntry } from '../../domain/level/history';
import type { LevelState } from '../../domain/level/level';
import { XP_KIND_LABELS, type XpEvent, type XpKind } from '../../domain/level/xp';
import { PRIORITY_MUSCLES } from '../../domain/plan';
import { weekStart } from '../../domain/training';
import { addDays } from '../../lib/dates';
import { capitalize, formatDayMonth, formatNumber } from '../../lib/format';
import { BarChart } from '../../ui/BarChart';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { UserEmblem } from './Emblem';
import { BackButton, BadgeMedal, BadgeRow, CharacteristicRow, Rules } from './parts';
import { Radar, Sparkline } from './Radar';
import { useLevel, useLevelResolver } from './useLevel';

const xp = (n: number) => `${formatNumber(n, 0)} XP`;
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthOf = (date: string) => `${capitalize(MONTHS[Number(date.slice(5, 7)) - 1]!)} ${date.slice(0, 4)}`;

function Shell({ title, intro, children }: { title: string; intro?: string; children: (level: LevelState) => React.ReactNode }) {
  const level = useLevel();
  return (
    <Screen withTabBar={false}>
      <BackButton />
      <div className="flex flex-col gap-2">
        <h1 className="font-metal text-[40px] leading-none">{title}</h1>
        {intro && <p className="text-[15px] leading-snug text-cendre">{intro}</p>}
      </div>
      {level ? children(level) : <div className="h-[240px] animate-pulse rounded-[22px] bg-anthracite" aria-busy="true" aria-label="Chargement" />}
    </Screen>
  );
}

/** Les six caractéristiques : l'hexagone, puis chaque note avec sa courbe sur 12 semaines et ses facteurs. */
export function CharacteristicsScreen() {
  return (
    <Shell title="Caractéristiques" intro="Notes sur 100, calculées sur les 12 dernières semaines. Une convention FORGE, pas une mesure ; elles ne dépendent pas du niveau.">
      {(level) => <Characteristics level={level} />}
    </Shell>
  );
}

function Characteristics({ level }: { level: LevelState }) {
  const resolve = useLevelResolver();
  const history = useMemo(() => (resolve ? characteristicHistory(level.model, resolve, PRIORITY_MUSCLES, 12) : null), [level.model, resolve]);
  return (
    <>
      <section aria-label="Hexagone" className="rounded-[22px] bg-anthracite px-2 py-4">
        <Radar items={level.characteristics} />
      </section>
      <section aria-label="Notes" className="flex flex-col gap-2">
        {level.characteristics.map((c) => {
          const values = history?.map((p) => p.scores[c.key]) ?? [];
          return (
            <CharacteristicRow key={c.key} c={c}>
              {values.some((v) => v !== null) && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-[12px] text-cendre">12 dernières semaines</span>
                  <Sparkline values={values} />
                </div>
              )}
            </CharacteristicRow>
          );
        })}
      </section>
      <p className="pb-4 text-[12px] leading-snug text-cendre">
        Repères : OMS 2020 pour l’endurance, ACSM 2011 pour la mobilité, AASM 2015 pour le sommeil, Schoenfeld et al. 2017 pour le volume. Les réglages sont modifiables.
      </p>
    </>
  );
}

/** L'XP : semaine par semaine, par source, passages de niveau et chaque gain. */
export function XpScreen() {
  return <Shell title="Progression XP">{(level) => <Xp level={level} />}</Shell>;
}

const PAGE = 40;

function Xp({ level }: { level: LevelState }) {
  const today = level.model.input.today;
  const weeks = useMemo(() => xpByWeek(level.events, today, 12), [level.events, today]);
  const [shown, setShown] = useState(PAGE);
  const { progress } = level;
  const totals = (
    Object.entries(level.events.reduce<Partial<Record<XpKind, number>>>((acc, e) => ({ ...acc, [e.kind]: (acc[e.kind] ?? 0) + e.xp }), {})) as [XpKind, number][]
  ).sort((a, b) => b[1] - a[1]);
  const byWeek = new Map<string, XpEvent[]>();
  for (const e of level.events.slice(0, shown)) byWeek.set(weekStart(e.date), [...(byWeek.get(weekStart(e.date)) ?? []), e]);
  // Le rythme se mesure sur les semaines terminées depuis la première avec de l'XP, pas sur des semaines d'avant le début.
  const past = weeks.slice(0, -1);
  const from = past.findIndex((w) => w.xp > 0);
  const counted = from === -1 ? [] : past.slice(from);
  const average = counted.reduce((n, w) => n + w.xp, 0) / Math.max(1, counted.length);
  return (
    <>
      <section aria-label="Niveau" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
        <div className="flex items-end justify-between gap-3">
          <p className="flex items-baseline gap-2">
            <span className="text-[15px] text-cendre">Niveau</span>
            <span className="font-metal text-[52px] leading-[0.85]">{progress.level}</span>
          </p>
          <p className="text-right text-[13px] leading-snug text-cendre tabular-nums">
            {xp(progress.totalXp)} au total
            <br />
            {progress.next ? `niveau ${progress.level + 1} à ${xp(progress.next)}` : 'niveau maximal'}
          </p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
          <div className="h-full rounded-full bg-module motion-grow-x" style={{ width: `${Math.max(2, progress.progress * 100)}%` }} />
        </div>
        {progress.next && average > 0 && (
          <p className="text-[13px] text-cendre">
            À ton rythme des {counted.length} dernières semaines ({xp(Math.round(average))} par semaine), le niveau {progress.level + 1} arrive dans{' '}
            {Math.max(1, Math.ceil((progress.next - progress.totalXp) / average))} semaine{Math.ceil((progress.next - progress.totalXp) / average) > 1 ? 's' : ''} environ.
          </p>
        )}
      </section>

      <section aria-label="XP par semaine" className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-[18px]">
        <h2 className="text-[17px] font-semibold">XP par semaine</h2>
        <BarChart
          title="Touche une semaine pour son détail."
          bars={weeks.map((w, i) => ({
            key: w.weekStart,
            // Une étiquette sur deux, la dernière toujours : douze dates ne tiennent pas sur un écran d'iPhone.
            label: (weeks.length - 1 - i) % 2 === 0 ? `${Number(w.weekStart.slice(8))}/${Number(w.weekStart.slice(5, 7))}` : '',
            value: w.xp,
            detail: `Semaine du ${formatDayMonth(w.weekStart)} : ${xp(w.xp)}${
              w.xp
                ? ` (${(Object.entries(w.byKind) as [XpKind, number][])
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => `${k === 'mind' ? 'Mind' : XP_KIND_LABELS[k].toLocaleLowerCase('fr-FR')} ${v}`)
                    .join(', ')})`
                : ''
            }`,
          }))}
        />
      </section>

      {totals.length > 0 && (
        <section aria-label="D’où vient ton XP" className="flex flex-col gap-2.5 rounded-[22px] bg-anthracite p-[18px]">
          <h2 className="text-[17px] font-semibold">D’où vient ton XP</h2>
          {totals.map(([kind, n], i) => (
            <div key={kind} className="grid grid-cols-[130px_1fr_76px] items-center gap-2" aria-label={`${XP_KIND_LABELS[kind]} : ${xp(n)}`}>
              <span className="truncate text-[13px]">{XP_KIND_LABELS[kind]}</span>
              <span className="h-2.5 overflow-hidden rounded-[4px] bg-graphite" aria-hidden="true">
                <span className="block h-full rounded-[4px] bg-module motion-grow-x" style={{ width: `${(n / totals[0]![1]) * 100}%`, ['--i' as string]: i }} />
              </span>
              <span className="text-right text-[13px] tabular-nums" aria-hidden="true">
                {formatNumber(n, 0)}
              </span>
            </div>
          ))}
        </section>
      )}

      {level.levelUps.length > 0 && (
        <section aria-label="Passages de niveau" className="flex flex-col gap-2">
          <h2 className="text-[17px] font-semibold">Passages de niveau</h2>
          <ol className="flex flex-col">
            {[...level.levelUps].reverse().map((l) => (
              <li key={l.level} className="flex items-center justify-between gap-3 border-b border-graphite py-2 last:border-b-0">
                <span className="text-[15px]">Niveau {l.level}</span>
                <span className="text-[13px] text-cendre tabular-nums">{formatDayMonth(l.date)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-label="Tous les gains" className="flex flex-col gap-3">
        <h2 className="text-[17px] font-semibold">Tous les gains</h2>
        {[...byWeek].map(([week, events]) => (
          <div key={week} className="flex flex-col">
            <h3 className="text-[13px] text-cendre">
              Semaine du {formatDayMonth(week)} au {formatDayMonth(addDays(week, 6))}
            </h3>
            <ol className="flex flex-col">
              {events.map((e) => (
                <li key={e.key} className="flex items-center gap-3 border-b border-graphite py-2 last:border-b-0">
                  <span className="w-14 shrink-0 text-[13px] text-cendre tabular-nums">{formatDayMonth(e.date)}</span>
                  <span className="min-w-0 flex-1 text-[15px] leading-tight">{e.label}</span>
                  <span className="shrink-0 text-[15px] font-semibold text-module tabular-nums">+{e.xp}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
        {level.events.length > shown && (
          <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>
            Voir plus ({level.events.length - shown} restants)
          </Button>
        )}
        {!level.events.length && <p className="text-[15px] text-cendre">Termine une séance pour gagner tes premiers points.</p>}
      </section>
      <div className="pb-4">
        <Rules />
      </div>
    </>
  );
}

/** Les badges par catégorie : débloqués avec leur date, les autres avec leur condition et où tu en es. */
export function BadgesScreen() {
  return <Shell title="Badges">{(level) => <Badges level={level} />}</Shell>;
}

function Badges({ level }: { level: LevelState }) {
  const unlocked = new Map(level.unlocks.map((u) => [u.id, u]));
  const progress = useMemo(() => badgeProgress(level.model, level.unlocks), [level.model, level.unlocks]);
  const rare = BADGES.filter((b) => b.rarity === 'rare');
  const categories = [...new Set(BADGES.map((b) => b.category))] as BadgeCategory[];
  return (
    <>
      <section aria-label="Résumé" className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5 rounded-[18px] bg-anthracite p-4">
          <span className="text-[12px] text-cendre">Débloqués</span>
          <span className="font-metal text-[34px] leading-none tabular-nums">
            {unlocked.size}
            <span className="text-[17px] text-cendre"> / {BADGES.length}</span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-[18px] bg-anthracite p-4">
          <span className="text-[12px] text-cendre">Rares</span>
          <span className="font-metal text-[34px] leading-none text-citron tabular-nums">
            {rare.filter((b) => unlocked.has(b.id)).length}
            <span className="text-[17px] text-cendre"> / {rare.length}</span>
          </span>
        </div>
      </section>
      {categories.map((cat) => (
        <section key={cat} aria-label={BADGE_CATEGORY_LABELS[cat]} className="flex flex-col">
          <h2 className="text-[17px] font-semibold">{BADGE_CATEGORY_LABELS[cat]}</h2>
          <ul className="flex flex-col">
            {BADGES.filter((b) => b.category === cat).map((b) => (
              <BadgeRow key={b.id} badge={b} unlock={unlocked.get(b.id) ?? null} progress={progress.get(b.id)} />
            ))}
          </ul>
        </section>
      ))}
      <p className="pb-4 text-[12px] leading-snug text-cendre">
        Un badge se débloque à la date de la donnée qui remplit sa condition. Il ne se gagne qu’une fois, et suit tes données.
      </p>
    </>
  );
}

/** La frise : passages de niveau, badges, records et cycles, mois par mois. */
export function LevelHistoryScreen() {
  return (
    <Shell title="Historique" intro="Tes étapes FORGE LEVEL, de la plus récente à la plus ancienne.">
      {(level) => <History level={level} />}
    </Shell>
  );
}

function History({ level }: { level: LevelState }) {
  const entries = useMemo(() => timeline(level), [level]);
  const [shown, setShown] = useState(60);
  const months = new Map<string, TimelineEntry[]>();
  for (const e of entries.slice(0, shown)) months.set(e.date.slice(0, 7), [...(months.get(e.date.slice(0, 7)) ?? []), e]);
  if (!entries.length) return <p className="text-[15px] text-cendre">Rien pour l’instant : ta première séance terminée lance la frise.</p>;
  return (
    <>
      {[...months].map(([month, list]) => (
        <section key={month} aria-label={monthOf(`${month}-01`)} className="flex flex-col">
          <h2 className="text-[13px] text-cendre">{monthOf(`${month}-01`)}</h2>
          <ol className="flex flex-col">
            {list.map((e) => (
              <li
                key={`${e.kind}-${e.kind === 'niveau' ? e.level : e.kind === 'badge' ? e.badgeId : e.key}`}
                className="flex items-center gap-3 border-b border-graphite py-2.5 last:border-b-0"
              >
                <EntryIcon entry={e} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] leading-tight font-semibold">{entryTitle(e)}</span>
                  {entryDetail(e) && <span className="block text-[13px] leading-snug text-cendre">{entryDetail(e)}</span>}
                </span>
                <span className="shrink-0 text-[13px] text-cendre tabular-nums">{formatDayMonth(e.date)}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {entries.length > shown && (
        <Button variant="secondary" onClick={() => setShown((n) => n + 60)}>
          Voir plus
        </Button>
      )}
      <div className="pb-4" />
    </>
  );
}

function EntryIcon({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === 'badge') {
    const def = BADGES.find((b) => b.id === entry.badgeId);
    return def ? <BadgeMedal badge={def} unlocked size={36} /> : null;
  }
  if (entry.kind === 'niveau') return <UserEmblem level={entry.level} size={36} label={String(entry.level)} bare />;
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-graphite" aria-hidden="true">
      <Icon name={entry.kind === 'record' ? 'trophy' : 'check'} size={18} className={entry.kind === 'record' ? 'text-citron' : 'text-module'} />
    </span>
  );
}

const entryTitle = (e: TimelineEntry) =>
  e.kind === 'niveau'
    ? `Niveau ${e.level}`
    : e.kind === 'badge'
      ? `Badge : ${BADGES.find((b) => b.id === e.badgeId)?.name ?? e.badgeId}`
      : e.kind === 'record'
        ? e.label
        : 'Cycle terminé';
const entryDetail = (e: TimelineEntry) => (e.kind === 'badge' ? e.detail : e.kind === 'cycle' ? e.label.replace(/^Cycle terminé : /, '') : null);
