import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { repos, useAllTemplates, useExercises, useTemplates } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { TemplateExercise, WorkoutTemplate } from '../../db/types';
import { buildCatalog, catalogItem, defaultReps } from '../../domain/exerciseCatalog';
import { parseRepRange } from '../../domain/progression';
import { moveItem } from '../../domain/workoutFlow';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { SelectField } from '../../ui/SelectField';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { ExercisePicker } from './ExercisePicker';
import { ExerciseThumb } from './ExerciseVisual';
import { restOptions } from './restOptions';

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const RIR_OPTIONS = [
  { value: '', label: 'Libre' },
  ...[0, 1, 2, 3, 4].map((n) => ({
    value: String(n),
    label: n === 0 ? '0 (échec)' : String(n),
  })),
];

interface Row {
  key: string;
  exerciseId: string;
  sets: string;
  reps: string;
  restSec: string;
  rir: string;
}

const toRow = (e: TemplateExercise, i: number, fallbackRest: number | null): Row => ({
  key: `${e.exerciseId}-${i}`,
  exerciseId: e.exerciseId,
  sets: String(e.sets),
  reps: e.reps,
  restSec: String(e.restSec ?? fallbackRest ?? 90),
  rir: e.rir === null || e.rir === undefined ? '' : String(e.rir),
});

/** Une séance du programme : jours, exercices, séries, répétitions, repos et RIR visés. */
export function TemplateScreen() {
  const { templateId = 'nouvelle' } = useParams();
  const all = useAllTemplates();
  const current = useTemplates();
  const exercises = useExercises();
  if (!all || !current || !exercises)
    return (
      <Screen withTabBar={false}>
        <BackLink />
      </Screen>
    );
  const editing = templateId === 'nouvelle' ? null : (all.find((t) => t.id === templateId) ?? null);
  if (templateId !== 'nouvelle' && !editing) {
    return (
      <Screen withTabBar={false}>
        <BackLink />
        <p className="text-[17px]">Cette séance n’existe plus.</p>
      </Screen>
    );
  }
  return <TemplateEditor key={templateId} editing={editing} nextPosition={current.length} />;
}

function TemplateEditor({ editing, nextPosition }: { editing: WorkoutTemplate | null; nextPosition: number }) {
  const navigate = useNavigate();
  const toast = useToast();
  const exercises = useExercises();
  const catalog = useMemo(() => buildCatalog(exercises ?? []), [exercises]);
  const restOf = (exerciseId: string) => exercises?.find((e) => e.id === exerciseId)?.restSec ?? null;
  const [name, setName] = useState(editing?.name ?? '');
  const [weekdays, setWeekdays] = useState<number[]>(editing?.weekdays ?? []);
  const [rows, setRows] = useState<Row[]>(() => (editing?.exercises ?? []).map((e, i) => toRow(e, i, restOf(e.exerciseId))));
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string) => catalogItem(catalog, id)?.name ?? exercises?.find((e) => e.id === id)?.name ?? 'Exercice';
  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));
  const update = (key: string, patch: Partial<Row>) => setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('Donne un nom à la séance.');
    if (!rows.length) return setError('Ajoute au moins un exercice.');
    const bad = rows.find((r) => !/^\d+$/.test(r.sets.trim()) || Number(r.sets) < 1 || Number(r.sets) > 20);
    if (bad) return setError(`Séries de « ${nameOf(bad.exerciseId)} » : un nombre entre 1 et 20.`);
    const badReps = rows.find((r) => r.reps.trim() && !parseRepRange(r.reps));
    if (badReps) return setError(`Répétitions de « ${nameOf(badReps.exerciseId)} » : un nombre ou une fourchette, par exemple 8-12.`);
    setBusy(true);
    try {
      const list: TemplateExercise[] = rows.map((r) => ({
        exerciseId: r.exerciseId,
        sets: Number(r.sets),
        reps: r.reps.trim(),
        restSec: Number(r.restSec),
        rir: r.rir === '' ? null : Number(r.rir),
      }));
      const input = { name: name.trim(), weekdays, exercises: list };
      if (editing) await repos.templates.update(editing.id, input);
      else {
        const program = await repos.programs.ensureActive();
        await repos.templates.add({
          ...input,
          position: nextPosition,
          programId: program.id,
        });
      }
      toast.show(editing ? 'Séance modifiée' : 'Séance ajoutée au programme');
      navigate('/training', { viewTransition: true });
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'L’enregistrement a échoué. Réessaie.');
      setBusy(false);
    }
  };

  const duplicate = async () => {
    if (!editing) return;
    const copy = await repos.templates.add({
      name: `${editing.name.slice(0, 52)} (copie)`,
      weekdays: [],
      exercises: editing.exercises,
      position: nextPosition,
      programId: editing.programId ?? null,
    });
    toast.show('Séance dupliquée : choisis ses jours');
    navigate(`/training/programme/${copy.id}`, { replace: true });
  };

  const remove = async () => {
    if (!editing) return;
    await repos.templates.remove(editing.id);
    toast.show('Séance retirée du programme');
    navigate('/training', { replace: true });
  };

  return (
    <Screen withTabBar={false}>
      <BackLink />
      <h1 className="font-metal text-[40px]">{editing ? 'Modifier la séance' : 'Nouvelle séance'}</h1>
      <Field label="Nom de la séance" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex. Upper A" />
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-[13px] text-cendre">Jours prévus</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map((label, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={weekdays.includes(i + 1)}
              aria-label={DAY_NAMES[i]}
              onClick={() => toggleDay(i + 1)}
              className={`h-11 rounded-[12px] text-[15px] font-semibold ${weekdays.includes(i + 1) ? 'bg-citron text-noir' : 'bg-graphite text-cendre'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <section aria-label="Exercices" className="flex flex-col gap-3">
        <h2 className="text-[17px] font-semibold">Exercices</h2>
        {!rows.length && <p className="text-[15px] text-cendre">Ajoute les exercices dans l’ordre où tu les fais.</p>}
        {rows.map((row, i) => {
          const item = catalogItem(catalog, row.exerciseId);
          const label = nameOf(row.exerciseId);
          return (
            <div key={row.key} className="flex flex-col gap-3 rounded-[18px] bg-anthracite p-3.5">
              <div className="flex items-center gap-3">
                {item && <ExerciseThumb item={item} size={40} />}
                <p className="min-w-0 flex-1 text-[15px] leading-tight font-semibold">
                  <span className="mr-1.5 text-cendre tabular-nums">{i + 1}.</span>
                  {label}
                </p>
                <div className="-mr-1.5 flex shrink-0">
                  <IconButton icon="up" label={`Monter ${label}`} disabled={i === 0} onClick={() => setRows((r) => moveItem(r, i, -1))} />
                  <IconButton icon="down" label={`Descendre ${label}`} disabled={i === rows.length - 1} onClick={() => setRows((r) => moveItem(r, i, 1))} />
                  <IconButton icon="close" label={`Retirer ${label}`} onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Séries" value={row.sets} onChange={(e) => update(row.key, { sets: e.target.value })} inputMode="numeric" maxLength={2} />
                <Field label="Répétitions" value={row.reps} onChange={(e) => update(row.key, { reps: e.target.value })} maxLength={20} placeholder="8-12" />
                <SelectField label="Repos" value={row.restSec} onChange={(e) => update(row.key, { restSec: e.target.value })} options={restOptions(Number(row.restSec))} />
                <SelectField label="RIR visé" value={row.rir} onChange={(e) => update(row.key, { rir: e.target.value })} options={RIR_OPTIONS} />
              </div>
            </div>
          );
        })}
        <Button variant="secondary" onClick={() => setPicking(true)}>
          <Icon name="plus" size={18} />
          Ajouter un exercice
        </Button>
        <p className="text-[13px] leading-snug text-cendre">RIR : répétitions que tu gardes en réserve à la fin de la série. RIR 2 = tu aurais pu en faire 2 de plus.</p>
      </section>

      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void save()} disabled={busy}>
        Enregistrer la séance
      </Button>
      {editing && (
        <Button variant="secondary" onClick={() => void duplicate()}>
          <Icon name="copy" size={18} />
          Dupliquer la séance
        </Button>
      )}
      {editing &&
        (confirmDelete ? (
          <Button variant="danger" onClick={() => void remove()}>
            Confirmer : retirer du programme
          </Button>
        ) : (
          <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirmDelete(true)}>
            Retirer cette séance du programme
          </Button>
        ))}

      <Sheet open={picking} title="Ajouter un exercice" onClose={() => setPicking(false)}>
        {picking && (
          <ExercisePicker
            exclude={rows.map((r) => r.exerciseId)}
            onPick={async (exercise, item) => {
              const kind = item?.kind ?? exercise.kind ?? null;
              setRows((r) => [
                ...r,
                {
                  key: `${exercise.id}-${Date.now()}`,
                  exerciseId: exercise.id,
                  sets: '3',
                  reps: defaultReps(kind),
                  restSec: String(exercise.restSec ?? item?.rest ?? 90),
                  rir: '2',
                },
              ]);
              setPicking(false);
            }}
          />
        )}
      </Sheet>
    </Screen>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: 'up' | 'down' | 'close' | 'dots' | 'note' | 'info' | 'trash';
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-10 items-center justify-center rounded-full text-cendre active:bg-graphite disabled:opacity-30"
    >
      <Icon name={icon} size={19} />
    </button>
  );
}

function BackLink() {
  return (
    <Link to="/training" viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      Training
    </Link>
  );
}
