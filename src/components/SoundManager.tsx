import { useEffect, useRef, useState } from "react";
import { Upload, Play, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  BOL_LIBRARY,
  REQUIRED_BOLS,
  hasSample,
  loadedSampleKeys,
  playBol,
  removeSample,
  startAudio,
  subscribeSamples,
  uploadSample,
} from "@/lib/tabla-audio";

export function SoundManager() {
  const [, force] = useState(0);
  const [loaded, setLoaded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let mounted = true;
    startAudio().then(() => loadedSampleKeys()).then((k) => mounted && setLoaded(k));
    const unsub = subscribeSamples(() => {
      loadedSampleKeys().then((k) => setLoaded(k));
      force((n) => n + 1);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const onPick = async (bol: string, file?: File | null) => {
    if (!file) return;
    setError(null);
    try {
      await startAudio();
      await uploadSample(bol, file);
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    }
  };

  const preview = async (bol: string) => {
    await startAudio();
    playBol(bol);
  };

  const requiredMissing = REQUIRED_BOLS.filter((b) => !hasSample(b));

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5 md:p-7">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="font-display text-2xl text-gold">Your Tabla Sounds</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your own recordings (MP3 or WAV). They're stored privately in your browser
              and used for every playback.
            </p>
          </div>
          <div
            className={[
              "rounded-full px-3 py-1.5 text-xs border",
              requiredMissing.length === 0
                ? "border-[color:var(--gold)]/50 text-gold bg-[color:var(--accent)]/50"
                : "border-border text-muted-foreground",
            ].join(" ")}
          >
            {loaded.length} uploaded ·{" "}
            {requiredMissing.length === 0
              ? "All core bols ready"
              : `${requiredMissing.length} core bol${requiredMissing.length > 1 ? "s" : ""} missing`}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BOL_LIBRARY.filter((b) => b.name !== "-").map((b) => {
            const has = hasSample(b.name);
            const required = (REQUIRED_BOLS as readonly string[]).includes(b.name);
            return (
              <div
                key={b.name}
                className={[
                  "rounded-xl border p-4 transition",
                  has
                    ? "border-[color:var(--gold)]/40 bg-[color:var(--accent)]/40"
                    : required
                      ? "border-destructive/30 bg-[color:var(--card)]"
                      : "border-border bg-[color:var(--card)]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xl text-foreground">{b.label}</span>
                    {required && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Core
                      </span>
                    )}
                  </div>
                  {has ? (
                    <CheckCircle2 className="h-4 w-4 text-[color:var(--gold)]" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">No sample</span>
                  )}
                </div>

                <input
                  ref={(el) => {
                    inputRefs.current[b.name] = el;
                  }}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    onPick(b.name, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => inputRefs.current[b.name]?.click()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--gold)] px-3 py-1.5 text-xs font-medium text-[color:var(--primary-foreground)] hover:brightness-110 transition"
                  >
                    <Upload className="h-3 w-3" /> {has ? "Replace" : "Upload"}
                  </button>
                  <button
                    onClick={() => preview(b.name)}
                    disabled={!has}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:border-[color:var(--gold)]/60 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play className="h-3 w-3 fill-current" /> Preview
                  </button>
                  {has && (
                    <button
                      onClick={() => removeSample(b.name)}
                      className="ml-auto rounded-full border border-border p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition"
                      aria-label="Remove sample"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          Tip: short, dry single-stroke recordings (under 1 second, trimmed at the attack) give
          the cleanest, tightest playback at all tempos. Ghe is reused for Ge/Ga, and Ke covers
          Ki/Kat automatically.
        </p>
      </div>
    </div>
  );
}
