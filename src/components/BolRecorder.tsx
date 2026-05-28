import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Save, X, RotateCcw } from "lucide-react";
import { addBol, startAudio } from "@/lib/tabla-audio";
import { getAudioContext } from "@/lib/audio-engine";

type RecState = "idle" | "recording" | "processing" | "preview";

function trimSilence(buffer: AudioBuffer, threshold = 0.015, padMs = 30): AudioBuffer {
  const data = buffer.getChannelData(0);
  let start = 0;
  let end = data.length - 1;
  while (start < data.length && Math.abs(data[start]) < threshold) start++;
  while (end > start && Math.abs(data[end]) < threshold) end--;
  const pad = Math.floor(buffer.sampleRate * padMs / 1000);
  start = Math.max(0, start - pad);
  end = Math.min(data.length - 1, end + pad);
  const length = end - start + 1;
  if (length <= 0 || length >= buffer.length) return buffer;
  const newBuf = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length,
    sampleRate: buffer.sampleRate,
  });
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    newBuf.copyToChannel(buffer.getChannelData(ch).slice(start, start + length), ch);
  }
  return newBuf;
}

function encodeWav(buffer: AudioBuffer): Blob {
  const nc = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const ns = buffer.length;
  const ba = nc * 2;
  const ds = ns * ba;
  const ab = new ArrayBuffer(44 + ds);
  const v = new DataView(ab);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + ds, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, nc, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * ba, true);
  v.setUint16(32, ba, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, ds, true);
  let off = 44;
  for (let i = 0; i < ns; i++) {
    for (let ch = 0; ch < nc; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      v.setInt16(off, s * 0x7FFF, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

export function BolRecorder({ onSaved }: { onSaved?: () => void }) {
  const [state, setState] = useState<RecState>("idle");
  const [level, setLevel] = useState(0);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [trimmedDur, setTrimmedDur] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef(0);
  const wavRef = useRef<Blob | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const startRec = useCallback(async () => {
    setError(null);
    try {
      await startAudio();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;

      const ctx = getAudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.sqrt(sum / buf.length));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setLevel(0);
        stream.getTracks().forEach((t) => t.stop());

        const raw = new Blob(chunksRef.current, { type: rec.mimeType });
        try {
          const arrBuf = await raw.arrayBuffer();
          const decoded = await ctx.decodeAudioData(arrBuf.slice(0));
          const trimmed = trimSilence(decoded);
          setTrimmedDur(trimmed.duration);
          const wav = encodeWav(trimmed);
          wavRef.current = wav;
          setPreviewUrl(URL.createObjectURL(wav));
          setState("preview");
        } catch {
          setError("Could not process recording. Try again.");
          setState("idle");
        }
      };

      rec.start();
      recRef.current = rec;
      t0Ref.current = performance.now();
      setState("recording");
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration((performance.now() - t0Ref.current) / 1000);
      }, 100) as unknown as number;
    } catch (e) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setError(e instanceof Error ? e.message : "Could not access microphone");
    }
  }, []);

  const stopRec = useCallback(() => {
    if (recRef.current?.state === "recording") recRef.current.stop();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState("processing");
  }, []);

  const save = useCallback(async () => {
    if (!wavRef.current) return;
    setError(null);
    try {
      const file = new File([wavRef.current], `${name || "Recording"}.wav`, {
        type: "audio/wav",
      });
      await addBol(name.trim() || "Recording", file);
      wavRef.current = null;
      setPreviewUrl(null);
      setName("");
      setDuration(0);
      setTrimmedDur(0);
      setState("idle");
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }, [name, onSaved]);

  const discard = useCallback(() => {
    wavRef.current = null;
    setPreviewUrl(null);
    setName("");
    setDuration(0);
    setTrimmedDur(0);
    setState("idle");
  }, []);

  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-[color:var(--card)] p-3">
      {state === "idle" && (
        <button
          onClick={startRec}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full border-2 border-dashed border-destructive/40 px-5 py-2.5 text-sm font-medium text-destructive/80 hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition"
        >
          <Mic className="h-4 w-4" /> Record a bol
        </button>
      )}

      {state === "recording" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm text-destructive font-medium">Recording…</span>
            <span className="text-xs text-muted-foreground tabular-nums ml-auto">
              {duration.toFixed(1)}s
            </span>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-destructive rounded-full transition-all duration-75"
              style={{ width: `${Math.min(100, level * 300)}%` }}
            />
          </div>
          <button
            onClick={stopRec}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-destructive px-5 py-2.5 text-sm font-medium text-[color:var(--primary-foreground)] transition active:scale-95"
          >
            <Square className="h-4 w-4 fill-current" /> Stop recording
          </button>
        </div>
      )}

      {state === "processing" && (
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="h-3 w-3 rounded-full bg-[color:var(--gold)] animate-pulse" />
          <span className="text-sm text-muted-foreground">Trimming silence…</span>
        </div>
      )}

      {state === "preview" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{trimmedDur.toFixed(1)}s</span>
            {trimmedDur < duration - 0.1 && (
              <span className="opacity-60">(trimmed from {duration.toFixed(1)}s)</span>
            )}
          </div>
          {previewUrl && <audio src={previewUrl} controls className="w-full h-8" />}
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this bol (e.g. Dha, Tun, Kran)"
            maxLength={24}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="w-full rounded-lg bg-[color:var(--input)] border border-border px-3 py-2 text-foreground focus:outline-none focus:border-[color:var(--gold)]/60"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--gold)] px-5 py-2.5 text-sm font-medium text-[color:var(--primary-foreground)] glow-gold hover:brightness-110 transition"
            >
              <Save className="h-4 w-4" /> Save to library
            </button>
            <button
              onClick={startRec}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <RotateCcw className="h-4 w-4" /> Redo
            </button>
            <button
              onClick={discard}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
    </div>
  );
}
