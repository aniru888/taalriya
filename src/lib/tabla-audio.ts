import * as Tone from "tone";
import {
  type BolMeta,
  getBlob,
  listMeta,
  putBol,
  removeBol,
  renameBol,
} from "./sample-store";

let masterGain: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>(); // id -> buffer
let metaCache: BolMeta[] = [];
const listeners = new Set<() => void>();

// Global tabla pitch shift in semitones (relative to recording).
let tablaSemitones = 0;

function emit() {
  for (const l of listeners) l();
}

export function subscribeLibrary(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getLibrary(): BolMeta[] {
  return metaCache;
}

export function setTablaSemitones(n: number) {
  tablaSemitones = Math.max(-12, Math.min(12, n));
}

export function getTablaSemitones() {
  return tablaSemitones;
}

export async function startAudio() {
  await Tone.start();
  const ctx = Tone.getContext().rawContext as AudioContext;
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.95;
    masterGain.connect(ctx.destination);
  }
  await hydrate();
}

async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const arr = await blob.arrayBuffer();
  return await ctx.decodeAudioData(arr.slice(0));
}

async function hydrate() {
  metaCache = await listMeta();
  await Promise.all(
    metaCache.map(async (m) => {
      if (buffers.has(m.id)) return;
      const blob = await getBlob(m.id);
      if (!blob) return;
      try {
        buffers.set(m.id, await decodeBlob(blob));
      } catch (e) {
        console.warn("Decode failed", m.name, e);
      }
    }),
  );
  emit();
}

export async function addBol(name: string, file: File): Promise<BolMeta> {
  await startAudio();
  const meta: BolMeta = {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled",
    createdAt: Date.now(),
  };
  try {
    const buf = await decodeBlob(file);
    buffers.set(meta.id, buf);
  } catch {
    throw new Error("Could not decode audio. Try MP3 or WAV.");
  }
  await putBol(meta, file);
  metaCache = await listMeta();
  emit();
  return meta;
}

export async function rename(id: string, name: string) {
  await renameBol(id, name.trim() || "Untitled");
  metaCache = await listMeta();
  emit();
}

export async function remove(id: string) {
  await removeBol(id);
  buffers.delete(id);
  metaCache = await listMeta();
  emit();
}

export function findByName(name: string): BolMeta | undefined {
  const n = (name || "").trim().toLowerCase();
  if (!n) return undefined;
  return metaCache.find((m) => m.name.trim().toLowerCase() === n);
}

function fireBuffer(buf: AudioBuffer, time: number | undefined, velocity: number) {
  const ctx = Tone.getContext().rawContext as AudioContext;
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.95;
    masterGain.connect(ctx.destination);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  // Apply global pitch shift via playbackRate (preserves natural texture).
  src.playbackRate.value = Math.pow(2, tablaSemitones / 12);
  const g = ctx.createGain();
  g.gain.value = Math.max(0, Math.min(1.5, velocity));
  src.connect(g).connect(masterGain);
  src.start(time ?? ctx.currentTime);
}

export function playById(id: string | null | undefined, time?: number, velocity = 1) {
  if (!id) return;
  const buf = buffers.get(id);
  if (!buf) return;
  fireBuffer(buf, time, velocity);
}

export function playByName(name: string, time?: number, velocity = 1) {
  const m = findByName(name);
  if (!m) return;
  playById(m.id, time, velocity);
}

export function setMasterVolume(v: number) {
  if (!masterGain) return;
  masterGain.gain.value = v;
}
