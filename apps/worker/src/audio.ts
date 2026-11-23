/**
 * Séances audio de FORGE MIND (contenus du créateur, visibles par tous, gérés par lui seul).
 *
 * Stockage Workers KV (namespace AUDIO) :
 * - `catalog` : la liste des séances (métadonnées) ;
 * - `audio:<id>:<version>:<n>` : le fichier, découpé en morceaux de 2 Mio (une valeur KV est limitée à 25 Mio),
 *   ce qui permet aussi de servir des plages d'octets (Safari en a besoin pour lire et avancer dans un audio) ;
 * - `cover:<id>:<version>` : l'image de couverture.
 * Les clés de fichier portent une version : un fichier remplacé ne peut pas être servi depuis un cache périmé.
 *
 * Administration : en-tête `authorization: Bearer <code>`, comparé au secret Cloudflare ADMIN_CODE.
 */

export interface AudioEnv {
  AUDIO?: KVNamespace;
  ADMIN_CODE?: string;
}

export const FORMATS = ['hypnose', 'relaxation', 'meditation', 'visualisation', 'sommeil', 'respiration', 'preparation'] as const;
export const THEMES = ['stress', 'ruminations', 'confiance', 'sommeil', 'lacher-prise', 'motivation', 'preparation', 'emotions', 'recuperation'] as const;
export const CATEGORIES = ['apaiser', 'dormir', 'concentrer', 'depasser', 'recuperer', 'recul', 'confiance'] as const;
export const LEVELS = ['tous', 'debutant', 'habitue'] as const;

export interface AudioFile {
  size: number;
  mime: string;
  version: string;
  chunks: number;
}

export interface AudioItem {
  id: string;
  title: string;
  description: string;
  format: (typeof FORMATS)[number];
  themes: string[];
  categories: string[];
  goal: string;
  level: (typeof LEVELS)[number];
  audience: string;
  tags: string[];
  author: string;
  durationSec: number;
  published: boolean;
  order: number;
  file: AudioFile | null;
  cover: { mime: string; version: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const CHUNK_SIZE = 2 * 1024 * 1024;
export const MAX_FILE_BYTES = 95 * 1024 * 1024;
export const MAX_COVER_BYTES = 1024 * 1024;
const MIN_CODE_LENGTH = 12;
const AUDIO_MIME = /^audio\/(mpeg|mp4|x-m4a|m4a|aac|wav|x-wav|ogg|webm|flac)$/;
const IMAGE_MIME = /^image\/(jpeg|png|webp)$/;
const IMMUTABLE_TTL = 86400;

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', ...extra } });
}
const fail = (status: number, erreur: string) => json({ erreur }, status, { 'cache-control': 'no-store' });
const newId = () => crypto.randomUUID().replaceAll('-', '').slice(0, 16);
const chunkKey = (id: string, version: string, n: number) => `audio:${id}:${version}:${n}`;
const coverKey = (id: string, version: string) => `cover:${id}:${version}`;
/** Description d'une version de fichier, écrite avec ses morceaux : le fichier se sert sans relire le catalogue. */
const fileMetaKey = (id: string, version: string) => `audio:${id}:${version}:meta`;
const VERSION_RE = /^[a-f0-9]{8}$/;
/** Envoi en cours : le fichier arrive morceau par morceau (une requête par morceau, peu de calcul par requête). */
const uploadKey = (id: string, version: string) => `upload:${id}:${version}`;

async function readCatalog(kv: KVNamespace, cacheTtl?: number): Promise<AudioItem[]> {
  const list = (await kv.get('catalog', cacheTtl ? { type: 'json', cacheTtl } : { type: 'json' })) as AudioItem[] | null;
  return Array.isArray(list) ? list : [];
}
const writeCatalog = (kv: KVNamespace, items: AudioItem[]) => kv.put('catalog', JSON.stringify(items));
const sortItems = (items: AudioItem[]) => [...items].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));

/** Comparaison en temps constant des empreintes : la durée ne révèle rien du code. */
async function sameSecret(given: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(given)), crypto.subtle.digest('SHA-256', enc.encode(expected))]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

async function checkAdmin(request: Request, env: AudioEnv): Promise<Response | null> {
  const expected = env.ADMIN_CODE ?? '';
  if (expected.length < MIN_CODE_LENGTH) return fail(503, 'Espace créateur pas encore configuré : ajoute le secret ADMIN_CODE (12 caractères au moins) dans Cloudflare.');
  const header = request.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!given || !(await sameSecret(given, expected))) return fail(401, 'Code incorrect.');
  return null;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback);
const list = (v: unknown, allowed: readonly string[] | null, max: number, maxLen = 40) =>
  Array.isArray(v)
    ? [
        ...new Set(
          v
            .filter((x): x is string => typeof x === 'string')
            .map((x) => x.trim().slice(0, maxLen))
            .filter((x) => x && (!allowed || allowed.includes(x))),
        ),
      ].slice(0, max)
    : [];

/** Métadonnées modifiables, nettoyées et bornées. */
export function cleanMeta(input: Record<string, unknown>, base?: AudioItem): Omit<AudioItem, 'id' | 'file' | 'cover' | 'createdAt' | 'updatedAt' | 'order'> {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);
  const duration = Number(input.durationSec);
  return {
    title: has('title') ? text(input.title, 120) : (base?.title ?? ''),
    description: has('description') ? text(input.description, 2000) : (base?.description ?? ''),
    format: has('format') ? pick(input.format, FORMATS, 'relaxation') : (base?.format ?? 'relaxation'),
    themes: has('themes') ? list(input.themes, THEMES, THEMES.length) : (base?.themes ?? []),
    categories: has('categories') ? list(input.categories, CATEGORIES, CATEGORIES.length) : (base?.categories ?? []),
    goal: has('goal') ? text(input.goal, 300) : (base?.goal ?? ''),
    level: has('level') ? pick(input.level, LEVELS, 'tous') : (base?.level ?? 'tous'),
    audience: has('audience') ? text(input.audience, 200) : (base?.audience ?? ''),
    tags: has('tags') ? list(input.tags, null, 12, 30) : (base?.tags ?? []),
    author: has('author') ? text(input.author, 80) : (base?.author ?? ''),
    durationSec: has('durationSec') && Number.isFinite(duration) && duration >= 0 && duration <= 4 * 3600 ? Math.round(duration) : (base?.durationSec ?? 0),
    published: has('published') ? input.published === true : (base?.published ?? false),
  };
}

/** Plage demandée (en-tête Range), bornée à la taille du fichier ; null si absente, 'invalid' si impossible. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  let start: number;
  let end: number;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (suffix === 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}

/** Flux des octets [start, end] à partir des morceaux, lus un par un (mémoire constante). */
function streamRange(kv: KVNamespace, id: string, file: AudioFile, start: number, end: number): ReadableStream<Uint8Array> {
  let n = Math.floor(start / CHUNK_SIZE);
  const last = Math.floor(end / CHUNK_SIZE);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (n > last) return controller.close();
      const buf = await kv.get(chunkKey(id, file.version, n), { type: 'arrayBuffer', cacheTtl: IMMUTABLE_TTL });
      if (!buf) return controller.error(new Error('Morceau manquant'));
      const chunkStart = n * CHUNK_SIZE;
      const from = Math.max(0, start - chunkStart);
      const to = Math.min(buf.byteLength, end - chunkStart + 1);
      controller.enqueue(new Uint8Array(buf, from, to - from));
      n++;
    },
  });
}

async function serveFile(request: Request, kv: KVNamespace, id: string, version: string | null): Promise<Response> {
  const file = version
    ? ((await kv.get(fileMetaKey(id, version), { type: 'json', cacheTtl: IMMUTABLE_TTL })) as AudioFile | null)
    : ((await readCatalog(kv, 60)).find((i) => i.id === id)?.file ?? null);
  if (!file) return fail(404, 'Séance introuvable.');
  const range = parseRange(request.headers.get('range'), file.size);
  const common = { 'content-type': file.mime, 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=31536000, immutable', etag: `"${file.version}"` };
  if (range === 'invalid') return new Response(null, { status: 416, headers: { 'content-range': `bytes */${file.size}` } });
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers: { ...common, 'content-length': String(file.size) } });
  if (!range) return new Response(streamRange(kv, id, file, 0, file.size - 1), { status: 200, headers: { ...common, 'content-length': String(file.size) } });
  return new Response(streamRange(kv, id, file, range.start, range.end), {
    status: 206,
    headers: { ...common, 'content-length': String(range.end - range.start + 1), 'content-range': `bytes ${range.start}-${range.end}/${file.size}` },
  });
}

async function serveCover(kv: KVNamespace, id: string, version: string | null): Promise<Response> {
  const v = version ?? (await readCatalog(kv, 60)).find((i) => i.id === id)?.cover?.version;
  if (!v) return fail(404, 'Pas de couverture.');
  const { value, metadata } = await kv.getWithMetadata<{ mime?: string }>(coverKey(id, v), { type: 'arrayBuffer', cacheTtl: IMMUTABLE_TTL });
  if (!value) return fail(404, 'Pas de couverture.');
  return new Response(value, { headers: { 'content-type': metadata?.mime ?? 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
}

async function deleteFile(kv: KVNamespace, id: string, file: AudioFile | null) {
  if (!file) return;
  await Promise.all([kv.delete(fileMetaKey(id, file.version)), ...Array.from({ length: file.chunks }, (_, n) => kv.delete(chunkKey(id, file.version, n)))]);
}

/** Route /api/audio/* et /api/admin/audio/* ; null si la route n'est pas audio. */
export async function handleAudio(request: Request, env: AudioEnv, waitUntil: (p: Promise<unknown>) => void = () => {}): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (!path.startsWith('/api/audio') && !path.startsWith('/api/admin')) return null;
  const kv = env.AUDIO;
  if (!kv) return fail(503, 'Stockage audio indisponible.');
  const method = request.method;

  // Public
  if (path === '/api/audio' && method === 'GET') {
    const items = sortItems((await readCatalog(kv)).filter((i) => i.published && i.file));
    // Revalidé à chaque ouverture : une séance publiée apparaît tout de suite (une lecture KV par visite).
    return json({ items }, 200, { 'cache-control': 'no-cache' });
  }
  let m = /^\/api\/audio\/([a-f0-9]{16})\/(file|cover)$/.exec(path);
  if (m && (method === 'GET' || method === 'HEAD')) {
    const v = url.searchParams.get('v');
    const version = v && VERSION_RE.test(v) ? v : null;
    return m[2] === 'file' ? serveFile(request, kv, m[1]!, version) : serveCover(kv, m[1]!, version);
  }

  // Administration
  if (!path.startsWith('/api/admin/')) return fail(404, 'Route inconnue.');
  const denied = await checkAdmin(request, env);
  if (denied) return denied;
  const now = new Date().toISOString();

  if (path === '/api/admin/check' && method === 'GET') return json({ ok: true }, 200, { 'cache-control': 'no-store' });

  if (path === '/api/admin/audio' && method === 'GET') return json({ items: sortItems(await readCatalog(kv)) }, 200, { 'cache-control': 'no-store' });

  if (path === '/api/admin/audio' && method === 'POST') {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return fail(400, 'Données illisibles.');
    }
    const meta = cleanMeta(body);
    if (!meta.title) return fail(400, 'Le titre est obligatoire.');
    const items = await readCatalog(kv);
    const item: AudioItem = {
      ...meta,
      published: false,
      id: newId(),
      file: null,
      cover: null,
      order: items.reduce((a, i) => Math.max(a, i.order), -1) + 1,
      createdAt: now,
      updatedAt: now,
    };
    await writeCatalog(kv, [...items, item]);
    return json({ item }, 201, { 'cache-control': 'no-store' });
  }

  if (path === '/api/admin/order' && method === 'PUT') {
    const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : [];
    const items = await readCatalog(kv);
    const next = items.map((i) => ({ ...i, order: ids.includes(i.id) ? ids.indexOf(i.id) : ids.length + i.order }));
    await writeCatalog(kv, next);
    return json({ items: sortItems(next) }, 200, { 'cache-control': 'no-store' });
  }

  const up = /^\/api\/admin\/audio\/([a-f0-9]{16})\/upload(?:\/([a-f0-9]{8})\/(\d+|done))?$/.exec(path);
  if (up) return handleUpload(request, kv, up[1]!, up[2] ?? null, up[3] ?? null, now, waitUntil);

  m = /^\/api\/admin\/audio\/([a-f0-9]{16})(?:\/(cover))?$/.exec(path);
  if (!m) return fail(404, 'Route inconnue.');
  const id = m[1]!;
  const items = await readCatalog(kv);
  const item = items.find((i) => i.id === id);
  if (!item) return fail(404, 'Séance introuvable.');
  const save = async (next: AudioItem) => {
    await writeCatalog(
      kv,
      items.map((i) => (i.id === id ? next : i)),
    );
    return json({ item: next }, 200, { 'cache-control': 'no-store' });
  };

  if (!m[2] && method === 'PUT') {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return fail(400, 'Données illisibles.');
    }
    const meta = cleanMeta(body, item);
    if (!meta.title) return fail(400, 'Le titre est obligatoire.');
    if (meta.published && !item.file) return fail(400, 'Ajoute le fichier audio avant de publier.');
    return save({ ...item, ...meta, updatedAt: now });
  }

  if (!m[2] && method === 'DELETE') {
    await writeCatalog(
      kv,
      items.filter((i) => i.id !== id),
    );
    waitUntil(Promise.all([deleteFile(kv, id, item.file), item.cover ? kv.delete(coverKey(id, item.cover.version)) : Promise.resolve()]));
    return json({ ok: true }, 200, { 'cache-control': 'no-store' });
  }

  if (m[2] === 'cover' && method === 'PUT') {
    const mime = (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (!IMAGE_MIME.test(mime)) return fail(415, 'Image JPEG, PNG ou WebP uniquement.');
    const buf = await request.arrayBuffer();
    if (buf.byteLength === 0) return fail(400, 'Image vide.');
    if (buf.byteLength > MAX_COVER_BYTES) return fail(413, 'Image trop lourde : 1 Mo au maximum.');
    const version = newId().slice(0, 8);
    await kv.put(coverKey(id, version), buf, { metadata: { mime } });
    const old = item.cover;
    const res = await save({ ...item, cover: { mime, version }, updatedAt: now });
    if (old) waitUntil(kv.delete(coverKey(id, old.version)));
    return res;
  }

  if (m[2] === 'cover' && method === 'DELETE') {
    if (item.cover) waitUntil(kv.delete(coverKey(id, item.cover.version)));
    return save({ ...item, cover: null, updatedAt: now });
  }

  return fail(405, 'Méthode non autorisée.');
}

/**
 * Envoi d'un fichier en trois temps :
 * POST …/upload {size, mime} → version ; PUT …/upload/<version>/<n> pour chaque morceau de 2 Mio ; POST …/upload/<version>/done.
 * Chaque requête reste légère (offre gratuite de Cloudflare : 10 ms de calcul par requête) et un morceau raté se renvoie seul.
 */
async function handleUpload(
  request: Request,
  kv: KVNamespace,
  id: string,
  version: string | null,
  part: string | null,
  now: string,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<Response> {
  const items = await readCatalog(kv);
  const item = items.find((i) => i.id === id);
  if (!item) return fail(404, 'Séance introuvable.');

  if (!version && request.method === 'POST') {
    const body = (await request.json().catch(() => null)) as { size?: unknown; mime?: unknown } | null;
    const size = Number(body?.size);
    const raw = typeof body?.mime === 'string' ? body.mime.toLowerCase() : '';
    if (!AUDIO_MIME.test(raw)) return fail(415, 'Format audio non pris en charge : envoie un fichier MP3, M4A, AAC, WAV ou OGG.');
    if (!Number.isInteger(size) || size <= 0) return fail(400, 'Fichier vide.');
    if (size > MAX_FILE_BYTES) return fail(413, 'Fichier trop lourd : 95 Mo au maximum.');
    const mime = raw === 'audio/x-m4a' || raw === 'audio/m4a' ? 'audio/mp4' : raw;
    const v = newId().slice(0, 8);
    const file: AudioFile = { size, mime, version: v, chunks: Math.ceil(size / CHUNK_SIZE) };
    await kv.put(uploadKey(id, v), JSON.stringify(file), { expirationTtl: 86400 });
    return json({ version: v, chunkSize: CHUNK_SIZE, chunks: file.chunks }, 201, { 'cache-control': 'no-store' });
  }

  if (!version) return fail(405, 'Méthode non autorisée.');
  const pending = (await kv.get(uploadKey(id, version), { type: 'json' })) as AudioFile | null;
  if (!pending) return fail(404, 'Envoi expiré : recommence l’envoi du fichier.');

  if (part === 'done' && request.method === 'POST') {
    await kv.put(fileMetaKey(id, version), JSON.stringify(pending));
    const old = item.file;
    const next: AudioItem = { ...item, file: pending, updatedAt: now };
    await writeCatalog(
      kv,
      items.map((i) => (i.id === id ? next : i)),
    );
    waitUntil(Promise.all([kv.delete(uploadKey(id, version)), deleteFile(kv, id, old)]));
    return json({ item: next }, 200, { 'cache-control': 'no-store' });
  }

  if (part !== null && part !== 'done' && request.method === 'PUT') {
    const n = Number(part);
    if (n >= pending.chunks) return fail(400, 'Morceau en trop.');
    const expected = n < pending.chunks - 1 ? CHUNK_SIZE : pending.size - CHUNK_SIZE * (pending.chunks - 1);
    const buf = await request.arrayBuffer();
    if (buf.byteLength !== expected) return fail(400, `Morceau incomplet (${buf.byteLength} octets reçus, ${expected} attendus).`);
    await kv.put(chunkKey(id, version, n), buf);
    return json({ ok: true }, 200, { 'cache-control': 'no-store' });
  }

  return fail(405, 'Méthode non autorisée.');
}
