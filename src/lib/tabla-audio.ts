import * as Tone from "tone";

// Bol = a single tabla syllable. "-" or "" means rest.
export type Bol = string;

let initialized = false;
let dayan: Tone.MembraneSynth; // right (treble) drum
let dayanRing: Tone.MetalSynth; // ringing/pitched overtones
let bayan: Tone.MembraneSynth; // left (bass) drum
let bayanBend: Tone.MembraneSynth; // bass with pitch bend (Ghe)
let slap: Tone.NoiseSynth; // dry slap (Ta/Na rim)

let dayanGain: Tone.Gain;
let bayanGain: Tone.Gain;
let slapGain: Tone.Gain;
let masterGain: Tone.Gain;

function ensureInit() {
  if (initialized) return;

  masterGain = new Tone.Gain(0.9).toDestination();
  const verb = new Tone.Reverb({ decay: 1.6, wet: 0.18, preDelay: 0.01 }).connect(masterGain);
  const hp = new Tone.Filter(60, "highpass").connect(verb);

  dayanGain = new Tone.Gain(0.7).connect(hp);
  dayan = new Tone.MembraneSynth({
    pitchDecay: 0.012,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.2 },
    oscillator: { type: "sine" },
  }).connect(dayanGain);

  dayanRing = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.35, release: 0.25 },
    harmonicity: 5.1,
    modulationIndex: 16,
    resonance: 3200,
    octaves: 1.2,
  } as any);
  const ringGain = new Tone.Gain(0.18).connect(hp);
  dayanRing.connect(ringGain);

  bayanGain = new Tone.Gain(0.9).connect(hp);
  bayan = new Tone.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.4 },
    oscillator: { type: "sine" },
  }).connect(bayanGain);

  bayanBend = new Tone.MembraneSynth({
    pitchDecay: 0.18,
    octaves: 8,
    envelope: { attack: 0.002, decay: 0.55, sustain: 0, release: 0.5 },
    oscillator: { type: "sine" },
  }).connect(bayanGain);

  slapGain = new Tone.Gain(0.25).connect(hp);
  slap = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.05 },
  }).connect(slapGain);

  initialized = true;
}

export async function startAudio() {
  ensureInit();
  await Tone.start();
}

// Play a single bol immediately or at a scheduled time.
export function playBol(bolRaw: Bol, time?: number, velocity = 1) {
  if (!initialized) ensureInit();
  const bol = (bolRaw || "").trim().toLowerCase();
  if (!bol || bol === "-" || bol === "x" || bol === "s") return;
  const t = time ?? Tone.now();

  switch (bol) {
    case "dha":
      bayan.triggerAttackRelease("A1", "8n", t, 0.9 * velocity);
      dayan.triggerAttackRelease("D4", "16n", t, 0.8 * velocity);
      dayanRing.triggerAttackRelease("D5", 0.18, t, 0.5 * velocity);
      break;
    case "dhin":
      bayan.triggerAttackRelease("A1", "8n", t, 0.85 * velocity);
      dayan.triggerAttackRelease("E4", "8n", t, 0.7 * velocity);
      dayanRing.triggerAttackRelease("E5", 0.28, t, 0.55 * velocity);
      break;
    case "dhe":
    case "dhet":
      bayan.triggerAttackRelease("A1", "16n", t, 0.7 * velocity);
      slap.triggerAttackRelease(0.05, t, 0.6 * velocity);
      break;
    case "ge":
    case "ghe":
    case "ga":
      bayanBend.triggerAttackRelease("F1", "8n", t, 0.9 * velocity);
      break;
    case "ke":
    case "ki":
    case "kat":
      bayan.triggerAttackRelease("C2", "32n", t, 0.4 * velocity);
      slap.triggerAttackRelease(0.03, t, 0.3 * velocity);
      break;
    case "na":
      dayan.triggerAttackRelease("E4", "16n", t, 0.7 * velocity);
      dayanRing.triggerAttackRelease("E5", 0.22, t, 0.6 * velocity);
      slap.triggerAttackRelease(0.02, t, 0.3 * velocity);
      break;
    case "ta":
      dayan.triggerAttackRelease("F4", "16n", t, 0.7 * velocity);
      slap.triggerAttackRelease(0.03, t, 0.45 * velocity);
      break;
    case "tin":
      dayan.triggerAttackRelease("E4", "8n", t, 0.65 * velocity);
      dayanRing.triggerAttackRelease("E5", 0.24, t, 0.5 * velocity);
      break;
    case "tu":
    case "tun":
      dayan.triggerAttackRelease("D4", "8n", t, 0.7 * velocity);
      dayanRing.triggerAttackRelease("D5", 0.28, t, 0.55 * velocity);
      break;
    case "ti":
    case "te":
      slap.triggerAttackRelease(0.025, t, 0.45 * velocity);
      dayan.triggerAttackRelease("G4", "32n", t, 0.35 * velocity);
      break;
    case "ra":
      slap.triggerAttackRelease(0.02, t, 0.4 * velocity);
      break;
    case "tirakita":
    case "tirikita": {
      // micro-roll: 4 sixteenths within one beat
      const step = Tone.Time("16n").toSeconds() / 1.0;
      slap.triggerAttackRelease(0.02, t, 0.4);
      dayan.triggerAttackRelease("G4", "32n", t + step * 0.5, 0.35);
      slap.triggerAttackRelease(0.02, t + step, 0.4);
      dayan.triggerAttackRelease("F4", "32n", t + step * 1.5, 0.4);
      break;
    }
    default:
      // unknown bol — soft click so user hears placement
      slap.triggerAttackRelease(0.02, t, 0.25);
  }
}

export const BOL_LIBRARY: { name: string; label: string; tone: "bass" | "treble" | "combo" }[] = [
  { name: "Dha", label: "Dha", tone: "combo" },
  { name: "Dhin", label: "Dhin", tone: "combo" },
  { name: "Ge", label: "Ge", tone: "bass" },
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

export function setMasterVolume(v: number) {
  if (!initialized) return;
  masterGain.gain.rampTo(v, 0.05);
}
