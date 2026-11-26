import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { repos, useMeta, useProfile, useToday } from '../../db/hooks';
import { BADGES } from '../../domain/level/badges';
import { acquiredPieces, AVATAR_LAYERS, readAvatar, withPiece } from '../../domain/level/avatar';
import { announcement, LEVEL_SEEN_KEY, readSeen, seenFrom, type Announcement } from '../../domain/level/history';
import type { LevelState } from '../../domain/level/level';
import { xpForLevel } from '../../domain/level/xp';
import { formatNumber } from '../../lib/format';
import { nowIso } from '../../lib/ids';
import { useReducedMotion } from '../../lib/motion';
import { haptic } from '../../services/haptics';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Emblem, UserEmblem } from './Emblem';
import { BadgeMedal } from './parts';
import { useLevel } from './useLevel';

const LAYER_NAMES = Object.fromEntries(AVATAR_LAYERS.map((l) => [l.layer, l.label])) as Record<string, string>;

/** Délai avant l'annonce : on laisse l'écran se poser, et on ne coupe jamais une fenêtre ouverte. */
const DELAY_MS = 1200;
const RETRY_MS = 4000;
/** Au-delà, les records restent dans l'historique : l'annonce garde l'essentiel. */
const MAX_RECORDS = 4;

/**
 * Annonce FORGE LEVEL : passage de niveau, badges débloqués et records récents, une seule fois chacun.
 * Monté par la coquille de l'app, jamais pendant une séance ou une pratique Mind.
 * À la toute première visite, l'état actuel est noté sans rien annoncer.
 */
export function LevelAnnouncer() {
  const level = useLevel();
  const seenRaw = useMeta<unknown>(LEVEL_SEEN_KEY);
  const profile = useProfile();
  const today = useToday();
  const [moment, setMoment] = useState<{ a: Announcement; state: LevelState; acquired: Set<string> } | null>(null);

  useEffect(() => {
    if (!level || seenRaw === undefined || profile === undefined || moment) return;
    const seen = readSeen(seenRaw);
    const acquired = acquiredPieces(level, profile?.specialization, seen?.pieces);
    if (!seen) {
      void repos.meta.set(LEVEL_SEEN_KEY, seenFrom(level, today, nowIso(), acquired));
      return;
    }
    // Première visite depuis l'avatar : les pièces déjà gagnées sont notées sans être annoncées.
    if (!seen.pieces) {
      void repos.meta.set(LEVEL_SEEN_KEY, { ...seen, pieces: [...acquired] });
      return;
    }
    const a = announcement(level, seen, today, acquired);
    if (!a) return;
    let timer = 0;
    const tryShow = () => {
      if (document.querySelector('dialog[open]')) timer = window.setTimeout(tryShow, RETRY_MS);
      else setMoment({ a, state: level, acquired });
    };
    timer = window.setTimeout(tryShow, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [level, seenRaw, profile, today, moment]);

  const close = () => {
    if (!moment) return;
    const seen = readSeen(seenRaw);
    const next = seenFrom(moment.state, today, nowIso(), new Set([...moment.acquired, ...(seen?.pieces ?? [])]));
    // Un niveau perdu (données supprimées) puis regagné n'est pas annoncé deux fois.
    void repos.meta.set(LEVEL_SEEN_KEY, { ...next, level: Math.max(next.level, seen?.level ?? 1) });
    setMoment(null);
  };
  return moment ? <LevelMomentDialog announcement={moment.a} state={moment.state} onClose={close} /> : null;
}

function LevelMomentDialog({ announcement: a, state, onClose }: { announcement: Announcement; state: LevelState; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const navigate = useNavigate();
  const profile = useProfile();
  const config = readAvatar(profile?.avatar);
  const reduce = useReducedMotion();
  const target = a.level?.to ?? state.progress.level;
  const [shown, setShown] = useState(reduce || !a.level ? target : a.level.from);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    document.documentElement.style.overflow = 'hidden';
    haptic(a.level || a.badges.some((b) => BADGES.find((d) => d.id === b.id)?.rarity === 'rare') ? 'success' : 'light');
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [a]);

  // Le chiffre du niveau monte de l'ancien au nouveau, un cran à la fois.
  useEffect(() => {
    if (reduce || !a.level || shown >= target) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === a.level.from ? 650 : 220);
    return () => window.clearTimeout(t);
  }, [shown, target, reduce, a.level]);
  const landed = shown >= target;

  const title = a.level
    ? `Niveau ${target}`
    : a.badges.length
      ? a.badges.length > 1
        ? `${a.badges.length} badges débloqués`
        : 'Badge débloqué'
      : a.records.length
        ? a.records.length > 1
          ? `${a.records.length} records`
          : 'Nouveau record'
        : a.pieces.length > 1
          ? 'Nouvelles pièces'
          : 'Nouvelle pièce';
  const records = a.records.slice(0, MAX_RECORDS).map((e) => {
    const r = state.model.records.find((x) => `record:${x.workoutId}:${x.exerciseId}` === e.key);
    return {
      key: e.key,
      label: e.label.replace(/^Record : /, ''),
      detail: r ? `${formatNumber(r.weightKg, r.weightKg % 1 ? 1 : 0)} kg × ${r.reps}, 1RM estimé ${formatNumber(r.e1rmKg, 0)} kg` : null,
    };
  });
  const p = state.progress;
  let i = 0;
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      data-module="progression"
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-y-auto bg-noir p-0 text-craie open:animate-fade-in"
    >
      <div className="mx-auto flex min-h-full max-w-[520px] flex-col gap-6 px-6 pt-[calc(env(safe-area-inset-top)+48px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative">
            <div
              className={`pointer-events-none absolute inset-[-28px] rounded-full ${landed && !reduce ? 'level-glow' : ''}`}
              style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--forge-module) 35%, transparent) 0%, transparent 65%)' }}
              aria-hidden="true"
            />
            <div className={reduce ? '' : 'motion-pop'}>
              <UserEmblem level={target} size={132} label={a.level ? String(shown) : undefined} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[13px] text-cendre">FORGE LEVEL</p>
            {/* Le titre prend le focus à l'ouverture : la fenêtre reste en haut, et le lecteur d'écran l'annonce. */}
            <h1 id={titleId} tabIndex={-1} autoFocus className={`font-metal text-[48px] leading-none outline-none ${landed && !reduce ? 'motion-impact' : ''}`}>
              {title}
            </h1>
            {a.level && (
              <p className="text-[15px] text-cendre">
                {a.level.to - a.level.from > 1 ? `Du niveau ${a.level.from} au niveau ${a.level.to}.` : `Tu passes du niveau ${a.level.from} au niveau ${a.level.to}.`}
              </p>
            )}
          </div>
          {p.next && (
            <div className="flex w-full flex-col gap-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-graphite" aria-hidden="true">
                <div className={`h-full rounded-full bg-module ${reduce ? '' : 'motion-grow-x'}`} style={{ width: `${Math.max(2, p.progress * 100)}%` }} />
              </div>
              <p className="text-[12px] text-cendre tabular-nums">
                {formatNumber(p.totalXp - xpForLevel(p.level), 0)} sur {formatNumber(p.next - xpForLevel(p.level), 0)} XP vers le niveau {p.level + 1}
              </p>
            </div>
          )}
        </div>

        {a.badges.length > 0 && (
          <section aria-label="Badges débloqués" className="flex flex-col gap-2">
            <h2 className="text-[13px] text-cendre">{a.badges.length > 1 ? 'Badges débloqués' : 'Badge débloqué'}</h2>
            <ul className="flex flex-col gap-2">
              {a.badges.map((b) => {
                const def = BADGES.find((d) => d.id === b.id);
                if (!def) return null;
                return (
                  <li key={b.id} className="motion-rise flex items-center gap-3 rounded-[18px] bg-anthracite p-3" style={{ ['--i' as string]: ++i }}>
                    <span className={reduce ? '' : 'motion-pop'} style={{ animationDelay: `${i * 90}ms` }}>
                      <BadgeMedal badge={def} unlocked size={48} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="text-[17px] leading-tight font-semibold">{def.name}</span>
                        {def.rarity === 'rare' && <span className="text-[11px] font-semibold text-citron">Rare</span>}
                      </span>
                      <span className="block text-[13px] leading-snug text-cendre">{b.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {records.length > 0 && (
          <section aria-label="Nouveaux records" className="flex flex-col gap-2">
            <h2 className="text-[13px] text-cendre">{records.length > 1 ? 'Nouveaux records' : 'Nouveau record'}</h2>
            <ul className="flex flex-col gap-2">
              {records.map((r) => (
                <li key={r.key} className="motion-rise flex items-center gap-3 rounded-[18px] bg-anthracite p-3" style={{ ['--i' as string]: ++i }}>
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-citron text-noir shadow-[0_0_16px_color-mix(in_oklab,var(--forge-accent)_45%,transparent)] ${reduce ? '' : 'motion-pop'}`}
                    style={{ animationDelay: `${i * 90}ms` }}
                    aria-hidden="true"
                  >
                    <Icon name="trophy" size={20} strokeWidth={2.2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] leading-tight font-semibold">{r.label}</span>
                    {r.detail && <span className="block text-[13px] text-cendre tabular-nums">{r.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {a.pieces.length > 0 && (
          <section aria-label="Nouvelles pièces d’emblème" className="flex flex-col gap-2">
            <h2 className="text-[13px] text-cendre">{a.pieces.length > 1 ? 'Nouvelles pièces d’emblème' : 'Nouvelle pièce d’emblème'}</h2>
            <ul className="grid grid-cols-3 gap-2">
              {a.pieces.map((piece) => (
                <li key={piece.id} className="motion-rise flex flex-col items-center gap-1.5 rounded-[18px] bg-anthracite p-3 text-center" style={{ ['--i' as string]: ++i }}>
                  <Emblem config={withPiece(config, piece)} name={profile?.firstName ?? null} level={target} size={56} specialization={profile?.specialization ?? null} />
                  <span className="text-[13px] leading-tight font-semibold">{piece.name}</span>
                  <span className="text-[11px] text-cendre">{LAYER_NAMES[piece.layer]}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/progression/joueur/embleme', { viewTransition: true });
              }}
              className="self-center text-[15px] font-semibold text-module"
            >
              Ouvrir l’atelier de l’emblème
            </button>
          </section>
        )}

        {a.records.length > MAX_RECORDS && (
          <p className="-mt-3 text-[13px] text-cendre">
            Et {a.records.length - MAX_RECORDS} autre{a.records.length - MAX_RECORDS > 1 ? 's' : ''}, dans l’historique de ta fiche joueur.
          </p>
        )}

        {a.xp > 0 && <p className="text-center text-[15px] text-module tabular-nums">+{formatNumber(a.xp, 0)} XP pour ces étapes</p>}

        <div className="mt-auto flex flex-col gap-2">
          <Button
            onClick={() => {
              onClose();
              navigate('/progression/joueur', { viewTransition: true });
            }}
          >
            Voir ma fiche joueur
          </Button>
          <Button variant="quiet" onClick={onClose}>
            Continuer
          </Button>
        </div>
      </div>
    </dialog>
  );
}
