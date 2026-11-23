import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useAudioDownloads, useAudioStates, useMindSessions } from '../../db/hooks';
import type { AudioState } from '../../db/types';
import {
  AUDIO_FORMATS,
  clockText,
  durationText,
  FORMAT_LABELS,
  HYPNOSIS_PRECAUTIONS,
  HYPNOSIS_SOURCES,
  HYPNOSIS_THEMES,
  LEVEL_LABELS,
  resumePosition,
  sizeText,
  THEME_LABELS,
  themesOf,
  type AudioItem,
  type HypnosisTheme,
} from '../../domain/audio';
import { CATEGORY_INFO } from '../../domain/mind';
import type { MindCategory } from '../../data/mindExercises';
import { formatDayShort } from '../../lib/format';
import { downloadAudio, removeDownload, sourceFor, toggleAudioFavorite, useAudioCatalog } from '../../services/audioApi';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { useToast } from '../../ui/Toast';
import { MindBack } from '../mind/mindShared';
import { AudioCover } from './AudioCover';
import { useAudioPlayer, type PreparedSource } from './AudioPlayer';

/** Source prête avant le toucher (fichier téléchargé ou réseau) : sur iPhone, la lecture doit partir dans le geste. */
function usePreparedSource(item: AudioItem | undefined, downloadedVersion: string | undefined): PreparedSource | null {
  const [source, setSource] = useState<PreparedSource | null>(null);
  const player = useAudioPlayer();
  const playerItem = useRef<string | undefined>(undefined);
  playerItem.current = player.item?.id;
  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    let made: PreparedSource | null = null;
    void sourceFor(item).then((s) => {
      made = s;
      if (!cancelled) setSource(s);
    });
    return () => {
      cancelled = true;
      // L'adresse locale appartient au lecteur une fois la lecture lancée.
      if (made?.local && playerItem.current !== item.id) URL.revokeObjectURL(made.url);
    };
  }, [item, downloadedVersion]);
  return source;
}

/** Position de reprise connue pour une séance. */
const resumeOf = (item: AudioItem, state: AudioState | undefined) => (state ? resumePosition(state.position, state.durationSec || item.durationSec) : 0);

export function AudioRow({ item, state, downloaded }: { item: AudioItem; state?: AudioState; downloaded?: boolean }) {
  const resume = resumeOf(item, state);
  return (
    <li className="border-b border-anthracite last:border-b-0">
      <Link to={`/mind/audio/${item.id}`} viewTransition className="flex min-h-[72px] items-center gap-3 py-2.5">
        <AudioCover item={item} size={56} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[17px] leading-tight">
            <span className="truncate">{item.title}</span>
            {state?.favorite && <Icon name="star" size={14} className="shrink-0 fill-brume text-brume" aria-label="Favori" />}
          </span>
          <span className="block text-[13px] text-cendre">
            {FORMAT_LABELS[item.format]}, {durationText(item.durationSec)}
            {resume > 0 ? `, reprise à ${clockText(resume)}` : ''}
          </span>
          {item.author && <span className="block text-[12px] text-brume">Séance de {item.author}</span>}
        </span>
        {downloaded && <Icon name="down" size={16} className="shrink-0 text-cendre" aria-label="Disponible hors connexion" />}
        <Icon name="chevron" size={18} className="shrink-0 text-cendre" />
      </Link>
    </li>
  );
}

function Precautions() {
  return (
    <section aria-label="Précautions" className="flex flex-col gap-2 rounded-[18px] border border-graphite p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <Icon name="info" size={18} className="text-brume" />
        Avant d’écouter
      </h2>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-snug">
        {HYPNOSIS_PRECAUTIONS.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="text-[12px] leading-snug text-cendre">Repères : {HYPNOSIS_SOURCES}.</p>
    </section>
  );
}

function OfflineNote({ status }: { status: string }) {
  if (status === 'offline') return <p className="text-[13px] text-cendre">Hors connexion : liste de ta dernière visite, seules les séances téléchargées se lisent.</p>;
  if (status === 'error') return <p className="text-[13px] text-cendre">Liste non mise à jour : le serveur ne répond pas.</p>;
  return null;
}

type Filter = 'tout' | 'favoris' | 'telechargees' | (typeof AUDIO_FORMATS)[number];

/** Bibliothèque des séances audio. */
export function AudioLibraryScreen() {
  const { items, status } = useAudioCatalog();
  const states = useAudioStates();
  const downloads = useAudioDownloads();
  const [params, setParams] = useSearchParams();
  const asked = (params.get('filtre') ?? 'tout') as Filter;
  const formats = AUDIO_FORMATS.filter((f) => items.some((i) => i.format === f));
  const filter: Filter = asked === 'favoris' || asked === 'telechargees' || (formats as string[]).includes(asked) ? asked : 'tout';
  const list = items.filter((i) =>
    filter === 'tout'
      ? true
      : filter === 'favoris'
        ? states?.get(i.id)?.favorite
        : filter === 'telechargees'
          ? downloads?.get(i.id)?.version === i.file?.version
          : i.format === filter,
  );
  const resumable = useMemo(
    () =>
      items
        .filter((i) => resumeOf(i, states?.get(i.id)) > 0)
        .sort((a, b) => (states?.get(b.id)?.lastPlayedAt ?? '').localeCompare(states?.get(a.id)?.lastPlayedAt ?? ''))
        .slice(0, 2),
    [items, states],
  );
  const chips: { value: Filter; label: string }[] = [
    { value: 'tout', label: 'Tout' },
    { value: 'favoris', label: 'Favoris' },
    { value: 'telechargees', label: 'Hors connexion' },
    ...formats.map((f) => ({ value: f, label: FORMAT_LABELS[f] })),
  ];

  return (
    <Screen withTabBar={false}>
      <MindBack />
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[40px] leading-none">Séances audio</h1>
        <p className="text-[15px] text-cendre">Des séances enregistrées, à écouter au calme, avec ou sans connexion.</p>
      </div>
      <OfflineNote status={status} />
      {resumable.length > 0 && filter === 'tout' && (
        <section aria-label="Reprendre" className="flex flex-col">
          <h2 className="mb-1 text-[17px] font-semibold">Reprendre</h2>
          <ul>
            {resumable.map((i) => (
              <AudioRow key={i.id} item={i} state={states?.get(i.id)} downloaded={downloads?.get(i.id)?.version === i.file?.version} />
            ))}
          </ul>
        </section>
      )}
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtrer">
        {chips.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-pressed={filter === c.value}
            onClick={() => setParams(c.value === 'tout' ? {} : { filtre: c.value }, { replace: true })}
            className={`h-10 shrink-0 rounded-full px-3.5 text-[14px] whitespace-nowrap ${filter === c.value ? 'bg-brume font-semibold text-noir' : 'bg-graphite text-craie'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {status === 'loading' && items.length === 0 ? (
        <p className="text-[15px] text-cendre">Chargement…</p>
      ) : list.length === 0 ? (
        <p className="text-[15px] text-cendre">
          {filter === 'favoris'
            ? 'Touche l’étoile d’une séance pour la retrouver ici.'
            : filter === 'telechargees'
              ? 'Télécharge une séance depuis sa fiche pour l’écouter sans connexion.'
              : 'Aucune séance pour l’instant.'}
        </p>
      ) : (
        <ul>
          {list.map((i) => (
            <AudioRow key={i.id} item={i} state={states?.get(i.id)} downloaded={downloads?.get(i.id)?.version === i.file?.version} />
          ))}
        </ul>
      )}
    </Screen>
  );
}

/** Fiche d'une séance audio : présentation, écoute, reprise, favori, téléchargement. */
export function AudioDetailScreen() {
  const { id = '' } = useParams();
  const { items, status } = useAudioCatalog();
  const item = items.find((i) => i.id === id);
  const states = useAudioStates();
  const downloads = useAudioDownloads();
  const sessions = useMindSessions();
  const player = useAudioPlayer();
  const toast = useToast();
  const download = downloads?.get(id);
  const source = usePreparedSource(item, download?.version);
  const [progress, setProgress] = useState<number | null>(null);

  if (!item) {
    return (
      <Screen withTabBar={false}>
        <MindBack to="/mind/audio" label="Séances audio" />
        <p className="text-[15px] text-cendre">{status === 'loading' ? 'Chargement…' : 'Cette séance n’est pas (ou plus) disponible.'}</p>
      </Screen>
    );
  }
  const state = states?.get(item.id);
  const resume = resumeOf(item, state);
  const current = player.item?.id === item.id;
  const offlineReady = download?.version === item.file?.version;
  const listens = sessions?.filter((s) => s.ref === item.id) ?? [];
  const themes = themesOf(item);

  const start = (from: number) => {
    if (!source) return;
    if (current) {
      player.seekTo(from);
      if (!player.playing) player.toggle();
    } else player.play(item, source, from);
    player.expand(true);
  };

  const doDownload = async () => {
    setProgress(0);
    try {
      await downloadAudio(item, setProgress);
      toast.show('Séance disponible hors connexion');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Téléchargement impossible.');
    } finally {
      setProgress(null);
    }
  };

  return (
    <Screen withTabBar={false}>
      <div className="flex items-center justify-between">
        <MindBack to="/mind/audio" label="Séances audio" />
        <button
          type="button"
          onClick={() => void toggleAudioFavorite(item.id)}
          aria-pressed={Boolean(state?.favorite)}
          aria-label={state?.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className="flex h-11 w-11 items-center justify-center"
        >
          <Icon name="star" size={22} className={state?.favorite ? 'fill-brume text-brume' : 'text-cendre'} />
        </button>
      </div>
      <div className="mx-auto w-full max-w-[260px]">
        <AudioCover item={item} size="full" />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="self-start rounded-full bg-brume-voile px-2.5 py-1 text-[12px] text-brume">{item.author ? `Séance originale de ${item.author}` : 'Séance originale FORGE'}</p>
        <h1 className="font-metal text-[34px] leading-none">{item.title}</h1>
        <p className="text-[15px] text-cendre">
          {FORMAT_LABELS[item.format]}, {durationText(item.durationSec)}, {LEVEL_LABELS[item.level].toLocaleLowerCase('fr-FR')}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Button variant="calm" disabled={!source} onClick={() => start(resume)}>
          <Icon name="play" size={18} />
          {current && player.playing ? 'Ouvrir le lecteur' : resume > 0 ? `Reprendre à ${clockText(resume)}` : 'Écouter'}
        </Button>
        {resume > 0 && !current && (
          <Button variant="quiet" className="self-center" disabled={!source} onClick={() => start(0)}>
            Recommencer depuis le début
          </Button>
        )}
      </div>

      {item.format === 'hypnose' && <Precautions />}

      {item.description && <p className="text-[17px] leading-relaxed whitespace-pre-line">{item.description}</p>}
      <dl className="flex flex-col gap-2 rounded-[18px] bg-anthracite p-4 text-[15px]">
        {item.goal && (
          <div>
            <dt className="text-[13px] text-cendre">Objectif</dt>
            <dd>{item.goal}</dd>
          </div>
        )}
        <div>
          <dt className="text-[13px] text-cendre">Pour qui</dt>
          <dd>{item.audience || LEVEL_LABELS[item.level]}</dd>
        </div>
        {themes.length > 0 && (
          <div>
            <dt className="text-[13px] text-cendre">Thèmes</dt>
            <dd>{themes.map((t) => THEME_LABELS[t]).join(', ')}</dd>
          </div>
        )}
        {item.categories.length > 0 && (
          <div>
            <dt className="text-[13px] text-cendre">Catégories</dt>
            <dd>{item.categories.map((c) => CATEGORY_INFO[c as MindCategory]?.label ?? c).join(', ')}</dd>
          </div>
        )}
        {item.tags.length > 0 && (
          <div>
            <dt className="text-[13px] text-cendre">Mots-clés</dt>
            <dd>{item.tags.join(', ')}</dd>
          </div>
        )}
      </dl>

      <section aria-label="Hors connexion" className="flex items-center justify-between gap-3 rounded-[18px] border border-graphite p-4">
        <span className="min-w-0 text-[15px]">
          {offlineReady ? 'Disponible hors connexion' : progress !== null ? `Téléchargement… ${Math.round(progress * 100)} %` : 'Écouter sans connexion'}
          <span className="block text-[12px] text-cendre">{item.file ? sizeText(item.file.size) : ''} sur ton iPhone</span>
        </span>
        {offlineReady ? (
          <Button size="small" variant="secondary" onClick={() => void removeDownload(item.id).then(() => toast.show('Téléchargement supprimé'))}>
            Supprimer
          </Button>
        ) : (
          <Button size="small" variant="secondary" disabled={progress !== null} onClick={() => void doDownload()}>
            Télécharger
          </Button>
        )}
      </section>

      {listens.length > 0 && (
        <p className="text-[13px] text-cendre">
          Écoutée {listens.length} fois, dernière écoute {formatDayShort(listens[0]!.date).toLocaleLowerCase('fr-FR')}.
        </p>
      )}
    </Screen>
  );
}

/** Catégorie Hypnose : précautions, thèmes et séances. */
export function HypnosisScreen() {
  const { items, status } = useAudioCatalog();
  const states = useAudioStates();
  const downloads = useAudioDownloads();
  const [params, setParams] = useSearchParams();
  const hypnosis = items.filter((i) => i.format === 'hypnose');
  const themes = HYPNOSIS_THEMES.filter((t) => hypnosis.some((i) => i.themes.includes(t)));
  const asked = params.get('theme');
  const theme = asked && (themes as string[]).includes(asked) ? (asked as HypnosisTheme) : null;
  const list = theme ? hypnosis.filter((i) => i.themes.includes(theme)) : hypnosis;

  return (
    <Screen withTabBar={false}>
      <MindBack />
      <div className="flex flex-col gap-1">
        <h1 className="font-metal text-[40px] leading-none">Hypnose</h1>
        <p className="text-[15px] leading-snug text-cendre">Des séances guidées pour te détendre, prendre du recul ou te préparer. Tu choisis librement ce que tu écoutes.</p>
      </div>
      <OfflineNote status={status} />
      <Precautions />
      {themes.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Thèmes">
          <button
            type="button"
            aria-pressed={!theme}
            onClick={() => setParams({}, { replace: true })}
            className={`h-10 rounded-full px-3.5 text-[14px] ${!theme ? 'bg-brume font-semibold text-noir' : 'bg-graphite text-craie'}`}
          >
            Tous
          </button>
          {themes.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={theme === t}
              onClick={() => setParams({ theme: t }, { replace: true })}
              className={`h-10 rounded-full px-3.5 text-[14px] ${theme === t ? 'bg-brume font-semibold text-noir' : 'bg-graphite text-craie'}`}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-[15px] text-cendre">{status === 'loading' ? 'Chargement…' : 'Aucune séance d’hypnose pour l’instant.'}</p>
      ) : (
        <ul>
          {list.map((i) => (
            <AudioRow key={i.id} item={i} state={states?.get(i.id)} downloaded={downloads?.get(i.id)?.version === i.file?.version} />
          ))}
        </ul>
      )}
    </Screen>
  );
}

/** Raccourcis audio pour les écrans Mind (accueil, sommeil, catégories) ; rien tant qu'aucune séance n'existe. */
export function AudioShelf({ title, items, more }: { title: string; items: AudioItem[]; more?: string }) {
  const states = useAudioStates();
  const downloads = useAudioDownloads();
  if (items.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {more && (
          <Link to={more} viewTransition className="flex min-h-11 items-center px-1 text-[15px] text-brume">
            Tout voir
          </Link>
        )}
      </div>
      <ul>
        {items.map((i) => (
          <AudioRow key={i.id} item={i} state={states?.get(i.id)} downloaded={downloads?.get(i.id)?.version === i.file?.version} />
        ))}
      </ul>
    </section>
  );
}
