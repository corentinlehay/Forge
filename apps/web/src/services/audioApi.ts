import { useEffect, useSyncExternalStore } from 'react';
import { getDb } from '../db/schema';
import type { AudioState } from '../db/types';
import { audioItemSchema, fileUrl, parseCatalog, type AudioItem } from '../domain/audio';
import { nowIso } from '../lib/ids';

/**
 * Accès aux séances audio : catalogue public (mis de côté pour le hors connexion), téléchargements,
 * état local (reprise, favoris) et, pour le créateur, l'administration protégée par son code.
 */

const CATALOG_KEY = 'audioCatalog';
const ADMIN_KEY = 'forge.adminCode';

type CatalogStatus = 'loading' | 'ok' | 'offline' | 'error';
interface CatalogSnapshot {
  items: AudioItem[];
  status: CatalogStatus;
}

let snapshot: CatalogSnapshot = { items: [], status: 'loading' };
let inflight: Promise<void> | null = null;
let loadedAt = 0;
const listeners = new Set<() => void>();
const emit = (next: CatalogSnapshot) => {
  snapshot = next;
  listeners.forEach((l) => l());
};

/** Recharge le catalogue ; sans réseau, garde la dernière liste reçue (enregistrée sur l'appareil). */
export function refreshCatalog(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && snapshot.status === 'ok' && Date.now() - loadedAt < 5 * 60 * 1000) return Promise.resolve();
  inflight = (async () => {
    try {
      const res = await fetch('/api/audio', { cache: force ? 'no-store' : 'default' });
      if (!res.ok) throw new Error(String(res.status));
      const items = parseCatalog(await res.json());
      loadedAt = Date.now();
      emit({ items, status: 'ok' });
      await getDb().meta.put({ key: CATALOG_KEY, value: { items }, updatedAt: nowIso() });
      await pruneDownloads(items);
    } catch {
      const cached = (
        await getDb()
          .meta.get(CATALOG_KEY)
          .catch(() => undefined)
      )?.value as { items?: unknown } | undefined;
      const items = parseCatalog(cached ?? null);
      emit({ items, status: navigator.onLine ? 'error' : 'offline' });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Catalogue partagé par tous les écrans, chargé à la première utilisation. */
export function useAudioCatalog(): CatalogSnapshot & { refresh: () => Promise<void> } {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
  useEffect(() => {
    void refreshCatalog();
  }, []);
  return { ...snap, refresh: () => refreshCatalog(true) };
}

/** Remplace une séance dans le catalogue local (après une modification du créateur). */
export function patchCatalog(items: AudioItem[]) {
  emit({ items: items.filter((i) => i.published && i.file), status: snapshot.status === 'loading' ? 'ok' : snapshot.status });
}

// État local d'écoute

export async function getAudioState(id: string): Promise<AudioState | undefined> {
  return getDb().audioStates.get(id);
}

export async function saveAudioState(id: string, patch: Partial<Omit<AudioState, 'id' | 'updatedAt'>>): Promise<void> {
  const db = getDb();
  await db.transaction('rw', db.audioStates, async () => {
    const existing = await db.audioStates.get(id);
    await db.audioStates.put({ id, position: 0, durationSec: 0, favorite: false, lastPlayedAt: null, ...existing, ...patch, updatedAt: nowIso() });
  });
}

export async function toggleAudioFavorite(id: string): Promise<void> {
  const existing = await getAudioState(id);
  await saveAudioState(id, { favorite: !existing?.favorite });
}

// Téléchargements pour l'écoute hors connexion

/** Télécharge le fichier entier sur l'appareil, avec la progression (0 à 1). */
export async function downloadAudio(item: AudioItem, onProgress: (ratio: number) => void): Promise<void> {
  const url = fileUrl(item);
  if (!url || !item.file) throw new Error('Pas de fichier pour cette séance.');
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error('Téléchargement impossible : vérifie ta connexion.');
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    received += value.byteLength;
    onProgress(Math.min(1, received / item.file.size));
  }
  const blob = new Blob(parts as BlobPart[], { type: item.file.mime });
  await getDb().audioDownloads.put({ id: item.id, version: item.file.version, mime: item.file.mime, size: blob.size, blob, savedAt: nowIso() });
}

/** Libère la place des séances retirées par le créateur ou dont le fichier a été remplacé. */
async function pruneDownloads(items: AudioItem[]): Promise<void> {
  const current = new Map(items.map((i) => [i.id, i.file?.version]));
  const stale: string[] = [];
  await getDb().audioDownloads.each((d) => {
    if (current.get(d.id) !== d.version) stale.push(d.id);
  });
  if (stale.length) await getDb().audioDownloads.bulkDelete(stale);
}

export async function removeDownload(id: string): Promise<void> {
  await getDb().audioDownloads.delete(id);
}

/** Source à lire : le fichier téléchargé s'il est à jour, sinon le réseau. */
export async function sourceFor(item: AudioItem): Promise<{ url: string; local: boolean } | null> {
  const remote = fileUrl(item);
  const local = await getDb()
    .audioDownloads.get(item.id)
    .catch(() => undefined);
  if (local && item.file && local.version === item.file.version) return { url: URL.createObjectURL(local.blob), local: true };
  return remote ? { url: remote, local: false } : null;
}

// Espace créateur

export function getAdminCode(): string | null {
  try {
    return localStorage.getItem(ADMIN_KEY);
  } catch {
    return null;
  }
}
export function setAdminCode(code: string | null) {
  try {
    if (code) localStorage.setItem(ADMIN_KEY, code);
    else localStorage.removeItem(ADMIN_KEY);
  } catch {
    /* sans stockage, le code sera redemandé */
  }
}

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function adminFetch(path: string, init: RequestInit = {}, code = getAdminCode()): Promise<unknown> {
  if (!code) throw new AdminError('Code manquant.', 401);
  let res: Response;
  try {
    res = await fetch(path, { ...init, cache: 'no-store', headers: { ...(init.headers ?? {}), authorization: `Bearer ${code}` } });
  } catch {
    throw new AdminError('Pas de connexion : l’espace créateur a besoin d’internet.', 0);
  }
  const body = (await res.json().catch(() => ({}))) as { erreur?: string };
  if (!res.ok) throw new AdminError(body.erreur ?? `Erreur ${res.status}.`, res.status);
  return body;
}

export const checkAdminCode = (code: string) => adminFetch('/api/admin/check', {}, code);

const itemOf = (body: unknown) => audioItemSchema.parse((body as { item: unknown }).item);

export async function adminList(): Promise<AudioItem[]> {
  return parseCatalog(await adminFetch('/api/admin/audio'));
}

export type AudioMeta = Pick<
  AudioItem,
  'title' | 'description' | 'format' | 'themes' | 'categories' | 'goal' | 'level' | 'audience' | 'tags' | 'author' | 'durationSec' | 'published'
>;

export async function adminCreate(meta: Partial<AudioMeta>): Promise<AudioItem> {
  return itemOf(await adminFetch('/api/admin/audio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(meta) }));
}

export async function adminUpdate(id: string, meta: Partial<AudioMeta>): Promise<AudioItem> {
  return itemOf(await adminFetch(`/api/admin/audio/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(meta) }));
}

export async function adminDelete(id: string): Promise<void> {
  await adminFetch(`/api/admin/audio/${id}`, { method: 'DELETE' });
}

export async function adminReorder(ids: string[]): Promise<AudioItem[]> {
  return parseCatalog(await adminFetch('/api/admin/order', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) }));
}

export async function adminDeleteCover(id: string): Promise<AudioItem> {
  return itemOf(await adminFetch(`/api/admin/audio/${id}/cover`, { method: 'DELETE' }));
}

/** Type MIME d'un fichier choisi sur l'iPhone (parfois vide) : déduit de l'extension si besoin. */
export function audioMime(file: File): string {
  if (file.type && file.type.startsWith('audio/')) return file.type;
  const ext = file.name.toLowerCase().split('.').pop();
  return (
    (
      { m4a: 'audio/mp4', mp4: 'audio/mp4', mp3: 'audio/mpeg', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac', webm: 'audio/webm' } as Record<
        string,
        string
      >
    )[ext ?? ''] ?? file.type
  );
}

/** Envoi d'un fichier avec sa progression (XMLHttpRequest : fetch ne donne pas la progression d'envoi). */
function uploadWithProgress(path: string, body: Blob, mime: string, onProgress: (ratio: number) => void): Promise<AudioItem> {
  const code = getAdminCode();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', path);
    xhr.setRequestHeader('authorization', `Bearer ${code ?? ''}`);
    xhr.setRequestHeader('content-type', mime);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new AdminError('Envoi interrompu : vérifie ta connexion et réessaie.', 0));
    xhr.onload = () => {
      let body: { erreur?: string; item?: unknown } = {};
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        /* réponse vide */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(audioItemSchema.parse(body.item));
      else reject(new AdminError(body.erreur ?? `Erreur ${xhr.status}.`, xhr.status));
    };
    xhr.send(body);
  });
}

/**
 * Envoi du fichier audio morceau par morceau (2 Mio par requête) : chaque morceau raté est renvoyé
 * jusqu'à trois fois, ce qui tient sur une connexion mobile instable.
 */
export async function adminUploadFile(id: string, file: File, onProgress: (ratio: number) => void): Promise<AudioItem> {
  const start = (await adminFetch(`/api/admin/audio/${id}/upload`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ size: file.size, mime: audioMime(file) }),
  })) as { version: string; chunkSize: number; chunks: number };
  for (let n = 0; n < start.chunks; n++) {
    const part = file.slice(n * start.chunkSize, (n + 1) * start.chunkSize);
    for (let attempt = 1; ; attempt++) {
      try {
        await adminFetch(`/api/admin/audio/${id}/upload/${start.version}/${n}`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: part });
        break;
      } catch (e) {
        if (attempt >= 3 || (e instanceof AdminError && e.status >= 400 && e.status < 500)) throw e;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    onProgress((n + 1) / start.chunks);
  }
  return itemOf(await adminFetch(`/api/admin/audio/${id}/upload/${start.version}/done`, { method: 'POST' }));
}
export const adminUploadCover = (id: string, image: Blob, onProgress: (ratio: number) => void = () => {}) =>
  uploadWithProgress(`/api/admin/audio/${id}/cover`, image, image.type || 'image/jpeg', onProgress);

/** Durée d'un fichier audio choisi, lue par le navigateur (null si illisible). */
export function readAudioDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (v: number | null) => {
      URL.revokeObjectURL(url);
      resolve(v);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null);
    audio.onerror = () => done(null);
    setTimeout(() => done(null), 15000);
    audio.src = url;
  });
}

/** Couverture : image ramenée à 800 px de côté au plus, en JPEG. */
export async function prepareCover(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image illisible.'));
      el.src = url;
    });
    const scale = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image illisible.'))), 'image/jpeg', 0.82));
  } finally {
    URL.revokeObjectURL(url);
  }
}
