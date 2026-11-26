import { useEffect, useMemo, useState } from 'react';
import { repos, useMeta, useProfile } from '../../db/hooks';
import type { AvatarConfig } from '../../db/types';
import { acquiredPieces, AVATAR_LAYERS, AVATAR_PIECES, cleanInitials, readAvatar, unlockText, withPiece, type AvatarPiece } from '../../domain/level/avatar';
import { LEVEL_SEEN_KEY, readSeen } from '../../domain/level/history';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { useToast } from '../../ui/Toast';
import { Emblem, emblemText } from './Emblem';
import { BackButton } from './parts';
import { useLevel } from './useLevel';

/**
 * Atelier de l'emblème : chaque couche se choisit parmi les pièces acquises ; les autres restent visibles,
 * grisées, avec ce qui les débloque. Purement cosmétique.
 */
export function AvatarScreen() {
  const level = useLevel();
  const profile = useProfile();
  const seenRaw = useMeta<unknown>(LEVEL_SEEN_KEY);
  const ready = level && profile !== undefined && seenRaw !== undefined;
  return (
    <Screen withTabBar={false}>
      <BackButton />
      <div className="flex flex-col gap-2">
        <h1 className="font-metal text-[40px] leading-none">Ton emblème</h1>
        <p className="text-[15px] leading-snug text-cendre">
          Compose-le avec les pièces gagnées. Les niveaux, les badges rares et ta spécialisation en débloquent d’autres. Il ne change aucun calcul.
        </p>
      </div>
      {ready ? (
        <Atelier
          level={level.progress.level}
          acquired={acquiredPieces(level, profile?.specialization, readSeen(seenRaw)?.pieces)}
          saved={readAvatar(profile?.avatar)}
          firstName={profile?.firstName ?? null}
          specialization={profile?.specialization ?? null}
          seenRaw={seenRaw}
        />
      ) : (
        <div className="h-[320px] animate-pulse rounded-[22px] bg-anthracite" aria-busy="true" aria-label="Chargement" />
      )}
    </Screen>
  );
}

function Atelier({
  level,
  acquired,
  saved,
  firstName,
  specialization,
  seenRaw,
}: {
  level: number;
  acquired: Set<string>;
  saved: AvatarConfig;
  firstName: string | null;
  specialization: Parameters<typeof Emblem>[0]['specialization'];
  seenRaw: unknown;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<AvatarConfig>(saved);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(saved), [saved]);
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const count = AVATAR_PIECES.filter((p) => acquired.has(p.id)).length;
  const preview = useMemo(() => ({ name: firstName, level, specialization }), [firstName, level, specialization]);

  const save = async () => {
    setBusy(true);
    try {
      await repos.profile.update({ avatar: draft });
      // Ce qui a été gagné reste acquis : on le note, même si le niveau baisse un jour.
      const seen = readSeen(seenRaw);
      if (seen) await repos.meta.set(LEVEL_SEEN_KEY, { ...seen, pieces: [...new Set([...(seen.pieces ?? []), ...acquired])] });
      toast.show('Emblème enregistré');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Enregistrement impossible. Réessaie.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section aria-label="Aperçu" className="flex flex-col items-center gap-3 rounded-[26px] bg-anthracite px-4 py-6">
        <Emblem config={draft} {...preview} size={168} />
        <p className="text-[13px] text-cendre tabular-nums">
          {count} pièces acquises sur {AVATAR_PIECES.length}
        </p>
      </section>

      <Field
        label="Initiales (deux lettres au plus)"
        value={draft.initiales}
        placeholder={emblemText(null, firstName)}
        maxLength={2}
        autoCapitalize="characters"
        onChange={(e) => setDraft({ ...draft, initiales: cleanInitials(e.target.value) })}
      />

      {AVATAR_LAYERS.map(({ layer, label }) => (
        <section key={layer} aria-label={label} className="flex flex-col gap-2">
          <h2 className="text-[17px] font-semibold">{label}</h2>
          <ul className="grid grid-cols-3 gap-2">
            {AVATAR_PIECES.filter((p) => p.layer === layer).map((p) => (
              <PieceOption key={p.id} piece={p} draft={draft} preview={preview} owned={acquired.has(p.id)} onPick={(next) => setDraft(next)} />
            ))}
          </ul>
          {layer === 'ornement' && !specialization && <p className="text-[12px] text-cendre">Le bandeau affiche ta spécialisation : choisis-la sur ta fiche joueur.</p>}
        </section>
      ))}

      {changed ? (
        <div className="sticky bottom-0 -mx-5 flex flex-col gap-2 bg-noir/95 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur">
          <Button disabled={busy} onClick={() => void save()}>
            Enregistrer l’emblème
          </Button>
          <Button variant="quiet" onClick={() => setDraft(saved)}>
            Annuler les changements
          </Button>
        </div>
      ) : (
        <div className="pb-4" />
      )}
    </>
  );
}

function PieceOption({
  piece,
  draft,
  preview,
  owned,
  onPick,
}: {
  piece: AvatarPiece;
  draft: AvatarConfig;
  preview: { name: string | null; level: number; specialization: Parameters<typeof Emblem>[0]['specialization'] };
  owned: boolean;
  onPick: (next: AvatarConfig) => void;
}) {
  const ornament = piece.layer === 'ornement';
  const key = piece.value === 'etoiles' ? 'etoiles' : 'bandeau';
  const selected = ornament ? draft[key] : (draft as unknown as Record<string, string>)[piece.layer] === piece.value;
  const pick = () => {
    if (!owned) return;
    if (ornament) onPick({ ...draft, [key]: !draft[key] });
    else onPick(withPiece(draft, piece));
  };
  const shown = ornament ? { ...withPiece(draft, piece) } : withPiece(draft, piece);
  return (
    <li>
      <button
        type="button"
        onClick={pick}
        disabled={!owned}
        aria-pressed={owned ? selected : undefined}
        aria-label={`${piece.name}${owned ? (selected ? ', choisi' : '') : `, verrouillé : ${unlockText(piece)}`}`}
        className={`relative flex h-full w-full flex-col items-center gap-1 rounded-[16px] px-1.5 py-2.5 text-center transition-colors ${
          selected ? 'bg-graphite ring-2 ring-module' : 'bg-anthracite'
        } ${owned ? 'active:opacity-80' : ''}`}
      >
        {!owned && (
          <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-graphite text-cendre" aria-hidden="true">
            <Icon name="lock" size={13} />
          </span>
        )}
        <span className={owned ? '' : 'opacity-40 grayscale'}>
          <Emblem config={shown} {...preview} size={60} />
        </span>
        <span className={`text-[13px] leading-tight font-semibold ${owned ? '' : 'text-cendre'}`}>{piece.name}</span>
        {!owned && <span className="text-[11px] leading-tight text-cendre">{unlockText(piece)}</span>}
        {owned && ornament && <span className="text-[11px] text-cendre">{selected ? 'Affiché' : 'Masqué'}</span>}
      </button>
    </li>
  );
}
