// Thin facade over the new audio engine. Keeps the existing public API
// stable so SoundLibrary, CustomTaalCreator, TanpuraPanel and the home
// route keep working — and exposes the new transport / subdivision API.

import {
  ensureAudio,
  previewSample,
  registerSample,
  unregisterSample,
  setMasterVolume as engineSetVolume,
  setSemitones as engineSetSemitones,
  getSemitones as engineGetSemitones,
  startTransport as engineStart,
  stopTransport as engineStop,
  updateTransport as engineUpdate,
  setCompressorEnabled,
  isCompressorEnabled,
  hasSample,
} from "./audio-engine";
import {
  type BolMeta,
  getBlob,
  listMeta,
  putBol,
  removeBol,
  renameBol,
} from "./sample-store";

let metaCache: BolMeta[] = [];
const listeners = new Set<() => void>();

function emit() { for (const l of listeners) l(); }

export function subscribeLibrary(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function getLibrary(): BolMeta[] { return metaCache; }

export async function startAudio() {
  await ensureAudio();
  await hydrate();
}

async function hydrate() {
  metaCache = await listMeta();
  await Promise.all(metaCache.map(async (m) => {
    if (hasSample(m.id)) return;
    const blob = await getBlob(m.id);
    if (!blob) return;
    try { await registerSample(m.id, blob); }
    catch (e) { console.warn("Decode failed", m.name, e); }
  }));
  emit();
}

export async function addBol(name: string, file: File): Promise<BolMeta> {
  await ensureAudio();
  const meta: BolMeta = {
    id: crypto.randomUUID(),
    name: name.trim() || "Untitled",
    createdAt: Date.now(),
  };
  try {
    await registerSample(meta.id, file);
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
  unregisterSample(id);
  metaCache = await listMeta();
  emit();
}

export function findByName(name: string): BolMeta | undefined {
  const n = (name || "").trim().toLowerCase();
  if (!n) return undefined;
  return metaCache.find((m) => m.name.trim().toLowerCase() === n);
}

export function findById(id: string): BolMeta | undefined {
  return metaCache.find((m) => m.id === id);
}

export function playById(id: string | null | undefined, _time?: number, velocity = 1) {
  if (!id) return;
  // `_time` is accepted for legacy callers; previews always fire immediately.
  previewSample(id, velocity);
}

export function playByName(name: string, _time?: number, velocity = 1) {
  const m = findByName(name);
  if (m) previewSample(m.id, velocity);
}

// Tabla pitch shift (semitones, global).
export function setTablaSemitones(n: number) { engineSetSemitones(n); }
export function getTablaSemitones() { return engineGetSemitones(); }

export function setMasterVolume(v: number) { engineSetVolume(v); }

// New transport API (re-exported for components)
export {
  engineStart as startTransport,
  engineStop as stopTransport,
  engineUpdate as updateTransport,
  setCompressorEnabled,
  isCompressorEnabled,
};
export type { Beat, Voice, OnBeatInfo, TransportOptions } from "./audio-engine";
