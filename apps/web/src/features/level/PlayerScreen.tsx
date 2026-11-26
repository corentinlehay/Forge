import { useState } from 'react';
import { Link } from 'react-router';
import { repos, useProfile } from '../../db/hooks';
import type { Specialization } from '../../db/types';
import { BADGE_CATEGORY_LABELS, BADGES, type BadgeDef } from '../../domain/level/badges';
import { CHARACTERISTIC_LABELS, CHARACTERISTIC_TEXTS, CONFIDENCE_LABELS, type Characteristic } from '../../domain/level/characteristics';
import type { LevelState } from '../../domain/level/level';
import { LEVEL_SETTINGS } from '../../domain/level/settings';
import { XP_KIND_LABELS, type XpKind } from '../../domain/level/xp';
import { formatDayMonth, formatNumber } from '../../lib/format';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Sheet } from '../../ui/Sheet';
import { useToast } from '../../ui/Toast';
import { useHistoryBack } from '../mind/mindShared';
import { Emblem } from './Emblem';
import { useLevel } from './useLevel';

const xp = (n: number) => `${formatNumber(n, 0)} XP`;

/** Fiche joueur FORGE LEVEL : niveau et XP, six caractéristiques, badges, et d'où vient chaque point. */
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
  const totals = Object.entries(level.events.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.kind]: (acc[e.kind] ?? 0) + e.xp }), {})).sort((a, b) => b[1] - a[1]) as [
    XpKind,
    number,
  ][];

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

      <section aria-label="Caractéristiques" className="flex flex-col gap-2">
        <div>
          <h2 className="text-[17px] font-semibold">Caractéristiques</h2>
          <p className="text-[13px] leading-snug text-cendre">Notes sur 100 calculées sur 12 semaines : une convention FORGE, pas une mesure. Elles ne dépendent pas du niveau.</p>
        </div>
        {level.characteristics.map((c) => (
          <CharacteristicRow key={c.key} c={c} />
        ))}
      </section>

      <section aria-label="Badges" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] font-semibold">Badges</h2>
          <span className="text-[13px] text-cendre tabular-nums">
            {unlocked.size} sur {BADGES.length}
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {[...BADGES]
            .sort((a, b) => Number(unlocked.has(b.id)) - Number(unlocked.has(a.id)))
            .map((b) => (
              <BadgeTile key={b.id} badge={b} unlock={unlocked.get(b.id) ?? null} />
            ))}
        </ul>
      </section>

      <section aria-label="Dernière XP" className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold">Dernière XP</h2>
        {level.events.length ? (
          <ol className="flex flex-col">
            {level.events.slice(0, 12).map((e) => (
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
        {totals.length > 0 && (
          <div className="flex flex-col gap-1 rounded-[18px] bg-anthracite p-4">
            <h3 className="text-[13px] text-cendre">D’où vient ton XP</h3>
            {totals.map(([kind, n]) => (
              <p key={kind} className="flex justify-between text-[15px] tabular-nums">
                <span>{XP_KIND_LABELS[kind]}</span>
                <span>{xp(n)}</span>
              </p>
            ))}
          </div>
        )}
      </section>

      <Rules />

      <Link to="/progression/joueur/activites" viewTransition className="flex min-h-12 items-center justify-between gap-3 rounded-[14px] bg-anthracite px-4 active:opacity-80">
        <span className="flex items-center gap-2.5 text-[15px] font-semibold">
          <Icon name="calendar" size={20} className="text-module" />
          Journal d’activité, cardio et mobilité
        </span>
        <Icon name="chevron" size={16} className="text-cendre" />
      </Link>

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

const CONFIDENCE_STYLE = { faible: 'text-cendre', moyenne: 'text-craie', elevee: 'text-module' } as const;

function CharacteristicRow({ c }: { c: Characteristic }) {
  const label = CHARACTERISTIC_LABELS[c.key];
  const journal = c.key === 'endurance' || c.key === 'mobilite';
  return (
    <details className="group rounded-[18px] bg-anthracite px-4 py-3">
      <summary
        className="flex cursor-pointer list-none flex-col gap-2 [&::-webkit-details-marker]:hidden"
        aria-label={c.score === null ? `${label} : données insuffisantes` : `${label} : ${c.score} sur 100`}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold">{label}</span>
          {c.score === null ? (
            <span className="text-[13px] text-cendre">Données insuffisantes</span>
          ) : (
            <span className="flex items-baseline gap-1">
              <span className="font-metal text-[28px] leading-none tabular-nums">{c.score}</span>
              <span className="text-[12px] text-cendre">/100</span>
            </span>
          )}
        </span>
        {c.score !== null && (
          <span className="h-1.5 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
            <span className="block h-full rounded-full bg-module" style={{ width: `${c.score}%` }} />
          </span>
        )}
        <span className="flex items-start justify-between gap-3 text-[12px]">
          {c.score === null ? (
            <span className="leading-snug text-cendre">{c.missing}</span>
          ) : (
            <span className="flex min-w-0 flex-col gap-0.5 leading-snug">
              <span className={CONFIDENCE_STYLE[c.confidence!]}>{CONFIDENCE_LABELS[c.confidence!]}</span>
              {c.change && (
                <span className="text-cendre tabular-nums">
                  {c.change.delta === 0
                    ? 'Stable sur 4 semaines'
                    : `${c.change.delta > 0 ? '+' : ''}${c.change.delta} en 4 semaines, surtout : ${c.change.factor.toLocaleLowerCase('fr-FR')}`}
                </span>
              )}
            </span>
          )}
          <Icon name="chevron" size={14} className="mt-0.5 shrink-0 text-cendre transition-transform group-open:rotate-90" />
        </span>
      </summary>
      <div className="flex flex-col gap-2 pt-3">
        <p className="text-[13px] leading-snug text-cendre">{CHARACTERISTIC_TEXTS[c.key]}</p>
        {c.factors.map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <p className="flex justify-between gap-3 text-[13px]">
              <span>
                {f.label} <span className="text-cendre">({f.weight} %)</span>
              </span>
              <span className="text-cendre tabular-nums">{Math.round(f.value)}/100</span>
            </p>
            <p className="text-[12px] text-cendre">{f.detail}</p>
          </div>
        ))}
        {journal && (
          <Link to="/progression/joueur/activites" viewTransition className="self-start text-[13px] font-semibold text-module">
            Ouvrir le journal d’activité
          </Link>
        )}
      </div>
    </details>
  );
}

function BadgeTile({ badge, unlock }: { badge: BadgeDef; unlock: { date: string; detail: string } | null }) {
  const rare = badge.rarity === 'rare';
  return (
    <li
      className={`flex flex-col gap-1 rounded-[16px] p-3 ${unlock ? 'bg-anthracite' : 'bg-anthracite/50'}`}
      aria-label={`${badge.name}, ${rare ? 'rare' : 'commun'}, ${unlock ? `débloqué le ${formatDayMonth(unlock.date)}` : `à débloquer : ${badge.condition}`}`}
    >
      <span className="flex items-center justify-between gap-2">
        <Icon name="trophy" size={18} className={unlock ? (rare ? 'text-citron' : 'text-module') : 'text-cendre/50'} />
        <span className="text-[11px] text-cendre">{BADGE_CATEGORY_LABELS[badge.category]}</span>
      </span>
      <span className={`text-[15px] leading-tight font-semibold ${unlock ? '' : 'text-cendre'}`}>{badge.name}</span>
      <span className="text-[12px] leading-snug text-cendre">{unlock ? `${formatDayMonth(unlock.date)}, ${unlock.detail}` : badge.condition}</span>
      {rare && <span className="text-[11px] font-semibold text-citron">Rare</span>}
    </li>
  );
}

function Rules() {
  const X = LEVEL_SETTINGS.xp;
  const rows: [string, string][] = [
    [`Séance terminée, ${X.workout.minSets} séries ou plus`, `${X.workout.xp} XP, une par jour, ${X.workout.maxPerWeek} par semaine au plus`],
    ['Semaine du programme respectée', `${X.programWeek.xp} XP`],
    ['Record personnel', `${X.record.xp} XP, ${X.record.maxPerWorkout} par séance au plus`],
    ['Objectif de charge proposé atteint', `${X.loadTarget.xp} XP, ${X.loadTarget.maxPerWorkout} par séance au plus`],
    ['Pratique Mind terminée', `${X.mind.xp} XP par jour`],
    ['Cardio ou mobilité notés', `${X.activity.xp} XP par jour`],
    ['Objectif de protéines atteint', `${X.protein.xp} XP, ${X.protein.maxPerWeek} jours par semaine au plus`],
    ['Bilan de la semaine rempli', `${X.weekNote.xp} XP`],
    ['Badge débloqué', `${X.badge.commun} XP, ${X.badge.rare} s’il est rare`],
    ['Cycle terminé avec 80 % des séances', `${X.cycle.xp} XP`],
  ];
  return (
    <details className="group rounded-[18px] bg-anthracite px-4 py-3">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="text-[15px] font-semibold">Comment se gagne l’XP</span>
        <Icon name="chevron" size={14} className="text-cendre transition-transform group-open:rotate-90" />
      </summary>
      <div className="flex flex-col gap-2 pt-2">
        <dl className="flex flex-col gap-1.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex flex-col">
              <dt className="text-[13px]">{k}</dt>
              <dd className="text-[12px] text-cendre">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[12px] leading-snug text-cendre">
          Ni le volume ni la durée ne rapportent d’XP : pas de course au surentraînement. Une séance allégée par PULSE rapporte autant qu’une séance normale. Tout se recalcule à
          partir de tes données : supprimer une séance retire l’XP qu’elle avait rapportée.
        </p>
      </div>
    </details>
  );
}
