import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Square, Repeat, Volume2, TrendingUp, Star, Timer, Circle, X as XIcon, Sparkles } from "lucide-react";
import {
  setMasterVolume,
  startAudio,
  startTransport,
  stopTransport,
  updateTransport,
  setCompressorEnabled,
  isCompressorEnabled,
  type Beat,
  type OnBeatInfo,
} from "@/lib/tabla-audio";
import { loadSettings, saveSettings } from "@/lib/settings";

/** A single sub-event inside a beat. `play` is legacy; new code should set
 *  `sampleId` + `offset` so the scheduler can fire it sample-accurately. */
export interface Bol {
  label: string;
  sampleId?: string | null;
  /** 0..1 position inside the beat. 0 = downbeat. */
  offset?: number;
  velocity?: number;
}

/** Step model. `bols` is the new shape (1..N voices per matra).
 *  The legacy `play`/`label` pair is still accepted; we wrap it as a
 *  single bol at offset 0 for backward compatibility. */
export interface Step {
  label: string;
  /** Legacy single-voice callback. Ignored if `bols` is provided. */
  play?: ((time: number, velocity?: number) => void) | null;
  /** Optional sample id for the legacy single-voice path. */
  sampleId?: string | null;
  /** New multi-voice / subdivision shape. */
  bols?: Bol[];
}

interface Props {
  steps: Step[];
  title?: string;
  subtitle?: string;
  divisions?: number[];
  sam?: number;       // 1-based beat
  khali?: number[];   // 1-based beats
  taalId?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

function stepToBeat(s: Step): Beat {
  if (s.bols && s.bols.length > 0) {
    return {
      voices: s.bols.map((b) => ({
        sampleId: b.sampleId ?? null,
        offset: b.offset ?? 0,
        velocity: b.velocity ?? 1,
      })),
    };
  }
  if (s.sampleId) {
    return { voices: [{ sampleId: s.sampleId, offset: 0, velocity: 1 }] };
  }
  // Rest beat (no audible voice) — we still emit a visual tick from the engine.
  return { voices: [] };
}

export function TaalPlayer({
  steps, title, subtitle, divisions,
  sam = 1, khali = [], taalId, isFavorite, onToggleFavorite,
}: Props) {
  const initialRef = useRef(loadSettings());
  const initial = initialRef.current;
  const [bpm, setBpm] = useState(initial.bpm);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [currentVoice, setCurrentVoice] = useState(-1);
  const [volume, setVolume] = useState(initial.volume);
  const [compressor, setCompressor] = useState(initial.compressorEnabled);

  // Gradual BPM training
  const [trainOn, setTrainOn] = useState(false);
  const [trainStep, setTrainStep] = useState(4);
  const [trainEvery, setTrainEvery] = useState(2);
  const [trainMax, setTrainMax] = useState(180);

  // Session timer
  const [sessionMs, setSessionMs] = useState(0);
  const [totalMs, setTotalMs] = useState(initial.totalPracticeMs);
  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  // Memoize Beat[] for the engine; recompute when step composition changes.
  const fingerprint = useMemo(
    () => steps.map((s) => {
      if (s.bols && s.bols.length > 0) {
        return s.bols.map((b) => `${b.label}@${b.offset ?? 0}#${b.sampleId ?? ""}`).join(",");
      }
      return `${s.label}#${s.sampleId ?? ""}`;
    }).join("|"),
    [steps],
  );
  const beats = useMemo<Beat[]>(
    () => stepsRef.current.map(stepToBeat),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fingerprint],
  );

  useEffect(() => { setMasterVolume(volume); saveSettings({ volume }); }, [volume]);
  useEffect(() => {
    setCompressorEnabled(compressor);
    saveSettings({ compressorEnabled: compressor });
  }, [compressor]);
  useEffect(() => { saveSettings({ bpm }); }, [bpm]);

  // Live BPM update (no restart, stays loop-quantized via lookahead).
  useEffect(() => {
    if (playing) updateTransport({ bpm });
  }, [bpm, playing]);

  // Live loop update.
  useEffect(() => {
    if (playing) updateTransport({ loop });
  }, [loop, playing]);

  const stop = useCallback(() => {
    stopTransport();
    setPlaying(false);
    setCurrentBeat(-1);
    setCurrentVoice(-1);
  }, []);

  const start = useCallback(async () => {
    await startAudio();
    stopTransport();
    if (beats.length === 0) return;
    setMasterVolume(volume);
    setCompressorEnabled(compressor);
    let cycle = 0;
    startTransport({
      bpm: bpmRef.current,
      beats,
      loop,
      onBeat: (info: OnBeatInfo) => {
        setCurrentBeat(info.beatIndex);
        setCurrentVoice(info.voiceIndex);
      },
      onCycle: () => {
        cycle++;
        if (trainOn && cycle % trainEvery === 0) {
          setBpm((b) => Math.min(trainMax, b + trainStep));
        }
      },
    });
    setPlaying(true);
  }, [beats, loop, volume, compressor, trainOn, trainEvery, trainStep, trainMax]);

  const pause = useCallback(() => {
    // No native pause on the engine — stop and remember the position via re-start.
    stopTransport();
    setPlaying(false);
  }, []);

  useEffect(() => () => stopTransport(), []);

  // Re-arm the transport when composition changes mid-play.
  useEffect(() => {
    if (!playing) return;
    updateTransport({ beats });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  // Session timer ticking while playing
  useEffect(() => {
    if (playing) {
      startedAtRef.current = performance.now();
      tickRef.current = window.setInterval(() => {
        if (startedAtRef.current != null) {
          setSessionMs((ms) => ms + (performance.now() - startedAtRef.current!));
          startedAtRef.current = performance.now();
        }
      }, 1000) as unknown as number;
    } else {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      startedAtRef.current = null;
    }
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [playing]);

  // Persist total accumulated practice
  useEffect(() => {
    setTotalMs(() => {
      const next = initial.totalPracticeMs + sessionMs;
      saveSettings({ totalPracticeMs: next });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionMs]);

  // Keyboard: space play/pause, arrows for BPM
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (playing) pause();
        else start();
      } else if (e.code === "ArrowUp" || e.code === "ArrowRight") {
        e.preventDefault();
        setBpm((b) => Math.min(260, b + (e.shiftKey ? 5 : 1)));
      } else if (e.code === "ArrowDown" || e.code === "ArrowLeft") {
        e.preventDefault();
        setBpm((b) => Math.max(30, b - (e.shiftKey ? 5 : 1)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, pause, start]);

  const divisionStarts = (() => {
    const set = new Set<number>([0]);
    if (divisions) {
      let cum = 0;
      for (const d of divisions) { cum += d; set.add(cum); }
    }
    return set;
  })();

  const samIdx = Math.max(0, sam - 1);
  const khaliSet = new Set(khali.map((k) => k - 1));

  return (
    <div className="glass rounded-2xl p-4 sm:p-5 md:p-7">
      {(title || subtitle) && (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="font-display text-xl sm:text-2xl text-gold truncate">{title}</h3>}
            {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {onToggleFavorite && (
            <button
              onClick={onToggleFavorite}
              aria-label={isFavorite ? "Unfavorite" : "Favorite"}
              className={[
                "shrink-0 p-2 rounded-full border transition",
                isFavorite
                  ? "border-[color:var(--gold)]/70 text-gold bg-[color:var(--accent)]/60 glow-gold"
                  : "border-border text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Star className={["h-4 w-4", isFavorite ? "fill-current" : ""].join(" ")} />
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-6">
        {steps.length === 0 && (
          <div className="w-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Empty taal — add bols to begin.
          </div>
        )}
        {steps.map((s, i) => {
          const active = i === currentBeat;
          const isStart = divisionStarts.has(i);
          const bols = s.bols && s.bols.length > 0 ? s.bols : [{ label: s.label, sampleId: s.sampleId ?? null, offset: 0 }];
          const audible = bols.some((b) => b.sampleId);
          const isRest = !audible && !(s.play);
          const isSam = i === samIdx;
          const isKhali = khaliSet.has(i);
          const hasSubdivisions = bols.length > 1;
          return (
            <div
              key={i}
              className={[
                "relative min-w-[48px] sm:min-w-[56px] md:min-w-[68px] flex-1 max-w-[100px] aspect-[5/4] rounded-xl border flex flex-col items-center justify-center",
                active
                  ? "border-[color:var(--gold)] glow-gold bg-[color:var(--accent)] animate-beat"
                  : "border-border bg-[color:var(--card)] transition-colors duration-75",
                isStart && !active ? "border-[color:var(--gold)]/40" : "",
                isKhali && !active ? "bg-[color:var(--card)]/40" : "",
              ].join(" ")}
            >
              <span className="absolute top-1 left-1.5 text-[9px] sm:text-[10px] text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              {isSam && (
                <span className="absolute top-1 right-1.5 text-[9px] sm:text-[10px] font-display text-gold">X</span>
              )}
              {isKhali && (
                <span className="absolute top-1 right-1.5 text-[9px] sm:text-[10px] text-muted-foreground">o</span>
              )}
              {hasSubdivisions ? (
                <div className="flex items-center gap-0.5 px-1">
                  {bols.map((b, bi) => {
                    const litSub = active && currentVoice === bi;
                    return (
                      <span
                        key={bi}
                        className={[
                          "font-display text-[10px] sm:text-xs leading-tight px-0.5 transition-colors duration-75",
                          litSub ? "text-gold" : "text-foreground/85",
                          !b.sampleId ? "opacity-50" : "",
                        ].join(" ")}
                      >
                        {b.label || "·"}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span
                  className={[
                    "font-display text-xs sm:text-sm md:text-base px-1 text-center break-words leading-tight",
                    isRest ? "text-muted-foreground/40" : "text-foreground",
                    active ? "text-gold" : "",
                    isKhali && !active ? "text-muted-foreground" : "",
                  ].join(" ")}
                >
                  {isRest ? "·" : bols[0].label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {(sam || khali.length > 0) && (
        <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-wider text-muted-foreground mb-4">
          <span className="inline-flex items-center gap-1"><span className="text-gold font-display text-sm leading-none">X</span> Sam</span>
          {khali.length > 0 && (
            <span className="inline-flex items-center gap-1"><Circle className="h-2.5 w-2.5" /> Khali</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {!playing ? (
          <button
            onClick={start}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-4 sm:px-5 py-2.5 text-sm font-medium text-[color:var(--primary-foreground)] glow-gold transition hover:brightness-110 active:scale-95"
          >
            <Play className="h-4 w-4 fill-current" /> Play
          </button>
        ) : (
          <button
            onClick={pause}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-4 sm:px-5 py-2.5 text-sm font-medium text-foreground border border-border hover:border-[color:var(--gold)]/60 transition active:scale-95"
          >
            <Pause className="h-4 w-4 fill-current" /> Pause
          </button>
        )}
        <button
          onClick={stop}
          className="inline-flex items-center gap-2 rounded-full bg-transparent px-3 sm:px-4 py-2.5 text-sm font-medium text-muted-foreground border border-border hover:text-foreground hover:border-foreground/40 transition active:scale-95"
        >
          <Square className="h-4 w-4 fill-current" /> Stop
        </button>
        <button
          onClick={() => setLoop((v) => !v)}
          className={[
            "inline-flex items-center gap-2 rounded-full px-3 sm:px-4 py-2.5 text-sm font-medium border transition active:scale-95",
            loop
              ? "border-[color:var(--gold)]/60 text-gold bg-[color:var(--accent)]/60"
              : "border-border text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <Repeat className="h-4 w-4" /> Loop
        </button>
        <button
          onClick={() => setTrainOn((v) => !v)}
          className={[
            "inline-flex items-center gap-2 rounded-full px-3 sm:px-4 py-2.5 text-sm font-medium border transition active:scale-95",
            trainOn
              ? "border-[color:var(--gold)]/60 text-gold bg-[color:var(--accent)]/60"
              : "border-border text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <TrendingUp className="h-4 w-4" /> Trainer
        </button>
        <button
          onClick={() => setCompressor((v) => { const next = !v; setCompressorEnabled(next); return next; })}
          title="Master compressor / presence EQ for tabla clarity"
          className={[
            "inline-flex items-center gap-2 rounded-full px-3 sm:px-4 py-2.5 text-sm font-medium border transition active:scale-95",
            compressor
              ? "border-[color:var(--gold)]/60 text-gold bg-[color:var(--accent)]/60"
              : "border-border text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <Sparkles className="h-4 w-4" /> Clarity
        </button>

        <div className="flex items-center gap-3 ml-auto min-w-[180px] flex-1 md:max-w-xs">
          <span className="text-xs text-muted-foreground tabular-nums w-14">{bpm} BPM</span>
          <input
            type="range" min={30} max={260} value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="flex-1 accent-[color:var(--gold)]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <input
            type="range" min={0} max={1} step={0.01} value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-28 accent-[color:var(--gold)]"
          />
        </div>
      </div>

      {trainOn && (
        <div className="mt-4 rounded-xl border border-[color:var(--gold)]/30 bg-[color:var(--accent)]/30 p-3 flex flex-wrap items-end gap-3 text-xs">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">+BPM</label>
            <input
              type="number" min={1} max={20} value={trainStep}
              onChange={(e) => setTrainStep(Math.max(1, Math.min(20, Number(e.target.value))))}
              className="w-16 rounded-md bg-[color:var(--input)] border border-border px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Every (cycles)</label>
            <input
              type="number" min={1} max={20} value={trainEvery}
              onChange={(e) => setTrainEvery(Math.max(1, Math.min(20, Number(e.target.value))))}
              className="w-16 rounded-md bg-[color:var(--input)] border border-border px-2 py-1"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Max BPM</label>
            <input
              type="number" min={40} max={260} value={trainMax}
              onChange={(e) => setTrainMax(Math.max(40, Math.min(260, Number(e.target.value))))}
              className="w-20 rounded-md bg-[color:var(--input)] border border-border px-2 py-1"
            />
          </div>
          <span className="text-muted-foreground">Tempo ramps automatically each cycle.</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5" /> Session{" "}
          <span className="text-foreground tabular-nums">{fmt(sessionMs)}</span>
          <span className="mx-2 opacity-50">·</span>
          Total riyaaz{" "}
          <span className="text-foreground tabular-nums">{fmt(totalMs)}</span>
        </span>
        {sessionMs > 0 && (
          <button
            onClick={() => setSessionMs(0)}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="h-3 w-3" /> reset session
          </button>
        )}
      </div>
      {taalId ? null : null}
      {isCompressorEnabled() ? null : null}
    </div>
  );
}

function fmt(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
