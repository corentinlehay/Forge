import { useState } from 'react';
import { repos } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { Exercise, WorkoutTemplate } from '../../db/types';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

interface Row {
  key: number;
  name: string;
  sets: string;
  reps: string;
}

/** Une séance du programme : nom, jours, exercices avec séries et répétitions visées. */
export function TemplateForm({ editing, position, exercises, onDone }: { editing: WorkoutTemplate | null; position: number; exercises: Exercise[]; onDone: () => void }) {
  const toast = useToast();
  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? '';
  const [name, setName] = useState(editing?.name ?? '');
  const [weekdays, setWeekdays] = useState<number[]>(editing?.weekdays ?? []);
  const [rows, setRows] = useState<Row[]>(() =>
    editing?.exercises.length
      ? editing.exercises.map((e, i) => ({ key: i, name: nameOf(e.exerciseId), sets: String(e.sets), reps: e.reps }))
      : [{ key: 0, name: '', sets: '3', reps: '8-12' }],
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));
  const update = (key: number, patch: Partial<Row>) => setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const save = async () => {
    setError(null);
    const filled = rows.filter((r) => r.name.trim());
    if (!name.trim()) return setError('Donne un nom à la séance.');
    if (!filled.length) return setError('Ajoute au moins un exercice.');
    const bad = filled.find((r) => !/^\d+$/.test(r.sets.trim()) || Number(r.sets) < 1 || Number(r.sets) > 20);
    if (bad) return setError(`Séries de « ${bad.name.trim()} » : un nombre entre 1 et 20.`);
    setBusy(true);
    try {
      const list = [];
      for (const r of filled) {
        const exercise = await repos.exercises.findOrCreate(r.name);
        list.push({ exerciseId: exercise.id, sets: Number(r.sets), reps: r.reps.trim() });
      }
      const input = { name: name.trim(), weekdays, exercises: list };
      if (editing) await repos.templates.update(editing.id, input);
      else await repos.templates.add({ ...input, position });
      toast.show(editing ? 'Séance modifiée' : 'Séance ajoutée au programme');
      onDone();
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'L’enregistrement a échoué. Réessaie.');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    await repos.templates.remove(editing.id);
    toast.show('Séance retirée du programme');
    onDone();
  };

  return (
    <div className="flex flex-col gap-4 pb-1">
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
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-cendre">Exercices</p>
        {rows.map((row, i) => (
          <div key={row.key} className="flex flex-col gap-2 rounded-[14px] border border-graphite p-3">
            <div className="flex items-end gap-2">
              <Field label={`Exercice ${i + 1}`} value={row.name} onChange={(e) => update(row.key, { name: e.target.value })} maxLength={80} list="forge-exercises" className="flex-1" />
              {rows.length > 1 && (
                <button type="button" aria-label={`Retirer l’exercice ${i + 1}`} onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))} className="flex h-12 w-11 items-center justify-center text-cendre">
                  <Icon name="close" size={18} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Séries" value={row.sets} onChange={(e) => update(row.key, { sets: e.target.value })} inputMode="numeric" />
              <Field label="Répétitions" value={row.reps} onChange={(e) => update(row.key, { reps: e.target.value })} maxLength={20} placeholder="8-12" />
            </div>
          </div>
        ))}
        <datalist id="forge-exercises">{exercises.map((e) => <option key={e.id} value={e.name} />)}</datalist>
        <Button variant="secondary" onClick={() => setRows((r) => [...r, { key: Date.now(), name: '', sets: '3', reps: '8-12' }])}>
          <Icon name="plus" size={18} />
          Ajouter un exercice
        </Button>
      </div>
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void save()} disabled={busy}>
        Enregistrer la séance
      </Button>
      {editing &&
        (confirmDelete ? (
          <Button variant="danger" onClick={() => void remove()}>
            Retirer du programme
          </Button>
        ) : (
          <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirmDelete(true)}>
            Retirer cette séance du programme
          </Button>
        ))}
    </div>
  );
}
