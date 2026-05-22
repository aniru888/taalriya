import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { Play, Pause, Square, Repeat, Volume2 } from "lucide-react";
import { setMasterVolume, startAudio } from "@/lib/tabla-audio";

export interface Step {
  label: string;
  play: ((time: number, velocity?: number) => void) | null; // null = rest
}

interface Props {
  steps: Step[];
  title?: string;
  subtitle?: string;
  divisions?: number[];
}

export function TaalPlayer({ steps, title, subtitle, divisions }: Props) {
  const [bpm, setBpm] = useState(80);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [volume, setVolume] = useState(0.9);

  const seqRef = useRef<Tone.Sequence | null>(null);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    Tone.getTransport().bpm.rampTo(bpm, 0.1);
  }, [bpm]);

  useEffect(() => setMasterVolume(volume), [volume]);

  const stop = useCallback(() => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel(0);
    seqRef.current?.dispose();
    seqRef.current = null;
    setPlaying(false);
    setCurrentBeat(-1);
  }, []);

  const start = useCallback(async () => {
    await startAudio();
    stop();
    if (stepsRef.current.length === 0) return;
    Tone.getTransport().bpm.value = bpm;

    const indices = stepsRef.current.map((_, i) => i);
    const seq = new Tone.Sequence(
      (time, idx: number) => {
        const s = stepsRef.current[idx];
        s?.play?.(time);
        Tone.getDraw().schedule(() => setCurrentBeat(idx), time);
        if (!loop && idx === stepsRef.current.length - 1) {
          Tone.getDraw().schedule(() => {
            setTimeout(() => stop(), 60);
          }, time + Tone.Time("4n").toSeconds());
        }
      },
      indices,
      "4n",
    );
    seq.loop = loop;
    seq.start(0);
    seqRef.current = seq;
    Tone.getTransport().start("+0.05");
    setPlaying(true);
  }, [bpm, loop, stop]);

  const pause = useCallback(() => {
    Tone.getTransport().pause();
    setPlaying(false);
  }, []);

  const resume = useCallback(async () => {
    await startAudio();
    Tone.getTransport().start();
    setPlaying(true);
  }, []);

  useEffect(() => () => stop(), [stop]);

  // when length or composition fingerprint changes, restart if playing
  const fingerprint = steps.map((s) => s.label).join("|");
  useEffect(() => {
    setCurrentBeat(-1);
    if (playing) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  const divisionStarts = (() => {
    const set = new Set<number>([0]);
    if (divisions) {
      let cum = 0;
      for (const d of divisions) {
        cum += d;
        set.add(cum);
      }
    }
    return set;
  })();

  return (
    <div className="glass rounded-2xl p-5 md:p-7">
      {(title || subtitle) && (
        <div className="mb-5">
          {title && <h3 className="font-display text-2xl text-gold">{title}</h3>}
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {steps.length === 0 && (
          <div className="w-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Empty taal — add bols to begin.
          </div>
        )}
        {steps.map((s, i) => {
          const active = i === currentBeat;
          const isStart = divisionStarts.has(i);
          const isRest = !s.play;
          return (
            <div
              key={i}
              className={[
                "relative min-w-[56px] md:min-w-[68px] flex-1 max-w-[100px] aspect-[5/4] rounded-xl border flex flex-col items-center justify-center transition-all duration-150",
                active
                  ? "border-[color:var(--gold)] glow-gold bg-[color:var(--accent)] animate-beat"
                  : "border-border bg-[color:var(--card)]",
                isStart && !active ? "border-[color:var(--gold)]/40" : "",
              ].join(" ")}
            >
              <span className="absolute top-1 left-2 text-[10px] text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <span
                className={[
                  "font-display text-sm md:text-base px-1 text-center break-words leading-tight",
                  isRest ? "text-muted-foreground/40" : "text-foreground",
                  active ? "text-gold" : "",
                ].join(" ")}
              >
                {isRest ? "·" : s.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!playing ? (
          <button
            onClick={currentBeat >= 0 ? resume : start}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-5 py-2.5 text-sm font-medium text-[color:var(--primary-foreground)] glow-gold transition hover:brightness-110 active:scale-95"
          >
            <Play className="h-4 w-4 fill-current" /> Play
          </button>
        ) : (
          <button
            onClick={pause}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-5 py-2.5 text-sm font-medium text-foreground border border-border hover:border-[color:var(--gold)]/60 transition active:scale-95"
          >
            <Pause className="h-4 w-4 fill-current" /> Pause
          </button>
        )}
        <button
          onClick={stop}
          className="inline-flex items-center gap-2 rounded-full bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground border border-border hover:text-foreground hover:border-foreground/40 transition active:scale-95"
        >
          <Square className="h-4 w-4 fill-current" /> Stop
        </button>
        <button
          onClick={() => setLoop((v) => !v)}
          className={[
            "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium border transition active:scale-95",
            loop
              ? "border-[color:var(--gold)]/60 text-gold bg-[color:var(--accent)]/60"
              : "border-border text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <Repeat className="h-4 w-4" /> Loop {loop ? "On" : "Off"}
        </button>

        <div className="flex items-center gap-3 ml-auto min-w-[200px] flex-1 md:max-w-xs">
          <span className="text-xs text-muted-foreground tabular-nums w-14">{bpm} BPM</span>
          <input
            type="range"
            min={30}
            max={260}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="flex-1 accent-[color:var(--gold)]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-28 accent-[color:var(--gold)]"
          />
        </div>
      </div>
    </div>
  );
}
