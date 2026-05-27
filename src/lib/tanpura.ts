import { ensureAudio, getAudioContext } from "./audio-engine";

// Tanpura system: upload your own recordings tagged per scale, play with
// seamless looping. When a recording for the chosen scale isn't available,
// the nearest one is pitch-shifted via playbackRate (semitone ratio).

const DB_NAME = "taalriya-tanpura";
const STORE_BLOBS = "blobs";
const STORE_META = "meta";
const VERSION = 1;

export const SCALES = [
  "C","C#","D","D#","E","F","F#","G","G#","A","A#","B",
] as const;
export type Scale = (typeof SCALES)[number];

export interface TanpuraMeta {
  id: string;
  name: string;
  scale: Scale;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_BLOBS)) db.createObjectStore(STORE_BLOBS);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const r = fn(t.objectStore(store));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

export async function listTanpuras(): Promise<TanpuraMeta[]> {
  const v = await run<TanpuraMeta[]>(STORE_META, "readonly",
    (s) => s.getAll() as IDBRequest<TanpuraMeta[]>);
  return v.sort((a, b) => a.createdAt - b.createdAt);
}

async function getTanpuraBlob(id: string) {
  return run<Blob | undefined>(STORE_BLOBS, "readonly",
    (s) => s.get(id) as IDBRequest<Blob | undefined>);
}

export async function deleteTanpura(id: string) {
  await run(STORE_BLOBS, "readwrite", (s) => s.delete(id));
  await run(STORE_META, "readwrite", (s) => s.delete(id));
  buffers.delete(id);
  meta = await listTanpuras();
  emit();
}

const buffers = new Map<string, AudioBuffer>();
let meta: TanpuraMeta[] = [];
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export function subscribeTanpura(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function getTanpuraLibrary() { return meta; }

async function decode(blob: Blob): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  return await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
}

export async function hydrateTanpura() {
  await ensureAudio();
  meta = await listTanpuras();
  await Promise.all(
    meta.map(async (m) => {
      if (buffers.has(m.id)) return;
      const b = await getTanpuraBlob(m.id);
      if (!b) return;
      try { buffers.set(m.id, await decode(b)); } catch (e) { console.warn(e); }
    }),
  );
  emit();
}

export async function addTanpura(name: string, scale: Scale, file: File) {
  await ensureAudio();
  const m: TanpuraMeta = {
    id: crypto.randomUUID(),
    name: name.trim() || `Tanpura ${scale}`,
    scale,
    createdAt: Date.now(),
  };
  try {
    const buf = await decode(file);
    buffers.set(m.id, buf);
  } catch {
    throw new Error("Could not decode audio. Try MP3, WAV or OGG.");
  }
  await run(STORE_BLOBS, "readwrite", (s) => s.put(file, m.id));
  await run(STORE_META, "readwrite", (s) => s.put(m, m.id));
  meta = await listTanpuras();
  emit();
  return m;
}

// Scale index helpers
function scaleIndex(s: Scale) { return SCALES.indexOf(s); }
function semitoneDelta(from: Scale, to: Scale) {
  // shortest signed delta in [-6, 6]
  let d = scaleIndex(to) - scaleIndex(from);
  while (d > 6) d -= 12;
  while (d < -6) d += 12;
  return d;
}

export function findBestForScale(target: Scale): { meta: TanpuraMeta; semitones: number } | null {
  if (meta.length === 0) return null;
  // Prefer exact match; else nearest by absolute semitone distance.
  let best = meta[0];
  let bestAbs = Math.abs(semitoneDelta(best.scale, target));
  for (const m of meta) {
    const d = Math.abs(semitoneDelta(m.scale, target));
    if (d < bestAbs) { best = m; bestAbs = d; }
  }
  return { meta: best, semitones: semitoneDelta(best.scale, target) };
}

// Playback
let tanpuraOut: GainNode | null = null;
let activeSrc: AudioBufferSourceNode | null = null;
let activeId: string | null = null;
let tanpuraVolume = 0.7;

function ensureOut() {
  const ctx = getAudioContext();
  if (!tanpuraOut) {
    tanpuraOut = ctx.createGain();
    tanpuraOut.gain.value = tanpuraVolume;
    tanpuraOut.connect(ctx.destination);
  }
  return { ctx, out: tanpuraOut };
}

export function setTanpuraVolume(v: number) {
  tanpuraVolume = Math.max(0, Math.min(1, v));
  if (tanpuraOut) tanpuraOut.gain.value = tanpuraVolume;
}
export function getTanpuraVolume() { return tanpuraVolume; }

export async function playTanpuraScale(scale: Scale) {
  await ensureAudio();
  await hydrateTanpura();
  const pick = findBestForScale(scale);
  if (!pick) return false;
  const buf = buffers.get(pick.meta.id);
  if (!buf) return false;
  stopTanpura();
  const { ctx, out } = ensureOut();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.playbackRate.value = Math.pow(2, pick.semitones / 12);
  // Tiny fade-in to avoid click on loop start
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.08);
  src.connect(g).connect(out);
  src.start(0);
  activeSrc = src;
  activeId = pick.meta.id;
  return true;
}

export function stopTanpura() {
  if (activeSrc) {
    try {
      const ctx = getAudioContext();
      // tiny fade-out
      const node = activeSrc;
      node.stop(ctx.currentTime + 0.08);
    } catch { /* noop */ }
    activeSrc = null;
    activeId = null;
  }
}

export function isTanpuraPlaying() { return activeSrc !== null; }
export function activeTanpuraId() { return activeId; }
