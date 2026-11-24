import { useState } from 'react';
import type { PulseDay, PulseReview, Scale5 } from '../../db/types';
import {
  FOLLOWED_LABELS,
  hasReviewAnswer,
  REVIEW_CHANGE_LABELS,
  REVIEW_CHANGES,
  REVIEW_FROM_HOUR,
  reviewDefaults,
  reviewSummary,
  USEFUL_LABELS,
} from '../../domain/pulse/decisions';
import { addDays } from '../../lib/dates';
import { formatDayShort } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { ScaleChips } from '../../ui/ScaleChips';
import { Sheet } from '../../ui/Sheet';
import { TextArea } from '../../ui/TextArea';
import { useToast } from '../../ui/Toast';
import { saveReview } from './pulseActions';
import type { PulseModel } from './usePulse';
import { haptic } from '../../services/haptics';

type Draft = Omit<PulseReview, 'at'>;

/**
 * Bilan du soir (cahier PULSE, section 12) : à partir de 17 h pour la journée, et le lendemain pour la veille.
 * Toutes les réponses sont facultatives ; le bilan se corrige à tout moment le jour même et le lendemain.
 */
export function ReviewSection({ model, hour }: { model: PulseModel; hour: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const yesterday = addDays(model.today, -1);
  const rowOf = (d: string) => model.journal.find((j) => j.date === d && !j.deletedAt) ?? null;
  const days = [
    hour >= REVIEW_FROM_HOUR ? { date: model.today, label: 'Bilan du jour', row: model.record ?? rowOf(model.today) } : null,
    { date: yesterday, label: 'Bilan de la veille', row: rowOf(yesterday) },
  ].filter((d): d is { date: string; label: string; row: PulseDay | null } => !!d && !!d.row);
  if (!days.length) return null;
  const current = days.find((d) => d.date === open) ?? null;
  return (
    <section aria-label="Bilans" className="flex flex-col gap-2">
      {days.map((d) => (
        <div key={d.date} className="flex flex-col gap-2 rounded-[18px] bg-anthracite p-4">
          <h2 className="text-[17px] font-semibold">{d.label}</h2>
          {d.row!.review ? (
            <>
              <p className="text-[15px] leading-snug">{reviewSummary(d.row!.review)}.</p>
              {d.row!.review.changes.length > 0 && (
                <p className="text-[13px] leading-snug text-cendre">
                  Modifications :{' '}
                  {d
                    .row!.review.changes.map((c) => REVIEW_CHANGE_LABELS.get(c) ?? c)
                    .join(', ')
                    .toLocaleLowerCase('fr-FR')}
                  .
                </p>
              )}
              {d.row!.review.note && <p className="text-[13px] leading-snug text-cendre">« {d.row!.review.note} »</p>}
              <button type="button" onClick={() => setOpen(d.date)} className="self-start py-1 text-[13px] text-cendre underline underline-offset-2">
                Corriger le bilan
              </button>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-snug text-cendre">
                {d.date === model.today
                  ? 'Cinq questions rapides sur ta journée, toutes facultatives.'
                  : `Le bilan de ${formatDayShort(d.date).toLocaleLowerCase('fr-FR')} n’est pas fait. Il reste possible aujourd’hui.`}
              </p>
              <Button size="small" className="self-start" onClick={() => setOpen(d.date)}>
                {d.date === model.today ? 'Faire le bilan du jour' : 'Faire le bilan d’hier'}
              </Button>
            </>
          )}
        </div>
      ))}
      <Sheet open={!!current} title={current?.label ?? 'Bilan'} onClose={() => setOpen(null)}>
        {current && <ReviewForm key={current.date} model={model} row={current.row!} onDone={() => setOpen(null)} />}
      </Sheet>
    </section>
  );
}

function ReviewForm({ model, row, onDone }: { model: PulseModel; row: PulseDay; onDone: () => void }) {
  const toast = useToast();
  const day = model.life.index.get(row.date);
  const finished = day?.workouts.map((w) => w.workout) ?? [];
  const [draft, setDraft] = useState<Draft>(() => reviewDefaults(row, finished, day?.mind ?? []));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  /** « Aucune » exclut les autres modifications, et inversement. */
  const toggleChange = (v: string) =>
    setDraft((d) => {
      if (v === 'aucune') return { ...d, changes: d.changes.includes('aucune') ? [] : ['aucune'] };
      const others = d.changes.filter((x) => x !== 'aucune');
      return { ...d, changes: others.includes(v) ? others.filter((x) => x !== v) : [...others, v] };
    });
  const toggleDone = (v: string) => setDraft((d) => ({ ...d, done: d.done.includes(v) ? d.done.filter((x) => x !== v) : [...d.done, v] }));
  const plan = row.plan ?? [];
  const hadSession = finished.length > 0;

  const save = async () => {
    setBusy(true);
    haptic('success');
    try {
      await saveReview(row.date, { ...draft, note: draft.note?.trim() || undefined });
      toast.show('Bilan enregistré');
      onDone();
    } catch {
      toast.show('Bilan non enregistré. Réessaie.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-1">
      <p className="text-[13px] text-cendre">{formatDayShort(row.date)} : chaque question est facultative, et un second appui efface une réponse.</p>
      <Chips
        strongLabel
        label="As-tu suivi le plan proposé ?"
        options={(['oui', 'partiel', 'non'] as const).map((v) => ({ value: v, label: FOLLOWED_LABELS[v] }))}
        selected={draft.followed ? [draft.followed] : []}
        onToggle={(v) => set('followed', draft.followed === v ? null : v)}
      />
      <Chips
        strongLabel
        label="Quelles modifications as-tu faites ?"
        options={REVIEW_CHANGES.map((c) => ({ value: c.key, label: c.label }))}
        selected={draft.changes}
        onToggle={toggleChange}
      />
      {hadSession ? (
        <ScaleChips
          label="Comment s’est passée ta séance ?"
          value={draft.sessionFeel}
          onChange={(v: Scale5) => set('sessionFeel', v)}
          onClear={() => set('sessionFeel', null)}
          low="Très difficile"
          high="Très bien"
        />
      ) : (
        <p className="text-[13px] text-cendre">Pas de séance terminée ce jour-là : la question sur la séance est passée.</p>
      )}
      <ScaleChips
        label="Comment as-tu vécu ta journée ?"
        value={draft.dayFeel}
        onChange={(v: Scale5) => set('dayFeel', v)}
        onClear={() => set('dayFeel', null)}
        low="Très mal"
        high="Très bien"
      />
      <Chips
        strongLabel
        label="Les recommandations t’ont-elles été utiles ?"
        options={(['oui', 'un-peu', 'non'] as const).map((v) => ({ value: v, label: USEFUL_LABELS[v] }))}
        selected={draft.useful ? [draft.useful] : []}
        onToggle={(v) => set('useful', draft.useful === v ? null : v)}
      />
      {plan.length > 0 && (
        <Chips
          strongLabel
          label="Ce que tu as fait du plan (prérempli quand FORGE le sait déjà)"
          options={plan.map((p) => ({ value: p.id, label: p.title }))}
          selected={draft.done}
          onToggle={toggleDone}
        />
      )}
      <TextArea label="Un mot sur ta journée" hint="facultatif" maxLength={500} value={draft.note ?? ''} onChange={(e) => set('note', e.target.value)} />
      <Button disabled={busy || !hasReviewAnswer(draft)} onClick={() => void save()}>
        Enregistrer le bilan
      </Button>
      <Button variant="quiet" onClick={onDone}>
        Plus tard
      </Button>
    </div>
  );
}
