import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createSignedUploadUrl, createLibrarySound } from "@/lib/admin.functions";
import { WaveformPreview } from "./WaveformPreview";

type Kind = "bol" | "tanpura" | "taal_loop";

interface Props {
  defaultKind: Kind;
  onUploaded?: () => void;
}

export function SoundUploader({ defaultKind, onUploaded }: Props) {
  const getSignedUrl = useServerFn(createSignedUploadUrl);
  const createRow = useServerFn(createLibrarySound);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [bpm, setBpm] = useState("");
  const [scale, setScale] = useState("");
  const [category, setCategory] = useState("");
  const [taalName, setTaalName] = useState("");
  const [featured, setFeatured] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null | undefined) => {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name)) {
      setError("Please choose an audio file (mp3, wav, ogg, m4a, flac).");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError("File is too large (max 20MB).");
      return;
    }
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const reset = () => {
    setFile(null);
    setName("");
    setDescription("");
    setTags("");
    setBpm("");
    setScale("");
    setCategory("");
    setTaalName("");
    setFeatured(false);
    setError(null);
  };

  const submit = async () => {
    if (!file) { setError("Choose an audio file first."); return; }
    if (!name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    setError(null);
    try {
      // 1. Decode duration
      let durationMs: number | null = null;
      try {
        const buf = await file.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decoded = await ctx.decodeAudioData(buf.slice(0));
        durationMs = Math.round(decoded.duration * 1000);
        ctx.close();
      } catch { /* non-fatal */ }

      // 2. Signed upload URL from server
      const { path, token } = await getSignedUrl({ data: { kind, filename: file.name } });

      // 3. Upload directly to storage
      const { error: upErr } = await supabase.storage
        .from("sound-library")
        .uploadToSignedUrl(path, token, file, { contentType: file.type || "audio/mpeg" });
      if (upErr) throw upErr;

      // 4. Persist metadata row
      await createRow({
        data: {
          kind,
          name: name.trim(),
          storage_path: path,
          duration_ms: durationMs,
          description: description.trim() || null,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          bpm: bpm ? Number(bpm) : null,
          scale: scale.trim() || null,
          category: category.trim() || null,
          taal_name: taalName.trim() || null,
          is_featured: featured,
        },
      });

      reset();
      onUploaded?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xl text-gold">Upload sound</h3>
        <div className="inline-flex rounded-full border border-border p-0.5">
          {(["bol", "tanpura", "taal_loop"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={[
                "rounded-full px-3 py-1 text-[11px] uppercase tracking-wider transition",
                kind === k
                  ? "bg-[color:var(--gold)] text-[color:var(--primary-foreground)]"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {k === "taal_loop" ? "Taal loop" : k}
            </button>
          ))}
        </div>
      </div>

      {/* Drag-drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pickFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => fileInput.current?.click()}
        className={[
          "rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition",
          dragging
            ? "border-[color:var(--gold)] bg-[color:var(--accent)]/40"
            : "border-border hover:border-[color:var(--gold)]/60",
        ].join(" ")}
      >
        <Upload className="h-6 w-6 text-gold mx-auto mb-2" />
        <div className="text-sm text-foreground">
          {file ? file.name : "Drop an audio file here, or click to browse"}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">MP3, WAV, OGG, M4A — up to 20MB</div>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }}
        />
      </div>

      {file && (
        <div className="mt-3">
          <WaveformPreview src={file} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <Field label="Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputCls} placeholder="e.g. Dha (high)" />
        </Field>
        <Field label="Category">
          <input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} className={inputCls} placeholder="e.g. Bol set A" />
        </Field>
        {kind !== "tanpura" && (
          <Field label="Taal name">
            <input value={taalName} onChange={(e) => setTaalName(e.target.value)} maxLength={60} className={inputCls} placeholder="e.g. Teen Taal" />
          </Field>
        )}
        {kind === "taal_loop" && (
          <Field label="BPM">
            <input type="number" min={20} max={400} value={bpm} onChange={(e) => setBpm(e.target.value)} className={inputCls} placeholder="e.g. 80" />
          </Field>
        )}
        {kind === "tanpura" && (
          <Field label="Scale / Key">
            <input value={scale} onChange={(e) => setScale(e.target.value)} maxLength={8} className={inputCls} placeholder="e.g. C, C#, D" />
          </Field>
        )}
        <Field label="Tags (comma-separated)" full>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputCls} placeholder="e.g. dayan, sharp, traditional" />
        </Field>
        <Field label="Description" full>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} className={inputCls + " resize-none"} placeholder="Optional notes about the recording" />
        </Field>
      </div>

      <label className="flex items-center gap-2 mt-3 text-xs text-muted-foreground select-none">
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="accent-[color:var(--gold)]" />
        Featured — surface to all users by default
      </label>

      {error && (
        <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 justify-end">
        {file && (
          <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={busy || !file}
          className="rounded-full bg-[color:var(--gold)] px-5 py-2.5 text-sm font-medium text-[color:var(--primary-foreground)] glow-gold hover:brightness-110 transition disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Save to library"}
        </button>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg bg-[color:var(--input)] border border-border px-3 py-2 text-foreground focus:outline-none focus:border-[color:var(--gold)]/60";

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}
