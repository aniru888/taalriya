import * as Tone from "tone";
import { getSample, listSampleKeys, putSample, deleteSample } from "./sample-store";

// Bols the app cares about by default. Users may upload more if they wish.
export const REQUIRED_BOLS = ["Dha", "Dhin", "Na", "Tin", "Ta", "Ghe"] as const;

export const BOL_LIBRARY: { name: string; label: string; tone: "bass" | "treble" | "combo" }[] = [
  { name: "Dha", label: "Dha", tone: "combo" },
  { name: "Dhin", label: "Dhin", tone: "combo" },
  { name: "Ghe", label: "Ghe", tone: "bass" },
  { name: "Ke", label: "Ke", tone: "bass" },
  { name: "Na", label: "Na", tone: "treble" },
  { name: "Ta", label: "Ta", tone: "treble" },
  { name: "Tin", label: "Tin", tone: "treble" },
  { name: "Tu", label: "Tu", tone: "treble" },
  { name: "Te", label: "Te", tone: "treble" },
  { name: "Ra", label: "Ra", tone: "treble" },
  { name: "Tirakita", label: "Tirakita", tone: "combo" },
  { name: "-", label: "Rest", tone: "treble" },
];

// Aliases let taal definitions reuse a single uploaded sample.
const ALIASES: Record<string, string> = {
  ge: "ghe",
  ga: "ghe",
  ki: "ke",
  kat: "ke",
  dhe: "dha",
  dhet: "dha",
  ti: "te",
  tun: "tu",
};

const norm = (b: string) => {
  const k = (b || "").trim().toLowerCase();
  return ALIASES[k] ?? k;
};

let masterGain: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeSamples(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function startAudio() {
  await Tone.start();
  const ctx = Tone.getContext().rawContext as AudioContext;
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.95;
    masterGain.connect(ctx.destination);
  }
  // Lazy-load any samples we haven't decoded yet.
  await hydrateBuffers();
}

async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const ctx = Tone.getContext().rawContext as AudioContext;
  const arr = await blob.arrayBuffer();
  return await ctx.decodeAudioData(arr.slice(0));
}

async function hydrateBuffers() {
  const keys = await listSampleKeys();
  await Promise.all(
    keys.map(async (k) => {
      if (buffers.has(k)) return;
      const blob = await getSample(k);
      if (!blob) return;
      try {
        buffers.set(k, await decodeBlob(blob));
      } catch (e) {
        console.warn("Failed to decode sample for", k, e);
      }
    }),
  );
}

export async function uploadSample(bol: string, file: File) {
  const k = norm(bol);
  await putSample(k, file);
  // re-decode
  try {
    const buf = await decodeBlob(file);
    buffers.set(k, buf);
  } catch (e) {
    console.error("Decode failed", e);
    throw new Error("Could not decode audio file. Try MP3 or WAV.");
  }
  emit();
}

export async function removeSample(bol: string) {
  const k = norm(bol);
  await deleteSample(k);
  buffers.delete(k);
  emit();
}

export function hasSample(bol: string) {
  return buffers.has(norm(bol));
}

export async function loadedSampleKeys(): Promise<string[]> {
  await hydrateBuffers();
  return Array.from(buffers.keys());
}

/** Schedule (or fire now) a single bol via Web Audio for sample-accurate timing. */
export function playBol(bolRaw: string, time?: number, velocity = 1) {
  const b = (bolRaw || "").trim().toLowerCase();
  if (!b || b === "-" || b === "x" || b === "s") return;

  // Tirakita = 4-stroke micro-roll inside one beat using available samples.
  if (b === "tirakita" || b === "tirikita") {
    const ctx = Tone.getContext().rawContext as AudioContext;
    const t0 = time ?? ctx.currentTime;
    const step = 60 / Tone.getTransport().bpm.value / 4; // one 16th
    const roll = ["te", "ke", "te", "na"];
    roll.forEach((x, i) => fireOne(x, t0 + i * step, velocity * 0.85));
    return;
  }

  fireOne(b, time, velocity);
}

function fireOne(bolKey: string, time: number | undefined, velocity: number) {
  const ctx = Tone.getContext().rawContext as AudioContext;
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.95;
    masterGain.connect(ctx.destination);
  }
  const buf = buffers.get(norm(bolKey));
  if (!buf) return; // no sample uploaded — stay silent
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = Math.max(0, Math.min(1.5, velocity));
  src.connect(g).connect(masterGain);
  src.start(time ?? ctx.currentTime);
}

export function setMasterVolume(v: number) {
  if (!masterGain) return;
  masterGain.gain.value = v;
}
