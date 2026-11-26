import { useState } from 'react';
import { Link } from 'react-router';
import { repos, useProfile } from '../../db/hooks';
import type { Specialization } from '../../db/types';
import { BADGES } from '../../domain/level/badges';
import { CHARACTERISTIC_LABELS } from '../../domain/level/characteristics';
import type { LevelState } from '../../domain/level/level';
import { formatDayMonth, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { useHistoryBack } from '../mind/mindShared';
import { Emblem } from './Emblem';
import { BadgeMedal, NavRow } from './parts';
import { Radar } from './Radar';
import { useLevel } from './useLevel';

const xp = (n: number) => `${formatNumber(n, 0)} XP`;

/** Fiche joueur FORGE LEVEL : niveau et XP, l'hexagone des caractéristiques, l'accès aux badges, à l'XP et à l'historique. */
export function PlayerScreen() {
  const level = useLevel();
  const profile = useProfile();
  const back = useHistoryBack('/progression');
  return (
    <Screen withTabBar={false}>
      <button type="button" onClick={back} className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
        <Icon name="back" size={20} />
        Retour
      </button>
      {!level || profile === undefined ? (
        <div className="h-[220px] animate-pulse rounded-[22px] bg-anthracite" aria-busy="true" aria-label="Chargement" />
      ) : (
        <Player level={level} firstName={profile?.firstName ?? null} specialization={profile?.specialization ?? null} />
      )}
    </Screen>
  );
}

function Player({ level, firstName, specialization }: { level: LevelState; firstName: string | null; specialization: Specialization | null }) {
  const { progress } = level;
  const [choosing, setChoosing] = useState(false);
  const toast = useToast();
  const chosen = specialization && level.specializations.some((s) => s.id === specialization) ? specialization : null;
  const choose = async (s: Specialization | null) => {
    try {
      await repos.profile.update({ specialization: s });
      setChoosing(false);
      toast.show(s ? `Spécialisation : ${s}` : 'Spécialisation retirée');
    } catch {
      toast.show('Enregistrement impossible. Réessaie.');
    }
  };
  const unlocked = new Map(level.unlocks.map((u) => [u.id, u]));

  return (
    <>
      <section aria-label="Carte joueur" className="relative flex flex-col gap-4 overflow-hidden rounded-[26px] bg-anthracite p-5">
        <div className="flex items-center gap-4">
          <Emblem name={firstName} level={progress.level} size={84} />
          <div className="min-w-0 flex-1">
            {firstName && <p className="truncate text-[20px] leading-tight font-semibold">{firstName}</p>}
            <button type="button" onClick={() => setChoosing(true)} className="-ml-1 flex min-h-9 items-center gap-1 px-1 text-[13px] font-semibold text-module">
              {chosen ? <span className="tracking-[0.08em]">{chosen}</span> : 'Choisir une spécialisation'}
              <Icon name="chevron" size={14} className="shrink-0" />
            </button>
          </div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <p className="flex items-baseline gap-2">
            <span className="text-[15px] text-cendre">Niveau</span>
            <span className="font-metal text-[64px] leading-[0.85] tabular-nums">{progress.level}</span>
          </p>
          <p className="pb-1 text-right text-[13px] leading-snug text-cendre tabular-nums">
            {xp(progress.totalXp)}
            <br />
            {progress.next ? `encore ${xp(progress.next - progress.totalXp)} pour le niveau ${progress.level + 1}` : 'niveau maximal'}
          </p>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-graphite"
          role="progressbar"
          aria-label={`Progression vers le niveau ${progress.level + 1}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress.progress * 100)}
        >
          <div className="h-full rounded-full bg-module" style={{ width: `${Math.max(2, progress.progress * 100)}%` }} />
        </div>
      </section>

      <Link
        to="/progression/joueur/caracteristiques"
        viewTransition
        aria-label="Ouvrir les caractéristiques"
        className="flex flex-col gap-1 rounded-[22px] bg-anthracite px-2 pt-4 pb-3 active:opacity-90"
      >
        <span className="flex items-center justify-between px-3">
          <span className="text-[17px] font-semibold">Caractéristiques</span>
          <Icon name="chevron" size={16} className="text-cendre" />
        </span>
        <Radar items={level.characteristics} size={280} />
        <span className="px-3 text-center text-[12px] text-cendre">Notes sur 12 semaines. « – » : pas encore assez de données.</span>
      </Link>

      <nav aria-label="FORGE LEVEL" className="flex flex-col gap-2">
        <NavRow to="/progression/joueur/xp" icon="bolt" title="Progression XP" aside={xp(progress.totalXp)} />
        <NavRow to="/progression/joueur/badges" icon="trophy" title="Badges" aside={`${unlocked.size} sur ${BADGES.length}`} />
        <NavRow to="/progression/joueur/historique" icon="clock" title="Historique" />
        <NavRow to="/progression/joueur/activites" icon="calendar" title="Journal d’activité" aside="Cardio, mobilité" />
      </nav>

      {level.unlocks.length > 0 && (
        <section aria-label="Derniers badges" className="flex gap-3 overflow-x-auto pb-1">
          {level.unlocks.slice(0, 6).map((u) => {
            const def = BADGES.find((b) => b.id === u.id)!;
            return (
              <Link key={u.id} to="/progression/joueur/badges" viewTransition className="flex w-[88px] shrink-0 flex-col items-center gap-1.5 text-center">
                <BadgeMedal badge={def} unlocked size={52} />
                <span className="line-clamp-2 text-[12px] leading-tight">{def.name}</span>
              </Link>
            );
          })}
        </section>
      )}

      <section aria-label="Dernière XP" className="flex flex-col gap-2 pb-4">
        <h2 className="text-[17px] font-semibold">Dernière XP</h2>
        {level.events.length ? (
          <ol className="flex flex-col">
            {level.events.slice(0, 6).map((e) => (
              <li key={e.key} className="flex items-center gap-3 border-b border-graphite py-2.5 last:border-b-0">
                <span className="w-14 shrink-0 text-[13px] text-cendre tabular-nums">{formatDayMonth(e.date)}</span>
                <span className="min-w-0 flex-1 text-[15px] leading-tight">{e.label}</span>
                <span className="shrink-0 text-[15px] font-semibold text-module tabular-nums">+{e.xp}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[15px] text-cendre">Termine une séance pour gagner tes premiers points.</p>
        )}
      </section>

      <Sheet open={choosing} title="Spécialisation" onClose={() => setChoosing(false)}>
        <div className="flex flex-col gap-2 pb-2">
          <p className="text-[15px] leading-snug text-cendre">Un titre pour ta carte. Il ne change aucun calcul.</p>
          {level.specializations.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => void choose(s.id)}
              aria-pressed={chosen === s.id}
              className={`flex min-h-14 items-center justify-between gap-3 rounded-[16px] px-4 py-2 text-left ${chosen === s.id ? 'bg-graphite ring-2 ring-module' : 'bg-graphite'}`}
            >
              <span>
                <span className="block text-[15px] font-semibold tracking-[0.08em]">{s.id}</span>
                <span className="block text-[13px] text-cendre">
                  {s.text}, {CHARACTERISTIC_LABELS[s.characteristic].toLocaleLowerCase('fr-FR')}
                </span>
              </span>
              {level.suggested === s.id && <span className="shrink-0 text-[12px] text-module">Ta meilleure note</span>}
            </button>
          ))}
          {level.specializations.length < 6 && <p className="text-[13px] leading-snug text-cendre">ENGINE et MOBILITY arrivent quand Endurance et Mobilité ont une note.</p>}
          {chosen && (
            <Button variant="quiet" onClick={() => void choose(null)}>
              Retirer la spécialisation
            </Button>
          )}
        </div>
      </Sheet>
    </>
  );
}
