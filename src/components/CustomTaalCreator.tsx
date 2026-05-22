import { useEffect, useState } from "react";
import { Plus, Trash2, Save, FolderOpen, X } from "lucide-react";
import { BOL_LIBRARY, playBol, startAudio } from "@/lib/tabla-audio";
import { TaalPlayer } from "./TaalPlayer";

interface SavedTaal {
  id: string;
  name: string;
  bols: string[];
  bpm: number;
  createdAt: number;
}

const STORAGE_KEY = "taalriya.customTaals.v1";

function loadSaved(): SavedTaal[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function CustomTaalCreator() {
  const [name, setName] = useState("My Taal");
  const [bols, setBols] = useState<string[]>(["Dha", "Dhin", "Na", "Dha", "Tin", "Na"]);
  const [saved, setSaved] = useState<SavedTaal[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  useEffect(() => setSaved(loadSaved()), []);

  const addBol = async (bol: string) => {
    await startAudio();
    playBol(bol);
    setBols((b) => [...b, bol]);
  };

  const removeAt = (i: number) => setBols((b) => b.filter((_, idx) => idx !== i));

  const onDropToSlot = (target: number) => {
    if (draggingIdx === null) return;
    setBols((b) => {
      const next = [...b];
      const [item] = next.splice(draggingIdx, 1);
      next.splice(target, 0, item);
      return next;
    });
    setDraggingIdx(null);
  };

  const save = () => {
    if (!bols.length) return;
    const item: SavedTaal = {
      id: crypto.randomUUID(),
      name: name.trim() || "Untitled Taal",
      bols,
      bpm: 80,
      createdAt: Date.now(),
    };
    const next = [item, ...saved];
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const load = (s: SavedTaal) => {
    setName(s.name);
    setBols(s.bols);
  };

  const remove = (id: string) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-5 md:p-7">
        <div className="flex flex-wrap items-end gap-4 mb-5">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
              Taal Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-[color:var(--input)] border border-border px-3 py-2 text-foreground focus:outline-none focus:border-[color:var(--gold)]/60"
              placeholder="Name your taal"
            />
          </div>
          <button
            onClick={save}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-5 py-2.5 text-sm font-medium text-[color:var(--primary-foreground)] glow-gold hover:brightness-110 transition"
          >
            <Save className="h-4 w-4" /> Save Locally
          </button>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Bols Library — tap to add, drag chips below to reorder
          </p>
          <div className="flex flex-wrap gap-2">
            {BOL_LIBRARY.map((b) => (
              <button
                key={b.name}
                onClick={() => addBol(b.name)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm border transition active:scale-95",
                  b.tone === "bass"
                    ? "border-[color:var(--gold)]/30 bg-[color:var(--accent)]/60 text-foreground"
                    : b.tone === "combo"
                      ? "border-[color:var(--gold)]/50 bg-[color:var(--accent)] text-gold"
                      : "border-border bg-[color:var(--card)] text-foreground",
                  "hover:border-[color:var(--gold)]/70",
                ].join(" ")}
              >
                <Plus className="h-3 w-3" /> {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Your sequence ({bols.length} beats)
          </p>
          {bols.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Add bols from the library above to build your taal.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {bols.map((bol, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => setDraggingIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDropToSlot(i)}
                  className="group relative inline-flex items-center gap-2 rounded-xl border border-border bg-[color:var(--card)] pl-3 pr-2 py-2 cursor-grab active:cursor-grabbing hover:border-[color:var(--gold)]/60 transition"
                >
                  <span className="text-[10px] text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="font-display text-base text-foreground">{bol === "-" ? "·" : bol}</span>
                  <button
                    onClick={() => removeAt(i)}
                    className="text-muted-foreground hover:text-destructive transition"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <TaalPlayer bols={bols} title={name} subtitle="Custom taal — adjust speed, loop and play" />

      {saved.length > 0 && (
        <div className="glass rounded-2xl p-5 md:p-7">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="h-4 w-4 text-gold" />
            <h3 className="font-display text-xl text-gold">Saved Taals</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {saved.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border bg-[color:var(--card)] p-3"
              >
                <div className="min-w-0">
                  <div className="font-display text-lg text-foreground truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.bols.length} beats · {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => load(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-[color:var(--gold)]/60 transition"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    className="rounded-full border border-border p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
