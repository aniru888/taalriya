import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Play, Trash2, Pencil, Check, X, Library, Link2 } from "lucide-react";
import {
  addBol,
  getLibrary,
  playById,
  remove,
  rename,
  startAudio,
  subscribeLibrary,
} from "@/lib/tabla-audio";
import type { BolMeta } from "@/lib/sample-store";
import { loadSettings, saveSettings } from "@/lib/settings";
import { TAALS } from "@/lib/taals";
import { BolRecorder } from "./BolRecorder";

export function SoundLibrary() {
  const [items, setItems] = useState<BolMeta[]>([]);
  const [pendingName, setPendingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>(() => loadSettings().bolAssignments || {});
  const fileRef = useRef<HTMLInputElement>(null);

  const allLabels = useMemo(() => {
    const set = new Set<string>();
    for (const t of TAALS) for (const v of ["theka", "fast", "ending", "tehai"] as const) {
      for (const b of t[v]) if (b !== "-") set.add(b);
    }
    return Array.from(set).sort();
  }, []);

  const setAssignment = (label: string, sampleId: string) => {
    const next = { ...assignments };
    if (!sampleId) delete next[label]; else next[label] = sampleId;
    setAssignments(next);
    saveSettings({ bolAssignments: next });
  };

  useEffect(() => {
    startAudio().then(() => setItems(getLibrary()));
    return subscribeLibrary(() => setItems([...getLibrary()]));
  }, []);

  const onPick = async (file?: File | null) => {
    if (!file) return;
    setError(null);
    const name = (pendingName.trim() || file.name.replace(/\.[^.]+$/, "")).slice(0, 24);
    try {
      await addBol(name, file);
      setPendingName("");
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    }
  };

  const beginEdit = (m: BolMeta) => {
    setEditingId(m.id);
    setEditValue(m.name);
  };

  const commitEdit = async () => {
    if (!editingId) return;
    await rename(editingId, editValue);
    setEditingId(null);
  };

  return (
    <div className="glass rounded-2xl p-5 md:p-7">
      <div className="flex items-center gap-2 mb-4">
        <Library className="h-4 w-4 text-gold" />
        <h2 className="font-display text-2xl text-gold">Sound Library</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Record or upload any percussion sound and give it a bol name — Dha, Dhik, Kran, Trkt, or anything
        you like. Unlimited bols, fully renamable.
      </p>

      <div className="mb-4">
        <BolRecorder />
      </div>

      {/* Upload row */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-[color:var(--card)] p-3 mb-5">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            New bol name
          </label>
          <input
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            placeholder="e.g. Dhik, Kran, Trkt"
            maxLength={24}
            className="w-full rounded-lg bg-[color:var(--input)] border border-border px-3 py-2 text-foreground focus:outline-none focus:border-[color:var(--gold)]/60"
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-5 py-2.5 text-sm font-medium text-[color:var(--primary-foreground)] glow-gold hover:brightness-110 transition"
        >
          <Upload className="h-4 w-4" /> Upload audio
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No bols yet. Upload your first recording above to start building your library.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((m) => {
            const editing = editingId === m.id;
            return (
              <div
                key={m.id}
                className="rounded-xl border border-border bg-[color:var(--card)] p-3 flex items-center gap-2"
              >
                <button
                  onClick={() => playById(m.id)}
                  className="shrink-0 h-10 w-10 rounded-full bg-[color:var(--accent)] border border-[color:var(--gold)]/40 flex items-center justify-center hover:glow-gold transition"
                  aria-label={`Preview ${m.name}`}
                >
                  <Play className="h-4 w-4 fill-[color:var(--gold)] text-[color:var(--gold)]" />
                </button>
                <div className="flex-1 min-w-0">
                  {editing ? (
                    <input
                      autoFocus
                      value={editValue}
                      maxLength={24}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full rounded-md bg-[color:var(--input)] border border-border px-2 py-1 text-foreground"
                    />
                  ) : (
                    <div className="font-display text-lg truncate">{m.name}</div>
                  )}
                </div>
                {editing ? (
                  <>
                    <button
                      onClick={commitEdit}
                      className="p-1.5 rounded-full text-gold hover:bg-[color:var(--accent)]"
                      aria-label="Save"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-full text-muted-foreground hover:text-foreground"
                      aria-label="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => beginEdit(m)}
                      className="p-1.5 rounded-full text-muted-foreground hover:text-foreground"
                      aria-label="Rename"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(m.id)}
                      className="p-1.5 rounded-full text-muted-foreground hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bol assignment — explicit mapping replaces the old name-match auto-bind */}
      {items.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-[color:var(--card)]/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="h-4 w-4 text-gold" />
            <h3 className="font-display text-lg text-gold">Assign bols to recordings</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Uploaded recordings only play in preset taals when explicitly assigned here.
            Unassigned bols stay silent — no more auto-attaching to random beats.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {allLabels.map((label) => (
              <div key={label} className="flex items-center gap-2">
                <span className="font-display text-sm text-foreground w-20 shrink-0">{label}</span>
                <select
                  value={assignments[label] ?? ""}
                  onChange={(e) => setAssignment(label, e.target.value)}
                  className="flex-1 rounded-md bg-[color:var(--input)] border border-border px-2 py-1.5 text-sm focus:outline-none focus:border-[color:var(--gold)]/60"
                >
                  <option value="">— unassigned —</option>
                  {items.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
