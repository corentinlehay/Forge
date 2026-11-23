import { useState } from 'react';
import { repos } from '../../db/hooks';
import { DataError } from '../../db/repositories/entities';
import type { Program, WorkoutTemplate } from '../../db/types';
import { programTemplates } from '../../domain/training';
import { countLabel } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'program'; id: string };

/** Tes programmes : un seul actif à la fois ; créer, renommer, dupliquer, supprimer. */
export function ProgramsPanel({ programs, templates, onDone }: { programs: Program[]; templates: WorkoutTemplate[]; onDone: () => void }) {
  const toast = useToast();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const count = (id: string) => programTemplates(templates, programs, id).length;

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'L’opération a échoué. Réessaie.');
    }
  };

  const open = (p: Program) => {
    setName(p.name);
    setConfirmDelete(false);
    setError(null);
    setView({ kind: 'program', id: p.id });
  };

  if (view.kind === 'new') {
    return (
      <div className="flex flex-col gap-4 pb-1">
        <Field label="Nom du programme" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex. Hypertrophie 5 jours" />
        {error && (
          <p className="text-[15px] text-braise" role="alert">
            {error}
          </p>
        )}
        <Button
          onClick={() =>
            void run(async () => {
              const created = await repos.programs.add({
                name: name.trim(),
                active: false,
              });
              await repos.programs.activate(created.id);
              toast.show('Programme créé et activé');
              onDone();
            })
          }
        >
          Créer et activer
        </Button>
        <Button variant="quiet" onClick={() => setView({ kind: 'list' })}>
          Annuler
        </Button>
      </div>
    );
  }

  if (view.kind === 'program') {
    const program = programs.find((p) => p.id === view.id);
    if (!program) return null;
    return (
      <div className="flex flex-col gap-4 pb-1">
        <Button variant="quiet" className="-ml-2 self-start" onClick={() => setView({ kind: 'list' })}>
          <Icon name="back" size={18} />
          Tous les programmes
        </Button>
        <p className="text-[15px] text-cendre">
          {countLabel(count(program.id), 'séance')}
          {program.active ? ', programme actif' : ''}
        </p>
        {!program.active && (
          <Button
            onClick={() =>
              void run(async () => {
                await repos.programs.activate(program.id);
                toast.show(`« ${program.name} » est ton programme actif`);
                onDone();
              })
            }
          >
            Activer ce programme
          </Button>
        )}
        <div className="flex items-end gap-2">
          <Field label="Nom" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="flex-1" />
          <Button
            variant="secondary"
            size="small"
            className="h-12! rounded-[12px]!"
            disabled={!name.trim() || name.trim() === program.name}
            onClick={() =>
              void run(async () => {
                await repos.programs.update(program.id, { name: name.trim() });
                toast.show('Programme renommé');
              })
            }
          >
            Renommer
          </Button>
        </div>
        <Button
          variant="secondary"
          onClick={() =>
            void run(async () => {
              const copy = await repos.programs.duplicate(program.id);
              toast.show('Programme dupliqué');
              open(copy);
            })
          }
        >
          <Icon name="copy" size={18} />
          Dupliquer le programme
        </Button>
        {error && (
          <p className="text-[15px] text-braise" role="alert">
            {error}
          </p>
        )}
        {confirmDelete ? (
          <Button
            variant="danger"
            onClick={() =>
              void run(async () => {
                await repos.programs.removeWithTemplates(program.id);
                toast.show('Programme supprimé');
                setView({ kind: 'list' });
              })
            }
          >
            Confirmer : supprimer le programme et ses séances
          </Button>
        ) : (
          <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirmDelete(true)}>
            Supprimer ce programme
          </Button>
        )}
        <p className="text-[13px] text-cendre">Les séances déjà faites restent dans ton historique.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-1">
      {programs.length === 0 && <p className="text-[15px] text-cendre">Aucun programme. Crée le premier : tes séances s’y rangeront.</p>}
      <ul className="flex flex-col gap-2">
        {programs.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => open(p)} className="flex min-h-[60px] w-full items-center justify-between gap-3 rounded-[16px] bg-graphite px-4 py-3 text-left">
              <span className="min-w-0">
                <span className="block truncate text-[17px] font-semibold">{p.name}</span>
                <span className="block text-[13px] text-cendre">{countLabel(count(p.id), 'séance')}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-cendre">
                {p.active && <span className="rounded-full bg-citron px-2 py-0.5 text-[12px] font-semibold text-noir">Actif</span>}
                <Icon name="chevron" size={16} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        onClick={() => {
          setName('');
          setError(null);
          setView({ kind: 'new' });
        }}
      >
        <Icon name="plus" size={18} />
        Nouveau programme
      </Button>
    </div>
  );
}
