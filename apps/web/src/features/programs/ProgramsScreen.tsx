import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { repos, useAllTemplates, usePrograms, useToday } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { Program, ProgramStatus, WorkoutTemplate } from '../../db/types';
import {
  actionLabel,
  canDelete,
  cycleWeek,
  groupByStatus,
  OBJECTIVE_LABELS,
  programStatus,
  sessionsOf,
  sessionsPerWeek,
  STATUS_GROUPS,
  STATUS_LABELS,
  statusActions,
} from '../../domain/programs/status';
import { capitalize, countLabel, formatDayMonthLong } from '../../lib/format';
import { haptic } from '../../services/haptics';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { useToast } from '../../ui/Toast';

const DAY_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      {label}
    </Link>
  );
}

function StatusBadge({ status }: { status: ProgramStatus }) {
  return (
    <span className={`shrink-0 self-start rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${status === 'actif' ? 'bg-citron text-noir' : 'bg-graphite text-cendre'}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Objectif et rythme d'un programme, en une ligne. */
function summary(p: Program, sessions: readonly WorkoutTemplate[]): string {
  const parts: string[] = [];
  if (p.objective) parts.push(OBJECTIVE_LABELS[p.objective]);
  const perWeek = sessionsPerWeek(sessions);
  parts.push(sessions.length ? `${countLabel(perWeek, 'séance')} par semaine` : 'aucune séance');
  return capitalize(parts.join(', '));
}

/** Où en est le cycle, en une ligne ; rien si la date de début est inconnue. */
function cycleLine(p: Program, today: string): string | null {
  const status = programStatus(p);
  if (status === 'termine') return p.endDate ? `Terminé le ${formatDayMonthLong(p.endDate)}` : 'Terminé';
  if (status !== 'actif') return p.durationWeeks ? `Cycle de ${countLabel(p.durationWeeks, 'semaine')}` : null;
  const c = cycleWeek(p, today);
  if (!c) return p.durationWeeks ? `Cycle de ${countLabel(p.durationWeeks, 'semaine')}` : null;
  if (c.kind === 'a-venir') return `Commence le ${formatDayMonthLong(c.startDate)}`;
  if (c.kind === 'fini') return `Les ${c.total} semaines du cycle sont passées`;
  return c.total ? `Semaine ${c.week} sur ${c.total}` : `Semaine ${c.week}, sans durée fixée`;
}

/** Tous les programmes, groupés par statut. Un seul est actif ; les autres restent consultables. */
export function ProgramsScreen() {
  const programs = usePrograms();
  const templates = useAllTemplates();
  const today = useToday();
  const [showArchived, setShowArchived] = useState(false);

  if (!programs || !templates)
    return (
      <Screen withTabBar={false}>
        <BackLink to="/training" label="Training" />
      </Screen>
    );

  const groups = groupByStatus(programs);
  const archived = groups.find((g) => g.status === 'archive');

  return (
    <Screen withTabBar={false}>
      <BackLink to="/training" label="Training" />
      <h1 className="font-metal text-[40px]">Programmes</h1>
      <p className="text-[15px] leading-snug text-cendre">
        Un seul programme est actif : ses séances sont celles du jour. Les autres restent ici, en brouillon, en pause ou terminés.
      </p>

      {groups.length === 0 && <p className="text-[17px] leading-snug">Aucun programme pour l’instant. Crée le tien, ou laisse FORGE t’en proposer un avec le questionnaire.</p>}

      {groups
        .filter((g) => g.status !== 'archive')
        .map((g) => (
          <section key={g.status} aria-label={STATUS_GROUPS[g.status]} className="flex flex-col gap-2">
            <h2 className="text-[13px] text-cendre">{STATUS_GROUPS[g.status]}</h2>
            <ul className="flex flex-col gap-2">
              {g.programs.map((p) => (
                <li key={p.id}>
                  <ProgramCard program={p} sessions={sessionsOf(p.id, templates)} today={today} />
                </li>
              ))}
            </ul>
          </section>
        ))}

      {archived && (
        <section aria-label="Archivés" className="flex flex-col gap-2">
          <Button variant="quiet" className="-ml-2 self-start" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}>
            <Icon name={showArchived ? 'up' : 'down'} size={16} />
            {showArchived ? 'Masquer les archivés' : `Archivés (${archived.programs.length})`}
          </Button>
          {showArchived && (
            <ul className="flex flex-col gap-2">
              {archived.programs.map((p) => (
                <li key={p.id}>
                  <ProgramCard program={p} sessions={sessionsOf(p.id, templates)} today={today} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="flex flex-col gap-2">
        <Link to="/training/programmes/nouveau" viewTransition className="flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-graphite text-[17px] font-semibold">
          <Icon name="plus" size={18} />
          Nouveau programme
        </Link>
        <Link to="/reglages/plan" viewTransition className="flex min-h-11 items-center justify-center text-[15px] text-cendre">
          Ou génère-le avec le questionnaire FORGE
        </Link>
      </div>
    </Screen>
  );
}

function ProgramCard({ program, sessions, today }: { program: Program; sessions: WorkoutTemplate[]; today: string }) {
  const status = programStatus(program);
  const cycle = cycleLine(program, today);
  return (
    <Link
      to={`/training/programmes/${program.id}`}
      viewTransition
      className={`flex min-h-[64px] items-center justify-between gap-3 rounded-[18px] px-4 py-3 active:scale-[0.99] ${status === 'actif' ? 'bg-anthracite ring-1 ring-citron/40' : 'bg-anthracite'}`}
    >
      <span className="min-w-0">
        <span className="block truncate text-[17px] font-semibold">{program.name}</span>
        <span className="block text-[13px] text-cendre">{summary(program, sessions)}</span>
        {cycle && <span className="block text-[13px] text-cendre">{cycle}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-cendre">
        {status === 'actif' && <StatusBadge status={status} />}
        <Icon name="chevron" size={16} />
      </span>
    </Link>
  );
}

/** Barre du cycle : une case par semaine, la semaine en cours soulignée. */
function CycleBar({ week, total }: { week: number; total: number }) {
  if (total > 16) {
    return (
      <div className="h-2 w-full overflow-hidden rounded-full bg-graphite" aria-hidden="true">
        <div className="h-full rounded-full bg-citron" style={{ width: `${Math.min(1, week / total) * 100}%` }} />
      </div>
    );
  }
  return (
    <div className="flex gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-2 flex-1 rounded-full ${i + 1 < week ? 'bg-citron' : i + 1 === week ? 'bg-citron ring-2 ring-citron/35' : 'bg-graphite'}`} />
      ))}
    </div>
  );
}

/** Fiche d'un programme : cycle, séances, statut et actions. */
export function ProgramScreen() {
  const { id = '' } = useParams();
  const programs = usePrograms();
  const templates = useAllTemplates();
  const today = useToday();
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!programs || !templates)
    return (
      <Screen withTabBar={false}>
        <BackLink to="/training/programmes" label="Programmes" />
      </Screen>
    );
  const program = programs.find((p) => p.id === id);
  if (!program)
    return (
      <Screen withTabBar={false}>
        <BackLink to="/training/programmes" label="Programmes" />
        <p className="text-[17px]">Ce programme n’existe plus.</p>
      </Screen>
    );

  const status = programStatus(program);
  const sessions = sessionsOf(program.id, templates);
  const exerciseCount = sessions.reduce((sum, s) => sum + s.exercises.length, 0);
  const current = programs.find((p) => p.id !== program.id && programStatus(p) === 'actif');
  const cycle = status === 'actif' ? cycleWeek(program, today) : null;
  const here = `/training/programmes/${program.id}`;
  const back = `?retour=${encodeURIComponent(here)}`;

  const run = async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'L’opération a échoué. Réessaie.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (to: ProgramStatus) =>
    run(async () => {
      await repos.programs.setStatus(program.id, to);
      haptic(to === 'actif' ? 'success' : 'light');
      toast.show(
        to === 'actif'
          ? `« ${program.name} » est ton programme actif`
          : to === 'pause'
            ? status === 'archive'
              ? 'Programme sorti des archives'
              : 'Programme en pause'
            : to === 'termine'
              ? 'Cycle terminé'
              : 'Programme archivé',
      );
    });

  const actions = statusActions(status);
  const emptyBlocksActivation = sessions.length === 0;

  return (
    <Screen withTabBar={false}>
      <BackLink to="/training/programmes" label="Programmes" />
      <div className="flex flex-col gap-2">
        <StatusBadge status={status} />
        <h1 className="font-metal text-[40px] leading-[0.95]">{program.name}</h1>
        <p className="text-[15px] text-cendre">
          {program.objective ? `Objectif : ${OBJECTIVE_LABELS[program.objective].toLocaleLowerCase('fr-FR')}` : 'Objectif non précisé'}
          {program.secondaryObjective ? `, puis ${OBJECTIVE_LABELS[program.secondaryObjective].toLocaleLowerCase('fr-FR')}` : ''}
        </p>
      </div>

      {program.note && <p className="text-[15px] leading-relaxed whitespace-pre-line">{program.note}</p>}

      {status === 'actif' && (
        <section aria-label="Cycle" className="flex flex-col gap-3 rounded-[18px] bg-anthracite p-4">
          {cycle?.kind === 'en-cours' && (
            <>
              <p className="flex items-baseline justify-between gap-3">
                <span className="font-metal text-[28px]">{cycle.total ? `Semaine ${cycle.week} sur ${cycle.total}` : `Semaine ${cycle.week}`}</span>
                {program.startDate && <span className="text-[13px] text-cendre">depuis le {formatDayMonthLong(program.startDate)}</span>}
              </p>
              {cycle.total ? <CycleBar week={cycle.week} total={cycle.total} /> : <p className="text-[13px] text-cendre">Sans durée fixée.</p>}
            </>
          )}
          {cycle?.kind === 'a-venir' && <p className="text-[17px]">Le cycle commence le {formatDayMonthLong(cycle.startDate)}.</p>}
          {cycle?.kind === 'fini' && (
            <>
              <p className="text-[17px] leading-snug">Les {cycle.total} semaines du cycle sont passées.</p>
              <p className="text-[13px] text-cendre">Tu peux le terminer, ou continuer tant qu’il te convient.</p>
            </>
          )}
          {!cycle && (
            <>
              <p className="text-[15px] leading-snug text-cendre">Date de début du cycle inconnue : indique-la pour suivre tes semaines.</p>
              <Link to={`${here}/modifier`} viewTransition className="self-start text-[15px] font-semibold text-citron">
                Indiquer la date de début
              </Link>
            </>
          )}
        </section>
      )}
      {status !== 'actif' && (cycleLine(program, today) || program.startDate) && (
        <p className="text-[15px] text-cendre">
          {[cycleLine(program, today), status !== 'termine' && program.startDate ? `démarré le ${formatDayMonthLong(program.startDate)}` : null].filter(Boolean).join(', ')}
        </p>
      )}

      <section aria-label="Séances" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-semibold">Séances</h2>
          <p className="text-[13px] text-cendre">
            {countLabel(sessionsPerWeek(sessions), 'séance')} par semaine, {countLabel(exerciseCount, 'exercice')}
          </p>
        </div>
        <ol className="grid grid-cols-7 gap-1.5" aria-label="Semaine type">
          {DAY_LETTERS.map((letter, i) => {
            const day = sessions.filter((s) => s.weekdays.includes(i + 1));
            return (
              <li
                key={i}
                aria-label={`${DAY_SHORT[i]} ${day.length ? day.map((s) => s.name).join(', ') : 'repos'}`}
                className={`flex h-11 flex-col items-center justify-center rounded-[12px] text-[13px] font-semibold ${day.length ? 'bg-citron-voile text-citron' : 'bg-anthracite text-cendre'}`}
              >
                {letter}
              </li>
            );
          })}
        </ol>
        {sessions.length === 0 && <p className="text-[15px] text-cendre">Aucune séance : ajoute la première, avec ses jours et ses exercices.</p>}
        <ul className="flex flex-col gap-2">
          {sessions.map((t) => (
            <li key={t.id}>
              <Link
                to={`/training/programme/${t.id}${back}`}
                viewTransition
                className="flex min-h-[60px] items-center justify-between gap-3 rounded-[18px] bg-anthracite px-4 py-3 active:scale-[0.99]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[17px] font-semibold">{t.name}</span>
                  <span className="block text-[13px] text-cendre">
                    {t.weekdays.length ? t.weekdays.map((d) => DAY_SHORT[d - 1]).join(', ') : 'Sans jour fixe'}, {countLabel(t.exercises.length, 'exercice')}
                  </span>
                </span>
                <Icon name="edit" size={18} className="shrink-0 text-cendre" />
              </Link>
            </li>
          ))}
        </ul>
        <Link
          to={`/training/programme/nouvelle?programme=${program.id}&retour=${encodeURIComponent(here)}`}
          viewTransition
          className="flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-graphite text-[17px] font-semibold"
        >
          <Icon name="plus" size={18} />
          Ajouter une séance
        </Link>
      </section>

      <section aria-label="Statut du programme" className="flex flex-col gap-2">
        {actions.map((to, i) => (
          <div key={to} className="flex flex-col gap-1">
            <Button variant={i === 0 ? 'primary' : 'secondary'} disabled={busy || (to === 'actif' && emptyBlocksActivation)} onClick={() => void changeStatus(to)}>
              {actionLabel(status, to)}
            </Button>
            {to === 'actif' && emptyBlocksActivation && <p className="text-[13px] text-cendre">Ajoute au moins une séance avant de l’activer.</p>}
            {to === 'actif' && !emptyBlocksActivation && current && <p className="text-[13px] text-cendre">« {current.name} » passera en pause, sans rien perdre.</p>}
          </div>
        ))}
        <Link to={`${here}/modifier`} viewTransition className="flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-graphite text-[17px] font-semibold">
          <Icon name="edit" size={18} />
          Modifier nom, objectif et cycle
        </Link>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const copy = await repos.programs.duplicate(program.id);
              toast.show('Copie créée en brouillon');
              navigate(`/training/programmes/${copy.id}`, { viewTransition: true });
            })
          }
        >
          <Icon name="copy" size={18} />
          Dupliquer en brouillon
        </Button>
        {error && (
          <p className="text-[15px] text-braise" role="alert">
            {error}
          </p>
        )}
        {canDelete(status) &&
          (confirmDelete ? (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await repos.programs.removeWithTemplates(program.id);
                  toast.show('Programme supprimé');
                  navigate('/training/programmes', { replace: true });
                })
              }
            >
              Confirmer : supprimer le programme et ses séances
            </Button>
          ) : (
            <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirmDelete(true)}>
              Supprimer ce programme
            </Button>
          ))}
        {status === 'actif' && <p className="text-center text-[13px] text-cendre">Pour supprimer le programme actif, mets-le d’abord en pause.</p>}
        <p className="text-center text-[13px] text-cendre">Les séances déjà faites restent toujours dans ton historique.</p>
      </section>
    </Screen>
  );
}
