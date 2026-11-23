import { useState } from 'react';
import { EXERCISE_LIBRARY } from '../../data/exerciseLibrary';
import { EQUIPMENT_LABELS, MUSCLE_GROUPS, MUSCLE_LABELS, type Equipment, type MuscleGroup } from '../../data/muscles';
import { repos } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { Exercise } from '../../db/types';
import { normalize } from '../../domain/food';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { SelectField } from '../../ui/SelectField';
import { TextArea } from '../../ui/TextArea';
import { restOptions } from './restOptions';

const muscleOptions = MUSCLE_GROUPS.map((m) => ({
  value: m,
  label: MUSCLE_LABELS[m],
}));
const equipmentOptions = (Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }));
const kindOptions = [
  { value: 'compound', label: 'Polyarticulaire' },
  { value: 'isolation', label: 'Isolation' },
] as const;

/** Exercice perso (ou complément d'un ancien exercice) : nom, muscles, matériel, repos, consignes. */
export function CustomExerciseForm({ editing, others, onSaved }: { editing: Exercise | null; others: readonly Exercise[]; onSaved: (exercise: Exercise) => void }) {
  const [name, setName] = useState(editing?.name ?? '');
  const [muscle, setMuscle] = useState<MuscleGroup | null>((editing?.muscle as MuscleGroup | null) ?? null);
  const [secondary, setSecondary] = useState<MuscleGroup[]>((editing?.secondary as MuscleGroup[] | undefined) ?? []);
  const [equipment, setEquipment] = useState<Equipment | null>((editing?.equipment as Equipment | null) ?? null);
  const [kind, setKind] = useState<'compound' | 'isolation' | null>(editing?.kind ?? null);
  const [rest, setRest] = useState(String(editing?.restSec ?? 90));
  const [cues, setCues] = useState((editing?.cues ?? []).join('\n'));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    const clean = name.trim();
    if (!clean) return setError('Donne un nom à l’exercice.');
    const key = normalize(clean);
    if (EXERCISE_LIBRARY.some((l) => normalize(l.name) === key) && !editing?.libraryId)
      return setError(`« ${clean} » existe déjà dans la bibliothèque : choisis-le dans la liste.`);
    if (others.some((e) => e.id !== editing?.id && !e.deletedAt && normalize(e.name) === key)) return setError(`Tu as déjà un exercice « ${clean} ».`);
    if (!muscle) return setError('Choisis le muscle principal : il sert au suivi du volume par muscle.');
    const fields = {
      name: clean,
      muscle,
      secondary: secondary.filter((m) => m !== muscle),
      equipment,
      kind,
      restSec: Number(rest),
      cues: cues
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 8),
    };
    setBusy(true);
    try {
      const saved = editing ? await repos.exercises.update(editing.id, fields) : await repos.exercises.add({ ...fields, libraryId: null });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'L’enregistrement a échoué. Réessaie.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-1">
      <Field label="Nom de l’exercice" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex. Rowing Pendlay" />
      <Chips label="Muscle principal" options={muscleOptions} selected={muscle ? [muscle] : []} onToggle={(m) => setMuscle((cur) => (cur === m ? null : m))} />
      <Chips
        label="Muscles secondaires (facultatif)"
        options={muscleOptions.filter((o) => o.value !== muscle)}
        selected={secondary}
        onToggle={(m) => setSecondary((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]))}
      />
      <Chips label="Matériel (facultatif)" options={equipmentOptions} selected={equipment ? [equipment] : []} onToggle={(e) => setEquipment((cur) => (cur === e ? null : e))} />
      <Chips label="Type de mouvement (facultatif)" options={kindOptions} selected={kind ? [kind] : []} onToggle={(k) => setKind((cur) => (cur === k ? null : k))} />
      <SelectField label="Repos conseillé entre les séries" value={rest} onChange={(e) => setRest(e.target.value)} options={restOptions(editing?.restSec)} />
      <TextArea label="Consignes techniques (facultatif)" hint="une par ligne" value={cues} onChange={(e) => setCues(e.target.value)} maxLength={1200} rows={3} />
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void save()} disabled={busy}>
        {editing ? 'Enregistrer l’exercice' : 'Créer l’exercice'}
      </Button>
    </div>
  );
}
