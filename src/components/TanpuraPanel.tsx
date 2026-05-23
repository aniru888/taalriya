import { useEffect, useRef, useState } from "react";
import { Play, Square, Upload, Trash2, Music2 } from "lucide-react";
import {
  SCALES,
  type Scale,
  type TanpuraMeta,
  addTanpura,
  deleteTanpura,
  findBestForScale,
  getTanpuraLibrary,
  getTanpuraVolume,
  hydrateTanpura,
  isTanpuraPlaying,
  playTanpuraScale,
  setTanpuraVolume,
  stopTanpura,
  subscribeTanpura,
} from "@/lib/tanpura";
import { saveSettings } from "@/lib/settings";

interface Props {
  scale: Scale;
  onScaleChange: (s: Scale) => void;
}

export function TanpuraPanel({ scale, onScaleChange }: Props) {
  const [items, setItems] = useState<TanpuraMeta[]>([]);
  const [pendingScale, setPendingScale] = useState<Scale>("C");
  const [pendingName, setPendingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVol] = useState(getTanpuraVolume());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    hydrateTanpura().then(() => setItems(getTanpuraLibrary()));
    return subscribeTanpura(() => setItems([...getTanpuraLibrary()]));
  }, []);

  useEffect(() => {
    setTanpuraVolume(volume);
    saveSettings({ tanpuraVolume: volume });
  }, [volume]);

  const onPick = async (file?: File | null) => {
    if (!file) return;
    setError(null);
    try {
      const name = pendingName.trim() || `Tanpura ${pendingScale}`;
      await addTanpura(name, pendingScale, file);
      setPendingName("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
    }
  };

  const toggle = async () => {
    if (playing || isTanpuraPlaying()) {
      stopTanpura();
      setPlaying(false);
      return;
    }
    const ok = await playTanpuraScale(scale);
    setPlaying(Boolean(ok));
  };

  const best = findBestForScale(scale);

  return (
    <div className="glass rounded-2xl p-5 md:p-7">
      <div className="flex items-center gap-2 mb-3">
        <Music2 className="h-4 w-4 text-gold" />
        <h2 className="font-display text-2xl text-gold">Tanpura</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Upload your own tanpura loops for each scale. Missing scales are
        pitch-shifted from the nearest recording so you always have a drone in key.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Scale
          </label>
          <select
            value={scale}
            onChange={(e) => onScaleChange(e.target.value as Scale)}
            className="rounded-lg bg-[color:var(--input)] border border-border px-3 py-2 text-foreground focus:outline-none focus:border-[color:var(--gold)]/60"
          >
            {SCALES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button
          onClick={toggle}
          disabled={!best}
          className={[
            "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition active:scale-95",
            playing
              ? "bg-[color:var(--accent)] border border-[color:var(--gold)]/60 text-foreground"
              : "bg-[color:var(--gold)] text-[color:var(--primary-foreground)] glow-gold hover:brightness-110",
            !best ? "opacity-50 cursor-not-allowed" : "",
          ].join(" ")}
        >
          {playing ? <Square className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          {playing ? "Stop tanpura" : "Play tanpura"}
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-[160px]">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Vol</span>
          <input
            type="range" min={0} max={1} step={0.01} value={volume}
            onChange={(e) => setVol(Number(e.target.value))}
            className="flex-1 accent-[color:var(--gold)]"
          />
        </div>
      </div>

      {best ? (
        <div className="text-xs text-muted-foreground mb-4">
          Now playing in <span className="text-gold font-display">{scale}</span> using{" "}
          <span className="text-foreground">{best.meta.name}</span>{" "}
          {best.semitones === 0 ? "(exact match)" : `(pitch-shifted ${best.semitones > 0 ? "+" : ""}${best.semitones} st)`}
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-[color:var(--gold)]/30 bg-[color:var(--accent)]/40 p-3 text-xs text-foreground">
          No tanpura recordings yet. Upload one below to enable the drone.
        </div>
      )}

      {/* Upload row */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-[color:var(--card)] p-3 mb-5">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Recording scale
          </label>
          <select
            value={pendingScale}
            onChange={(e) => setPendingScale(e.target.value as Scale)}
            className="rounded-lg bg-[color:var(--input)] border border-border px-3 py-2 text-foreground focus:outline-none focus:border-[color:var(--gold)]/60"
          >
            {SCALES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Label (optional)
          </label>
          <input
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            placeholder={`Tanpura ${pendingScale}`}
            maxLength={32}
            className="w-full rounded-lg bg-[color:var(--input)] border border-border px-3 py-2 text-foreground focus:outline-none focus:border-[color:var(--gold)]/60"
          />
        </div>
        <input
          ref={fileRef} type="file" accept="audio/*" className="hidden"
          onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-5 py-2.5 text-sm font-medium text-[color:var(--primary-foreground)] glow-gold hover:brightness-110 transition"
        >
          <Upload className="h-4 w-4" /> Upload loop
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-[color:var(--card)] p-3 flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-[color:var(--accent)] border border-[color:var(--gold)]/40 flex items-center justify-center font-display text-gold">
                {m.scale}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-base truncate">{m.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Scale {m.scale}</div>
              </div>
              <button
                onClick={() => deleteTanpura(m.id)}
                className="p-1.5 rounded-full text-muted-foreground hover:text-destructive"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
