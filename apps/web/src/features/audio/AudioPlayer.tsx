import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { repos } from '../../db/hooks';
import { clockText, coverUrl, FORMAT_LABELS, isFinished, MIN_LISTEN_SEC, SLEEP_TIMER_MINUTES, type AudioItem } from '../../domain/audio';
import { toLocalDateKey } from '../../lib/dates';
import { saveAudioState } from '../../services/audioApi';
import { Icon } from '../../ui/Icon';
import { AudioCover } from './AudioCover';

/**
 * Lecteur audio de FORGE MIND : un seul élément <audio> pour toute l'app, qui continue de jouer
 * quand on change d'écran. Mini-lecteur en bas, lecteur complet en plein écran.
 * Sur iPhone, la lecture démarre dans le geste de l'utilisateur : la source est préparée avant le toucher.
 */

export interface PreparedSource {
  url: string;
  local: boolean;
}

interface PlayerState {
  item: AudioItem | null;
  playing: boolean;
  position: number;
  duration: number;
  waiting: boolean;
  error: string | null;
  local: boolean;
  sleepEndsAt: number | null;
  expanded: boolean;
  /** null : volume réglé par les boutons du téléphone (iPhone). */
  volume: number | null;
}

interface PlayerApi extends PlayerState {
  play: (item: AudioItem, source: PreparedSource, startAt: number) => void;
  toggle: () => void;
  seekBy: (seconds: number) => void;
  seekTo: (seconds: number) => void;
  setSleep: (minutes: number | null) => void;
  setVolume: (v: number) => void;
  expand: (open: boolean) => void;
  close: () => void;
}

const Ctx = createContext<PlayerApi | null>(null);

export function useAudioPlayer(): PlayerApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useAudioPlayer doit être utilisé sous <AudioPlayerProvider>.');
  return api;
}

/** Le volume se règle-t-il depuis la page ? Non sur iPhone, où il dépend des boutons de l'appareil. */
function volumeAdjustable(): boolean {
  try {
    const a = new Audio();
    a.volume = 0.5;
    return Math.abs(a.volume - 0.5) < 0.01;
  } catch {
    return false;
  }
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const SAVE_EVERY_MS = 5000;
const FADE_SEC = 10;

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>(() => ({
    item: null,
    playing: false,
    position: 0,
    duration: 0,
    waiting: false,
    error: null,
    local: false,
    sleepEndsAt: null,
    expanded: false,
    volume: volumeAdjustable() ? 1 : null,
  }));
  const itemRef = useRef<AudioItem | null>(null);
  const blobUrl = useRef<string | null>(null);
  const lastSave = useRef(0);
  const listen = useRef<{ seconds: number; lastTime: number; recordId: string | null; startedAt: Date }>({ seconds: 0, lastTime: 0, recordId: null, startedAt: new Date() });
  const sleepRef = useRef<number | null>(null);
  const userVolume = useRef(1);

  const audio = () => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'auto';
      audioRef.current = a;
    }
    return audioRef.current;
  };

  /** Position et historique d'écoute, enregistrés sans bloquer la lecture. */
  const persist = useCallback(async (final = false) => {
    const a = audioRef.current;
    const item = itemRef.current;
    if (!a || !item) return;
    const duration = Number.isFinite(a.duration) ? a.duration : item.durationSec;
    await saveAudioState(item.id, { position: a.currentTime, durationSec: duration, lastPlayedAt: new Date().toISOString() }).catch(() => {});
    const l = listen.current;
    if (l.seconds < MIN_LISTEN_SEC) return;
    const completed = isFinished(a.currentTime, duration) || (final && a.ended);
    const fields = { durationSec: Math.round(l.seconds), completed };
    try {
      if (l.recordId) await repos.mindSessions.update(l.recordId, fields);
      else {
        const rec = await repos.mindSessions.add({
          date: toLocalDateKey(l.startedAt),
          time: hhmm(l.startedAt),
          kind: 'audio',
          ref: item.id,
          title: item.title.slice(0, 120),
          ...fields,
        });
        l.recordId = rec.id;
      }
    } catch {
      /* l'historique est secondaire : la lecture continue */
    }
  }, []);

  // Événements de l'élément audio.
  useEffect(() => {
    const a = audio();
    const sync = () =>
      setState((s) => ({ ...s, playing: !a.paused, position: a.currentTime, duration: Number.isFinite(a.duration) ? a.duration : (itemRef.current?.durationSec ?? 0) }));
    const onTime = () => {
      const l = listen.current;
      const delta = a.currentTime - l.lastTime;
      if (!a.paused && delta > 0 && delta < 3) l.seconds += delta;
      l.lastTime = a.currentTime;
      sync();
      if (Date.now() - lastSave.current > SAVE_EVERY_MS) {
        lastSave.current = Date.now();
        void persist();
      }
      // Minuteur d'arrêt : fondu sur les dernières secondes quand le volume se règle, puis pause.
      const ends = sleepRef.current;
      if (ends) {
        const left = (ends - Date.now()) / 1000;
        if (left <= 0) {
          a.pause();
          a.volume = userVolume.current;
          sleepRef.current = null;
          setState((s) => ({ ...s, sleepEndsAt: null }));
        } else if (left < FADE_SEC && volumeAdjustable()) a.volume = userVolume.current * (left / FADE_SEC);
      }
    };
    const onPause = () => {
      sync();
      void persist();
    };
    const onEnded = () => {
      sync();
      void persist(true);
    };
    const onWaiting = () => setState((s) => ({ ...s, waiting: true }));
    const onPlaying = () => setState((s) => ({ ...s, waiting: false, error: null }));
    const onError = () =>
      setState((s) => ({
        ...s,
        playing: false,
        waiting: false,
        error: navigator.onLine ? 'Lecture impossible pour le moment. Réessaie.' : 'Pas de connexion : télécharge la séance pour l’écouter hors ligne.',
      }));
    const onHide = () => document.visibilityState === 'hidden' && void persist();
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('play', sync);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    a.addEventListener('loadedmetadata', sync);
    a.addEventListener('waiting', onWaiting);
    a.addEventListener('playing', onPlaying);
    a.addEventListener('error', onError);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('play', sync);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('loadedmetadata', sync);
      a.removeEventListener('waiting', onWaiting);
      a.removeEventListener('playing', onPlaying);
      a.removeEventListener('error', onError);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [persist]);

  // Minuteur d'arrêt : vérifié aussi chaque seconde (si la lecture est en pause, rien à faire).
  useEffect(() => {
    if (!state.sleepEndsAt) return;
    const id = window.setInterval(() => {
      const a = audioRef.current;
      if (a && sleepRef.current && Date.now() >= sleepRef.current) {
        a.pause();
        a.volume = userVolume.current;
        sleepRef.current = null;
        setState((s) => ({ ...s, sleepEndsAt: null }));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.sleepEndsAt]);

  const play = useCallback(
    (item: AudioItem, source: PreparedSource, startAt: number) => {
      const a = audio();
      if (itemRef.current?.id === item.id && a.src) {
        void a.play().catch(() => {});
        return;
      }
      if (itemRef.current) void persist();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = source.local ? source.url : null;
      itemRef.current = item;
      listen.current = { seconds: 0, lastTime: startAt, recordId: null, startedAt: new Date() };
      a.src = source.url;
      if (startAt > 0) {
        const seek = () => {
          a.currentTime = startAt;
          a.removeEventListener('loadedmetadata', seek);
        };
        a.addEventListener('loadedmetadata', seek);
      }
      void a.play().catch(() => setState((s) => ({ ...s, playing: false })));
      setState((s) => ({ ...s, item, local: source.local, position: startAt, duration: item.durationSec, error: null, waiting: true }));
    },
    [persist],
  );

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !itemRef.current) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  }, []);

  const seekTo = useCallback((sec: number) => {
    const a = audioRef.current;
    if (!a) return;
    const max = Number.isFinite(a.duration) ? a.duration : (itemRef.current?.durationSec ?? 0);
    a.currentTime = Math.max(0, Math.min(max, sec));
    listen.current.lastTime = a.currentTime;
    setState((s) => ({ ...s, position: a.currentTime }));
  }, []);
  const seekBy = useCallback((d: number) => seekTo((audioRef.current?.currentTime ?? 0) + d), [seekTo]);

  const setSleep = useCallback((minutes: number | null) => {
    const ends = minutes ? Date.now() + minutes * 60000 : null;
    sleepRef.current = ends;
    if (audioRef.current) audioRef.current.volume = userVolume.current;
    setState((s) => ({ ...s, sleepEndsAt: ends }));
  }, []);

  const setVolume = useCallback((v: number) => {
    userVolume.current = v;
    if (audioRef.current) audioRef.current.volume = v;
    setState((s) => (s.volume === null ? s : { ...s, volume: v }));
  }, []);

  const close = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      void persist(true);
      a.removeAttribute('src');
      a.load();
    }
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = null;
    itemRef.current = null;
    sleepRef.current = null;
    setState((s) => ({ ...s, item: null, playing: false, position: 0, duration: 0, sleepEndsAt: null, expanded: false, error: null, waiting: false }));
  }, [persist]);

  const expand = useCallback((open: boolean) => setState((s) => ({ ...s, expanded: open })), []);

  // Écran de verrouillage et Centre de contrôle (Media Session).
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms) return;
    const item = state.item;
    if (!item) {
      ms.metadata = null;
      return;
    }
    const cover = coverUrl(item);
    try {
      ms.metadata = new MediaMetadata({
        title: item.title,
        artist: item.author || 'FORGE MIND',
        album: `FORGE MIND, ${FORMAT_LABELS[item.format]}`,
        artwork: cover ? [{ src: cover, sizes: '800x800', type: item.cover?.mime ?? 'image/jpeg' }] : [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
      });
      ms.setActionHandler('play', () => void audioRef.current?.play());
      ms.setActionHandler('pause', () => audioRef.current?.pause());
      ms.setActionHandler('seekbackward', () => seekBy(-15));
      ms.setActionHandler('seekforward', () => seekBy(15));
      ms.setActionHandler('seekto', (d) => d.seekTime !== undefined && seekTo(d.seekTime));
    } catch {
      /* Media Session partielle : les commandes de l'écran restent disponibles */
    }
  }, [state.item, seekBy, seekTo]);

  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms || !state.item || !state.duration) return;
    try {
      ms.setPositionState({ duration: state.duration, position: Math.min(state.position, state.duration), playbackRate: 1 });
      ms.playbackState = state.playing ? 'playing' : 'paused';
    } catch {
      /* ignoré */
    }
  }, [state.item, state.duration, state.position, state.playing]);

  const api = useMemo<PlayerApi>(
    () => ({ ...state, play, toggle, seekBy, seekTo, setSleep, setVolume, expand, close }),
    [state, play, toggle, seekBy, seekTo, setSleep, setVolume, expand, close],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {state.item && state.expanded && <FullPlayer />}
    </Ctx.Provider>
  );
}

function PlayPauseIcon({ playing, size = 26 }: { playing: boolean; size?: number }) {
  return playing ? (
    <span className="flex gap-[5px]" aria-hidden="true">
      <span className="rounded-sm bg-current" style={{ width: size / 4.5, height: size * 0.8 }} />
      <span className="rounded-sm bg-current" style={{ width: size / 4.5, height: size * 0.8 }} />
    </span>
  ) : (
    <Icon name="play" size={size} />
  );
}

function SkipButton({ seconds, onClick }: { seconds: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={seconds < 0 ? 'Reculer de 15 secondes' : 'Avancer de 15 secondes'}
      className="relative flex h-14 w-14 items-center justify-center rounded-full text-craie active:scale-95"
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
        style={seconds > 0 ? { transform: 'scaleX(-1)' } : undefined}
      >
        <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v3.5H8" />
      </svg>
      <span className="absolute text-[11px] font-semibold tabular-nums">15</span>
    </button>
  );
}

/** Mini-lecteur au-dessus de la barre d'onglets (ou en bas de l'écran sans barre). */
export function MiniPlayer({ withTabBar }: { withTabBar: boolean }) {
  const p = useAudioPlayer();
  const visible = Boolean(p.item) && !p.expanded;
  useEffect(() => {
    document.documentElement.style.setProperty('--player-offset', visible ? '76px' : '0px');
    return () => document.documentElement.style.setProperty('--player-offset', '0px');
  }, [visible]);
  if (!p.item || p.expanded) return null;
  const progress = p.duration ? p.position / p.duration : 0;
  return (
    <div
      className="fixed inset-x-0 z-20 mx-auto w-full max-w-[560px] px-3 lg:pl-24"
      style={{ bottom: withTabBar ? 'calc(60px + max(env(safe-area-inset-bottom), 10px))' : 'calc(max(env(safe-area-inset-bottom), 10px) + 6px)' }}
    >
      <div className="relative flex items-center gap-3 overflow-hidden rounded-[18px] bg-brume-voile/95 p-2 pr-2.5 shadow-[0_8px_24px_rgb(0_0_0/0.5)] outline-1 outline-brume/25 backdrop-blur">
        <button type="button" onClick={() => p.expand(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Ouvrir le lecteur : ${p.item.title}`}>
          <AudioCover item={p.item} size={44} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold">{p.item.title}</span>
            <span className="block truncate text-[12px] text-cendre">
              {p.error ?? (p.waiting && p.playing ? 'Chargement…' : `${clockText(p.position)} / ${clockText(p.duration)}`)}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={p.toggle}
          aria-label={p.playing ? 'Pause' : 'Lecture'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brume text-noir"
        >
          <PlayPauseIcon playing={p.playing} size={20} />
        </button>
        <button type="button" onClick={p.close} aria-label="Fermer le lecteur" className="flex h-11 w-9 shrink-0 items-center justify-center text-cendre">
          <Icon name="close" size={18} />
        </button>
        <span className="absolute inset-x-0 bottom-0 h-[2px] bg-brume/20" aria-hidden="true">
          <span className="block h-full w-full origin-left bg-brume transition-transform duration-[250ms] ease-linear" style={{ scale: `${progress} 1` }} />
        </span>
      </div>
    </div>
  );
}

function FullPlayer() {
  const p = useAudioPlayer();
  const [timerOpen, setTimerOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!p.sleepEndsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [p.sleepEndsAt]);
  if (!p.item) return null;
  const item = p.item;
  const max = p.duration || item.durationSec || 1;
  const sleepLeft = p.sleepEndsAt ? Math.max(0, (p.sleepEndsAt - now) / 1000) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--forge-mind)_22%,var(--forge-bg)),var(--forge-bg)_75%)]"
      role="dialog"
      aria-label={`Lecteur : ${item.title}`}
    >
      <div className="pt-safe pb-safe mx-auto flex min-h-full w-full max-w-[480px] flex-1 flex-col gap-5 px-6">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => p.expand(false)} aria-label="Réduire le lecteur" className="-ml-2 flex h-11 w-11 items-center justify-center text-cendre">
            <Icon name="down" size={24} />
          </button>
          <span className="text-[13px] text-cendre">{p.local ? 'Lecture hors connexion' : FORMAT_LABELS[item.format]}</span>
          <button type="button" onClick={p.close} aria-label="Arrêter et fermer" className="-mr-2 flex h-11 w-11 items-center justify-center text-cendre">
            <Icon name="close" size={22} />
          </button>
        </div>
        <div className="mx-auto mt-2 w-full max-w-[320px]">
          <AudioCover item={item} size="full" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="font-metal text-[30px] leading-tight">{item.title}</h2>
          {item.author && <p className="text-[15px] text-brume">Séance de {item.author}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(max))}
            step={1}
            value={Math.floor(Math.min(p.position, max))}
            onChange={(e) => p.seekTo(Number(e.target.value))}
            aria-label="Position dans la séance"
            aria-valuetext={`${clockText(p.position)} sur ${clockText(max)}`}
            className="h-8 w-full accent-[var(--forge-mind)]"
          />
          <div className="flex justify-between text-[12px] text-cendre tabular-nums">
            <span>{clockText(p.position)}</span>
            <span>−{clockText(Math.max(0, max - p.position))}</span>
          </div>
        </div>
        {p.error && (
          <p className="text-center text-[15px] text-braise" role="alert">
            {p.error}
          </p>
        )}
        <div className="flex items-center justify-center gap-6">
          <SkipButton seconds={-15} onClick={() => p.seekBy(-15)} />
          <button
            type="button"
            onClick={p.toggle}
            aria-label={p.playing ? 'Pause' : 'Lecture'}
            className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-craie text-noir active:scale-95"
          >
            <PlayPauseIcon playing={p.playing} size={30} />
          </button>
          <SkipButton seconds={15} onClick={() => p.seekBy(15)} />
        </div>
        {p.volume !== null && (
          <label className="flex items-center gap-3 text-[13px] text-cendre">
            Volume
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={p.volume}
              onChange={(e) => p.setVolume(Number(e.target.value))}
              className="h-8 flex-1 accent-[var(--forge-mind)]"
            />
          </label>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setTimerOpen((o) => !o)}
            aria-expanded={timerOpen}
            className="flex min-h-11 items-center justify-center gap-2 text-[15px] text-craie"
          >
            <Icon name="moon" size={18} className="text-brume" />
            {sleepLeft !== null ? `Arrêt dans ${clockText(sleepLeft)}` : 'Minuteur d’arrêt'}
          </button>
          {timerOpen && (
            <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Minuteur d’arrêt">
              {SLEEP_TIMER_MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    p.setSleep(m);
                    setTimerOpen(false);
                  }}
                  className="h-10 rounded-full bg-graphite px-3.5 text-[14px]"
                >
                  {m} min
                </button>
              ))}
              {p.sleepEndsAt && (
                <button
                  type="button"
                  onClick={() => {
                    p.setSleep(null);
                    setTimerOpen(false);
                  }}
                  className="h-10 rounded-full border border-graphite px-3.5 text-[14px] text-cendre"
                >
                  Annuler
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
