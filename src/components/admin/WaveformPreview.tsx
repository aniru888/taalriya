import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

interface Props {
  /** Audio source: a URL or a File/Blob. */
  src: string | Blob | null;
  height?: number;
}

/** Lightweight waveform: decodes audio with WebAudio and renders peaks on canvas. */
export function WaveformPreview({ src, height = 64 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    audioRef.current = new Audio(url);
    audioRef.current.preload = "metadata";
    audioRef.current.addEventListener("ended", () => setPlaying(false));

    (async () => {
      try {
        const buf = typeof src === "string" ? await (await fetch(src)).arrayBuffer() : await src.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audio = await ctx.decodeAudioData(buf.slice(0));
        if (cancelled) return;
        setDuration(audio.duration);
        drawWaveform(canvasRef.current, audio);
        ctx.close();
      } catch (e) {
        console.warn("waveform decode", e);
      }
    })();

    return () => {
      cancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof src !== "string") URL.revokeObjectURL(url);
    };
  }, [src]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-[color:var(--card)]/60 p-2">
      <button
        type="button"
        onClick={toggle}
        disabled={!src}
        className="shrink-0 h-9 w-9 rounded-full bg-[color:var(--accent)] border border-[color:var(--gold)]/40 flex items-center justify-center hover:glow-gold transition disabled:opacity-40"
      >
        {playing ? <Pause className="h-4 w-4 text-gold" /> : <Play className="h-4 w-4 text-gold" />}
      </button>
      <canvas ref={canvasRef} height={height} className="flex-1 w-full" style={{ height }} />
      {duration !== null && (
        <span className="text-[10px] tabular-nums text-muted-foreground w-12 text-right">
          {duration.toFixed(2)}s
        </span>
      )}
    </div>
  );
}

function drawWaveform(canvas: HTMLCanvasElement | null, audio: AudioBuffer) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(200, Math.floor(rect.width));
  const h = canvas.height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const data = audio.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / w));
  const mid = h / 2;

  ctx.fillStyle = "rgba(220, 180, 90, 0.85)";
  for (let x = 0; x < w; x++) {
    let min = 1.0;
    let max = -1.0;
    const start = x * step;
    const end = start + step;
    for (let i = start; i < end && i < data.length; i++) {
      const v = data[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const y1 = (1 + min) * mid;
    const y2 = (1 + max) * mid;
    ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  }
}
