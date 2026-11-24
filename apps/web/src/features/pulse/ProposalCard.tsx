import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { WorkoutAdjustment } from '../../db/types';
import { ADJUST_BOUNDS, adjustTargets, describeAdjustment, volumeOf, volumeText } from '../../domain/pulse/adjust';
import { canRevert, CHOICE_LABELS, decisionText } from '../../domain/pulse/decisions';
import { lightenImpact, REPORT_IMPACT } from '../../domain/pulse/plan';
import { toLocalTimeKey } from '../../lib/dates';
import { formatTime } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { Stepper } from '../../ui/Stepper';
import { useToast } from '../../ui/Toast';
import { startWorkout } from '../training/workoutActions';
import { decideProposal, revertChoice } from './pulseActions';
import type { PulseModel } from './usePulse';
import { haptic } from '../../services/haptics';

const hour = (iso: string) => formatTime(toLocalTimeKey(new Date(iso)));

/**
 * « À valider » (cahier PULSE, section 8) : situation actuelle, modification proposée, justification, impact attendu.
 * Accepter, refuser (garder le prévu), modifier, reporter, demander pourquoi ; puis revenir en arrière tant que c'est possible.
 */
export function ProposalCard({ model }: { model: PulseModel }) {
  const r = model.result;
  const p = r.proposal;
  const record = model.record;
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const choice = record?.choice ?? null;
  const templateId = p?.templateId ?? record?.plannedTemplateId ?? null;
  const template = model.life.data.templates.find((t) => t.id === templateId && !t.deletedAt) ?? null;
  const todays = model.life.data.workouts.filter((w) => !w.deletedAt && w.date === model.today && w.templateId === templateId);
  const running = todays.find((w) => !w.endedAt);
  const finished = todays.some((w) => w.endedAt);

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    haptic('light');
    try {
      await fn();
      toast.show(done);
    } catch {
      toast.show('Choix non enregistré. Réessaie.');
    } finally {
      setBusy(false);
    }
  };

  if (!p && !choice) {
    return (
      <section id="a-valider" aria-label="À valider" className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">À valider</h2>
        <p className="rounded-[16px] bg-anthracite p-3.5 text-[15px] leading-snug">Aucune modification à valider aujourd’hui.</p>
      </section>
    );
  }

  const decisions = record?.decisions ?? [];
  const revert = canRevert(record, model.life.data.workouts, model.today);

  return (
    <section id="a-valider" aria-label="À valider" className="flex flex-col gap-2">
      <h2 className="text-[17px] font-semibold">À valider</h2>
      <div className={`flex flex-col gap-3 rounded-[18px] border-l-2 border-citron bg-anthracite p-4 ${choice ? '' : 'motion-attention'}`}>
        {p && <ProposalDetails p={p} collapsed={!!choice} />}
        {!choice && p && (
          <div className="flex flex-col gap-2">
            <Button
              disabled={busy}
              onClick={() =>
                void run(
                  () => decideProposal(r, 'accepter', p.kind === 'lighten' ? 'alleger' : 'remplacer', p.adjustment),
                  p.kind === 'lighten' ? 'Version allégée acceptée' : 'Récupération active acceptée',
                )
              }
            >
              {p.kind === 'lighten' ? 'Accepter la version allégée' : 'Accepter la récupération active'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void run(() => decideProposal(r, 'refuser', 'garder'), 'Séance prévue gardée')}>
              Garder la séance prévue
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="small" disabled={busy || !template} onClick={() => setEditing(true)}>
                Modifier
              </Button>
              <Button variant="secondary" size="small" disabled={busy} onClick={() => void run(() => decideProposal(r, 'reporter', 'deplacer'), 'Séance reportée à demain')}>
                Reporter à demain
              </Button>
            </div>
            <p className="text-[12px] leading-snug text-cendre">{REPORT_IMPACT}</p>
          </div>
        )}

        {choice && (
          <div className="flex flex-col gap-2">
            <p className="text-[15px] leading-snug">
              Ton choix : <span className="font-semibold">{CHOICE_LABELS[choice]}</span>
              {record?.choiceAt ? `, à ${hour(record.choiceAt)}` : ''}
              {choice === 'alleger' && describeAdjustment(record?.adjustment) ? ` (${describeAdjustment(record?.adjustment)})` : ''}.
            </p>
            {(choice === 'alleger' || choice === 'garder') && template && !finished && (
              <Button
                disabled={busy}
                onClick={() => {
                  if (running) {
                    navigate(`/training/seance/${running.id}`, { viewTransition: true });
                    return;
                  }
                  setBusy(true);
                  void startWorkout(template).then((id) => navigate(`/training/seance/${id}`, { viewTransition: true }));
                }}
              >
                {running ? 'Reprendre la séance' : choice === 'alleger' ? 'Démarrer la séance allégée' : 'Démarrer la séance prévue'}
              </Button>
            )}
            {revert.ok ? (
              <Button
                variant="quiet"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const res = await revertChoice(model.today, model.today);
                    if (!res.ok) throw new Error(res.reason);
                  }, 'Choix annulé : la proposition est de nouveau à valider')
                }
              >
                Revenir sur ce choix
              </Button>
            ) : (
              revert.reason && <p className="text-[12px] text-cendre">{revert.reason}</p>
            )}
          </div>
        )}

        {decisions.length > 0 && (
          <details>
            <summary className="cursor-pointer py-1 text-[13px] text-cendre underline underline-offset-2">Historique des choix du jour</summary>
            <ol className="flex flex-col gap-0.5 pt-1 text-[12px] text-cendre">
              {decisions.map((d) => (
                <li key={d.at + d.action}>
                  {hour(d.at)} : {decisionText(d)}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
      {template && p && (
        <Sheet open={editing} title="Modifier la proposition" onClose={() => setEditing(false)}>
          {editing && (
            <ModifyForm
              initial={p.adjustment ?? { source: 'pulse', setsDelta: -1, rirDelta: 2 }}
              template={template}
              onCancel={() => setEditing(false)}
              onSave={(adj) =>
                void run(async () => {
                  await decideProposal(r, 'modifier', 'alleger', adj);
                  setEditing(false);
                }, 'Version modifiée enregistrée')
              }
            />
          )}
        </Sheet>
      )}
    </section>
  );
}

function ModifyForm({
  initial,
  template,
  onSave,
  onCancel,
}: {
  initial: WorkoutAdjustment;
  template: NonNullable<PulseModel['life']['data']['templates'][number]>;
  onSave: (a: WorkoutAdjustment) => void;
  onCancel: () => void;
}) {
  const [setsLess, setSetsLess] = useState(-initial.setsDelta);
  const [rirMore, setRirMore] = useState(initial.rirDelta);
  const adj: WorkoutAdjustment = { source: 'pulse', setsDelta: -setsLess, rirDelta: rirMore };
  const none = setsLess === 0 && rirMore === 0;
  return (
    <div className="flex flex-col gap-4 pb-1">
      <p className="text-[15px] leading-snug text-cendre">
        Ajuste la version allégée de {template.name}. Le programme ne change pas : seule la séance d’aujourd’hui est concernée.
      </p>
      <Stepper label="Séries en moins par exercice" value={setsLess} {...ADJUST_BOUNDS.setsLess} step={1} start={1} format={(v) => String(v)} onChange={setSetsLess} />
      <Stepper label="Répétitions en réserve en plus" value={rirMore} {...ADJUST_BOUNDS.rirMore} step={1} start={2} format={(v) => String(v)} onChange={setRirMore} />
      <div className="flex flex-col gap-1 rounded-[16px] bg-graphite p-3.5 text-[13px] leading-snug">
        <p className="font-semibold">{none ? 'Séance prévue, sans changement' : `Séance du jour : ${volumeText(volumeOf(adjustTargets(template.exercises, adj)))}`}</p>
        {!none && lightenImpact(template, adj).map((l) => <p key={l}>{l}</p>)}
      </div>
      <Button disabled={none} onClick={() => onSave(adj)}>
        Enregistrer cette version
      </Button>
      {none && <p className="-mt-2 text-[12px] text-cendre">Sans changement, choisis plutôt « Garder la séance prévue ».</p>}
      <Button variant="quiet" onClick={onCancel}>
        Annuler
      </Button>
    </div>
  );
}

function ProposalDetails({ p, collapsed }: { p: NonNullable<PulseModel['result']['proposal']>; collapsed: boolean }) {
  const body = (
    <>
      <dl className="flex flex-col gap-2 text-[15px] leading-snug">
        <div>
          <dt className="text-[12px] text-cendre">Situation actuelle</dt>
          <dd>{p.situation}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-cendre">Modification proposée</dt>
          <dd className="font-semibold">{p.proposed}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-cendre">Justification</dt>
          <dd className="text-[13px]">{p.reason}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-cendre">Impact attendu</dt>
          <dd>
            <ul className="flex list-disc flex-col gap-0.5 pl-4 text-[13px]">
              {p.impact.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <details>
        <summary className="cursor-pointer py-1 text-[13px] text-cendre underline underline-offset-2">Pourquoi me proposes-tu cela ?</summary>
        <ul className="flex list-disc flex-col gap-0.5 pt-1 pl-4 text-[12px] leading-snug text-cendre">
          {p.basis.map((b) => (
            <li key={b}>{b}</li>
          ))}
          {p.source && <li>Source : {p.source}</li>}
        </ul>
      </details>
    </>
  );
  return collapsed ? (
    <details>
      <summary className="cursor-pointer py-1 text-[13px] text-cendre underline underline-offset-2">Voir la proposition</summary>
      <div className="flex flex-col gap-3 pt-2">{body}</div>
    </details>
  ) : (
    body
  );
}
