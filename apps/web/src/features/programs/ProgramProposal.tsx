import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { libraryExercise } from '../../data/exerciseLibrary';
import { TRAITS } from '../../data/exerciseTraits';
import { MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup } from '../../data/muscles';
import { saveGeneratedProgram } from '../../db/generatedProgram';
import { repos, useEffortScale } from '../../db/hooks';
import { getDb } from '../../db/schema';
import type { Program } from '../../db/types';
import { effortText } from '../../domain/effort';
import { buildCatalog, searchCatalog, type CatalogItem } from '../../domain/exerciseCatalog';
import { VOLUME_REFERENCE } from '../../domain/muscleVolume';
import { exerciseAccess, reviewSessions, swapOptions, trainingPlan, type PlannedExercise, type PlannedSession, type PlannedVolume, type TrainingAnswers } from '../../domain/plan';
import { defaultProgramName, GENERATOR_KEY, generatedNote, toTrainingAnswers, type GeneratorAnswers, type GeneratorRecord } from '../../domain/programs/generator';
import {
  addExercise,
  changedIds,
  compareSessions,
  MAX_EDIT_SETS,
  MIN_SETS,
  moveExercise,
  removeExercise,
  replaceExercise,
  sameSessions,
  setSets,
} from '../../domain/programs/proposal';
import { OBJECTIVE_LABELS } from '../../domain/programs/status';
import { formatRest } from '../../domain/workoutFlow';
import { lowerFirst } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Sheet } from '../../ui/Sheet';
import { Stepper } from '../../ui/Stepper';
import { useToast } from '../../ui/Toast';
import { DAY_NAMES } from '../plan/PlanQuestionnaire';
import { describeItem } from '../training/ExercisePicker';
import { ExerciseThumb } from '../training/ExerciseVisual';

/** Exercices que FORGE sait placer : ceux de la bibliothèque dont il connaît le mouvement et le matériel. */
export const PLACEABLE = buildCatalog([]).filter((i) => i.library && TRAITS[i.library.id]);
const ITEMS = new Map(PLACEABLE.map((i) => [i.library!.id, i]));
export const libraryName = (id: string) => libraryExercise(id)?.name ?? id;
/** Une autre proposition différente au plus après autant d'essais (la bibliothèque a ses limites). */
const MAX_TRIES = 6;
const MAX_COMPARE_LINES = 8;

type Editing = { session: number; index: number } | { session: number; adding: true } | null;

/**
 * La proposition : tout se modifie avant d'enregistrer (remplacer, ajouter, retirer, déplacer, séries),
 * durées, volume et avertissements suivent. « Autre proposition » en tire une nouvelle, comparée à la précédente.
 */
export function Proposal({ answers, active, onEdit }: { answers: GeneratorAnswers; active: Program | null; onEdit: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const scale = useEffortScale();
  const training = useMemo(() => toTrainingAnswers(answers), [answers]);
  const [variation, setVariation] = useState(0);
  const base = useMemo(() => trainingPlan({ ...training, variation }), [training, variation]);
  const [sessions, setSessionsState] = useState<PlannedSession[]>(base.sessions);
  const [previous, setPrevious] = useState<{ variation: number; sessions: PlannedSession[]; lines: string[] } | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState(() => defaultProgramName(answers.objective!, base.sessions.length));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEdit, setConfirmEdit] = useState(false);

  const review = useMemo(() => reviewSessions(sessions, training), [sessions, training]);
  const changes = useMemo(() => compareSessions(base.sessions, sessions), [base, sessions]);
  const adjusted = changes.length > 0;
  const warnings = [...base.fixedWarnings, ...review.warnings];
  const setSessions = (next: PlannedSession[]) => {
    setError(null);
    setSessionsState(next);
  };

  const regenerate = () => {
    for (let v = variation + 1; v <= variation + MAX_TRIES; v++) {
      const next = trainingPlan({ ...training, variation: v });
      if (sameSessions(next.sessions, sessions)) continue;
      setPrevious({ variation, sessions, lines: compareSessions(sessions, next.sessions) });
      setVariation(v);
      setSessionsState(next.sessions);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    toast.show('Pas d’autre proposition avec ces réponses');
  };
  const restorePrevious = () => {
    if (!previous) return;
    setVariation(previous.variation);
    setSessionsState(previous.sessions);
    setPrevious(null);
  };

  const save = async (activate: boolean) => {
    if (!name.trim()) return setError('Donne un nom au programme.');
    setBusy(true);
    setError(null);
    try {
      const program = await saveGeneratedProgram(
        getDb(),
        { sessions: review.sessions },
        {
          name: name.trim(),
          objective: answers.objective,
          secondaryObjective: answers.secondaryObjective,
          note: generatedNote({ sessions: review.sessions, splitLabel: base.splitLabel }, answers, adjusted),
          activate,
        },
      );
      await repos.meta.set(GENERATOR_KEY, { answers, savedAt: new Date().toISOString() } satisfies GeneratorRecord);
      toast.show(activate ? 'Programme activé' : 'Brouillon enregistré');
      navigate(`/training/programmes/${program.id}`, { replace: true, viewTransition: true });
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : 'Enregistrement impossible. Réessaie.');
    }
  };

  const minutes = review.sessions.map((s) => s.estimatedMinutes);
  const span = Math.min(...minutes) === Math.max(...minutes) ? `${minutes[0]} min` : `${Math.min(...minutes)} à ${Math.max(...minutes)} min`;
  const n = sessions.length;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-metal text-[40px] leading-none">Ta proposition</h1>
        <p className="text-[15px] leading-snug text-cendre">
          {OBJECTIVE_LABELS[answers.objective!]}
          {answers.secondaryObjective ? `, puis ${OBJECTIVE_LABELS[answers.secondaryObjective].toLocaleLowerCase('fr-FR')}` : ''}. {n} séance{n > 1 ? 's' : ''} par semaine en{' '}
          {base.splitLabel}, environ {span} chacune. Touche un exercice pour le changer.
        </p>
      </div>

      {previous && (
        <section aria-label="Par rapport à la proposition d’avant" className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-[18px] ring-1 ring-citron/40">
          <h2 className="text-[17px] font-semibold">Par rapport à la proposition d’avant</h2>
          <ul className="flex flex-col gap-1.5">
            {previous.lines.slice(0, MAX_COMPARE_LINES).map((l) => (
              <li key={l} className="text-[13px] leading-snug">
                {l}
              </li>
            ))}
          </ul>
          {previous.lines.length > MAX_COMPARE_LINES && <p className="text-[13px] text-cendre">Et {previous.lines.length - MAX_COMPARE_LINES} autres séances modifiées.</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="small" variant="secondary" onClick={restorePrevious}>
              Revenir à celle d’avant
            </Button>
            <Button size="small" variant="quiet" onClick={() => setPrevious(null)}>
              Garder celle-ci
            </Button>
          </div>
        </section>
      )}

      <Field label="Nom du programme" value={name} onChange={(e) => (setError(null), setName(e.target.value))} maxLength={60} />

      <section aria-label="Séances" className="flex flex-col gap-2">
        {review.sessions.map((s, si) => {
          const touched = changedIds(base.sessions[si], s);
          return (
            <article key={`${si}-${s.name}`} aria-label={s.name} className="flex flex-col gap-1 rounded-[22px] bg-anthracite px-[18px] pt-[18px] pb-2">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="min-w-0 text-[17px] font-semibold">
                  <span className="text-cendre capitalize">{DAY_NAMES[s.weekday - 1]}</span> {s.name}
                </h2>
                <span className="shrink-0 text-[13px] text-cendre tabular-nums">≈ {s.estimatedMinutes} min</span>
              </div>
              <ul className="flex flex-col">
                {s.exercises.map((e, ei) => (
                  <li key={e.libraryId} className="border-t border-graphite first:border-t-0">
                    <button
                      type="button"
                      onClick={() => setEditing({ session: si, index: ei })}
                      aria-label={`${libraryName(e.libraryId)}, ${prescriptionText(e, scale)}. Changer`}
                      className="flex min-h-14 w-full items-center gap-3 py-2 text-left active:opacity-70"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] leading-tight">{libraryName(e.libraryId)}</span>
                        <span className="block text-[13px] text-cendre tabular-nums">{prescriptionText(e, scale)}</span>
                        {touched.has(e.libraryId) && <span className="block text-[12px] font-medium text-citron">Ton choix</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-cendre">
                        <Icon name="swap" size={16} />
                        Changer
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Button variant="quiet" className="-ml-2 self-start" onClick={() => setEditing({ session: si, adding: true })}>
                <Icon name="plus" size={18} />
                Ajouter un exercice
              </Button>
            </article>
          );
        })}
        <p className="text-[12px] leading-snug text-cendre">
          FORGE te propose ensuite tes charges, séance après séance. Durées estimées avec 8 min d’échauffement, 40 s par série et les repos.
        </p>
      </section>

      {adjusted && (
        <section aria-label="Tes changements" className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-[18px]">
          <h2 className="text-[17px] font-semibold">Tes changements</h2>
          <ul className="flex flex-col gap-1.5">
            {changes.map((l) => (
              <li key={l} className="text-[13px] leading-snug">
                {l}
              </li>
            ))}
          </ul>
          <Button size="small" variant="secondary" className="self-start" onClick={() => setSessions(base.sessions)}>
            Revenir à la proposition de FORGE
          </Button>
        </section>
      )}

      <VolumeChart volume={review.volume} />

      {warnings.length > 0 && (
        <section aria-label="À savoir" className="flex flex-col gap-2 rounded-[22px] bg-anthracite p-[18px]">
          <h2 className="text-[17px] font-semibold">À savoir</h2>
          {warnings.map((w) => (
            <p key={w} className="text-[13px] leading-snug">
              {w}
            </p>
          ))}
        </section>
      )}

      <section aria-label="Pourquoi ces choix" className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Pourquoi ces choix</h2>
        {adjusted && <p className="text-[13px] leading-snug text-cendre">Les choix de FORGE, avant tes changements.</p>}
        <ul className="flex flex-col gap-2">
          {base.reasons.map((r) => (
            <li key={r} className="flex gap-2 text-[13px] leading-snug">
              <Icon name="check" size={14} strokeWidth={3} className="mt-0.5 shrink-0 text-citron" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <p className="text-[12px] leading-snug text-cendre">Des repères généraux, pas un avis médical. Arrête un exercice qui fait mal.</p>
      </section>

      <div className="flex flex-col gap-2 pb-2">
        {error && (
          <p className="text-[15px] text-braise" role="alert">
            {error}
          </p>
        )}
        {active && <p className="text-[13px] leading-snug text-cendre">En l’activant, « {active.name} » passe en pause. Tu le retrouves dans Programmes.</p>}
        <Button disabled={busy} onClick={() => void save(true)}>
          Valider et activer
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void save(false)}>
          Enregistrer en brouillon
        </Button>
        <Button variant="secondary" disabled={busy} onClick={regenerate}>
          <Icon name="swap" size={18} />
          Autre proposition
        </Button>
        {confirmEdit ? (
          <div className="flex flex-col gap-2 rounded-[18px] bg-anthracite p-4" role="group" aria-label="Modifier mes réponses">
            <p className="text-[15px] leading-snug">Tes changements sur cette proposition seront perdus.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="small" variant="danger" onClick={onEdit}>
                Modifier quand même
              </Button>
              <Button size="small" variant="quiet" onClick={() => setConfirmEdit(false)}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="quiet" disabled={busy} onClick={() => (adjusted ? setConfirmEdit(true) : onEdit())}>
            Modifier mes réponses
          </Button>
        )}
      </div>

      <Sheet open={editing !== null} title={editing && 'adding' in editing ? 'Ajouter un exercice' : 'Changer l’exercice'} onClose={() => setEditing(null)}>
        {editing && 'adding' in editing && (
          <LibraryList
            exclude={sessions[editing.session]!.exercises.map((e) => e.libraryId)}
            access={training}
            onPick={(id) => {
              setSessions(addExercise(sessions, editing.session, id, training));
              setEditing(null);
              toast.show(`Ajouté : ${libraryName(id)}`);
            }}
          />
        )}
        {editing && 'index' in editing && sessions[editing.session]?.exercises[editing.index] && (
          <ExerciseEditor
            session={sessions[editing.session]!}
            index={editing.index}
            training={training}
            scale={scale}
            onReplace={(id) => {
              const from = sessions[editing.session]!.exercises[editing.index]!.libraryId;
              setSessions(replaceExercise(sessions, editing.session, editing.index, id, training));
              setEditing(null);
              toast.show(`${libraryName(from)} remplacé par ${lowerFirst(libraryName(id))}`);
            }}
            onSets={(v) => setSessions(setSets(sessions, editing.session, editing.index, v))}
            onMove={(dir) => {
              setSessions(moveExercise(sessions, editing.session, editing.index, dir));
              setEditing({ session: editing.session, index: editing.index + dir });
            }}
            onRemove={() => {
              const id = sessions[editing.session]!.exercises[editing.index]!.libraryId;
              setSessions(removeExercise(sessions, editing.session, editing.index));
              setEditing(null);
              toast.show(`Retiré : ${libraryName(id)}`);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

const prescriptionText = (e: PlannedExercise, scale: 'rir' | 'rpe') => `${e.sets} × ${e.reps}, ${effortText(e.rir, scale)}, repos ${formatRest(e.restSec)}`;

/** Un exercice de la proposition : le remplacer (même mouvement d'abord), changer ses séries, le déplacer, le retirer. */
function ExerciseEditor({
  session,
  index,
  training,
  scale,
  onReplace,
  onSets,
  onMove,
  onRemove,
}: {
  session: PlannedSession;
  index: number;
  training: TrainingAnswers;
  scale: 'rir' | 'rpe';
  onReplace: (id: string) => void;
  onSets: (sets: number) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const e = session.exercises[index]!;
  const inSession = session.exercises.map((x) => x.libraryId);
  const options = swapOptions(e.libraryId, training, inSession);
  const [browsing, setBrowsing] = useState(false);
  const item = ITEMS.get(e.libraryId);
  return (
    <div className="flex flex-col gap-4 pb-3">
      <div className="flex items-center gap-3">
        {item && <ExerciseThumb item={item} size={52} />}
        <div className="min-w-0">
          <p className="text-[17px] leading-tight font-semibold">{libraryName(e.libraryId)}</p>
          <p className="text-[13px] text-cendre tabular-nums">
            {session.name}, exercice {index + 1} : {prescriptionText(e, scale)}
          </p>
        </div>
      </div>

      <section aria-label="Remplacer par" className="flex flex-col gap-1">
        <h3 className="text-[15px] font-semibold">Remplacer par</h3>
        {options.movement.length > 0 && <OptionGroup title="Même mouvement" ids={options.movement} favorites={training.favorites ?? []} onPick={onReplace} />}
        {options.muscle.length > 0 && (
          <OptionGroup title={`Autres exercices ${muscleOf(e.libraryId)}`} ids={options.muscle.slice(0, 6)} favorites={training.favorites ?? []} onPick={onReplace} />
        )}
        {!options.movement.length && !options.muscle.length && <p className="text-[13px] text-cendre">Pas d’équivalent avec ton matériel et tes zones à ménager.</p>}
        {browsing ? (
          <div className="mt-2">
            <LibraryList exclude={inSession} access={training} onPick={onReplace} />
          </div>
        ) : (
          <Button variant="quiet" className="-ml-2 self-start" onClick={() => setBrowsing(true)}>
            <Icon name="search" size={18} />
            Chercher dans toute la bibliothèque
          </Button>
        )}
      </section>

      <div className="rounded-[16px] bg-graphite/60 px-4 py-2">
        <Stepper label="Séries" value={e.sets} step={1} min={MIN_SETS} max={MAX_EDIT_SETS} start={e.sets} format={(v) => String(v)} onChange={onSets} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button size="small" variant="secondary" disabled={index === 0} onClick={() => onMove(-1)}>
          <Icon name="up" size={16} />
          Monter
        </Button>
        <Button size="small" variant="secondary" disabled={index === session.exercises.length - 1} onClick={() => onMove(1)}>
          <Icon name="down" size={16} />
          Descendre
        </Button>
      </div>
      <Button variant="danger" disabled={session.exercises.length <= 1} onClick={onRemove}>
        Retirer de la séance
      </Button>
      {session.exercises.length <= 1 && <p className="-mt-2 text-[13px] text-cendre">Une séance garde au moins un exercice.</p>}
    </div>
  );
}

const MUSCLE_OF: Record<MuscleGroup, string> = {
  pectoraux: 'pour les pectoraux',
  dos: 'pour le dos',
  trapezes: 'pour les trapèzes',
  lombaires: 'pour les lombaires',
  epaules: 'pour les épaules',
  biceps: 'pour les biceps',
  triceps: 'pour les triceps',
  'avant-bras': 'pour les avant-bras',
  abdominaux: 'pour les abdominaux',
  obliques: 'pour les obliques',
  fessiers: 'pour les fessiers',
  quadriceps: 'pour les quadriceps',
  ischios: 'pour les ischio-jambiers',
  adducteurs: 'pour les adducteurs',
  mollets: 'pour les mollets',
};
const muscleOf = (id: string) => {
  const m = libraryExercise(id)?.muscle;
  return m ? MUSCLE_OF[m] : 'du même muscle';
};

function OptionGroup({ title, ids, favorites, onPick }: { title: string; ids: string[]; favorites: readonly string[]; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-col">
      <p className="mt-2 text-[13px] text-cendre">{title}</p>
      <ul className="flex flex-col">
        {ids.map((id) => {
          const item = ITEMS.get(id);
          if (!item) return null;
          return (
            <li key={id} className="border-b border-graphite last:border-b-0">
              <OptionRow item={item} favorite={favorites.includes(id)} onPick={() => onPick(id)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OptionRow({ item, favorite = false, blocked = null, onPick }: { item: CatalogItem; favorite?: boolean; blocked?: string | null; onPick: () => void }) {
  return (
    <button type="button" disabled={Boolean(blocked)} onClick={onPick} className="flex min-h-16 w-full items-center gap-3 py-2 text-left disabled:opacity-50">
      <ExerciseThumb item={item} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-tight">{item.name}</span>
        <span className="block text-[13px] text-cendre">{blocked ?? describeItem(item)}</span>
      </span>
      {favorite && <span className="shrink-0 rounded-full bg-graphite px-2 py-0.5 text-[12px] text-citron">Favori</span>}
      {!blocked && <Icon name="plus" size={20} className="shrink-0 text-citron" />}
    </button>
  );
}

type Filter = MuscleGroup | 'tous';
const FILTERS = [{ value: 'tous' as Filter, label: 'Tous' }, ...MUSCLE_GROUPS.map((m) => ({ value: m as Filter, label: MUSCLE_LABELS[m] }))];

/**
 * Toute la bibliothèque, avec recherche et filtre par muscle. Avec `access`, les exercices impossibles
 * (matériel, zone à ménager, à éviter) restent visibles, grisés, avec leur raison.
 */
export function LibraryList({
  exclude,
  access,
  onPick,
}: {
  exclude: readonly string[];
  access?: Pick<TrainingAnswers, 'place' | 'equipment' | 'zones' | 'avoid'>;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('tous');
  const blocked = useMemo(() => (access ? exerciseAccess(access).blocked : () => null), [access]);
  const matches = searchCatalog(PLACEABLE, query, filter === 'tous' ? null : filter)
    .filter((i) => !exclude.includes(i.library!.id))
    .sort((x, y) => Number(Boolean(blocked(x.library!.id))) - Number(Boolean(blocked(y.library!.id))));
  return (
    <div className="flex flex-col gap-3 pb-1">
      <Field label="Chercher un exercice" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={80} placeholder="Ex. développé, squat, curl" enterKeyHint="search" />
      <Chips label="Groupe musculaire" hideLabel layout="scroll" options={FILTERS} selected={[filter]} onToggle={setFilter} />
      <ul className="flex flex-col">
        {matches.map((item) => (
          <li key={item.key} className="border-b border-graphite last:border-b-0">
            <OptionRow item={item} blocked={blocked(item.library!.id)} onPick={() => onPick(item.library!.id)} />
          </li>
        ))}
      </ul>
      {!matches.length && <p className="text-[15px] text-cendre">Aucun exercice ne correspond.</p>}
    </div>
  );
}

const formatSets = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

/**
 * Séries par semaine et par muscle : directes en plein, indirectes (muscle secondaire, comptées pour moitié) en clair,
 * sur la bande de repère de 10 à 20 séries. Les valeurs sont écrites : la barre n'est qu'une aide.
 */
function VolumeChart({ volume }: { volume: PlannedVolume[] }) {
  const max = Math.max(VOLUME_REFERENCE.high + 4, ...volume.map((v) => Math.ceil(v.total)));
  const pct = (n: number) => `${(n / max) * 100}%`;
  return (
    <section aria-label="Volume par semaine" className="flex flex-col gap-3 rounded-[22px] bg-anthracite p-[18px]">
      <div className="flex flex-col gap-1">
        <h2 className="text-[17px] font-semibold">Volume par semaine</h2>
        <p className="text-[13px] leading-snug text-cendre">
          Séries par muscle. Repère pour l’hypertrophie : {VOLUME_REFERENCE.low} à {VOLUME_REFERENCE.high} séries (Schoenfeld et al. 2017).
        </p>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-cendre" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-citron" />
          Directes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-citron/35" />
          Indirectes, pour moitié
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-craie/10" />
          Repère
        </span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {volume.map((v) => (
          <li
            key={v.muscle}
            className="grid grid-cols-[104px_1fr_56px] items-center gap-2"
            aria-label={`${MUSCLE_LABELS[v.muscle]} : ${formatSets(v.direct)} séries directes${v.indirect ? ` et ${formatSets(v.indirect)} indirectes` : ''}`}
          >
            <span className="truncate text-[13px]">{MUSCLE_LABELS[v.muscle]}</span>
            <span className="relative h-3 rounded-[4px] bg-graphite" aria-hidden="true">
              <span className="absolute inset-y-0 bg-craie/10" style={{ left: pct(VOLUME_REFERENCE.low), width: pct(VOLUME_REFERENCE.high - VOLUME_REFERENCE.low) }} />
              <span className="absolute inset-y-0 left-0 flex gap-[2px]" style={{ width: pct(v.total) }}>
                {v.direct > 0 && <span className="h-full rounded-[4px] bg-citron" style={{ width: `${(v.direct / v.total) * 100}%` }} />}
                {v.indirect > 0 && <span className="h-full flex-1 rounded-[4px] bg-citron/35" />}
              </span>
            </span>
            <span className="text-right text-[13px] tabular-nums" aria-hidden="true">
              {formatSets(v.direct)}
              {v.indirect > 0 && <span className="text-cendre"> +{formatSets(v.indirect)}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
