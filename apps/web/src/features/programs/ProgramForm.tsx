import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { repos, usePrograms, useToday } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { Program, ProgramObjective } from '../../db/types';
import { CYCLE_WEEKS, OBJECTIVE_LABELS, OBJECTIVES, programStatus } from '../../domain/programs/status';
import { isDateKey } from '../../lib/dates';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { Screen } from '../../ui/Screen';
import { TextArea } from '../../ui/TextArea';
import { useToast } from '../../ui/Toast';
import { BackLink } from './ProgramsScreen';

/** « Sans durée » : pas de cycle fixé. */
const NO_DURATION = 0;

/** Créer un programme (en brouillon) ou modifier son nom, ses objectifs, son cycle et sa description. */
export function ProgramFormScreen() {
  const { id } = useParams();
  const programs = usePrograms();
  if (id && !programs)
    return (
      <Screen withTabBar={false}>
        <BackLink to={`/training/programmes/${id}`} label="Programme" />
      </Screen>
    );
  const editing = id ? (programs?.find((p) => p.id === id) ?? null) : null;
  if (id && !editing)
    return (
      <Screen withTabBar={false}>
        <BackLink to="/training/programmes" label="Programmes" />
        <p className="text-[17px]">Ce programme n’existe plus.</p>
      </Screen>
    );
  return <ProgramForm key={id ?? 'nouveau'} editing={editing} />;
}

function ProgramForm({ editing }: { editing: Program | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const today = useToday();
  const [name, setName] = useState(editing?.name ?? '');
  const [objective, setObjective] = useState<ProgramObjective | null>(editing?.objective ?? null);
  const [secondary, setSecondary] = useState<ProgramObjective | null>(editing?.secondaryObjective ?? null);
  const [weeks, setWeeks] = useState<number>(editing?.durationWeeks ?? NO_DURATION);
  const [startDate, setStartDate] = useState(editing?.startDate ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // La date de début se pose à l'activation ; on peut la corriger ensuite (ou l'indiquer pour un programme d'avant).
  const showStart = editing !== null && programStatus(editing) !== 'brouillon';
  const durationOptions = [{ value: NO_DURATION, label: 'Sans durée' }, ...CYCLE_WEEKS.map((w) => ({ value: w, label: `${w} semaines` }))];
  if (weeks && !CYCLE_WEEKS.includes(weeks as (typeof CYCLE_WEEKS)[number])) durationOptions.push({ value: weeks, label: `${weeks} semaines` });

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('Donne un nom au programme.');
    if (showStart && startDate && (!isDateKey(startDate) || startDate > today)) return setError('Date de début : aujourd’hui ou avant.');
    setBusy(true);
    try {
      const fields = {
        name: name.trim(),
        objective,
        secondaryObjective: secondary && secondary !== objective ? secondary : null,
        durationWeeks: weeks || null,
        note: note.trim(),
      };
      if (editing) {
        await repos.programs.update(editing.id, { ...fields, ...(showStart ? { startDate: startDate || null } : {}) });
        await repos.programVersions.sync(editing.id);
        toast.show('Programme modifié');
        navigate(`/training/programmes/${editing.id}`, { viewTransition: true });
      } else {
        const created = await repos.programs.add({ ...fields, active: false, status: 'brouillon', source: 'manuel' });
        toast.show('Brouillon créé : ajoute ses séances');
        navigate(`/training/programmes/${created.id}`, { replace: true, viewTransition: true });
      }
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'L’enregistrement a échoué. Réessaie.');
      setBusy(false);
    }
  };

  return (
    <Screen withTabBar={false}>
      <BackLink to={editing ? `/training/programmes/${editing.id}` : '/training/programmes'} label={editing ? 'Programme' : 'Programmes'} />
      <h1 className="font-metal text-[40px]">{editing ? 'Modifier le programme' : 'Nouveau programme'}</h1>

      <Field label="Nom du programme" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex. Hypertrophie 4 jours" />

      <Chips
        label="Objectif"
        options={OBJECTIVES.map((o) => ({ value: o, label: OBJECTIVE_LABELS[o] }))}
        selected={objective ? [objective] : []}
        onToggle={(o) => {
          setObjective((cur) => (cur === o ? null : o));
          if (secondary === o) setSecondary(null);
        }}
      />

      {objective && (
        <Chips
          label="Objectif secondaire, facultatif"
          options={OBJECTIVES.filter((o) => o !== objective).map((o) => ({ value: o, label: OBJECTIVE_LABELS[o] }))}
          selected={secondary ? [secondary] : []}
          onToggle={(o) => setSecondary((cur) => (cur === o ? null : o))}
        />
      )}

      <Chips label="Durée du cycle" options={durationOptions} selected={[weeks]} onToggle={(w) => setWeeks(w)} />

      {showStart && <Field label="Début du cycle" type="date" value={startDate} max={today} onChange={(e) => setStartDate(e.target.value)} />}

      <TextArea
        label="Description"
        hint="facultative"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Ce que vise ce programme, ce qui compte pour toi."
      />

      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      <Button disabled={busy} onClick={() => void save()}>
        {editing ? 'Enregistrer' : 'Créer le brouillon'}
      </Button>
      {!editing && <p className="text-[13px] leading-snug text-cendre">Le programme est créé en brouillon : ajoute ses séances, puis active-le quand il est prêt.</p>}
    </Screen>
  );
}
