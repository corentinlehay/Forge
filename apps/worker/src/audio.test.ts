import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, cleanMeta, handleAudio, parseRange, type AudioEnv, type AudioItem } from './audio';

/** KV en mémoire, avec les méthodes utilisées par audio.ts. */
function memoryKv() {
  const store = new Map<string, { value: ArrayBuffer | string; metadata?: unknown }>();
  const toBuf = (v: unknown): ArrayBuffer | string => {
    if (typeof v === 'string') return v;
    if (v instanceof ArrayBuffer) return v.slice(0);
    const view = v as Uint8Array;
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
  };
  const read = (key: string, type: string) => {
    const e = store.get(key);
    if (!e) return null;
    if (type === 'json') return JSON.parse(typeof e.value === 'string' ? e.value : new TextDecoder().decode(e.value));
    if (type === 'arrayBuffer') return typeof e.value === 'string' ? new TextEncoder().encode(e.value).buffer : e.value.slice(0);
    return typeof e.value === 'string' ? e.value : new TextDecoder().decode(e.value);
  };
  const kv = {
    store,
    async get(key: string, opts?: { type?: string } | string) {
      return read(key, typeof opts === 'string' ? opts : (opts?.type ?? 'text'));
    },
    async getWithMetadata(key: string, opts?: { type?: string }) {
      return { value: read(key, opts?.type ?? 'text'), metadata: store.get(key)?.metadata ?? null };
    },
    async put(key: string, value: unknown, opts?: { metadata?: unknown }) {
      store.set(key, { value: toBuf(value), metadata: opts?.metadata });
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
  return kv;
}

const CODE = 'un-code-assez-long-2026';
function setup(adminCode: string | undefined = CODE) {
  const kv = memoryKv();
  const pending: Promise<unknown>[] = [];
  const env = { AUDIO: kv as unknown as KVNamespace, ADMIN_CODE: adminCode } as AudioEnv;
  const call = async (path: string, init: RequestInit & { admin?: boolean } = {}) => {
    const headers = new Headers(init.headers);
    if (init.admin) headers.set('authorization', `Bearer ${CODE}`);
    const res = await handleAudio(new Request(`https://forge.example${path}`, { ...init, headers }), env, (p) => pending.push(p));
    await Promise.all(pending);
    return res!;
  };
  return { kv, call };
}

const bytes = (n: number) => {
  const a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = i % 251;
  return a;
};

async function createWithFile(call: ReturnType<typeof setup>['call'], size: number) {
  const created = (await (
    await call('/api/admin/audio', {
      method: 'POST',
      admin: true,
      body: JSON.stringify({ title: 'Lâcher prise', format: 'hypnose', themes: ['lacher-prise', 'inconnu'], durationSec: 1200 }),
    })
  ).json()) as { item: AudioItem };
  return upload(call, created.item.id, bytes(size), 'audio/x-m4a');
}

/** Envoi morceau par morceau, comme l'app. */
async function upload(call: ReturnType<typeof setup>['call'], id: string, data: Uint8Array, mime: string) {
  const start = await call(`/api/admin/audio/${id}/upload`, { method: 'POST', admin: true, body: JSON.stringify({ size: data.byteLength, mime }) });
  expect(start.status).toBe(201);
  const { version, chunks } = (await start.json()) as { version: string; chunks: number };
  for (let n = 0; n < chunks; n++) {
    const res = await call(`/api/admin/audio/${id}/upload/${version}/${n}`, { method: 'PUT', admin: true, body: data.slice(n * CHUNK_SIZE, (n + 1) * CHUNK_SIZE) });
    expect(res.status).toBe(200);
  }
  const done = await call(`/api/admin/audio/${id}/upload/${version}/done`, { method: 'POST', admin: true });
  expect(done.status).toBe(200);
  return ((await done.json()) as { item: AudioItem }).item;
}

describe('plages d’octets', () => {
  it('lit les formes courantes de l’en-tête Range', () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange('bytes=0-1', 100)).toEqual({ start: 0, end: 1 });
    expect(parseRange('bytes=10-', 100)).toEqual({ start: 10, end: 99 });
    expect(parseRange('bytes=-20', 100)).toEqual({ start: 80, end: 99 });
    expect(parseRange('bytes=50-500', 100)).toEqual({ start: 50, end: 99 });
    expect(parseRange('bytes=100-', 100)).toBe('invalid');
    expect(parseRange('items=0-1', 100)).toBe('invalid');
  });
});

describe('métadonnées', () => {
  it('nettoie et borne les champs', () => {
    const m = cleanMeta({ title: '  Dormir  ', format: 'inconnu', categories: ['dormir', 'x', 'dormir'], tags: ['nuit', 3], durationSec: -5, published: 'oui' });
    expect(m).toMatchObject({ title: 'Dormir', format: 'relaxation', categories: ['dormir'], tags: ['nuit'], durationSec: 0, published: false });
  });
});

describe('administration', () => {
  it('reste fermée tant que le code n’est pas configuré', async () => {
    const { call } = setup('');
    const res = await call('/api/admin/check', { admin: true });
    expect(res.status).toBe(503);
  });

  it('refuse un code incorrect', async () => {
    const { call } = setup();
    expect((await call('/api/admin/check', { headers: { authorization: 'Bearer mauvais-code-123' } })).status).toBe(401);
    expect((await call('/api/admin/check')).status).toBe(401);
    expect((await call('/api/admin/check', { admin: true })).status).toBe(200);
  });

  it('crée une séance, envoie le fichier en morceaux, publie, puis supprime tout', async () => {
    const { call, kv } = setup();
    const size = CHUNK_SIZE * 2 + 1234;
    const item = await createWithFile(call, size);
    expect(item.themes).toEqual(['lacher-prise']);
    expect(item.file).toMatchObject({ size, chunks: 3, mime: 'audio/mp4' });
    expect(item.published).toBe(false);

    // Pas visible tant que la séance n'est pas publiée.
    expect(((await (await call('/api/audio')).json()) as { items: AudioItem[] }).items).toHaveLength(0);
    const pub = await call(`/api/admin/audio/${item.id}`, { method: 'PUT', admin: true, body: JSON.stringify({ published: true }) });
    expect(((await pub.json()) as { item: AudioItem }).item.published).toBe(true);
    expect(((await (await call('/api/audio')).json()) as { items: AudioItem[] }).items.map((i) => i.title)).toEqual(['Lâcher prise']);

    await call(`/api/admin/audio/${item.id}`, { method: 'DELETE', admin: true });
    expect([...kv.store.keys()].filter((k) => !k.startsWith('upload:'))).toEqual(['catalog']);
  });

  it('refuse de publier une séance sans fichier', async () => {
    const { call } = setup();
    const created = (await (await call('/api/admin/audio', { method: 'POST', admin: true, body: JSON.stringify({ title: 'Brouillon' }) })).json()) as { item: AudioItem };
    const res = await call(`/api/admin/audio/${created.item.id}`, { method: 'PUT', admin: true, body: JSON.stringify({ published: true }) });
    expect(res.status).toBe(400);
  });

  it('remplace le fichier et efface l’ancienne version', async () => {
    const { call, kv } = setup();
    const first = await createWithFile(call, 1000);
    const second = await upload(call, first.id, bytes(500), 'audio/mpeg');
    expect(second.file!.version).not.toBe(first.file!.version);
    expect([...kv.store.keys()].some((k) => k.includes(first.file!.version))).toBe(false);
    expect([...kv.store.keys()].some((k) => k.startsWith('upload:'))).toBe(false);
  });

  it('refuse un format qui n’est pas de l’audio', async () => {
    const { call } = setup();
    const item = await createWithFile(call, 10);
    const res = await call(`/api/admin/audio/${item.id}/upload`, { method: 'POST', admin: true, body: JSON.stringify({ size: 10, mime: 'video/mp4' }) });
    expect(res.status).toBe(415);
    const big = await call(`/api/admin/audio/${item.id}/upload`, { method: 'POST', admin: true, body: JSON.stringify({ size: 200 * 1024 * 1024, mime: 'audio/mpeg' }) });
    expect(big.status).toBe(413);
  });
});

describe('lecture', () => {
  it('sert le fichier entier puis une plage à cheval sur deux morceaux', async () => {
    const { call } = setup();
    const size = CHUNK_SIZE + 5000;
    const item = await createWithFile(call, size);
    const v = item.file!.version;

    const full = await call(`/api/audio/${item.id}/file?v=${v}`);
    expect(full.status).toBe(200);
    expect(full.headers.get('accept-ranges')).toBe('bytes');
    expect(new Uint8Array(await full.arrayBuffer())).toEqual(bytes(size));

    const start = CHUNK_SIZE - 10;
    const part = await call(`/api/audio/${item.id}/file?v=${v}`, { headers: { range: `bytes=${start}-${start + 29}` } });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe(`bytes ${start}-${start + 29}/${size}`);
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(bytes(size).slice(start, start + 30));

    expect((await call(`/api/audio/${item.id}/file?v=${v}`, { headers: { range: `bytes=${size}-` } })).status).toBe(416);
  });

  it('sert la couverture avec son type', async () => {
    const { call } = setup();
    const item = await createWithFile(call, 10);
    const up = await call(`/api/admin/audio/${item.id}/cover`, { method: 'PUT', admin: true, headers: { 'content-type': 'image/webp' }, body: bytes(300) });
    const cover = ((await up.json()) as { item: AudioItem }).item.cover!;
    const res = await call(`/api/audio/${item.id}/cover?v=${cover.version}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect((await res.arrayBuffer()).byteLength).toBe(300);
  });
});

describe('envoi par morceaux', () => {
  it('refuse un morceau de mauvaise taille', async () => {
    const { call } = setup();
    const created = (await (await call('/api/admin/audio', { method: 'POST', admin: true, body: JSON.stringify({ title: 'Test' }) })).json()) as { item: AudioItem };
    const start = (await (
      await call(`/api/admin/audio/${created.item.id}/upload`, { method: 'POST', admin: true, body: JSON.stringify({ size: CHUNK_SIZE + 10, mime: 'audio/mpeg' }) })
    ).json()) as {
      version: string;
    };
    const bad = await call(`/api/admin/audio/${created.item.id}/upload/${start.version}/0`, { method: 'PUT', admin: true, body: bytes(100) });
    expect(bad.status).toBe(400);
    const extra = await call(`/api/admin/audio/${created.item.id}/upload/${start.version}/5`, { method: 'PUT', admin: true, body: bytes(10) });
    expect(extra.status).toBe(400);
  });
});
