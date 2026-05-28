// Precision Web Audio scheduler for rhythm-training playback.
//
// Design:
// - Single shared AudioContext: master -> compressor -> destination.
// - 25ms lookahead loop schedules events at exact audio-clock times.
// - Visual callbacks fire from a rAF queue keyed to audioContext.currentTime
//   so the beat glow lights when the sample actually plays (not before).
// - Per-voice GainNode applies 3ms fade-in / 8ms fade-out to kill clicks.
// - Buffers are peak-normalized once on decode (-1 dBFS target) so soft
//   uploads play loud and clear without clipping.
// - Tempo updates apply at the next scheduled note (quantized via lookahead),
//   so loops stay BPM-locked.

export interface Voice {
  sampleId: string | null;
  /** Position inside the beat, 0..1. 0 = downbeat. */
  offset?: number;
  velocity?: number;
}

export interface Beat {
  voices: Voice[];
}

export interface OnBeatInfo {
  beatIndex: number;
  voiceIndex: number; // -1 for rest
  audioTime: number;
}

export interface TransportOptions {
  bpm: number;
  beats: Beat[];
  loop: boolean;
  onBeat: (info: OnBeatInfo) => void;
  onCycle?: (cycle: number) => void;
}

const SCHEDULE_AHEAD = 0.1; // seconds
const TICK_MS = 25;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let eqNode: BiquadFilterNode | null = null;

const buffers = new Map<string, AudioBuffer>();
const normGain = new Map<string, number>();

let semitones = 0;
let compressorEnabled = true;

interface ActiveState {
  opts: TransportOptions;
  nextNoteTime: number;
  beatIdx: number;
  cycle: number;
  visualQueue: OnBeatInfo[];
  voiceNodes: Set<AudioBufferSourceNode>; // for cleanup
  schedulerId: number | null;
  rafId: number | null;
  stopping: boolean;
}

let active: ActiveState | null = null;
let paused: { beatIdx: number; cycle: number } | null = null;

function ensureCtx(): AudioContext {
  if (ctx) return ctx;
  const C = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  ctx = new C();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.95;
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -10;
  compressor.knee.value = 24;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.12;
  eqNode = ctx.createBiquadFilter();
  eqNode.type = "peaking";
  eqNode.frequency.value = 3500;
  eqNode.Q.value = 0.9;
  eqNode.gain.value = 2; // subtle presence tilt for tabla clarity
  masterGain.connect(eqNode);
  eqNode.connect(compressor);
  compressor.connect(ctx.destination);
  return ctx;
}

export async function ensureAudio() {
  const c = ensureCtx();
  if (c.state === "suspended") await c.resume();
}

export function getAudioContext(): AudioContext {
  return ensureCtx();
}

export function setSemitones(n: number) {
  semitones = Math.max(-12, Math.min(12, n | 0));
}
export function getSemitones() {
  return semitones;
}

export function setMasterVolume(v: number) {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1.5, v));
}

export function setCompressorEnabled(on: boolean) {
  compressorEnabled = on;
  if (!ctx || !masterGain || !compressor || !eqNode) return;
  if (on) {
    masterGain.connect(eqNode);
    eqNode.connect(compressor);
    compressor.connect(ctx.destination);
    try { masterGain.disconnect(ctx.destination); } catch { /* wasn't direct */ }
  } else {
    masterGain.connect(ctx.destination);
    try { masterGain.disconnect(eqNode); } catch { /* wasn't via compressor */ }
    try { eqNode.disconnect(); } catch { /* noop */ }
    try { compressor.disconnect(); } catch { /* noop */ }
  }
}

export function isCompressorEnabled() {
  return compressorEnabled;
}

async function decode(blob: Blob | ArrayBuffer): Promise<AudioBuffer> {
  const c = ensureCtx();
  const arr = blob instanceof Blob ? await blob.arrayBuffer() : blob;
  // slice(0) to detach in case caller reuses the buffer
  return await c.decodeAudioData(arr.slice(0) as ArrayBuffer);
}

function computePeak(buf: AudioBuffer): number {
  let peak = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const a = d[i] < 0 ? -d[i] : d[i];
      if (a > peak) peak = a;
    }
  }
  return peak;
}

export async function registerSample(id: string, source: Blob | ArrayBuffer): Promise<AudioBuffer> {
  await ensureAudio();
  if (buffers.has(id)) return buffers.get(id)!;
  const buf = await decode(source);
  const peak = computePeak(buf);
  // Normalize peak to ~-1 dBFS (0.89). Cap to 8x to avoid blowing up near-silence.
  const target = 0.89;
  const gain = peak > 0.001 ? Math.min(8, target / peak) : 1;
  buffers.set(id, buf);
  normGain.set(id, gain);
  return buf;
}

export function unregisterSample(id: string) {
  buffers.delete(id);
  normGain.delete(id);
  if (active && active.opts.beats.some(b => b.voices.some(v => v.sampleId === id))) {
    stopTransport();
  }
}

export function hasSample(id: string) {
  return buffers.has(id);
}

export function getSampleDurationMs(id: string): number | null {
  const b = buffers.get(id);
  return b ? Math.round(b.duration * 1000) : null;
}

function fireVoice(sampleId: string, when: number, velocity: number): AudioBufferSourceNode | null {
  const buf = buffers.get(sampleId);
  if (!buf || !ctx || !masterGain) return null;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.pow(2, semitones / 12);

  const g = ctx.createGain();
  const norm = normGain.get(sampleId) ?? 1;
  const v = Math.max(0, Math.min(1.5, velocity));
  const peakV = Math.max(0.0002, norm * v);
  const dur = buf.duration / src.playbackRate.value;

  // 3ms attack fade, 8ms release fade — removes loop-seam clicks.
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peakV, when + 0.003);
  const releaseStart = Math.max(when + 0.005, when + dur - 0.008);
  g.gain.setValueAtTime(peakV, releaseStart);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  src.connect(g).connect(masterGain);
  src.start(when);
  src.stop(when + dur + 0.02);
  src.onended = () => {
    try { src.disconnect(); g.disconnect(); } catch { /* noop */ }
    if (active) active.voiceNodes.delete(src);
  };
  return src;
}

export function previewSample(sampleId: string, velocity = 1) {
  ensureAudio().then(() => {
    if (!ctx) return;
    fireVoice(sampleId, ctx.currentTime + 0.01, velocity);
  });
}

export function startTransport(opts: TransportOptions): () => void {
  const resumeFrom = paused;
  stopTransport();
  ensureAudio();
  if (!ctx) return () => {};

  const state: ActiveState = {
    opts,
    nextNoteTime: ctx.currentTime + 0.08,
    beatIdx: resumeFrom?.beatIdx ?? 0,
    cycle: resumeFrom?.cycle ?? 0,
    visualQueue: [],
    voiceNodes: new Set(),
    schedulerId: null,
    rafId: null,
    stopping: false,
  };
  active = state;

  const scheduleTick = () => {
    if (!active || active !== state || !ctx) return;
    const beats = state.opts.beats;
    if (beats.length === 0) return;
    const beatDur = 60 / Math.max(20, state.opts.bpm);

    while (state.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD && !state.stopping) {
      const beat = beats[state.beatIdx];
      const when0 = state.nextNoteTime;
      if (beat && beat.voices.length > 0) {
        for (let vi = 0; vi < beat.voices.length; vi++) {
          const voice = beat.voices[vi];
          const off = Math.max(0, Math.min(0.999, voice.offset ?? 0));
          const when = when0 + off * beatDur;
          if (voice.sampleId) {
            const node = fireVoice(voice.sampleId, when, voice.velocity ?? 1);
            if (node) state.voiceNodes.add(node);
          }
          state.visualQueue.push({ beatIndex: state.beatIdx, voiceIndex: vi, audioTime: when });
        }
      } else {
        // Rest beat: emit a visual tick at the downbeat so glow still moves.
        state.visualQueue.push({ beatIndex: state.beatIdx, voiceIndex: -1, audioTime: when0 });
      }

      state.beatIdx++;
      if (state.beatIdx >= beats.length) {
        state.beatIdx = 0;
        state.cycle++;
        state.opts.onCycle?.(state.cycle);
        if (!state.opts.loop) {
          state.stopping = true;
          const stopAt = when0 + beatDur;
          const ms = Math.max(0, (stopAt - ctx.currentTime) * 1000);
          window.setTimeout(() => { if (active === state) stopTransport(); }, ms + 30);
        }
      }
      state.nextNoteTime += beatDur;
    }
  };

  const visualTick = () => {
    if (!active || active !== state || !ctx) return;
    const now = ctx.currentTime;
    while (state.visualQueue.length && state.visualQueue[0].audioTime <= now) {
      const ev = state.visualQueue.shift()!;
      try { state.opts.onBeat(ev); } catch { /* noop */ }
    }
    state.rafId = requestAnimationFrame(visualTick);
  };

  scheduleTick();
  state.schedulerId = window.setInterval(scheduleTick, TICK_MS);
  state.rafId = requestAnimationFrame(visualTick);

  return () => stopTransport();
}

function teardownActive(): ActiveState | null {
  if (!active) return null;
  const s = active;
  active = null;
  if (s.schedulerId != null) window.clearInterval(s.schedulerId);
  if (s.rafId != null) cancelAnimationFrame(s.rafId);
  for (const src of s.voiceNodes) {
    try { src.stop(); src.disconnect(); } catch { /* noop */ }
  }
  s.voiceNodes.clear();
  s.visualQueue.length = 0;
  return s;
}

export function pauseTransport() {
  const s = teardownActive();
  if (s) paused = { beatIdx: s.beatIdx, cycle: s.cycle };
}

export function stopTransport() {
  paused = null;
  teardownActive();
}

export function updateTransport(patch: Partial<Pick<TransportOptions, "bpm" | "loop">> & { beats?: Beat[] }) {
  if (!active) return;
  if (patch.bpm != null) active.opts.bpm = patch.bpm;
  if (patch.loop != null) active.opts.loop = patch.loop;
  if (patch.beats) {
    active.opts.beats = patch.beats;
    if (patch.beats.length > 0 && active.beatIdx >= patch.beats.length) {
      active.beatIdx = active.beatIdx % patch.beats.length;
    }
  }
}

export function transportIsRunning() {
  return active !== null;
}
