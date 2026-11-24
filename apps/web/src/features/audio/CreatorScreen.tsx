import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CATEGORY_INFO, CATEGORY_ORDER } from '../../domain/mind';
import type { MindCategory } from '../../data/mindExercises';
import { AUDIO_FORMATS, AUDIO_LEVELS, durationText, FORMAT_LABELS, HYPNOSIS_THEMES, LEVEL_LABELS, sizeText, THEME_LABELS, type AudioItem } from '../../domain/audio';
import {
  AdminError,
  adminCreate,
  adminDelete,
  adminDeleteCover,
  adminList,
  adminReorder,
  adminUpdate,
  adminUploadCover,
  adminUploadFile,
  checkAdminCode,
  getAdminCode,
  patchCatalog,
  prepareCover,
  readAudioDuration,
  refreshCatalog,
  setAdminCode,
  type AudioMeta,
} from '../../services/audioApi';
import { Button } from '../../ui/Button';
import { Chips } from '../../ui/Chips';
import { Field } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Screen } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { SelectField } from '../../ui/SelectField';
import { TextArea } from '../../ui/TextArea';
import { useToast } from '../../ui/Toast';
import { AudioCover } from './AudioCover';
import { useAudioPlayer } from './AudioPlayer';

const AUTHOR_KEY = 'forge.creatorAuthor';
const lastAuthor = () => {
  try {
    return localStorage.getItem(AUTHOR_KEY) ?? '';
  } catch {
    return '';
  }
};

function Back({ to = '/reglages', label = 'Réglages' }: { to?: string; label?: string }) {
  return (
    <Link to={to} viewTransition className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 text-[15px] text-cendre">
      <Icon name="back" size={20} />
      {label}
    </Link>
  );
}

/** Saisie du code d'administration (gardé sur cet appareil seulement). */
function Unlock({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await checkAdminCode(code.trim());
      setAdminCode(code.trim());
      onDone();
    } catch (e) {
      setError(e instanceof AdminError ? e.message : 'Vérification impossible.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen withTabBar={false}>
      <Back />
      <h1 className="font-metal text-[36px] leading-none">Espace créateur</h1>
      <p className="text-[15px] leading-snug text-cendre">Réservé au créateur de FORGE : ajoute et gère les séances audio écoutées par tous les utilisateurs.</p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Code d’administration" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} maxLength={200} />
        {error && (
          <p className="text-[15px] text-braise" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || code.trim().length < 4}>
          {busy ? 'Vérification…' : 'Ouvrir'}
        </Button>
      </form>
    </Screen>
  );
}

/** Liste de toutes les séances (publiées et brouillons), ordre, accès à l'éditeur. */
export function CreatorScreen() {
  const [unlocked, setUnlocked] = useState(() => Boolean(getAdminCode()));
  const [items, setItems] = useState<AudioItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setItems(await adminList());
      setError(null);
    } catch (e) {
      if (e instanceof AdminError && e.status === 401) {
        setAdminCode(null);
        setUnlocked(false);
      }
      setError(e instanceof Error ? e.message : 'Liste indisponible.');
    }
  }, []);
  useEffect(() => {
    if (unlocked) void load();
  }, [unlocked, load]);

  if (!unlocked) return <Unlock onDone={() => setUnlocked(true)} />;

  const move = async (i: number, d: -1 | 1) => {
    if (!items) return;
    const next = [...items];
    const [it] = next.splice(i, 1);
    next.splice(i + d, 0, it!);
    setItems(next);
    try {
      const saved = await adminReorder(next.map((x) => x.id));
      setItems(saved);
      patchCatalog(saved);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Ordre non enregistré.');
      void load();
    }
  };

  return (
    <Screen withTabBar={false}>
      <Back />
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-metal text-[36px] leading-none">Espace créateur</h1>
        <Link to="/mind/createur/nouvelle" viewTransition className="flex h-10 items-center gap-1.5 rounded-full bg-citron px-4 text-[15px] font-semibold text-noir">
          <Icon name="plus" size={18} />
          Séance
        </Link>
      </div>
      <p className="text-[13px] leading-snug text-cendre">
        Tes séances publiées apparaissent chez tous les utilisateurs, dans Mind (et dans Hypnose pour les séances d’hypnose), en général en moins d’une minute.
      </p>
      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      {items === null && !error && <p className="text-[15px] text-cendre">Chargement…</p>}
      {items?.length === 0 && <p className="rounded-[18px] bg-anthracite p-4 text-[15px] text-cendre">Aucune séance. Ajoute ta première avec « Séance ».</p>}
      <ol className="flex flex-col gap-2">
        {items?.map((it, i) => (
          <li key={it.id} className="flex items-center gap-2 rounded-[18px] bg-anthracite p-2.5">
            <Link to={`/mind/createur/${it.id}`} viewTransition className="flex min-w-0 flex-1 items-center gap-3">
              <AudioCover item={it} size={52} />
              <span className="min-w-0">
                <span className="block truncate text-[16px]">{it.title}</span>
                <span className="block text-[12px] text-cendre">
                  {FORMAT_LABELS[it.format]}
                  {it.durationSec ? `, ${durationText(it.durationSec)}` : ''}
                </span>
                <span className={`block text-[12px] ${it.published ? 'text-brume' : 'text-cendre'}`}>{!it.file ? 'Fichier manquant' : it.published ? 'Publiée' : 'Brouillon'}</span>
              </span>
            </Link>
            <span className="flex shrink-0 flex-col">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => void move(i, -1)}
                aria-label={`Monter ${it.title}`}
                className="flex h-9 w-9 items-center justify-center text-cendre disabled:opacity-30"
              >
                <Icon name="up" size={18} />
              </button>
              <button
                type="button"
                disabled={i === items.length - 1}
                onClick={() => void move(i, 1)}
                aria-label={`Descendre ${it.title}`}
                className="flex h-9 w-9 items-center justify-center text-cendre disabled:opacity-30"
              >
                <Icon name="down" size={18} />
              </button>
            </span>
          </li>
        ))}
      </ol>
      <Button
        variant="quiet"
        className="self-center"
        onClick={() => {
          setAdminCode(null);
          setUnlocked(false);
          toast.show('Code oublié sur cet appareil');
        }}
      >
        Oublier le code sur cet appareil
      </Button>
    </Screen>
  );
}

type Form = AudioMeta;
const blankForm = (): Form => ({
  title: '',
  description: '',
  format: 'hypnose',
  themes: [],
  categories: [],
  goal: '',
  level: 'tous',
  audience: '',
  tags: [],
  author: lastAuthor(),
  durationSec: 0,
  published: false,
});
const formOf = (it: AudioItem): Form => ({
  title: it.title,
  description: it.description,
  format: it.format,
  themes: it.themes,
  categories: it.categories,
  goal: it.goal,
  level: it.level,
  audience: it.audience,
  tags: it.tags,
  author: it.author,
  durationSec: it.durationSec,
  published: it.published,
});

/** Ajout ou modification d'une séance : fichier, couverture, informations, publication. */
export function CreatorEditor() {
  const { id = 'nouvelle' } = useParams();
  const isNew = id === 'nouvelle';
  const navigate = useNavigate();
  const toast = useToast();
  const player = useAudioPlayer();
  const [item, setItem] = useState<AudioItem | null>(null);
  const [form, setForm] = useState<Form>(blankForm);
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<{ blob: Blob; url: string } | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!getAdminCode()) {
      void navigate('/mind/createur', { replace: true });
      return;
    }
    if (isNew) return;
    void adminList()
      .then((all) => {
        const found = all.find((x) => x.id === id);
        if (!found) return setError('Séance introuvable.');
        setItem(found);
        setForm(formOf(found));
        setTags(found.tags.join(', '));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Séance indisponible.'));
  }, [id, isNew, navigate]);

  useEffect(() => () => void (cover && URL.revokeObjectURL(cover.url)), [cover]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    const d = await readAudioDuration(f);
    if (d) set('durationSec', d);
    if (!form.title)
      set(
        'title',
        f.name
          .replace(/\.[a-z0-9]+$/i, '')
          .replace(/[_-]+/g, ' ')
          .slice(0, 120),
      );
  };

  const pickCover = async (f: File | undefined) => {
    if (!f) return;
    try {
      const blob = await prepareCover(f);
      setCover({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError('Image illisible : choisis une photo JPEG ou PNG.');
    }
  };

  const save = async () => {
    setError(null);
    if (!form.title.trim()) return setError('Donne un titre à la séance.');
    if (isNew && !file) return setError('Choisis le fichier audio de la séance.');
    const meta: Form = {
      ...form,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      themes: form.format === 'hypnose' ? form.themes : [],
    };
    try {
      if (meta.author) localStorage.setItem(AUTHOR_KEY, meta.author);
    } catch {
      /* ignoré */
    }
    try {
      setStep('Enregistrement des informations…');
      // Publication en dernier : le serveur refuse de publier une séance sans fichier.
      let saved = isNew ? await adminCreate({ ...meta, published: false }) : await adminUpdate(item!.id, { ...meta, published: meta.published && Boolean(item!.file) });
      if (file) {
        saved = await adminUploadFile(saved.id, file, (r) => setStep(`Envoi du fichier… ${Math.round(r * 100)} %`));
      }
      if (cover) {
        setStep('Envoi de la couverture…');
        saved = await adminUploadCover(saved.id, cover.blob);
      }
      if (meta.published && !saved.published) {
        setStep('Publication…');
        saved = await adminUpdate(saved.id, { published: true });
      }
      setItem(saved);
      setFile(null);
      setCover(null);
      setForm(formOf(saved));
      setStep(null);
      toast.show(saved.published ? 'Séance publiée' : 'Séance enregistrée en brouillon');
      void refreshCatalog(true);
      if (isNew) void navigate(`/mind/createur/${saved.id}`, { replace: true });
    } catch (e) {
      setStep(null);
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    }
  };

  const remove = async () => {
    if (!item) return;
    try {
      setStep('Suppression…');
      if (player.item?.id === item.id) player.close();
      await adminDelete(item.id);
      void refreshCatalog(true);
      toast.show('Séance supprimée');
      void navigate('/mind/createur', { replace: true });
    } catch (e) {
      setStep(null);
      setError(e instanceof Error ? e.message : 'Suppression impossible.');
    }
  };

  if (!isNew && !item && !error) {
    return (
      <Screen withTabBar={false}>
        <Back to="/mind/createur" label="Espace créateur" />
        <p className="text-[15px] text-cendre">Chargement…</p>
      </Screen>
    );
  }

  const busy = step !== null;
  return (
    <Screen withTabBar={false}>
      <Back to="/mind/createur" label="Espace créateur" />
      <h1 className="font-metal text-[32px] leading-none">{isNew ? 'Nouvelle séance' : 'Modifier la séance'}</h1>

      <section aria-label="Fichier audio" className="flex flex-col gap-2 rounded-[18px] bg-anthracite p-4">
        <h2 className="text-[15px] font-semibold">Fichier audio</h2>
        <p className="text-[13px] text-cendre">
          {file
            ? `${file.name}, ${sizeText(file.size)}${form.durationSec ? `, ${durationText(form.durationSec)}` : ''}`
            : item?.file
              ? `Fichier en ligne : ${sizeText(item.file.size)}, ${durationText(item.durationSec)}`
              : 'MP3, M4A (Mémos vocaux), AAC, WAV ou OGG, 95 Mo au maximum.'}
        </p>
        <input ref={fileInput} type="file" accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} />
        <Button size="small" variant="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
          {item?.file || file ? 'Remplacer le fichier' : 'Choisir le fichier'}
        </Button>
      </section>

      <Field label="Titre" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} />
      <TextArea label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} rows={4} />
      <SelectField
        label="Type de séance"
        value={form.format}
        onChange={(e) => set('format', e.target.value as Form['format'])}
        options={AUDIO_FORMATS.map((f) => ({ value: f, label: FORMAT_LABELS[f] }))}
      />
      {form.format === 'hypnose' && (
        <Chips
          tone="brume"
          label="Thèmes d’hypnose"
          options={HYPNOSIS_THEMES.map((t) => ({ value: t, label: THEME_LABELS[t] }))}
          selected={form.themes}
          onToggle={(t) => set('themes', form.themes.includes(t) ? form.themes.filter((x) => x !== t) : [...form.themes, t])}
        />
      )}
      <Chips
        tone="brume"
        label="Catégories Mind"
        options={CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_INFO[c].label }))}
        selected={form.categories as MindCategory[]}
        onToggle={(c) => set('categories', form.categories.includes(c) ? form.categories.filter((x) => x !== c) : [...form.categories, c])}
      />
      <Field
        label="Objectif de la séance"
        value={form.goal}
        onChange={(e) => set('goal', e.target.value)}
        maxLength={300}
        placeholder="Ex. relâcher les tensions avant de dormir"
      />
      <Segmented
        label="Niveau"
        value={form.level}
        onChange={(v) => set('level', v)}
        options={AUDIO_LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l].replace('Pour une pratique régulière', 'Régulier').replace('Pour débuter', 'Débutant') }))}
      />
      <Field
        label="Public recommandé (facultatif)"
        value={form.audience}
        onChange={(e) => set('audience', e.target.value)}
        maxLength={200}
        placeholder="Ex. sportifs en période de compétition"
      />
      <Field label="Mots-clés, séparés par des virgules" value={tags} onChange={(e) => setTags(e.target.value)} maxLength={300} placeholder="Ex. détente, soir, respiration" />
      <Field label="Auteur affiché" value={form.author} onChange={(e) => set('author', e.target.value)} maxLength={80} placeholder="Ton nom, tel qu’il apparaîtra" />

      <section aria-label="Couverture" className="flex items-center gap-3 rounded-[18px] bg-anthracite p-4">
        {cover ? (
          <img src={cover.url} alt="" className="h-16 w-16 rounded-[12px] object-cover" />
        ) : item ? (
          <AudioCover item={item} size={64} />
        ) : (
          <span className="h-16 w-16 rounded-[12px] bg-graphite" />
        )}
        <span className="min-w-0 flex-1 text-[13px] text-cendre">
          {cover ? 'Nouvelle couverture, envoyée à l’enregistrement.' : 'Image carrée de préférence. Sans image, une couverture est générée.'}
        </span>
        <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => void pickCover(e.target.files?.[0])} />
        <span className="flex flex-col gap-1">
          <Button size="small" variant="secondary" disabled={busy} onClick={() => coverInput.current?.click()}>
            Image
          </Button>
          {item?.cover && !cover && (
            <Button
              size="small"
              variant="quiet"
              disabled={busy}
              onClick={() =>
                void adminDeleteCover(item.id).then((saved) => {
                  setItem(saved);
                  void refreshCatalog(true);
                })
              }
            >
              Retirer
            </Button>
          )}
        </span>
      </section>

      <label className="flex min-h-12 items-center justify-between gap-3 rounded-[18px] border border-graphite px-4 text-[15px]">
        <span>
          Publier pour tous les utilisateurs
          <span className="block text-[12px] text-cendre">Décoché : brouillon, visible seulement ici.</span>
        </span>
        <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} className="h-6 w-6 shrink-0 accent-[var(--forge-mind)]" />
      </label>

      {error && (
        <p className="text-[15px] text-braise" role="alert">
          {error}
        </p>
      )}
      {step && (
        <p className="text-[15px] text-brume" aria-live="polite">
          {step}
        </p>
      )}
      <Button disabled={busy} onClick={() => void save()}>
        Enregistrer
      </Button>
      {item?.file && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            player.play(item, { url: `/api/audio/${item.id}/file?v=${item.file!.version}`, local: false }, 0);
            player.expand(true);
          }}
        >
          <Icon name="play" size={18} />
          Écouter la version en ligne
        </Button>
      )}
      {item &&
        (confirmDelete ? (
          <div className="flex flex-col gap-2 rounded-[18px] border border-braise/50 p-4">
            <p className="text-[15px]">Supprimer définitivement « {item.title} » ? Le fichier disparaît pour tous les utilisateurs.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="danger" disabled={busy} onClick={() => void remove()}>
                Supprimer
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="quiet" className="self-center text-braise!" onClick={() => setConfirmDelete(true)}>
            Supprimer la séance
          </Button>
        ))}
    </Screen>
  );
}
