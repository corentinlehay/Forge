import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { repos } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { WeekNote } from '../../db/types';
import { reviewWeeks, weekReview, weekStats, type ReviewLine, type WeekStats } from '../../domain/review';
import { weekStart } from '../../domain/training';
import { addDays, isDateKey } from '../../lib/dates';
import { formatDayMonth, formatHours, formatNumber, formatSignedKg } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Card } from '../../ui/Screen';
import { TextArea } from '../../ui/TextArea';
import { useToast } from '../../ui/Toast';
import { WeekNav } from './reviewShared';
import type { LifeModel } from './useLifeData';

/** « du 16 au 22 nov. », « du 30 nov. au 6 déc. » */
export function weekRange(start: string): string {
  const end = addDays(start, 6);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `du ${sameMonth ? String(Number(start.slice(8))).replace(/^1$/, '1er') : formatDayMonth(start)} au ${formatDayMonth(end)}`;
}

export function weekTitle(start: string, today: string): string {
  const current = weekStart(today);
  if (start === current) return 'Cette semaine';
  if (start === addDays(current, -7)) return 'La semaine dernière';
  return `Semaine du ${formatDayMonth(start)}`;
}

export function WeekView({ model }: { model: LifeModel }) {
  const [params, setParams] = useSearchParams();
  const current = weekStart(model.today);
  const asked = params.get('semaine');
  const start = asked && isDateKey(asked) && weekStart(asked) <= current ? weekStart(asked) : current;
  const review = useMemo(() => weekReview(model.index, model.data, start, model.today, model.badges), [model, start]);
  const go = (s: string) => {
    const next = new URLSearchParams(params);
    if (s === current) next.delete('semaine');
    else next.set('semaine', s);
    setParams(next, { replace: true });
  };
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [start]);

  const s = review.stats;
  const intention = review.isCurrent ? model.notes.get(addDays(start, -7))?.intention : undefined;

  return (
    <>
      <WeekNav
        label={weekTitle(start, model.today)}
        sub={`${weekRange(start).replace(/^d/, 'D')}${review.isCurrent ? `, ${s.elapsed} jour${s.elapsed > 1 ? 's' : ''} sur 7` : ''}`}
        onPrev={() => go(addDays(start, -7))}
        onNext={start < current ? () => go(addDays(start, 7)) : null}
        prevLabel="Semaine précédente"
        nextLabel="Semaine suivante"
      />

      {intention && (
        <section aria-label="Ton intention" className="border-l-2 border-module pl-3">
          <h2 className="text-[13px] text-cendre">Ton intention pour cette semaine</h2>
          <p className="text-[15px] leading-snug">{intention}</p>
        </section>
      )}

      {s.activeDays === 0 ? (
        <p className="rounded-[18px] bg-anthracite p-4 text-[15px] leading-snug text-cendre">
          Rien de noté pour cette semaine. Le bilan se remplit tout seul quand tu notes une séance, un repas, une pesée, un check-in ou une pratique.
        </p>
      ) : (
        <>
          <LineList
            title="Ce qui a avancé"
            lines={review.highlights}
            icon="check"
            empty="Semaine plus calme dans FORGE : rien de marquant pour l’instant, et c’est très bien aussi."
          />
          {review.focus.length > 0 && <LineList title="Pistes pour la suite" lines={review.focus} icon="info" />}
          <Figures stats={s} previous={review.previous} />
        </>
      )}

      {start <= current && <NoteCard key={`${start}-${model.notes.get(start)?.updatedAt ?? ''}`} start={start} note={model.notes.get(start)} />}
      <History model={model} shown={start} onOpen={go} />
    </>
  );
}

function LineList({ title, lines, icon, empty }: { title: string; lines: ReviewLine[]; icon: 'check' | 'info'; empty?: string }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {lines.length === 0 && empty ? (
        <p className="text-[15px] leading-snug text-cendre">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((l) => {
            const body = (
              <>
                <Icon name={icon} size={18} className={`mt-0.5 shrink-0 ${icon === 'check' ? 'text-citron' : 'text-cendre'}`} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[15px] leading-snug">{l.text}</span>
                  {l.piste && <span className="text-[13px] leading-snug text-cendre">{l.piste}</span>}
                  {l.source && <span className="text-[12px] text-cendre">Source : {l.source}</span>}
                </span>
                {l.to && <Icon name="chevron" size={16} className="mt-1 shrink-0 text-cendre" />}
              </>
            );
            return (
              <li key={l.text}>
                {l.to ? (
                  <Link to={l.to} viewTransition className="flex items-start gap-2.5 rounded-[16px] bg-anthracite p-3.5 active:opacity-80">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-[16px] bg-anthracite p-3.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const n0 = (v: number) => formatNumber(v, 0);
const n1 = (v: number) => formatNumber(v, 1);

function Figures({ stats: s, previous: p }: { stats: WeekStats; previous: WeekStats }) {
  const tiles: { label: string; value: string; sub: string }[] = [];
  tiles.push({ label: 'Jours actifs', value: `${s.activeDays}/${s.elapsed}`, sub: 'avec au moins une donnée' });
  if (s.sessions > 0 || s.planned) tiles.push({ label: 'Séances', value: String(s.sessions), sub: s.planned ? `${s.planned} prévues dans la semaine` : `${s.setCount} séries` });
  if (s.volumeKg > 0) tiles.push({ label: 'Volume', value: `${n0(s.volumeKg)} kg`, sub: p.volumeKg > 0 ? `sem. d’avant : ${n0(p.volumeKg)} kg` : `${s.setCount} séries` });
  if (s.avgSleep !== null)
    tiles.push({
      label: 'Sommeil moyen',
      value: formatHours(s.avgSleep),
      sub: `${s.nights} nuit${s.nights > 1 ? 's' : ''}${p.avgSleep !== null ? `, avant : ${formatHours(p.avgSleep)}` : ''}`,
    });
  if (s.avgRecovery !== null) tiles.push({ label: 'Récupération', value: `${n0(s.avgRecovery)}/100`, sub: 'estimée, en moyenne' });
  if (s.mood !== null || s.stress !== null)
    tiles.push({ label: 'Humeur', value: s.mood !== null ? `${n1(s.mood)}/5` : '—', sub: s.stress !== null ? `stress ${n1(s.stress)}/5` : `${s.moodDays} jours notés` });
  if (s.avgWeightKg !== null)
    tiles.push({
      label: 'Poids moyen',
      value: `${n1(s.avgWeightKg)} kg`,
      sub: p.avgWeightKg !== null ? `${formatSignedKg(Math.round((s.avgWeightKg - p.avgWeightKg) * 10) / 10)} sur la semaine` : `${s.weighIns} pesée${s.weighIns > 1 ? 's' : ''}`,
    });
  if (s.avgKcal !== null) tiles.push({ label: 'Calories', value: `${n0(s.avgKcal)}`, sub: `kcal par jour, ${s.foodDays} jour${s.foodDays > 1 ? 's' : ''} notés` });
  if (s.avgProteinG !== null) tiles.push({ label: 'Protéines', value: `${n0(s.avgProteinG)} g`, sub: s.targets ? `par jour, pour ${n0(s.targets.proteinG)} g visés` : 'par jour' });
  if (s.mindSessions > 0) tiles.push({ label: 'Mind', value: `${s.mindMinutes} min`, sub: `${s.mindSessions} pratique${s.mindSessions > 1 ? 's' : ''}` });
  if (s.costEur !== null) tiles.push({ label: 'Coût des repas', value: `${n0(s.costEur)} €`, sub: 'repas aux prix connus' });

  return (
    <section aria-label="Chiffres de la semaine" className="flex flex-col gap-2">
      <h2 className="text-[17px] font-semibold">Chiffres de la semaine</h2>
      <dl className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="flex min-w-0 flex-col gap-0.5 rounded-[18px] bg-anthracite p-3.5">
            <dt className="text-[12px] text-cendre">{t.label}</dt>
            <dd className="font-metal text-[26px] leading-tight">{t.value}</dd>
            <dd className="text-[12px] leading-snug text-cendre">{t.sub}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type NoteFields = Pick<WeekNote, 'wentWell' | 'toAdjust' | 'intention'>;
const FIELDS: { key: keyof NoteFields; label: string; placeholder: string }[] = [
  { key: 'wentWell', label: 'Ce qui a bien marché', placeholder: 'Une séance, une habitude, un moment' },
  { key: 'toAdjust', label: 'Ce que tu veux ajuster', placeholder: 'Sans te juger : ce qui t’a freiné' },
  { key: 'intention', label: 'Ton intention pour la semaine suivante', placeholder: 'Une seule chose, concrète' },
];

function NoteCard({ start, note }: { start: string; note: WeekNote | undefined }) {
  const toast = useToast();
  const initial = { wentWell: note?.wentWell ?? '', toAdjust: note?.toAdjust ?? '', intention: note?.intention ?? '' };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const dirty = FIELDS.some((f) => form[f.key].trim() !== (initial[f.key] ?? '').trim());

  async function save() {
    setError(null);
    try {
      await repos.weekNotes.save(start, { wentWell: form.wentWell.trim(), toAdjust: form.toAdjust.trim(), intention: form.intention.trim() });
      toast.show('Note de la semaine enregistrée');
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'Enregistrement impossible. Réessaie.');
    }
  }

  return (
    <Card label="Ton regard sur la semaine">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[17px] font-semibold">Ton regard sur la semaine</h2>
        <p className="text-[13px] leading-snug text-cendre">Facultatif. Gardé sur ton iPhone, avec ta sauvegarde.</p>
      </div>
      {FIELDS.map((f) => (
        <TextArea
          key={f.key}
          label={f.label}
          placeholder={f.placeholder}
          rows={2}
          maxLength={600}
          value={form[f.key]}
          onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
        />
      ))}
      {error && (
        <p role="alert" className="text-[13px] text-braise">
          {error}
        </p>
      )}
      <Button size="small" className="self-start" disabled={!dirty} onClick={() => void save()}>
        Enregistrer
      </Button>
    </Card>
  );
}

function History({ model, shown, onOpen }: { model: LifeModel; shown: string; onOpen: (start: string) => void }) {
  const [limit, setLimit] = useState(8);
  const weeks = useMemo(() => reviewWeeks(model.index, model.today).filter((w) => w !== shown), [model, shown]);
  const rows = useMemo(() => weeks.slice(0, limit).map((w) => ({ start: w, stats: weekStats(model.index, model.data, w, model.today) })), [weeks, limit, model]);
  if (weeks.length === 0) return null;
  return (
    <section aria-label="Historique des bilans" className="flex flex-col">
      <h2 className="mb-1 text-[17px] font-semibold">Historique</h2>
      <ul>
        {rows.map(({ start, stats }) => {
          const parts = [
            stats.sessions > 0 && `${stats.sessions} séance${stats.sessions > 1 ? 's' : ''}`,
            stats.avgSleep !== null && `sommeil ${formatHours(stats.avgSleep)}`,
            `${stats.activeDays} jour${stats.activeDays > 1 ? 's' : ''} actif${stats.activeDays > 1 ? 's' : ''}`,
          ].filter(Boolean);
          return (
            <li key={start} className="border-b border-anthracite last:border-b-0">
              <button type="button" onClick={() => onOpen(start)} className="flex min-h-11 w-full items-center justify-between gap-3 py-2.5 text-left">
                <span className="min-w-0">
                  <span className="block text-[15px]">{weekTitle(start, model.today)}</span>
                  <span className="block truncate text-[12px] text-cendre">{parts.join(', ')}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-cendre">
                  {model.notes.has(start) && (
                    <>
                      <Icon name="note" size={16} />
                      <span className="sr-only">Note écrite</span>
                    </>
                  )}
                  <Icon name="chevron" size={16} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {weeks.length > limit && (
        <Button variant="quiet" className="self-start" onClick={() => setLimit(limit + 8)}>
          Semaines plus anciennes
        </Button>
      )}
    </section>
  );
}
