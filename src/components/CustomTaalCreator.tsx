import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, Save, FolderOpen, Trash2, Eraser } from "lucide-react";
import {
  getLibrary,
  playById,
  startAudio,
  subscribeLibrary,
} from "@/lib/tabla-audio";
import type { BolMeta } from "@/lib/sample-store";
import { TaalPlayer, type Step } from "./TaalPlayer";

interface Cell {
  bolId: string | null;
}

interface SavedTaal {
  id: string;
  name: string;
  cells: Cell[];
  createdAt: number;
}

const STORAGE_KEY = "taalriya.customTaals.v2";

function loadSaved(): SavedTaal[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function CustomTaalCreator() {
  const [library, setLibrary] = useState<BolMeta[]>([]);
  const [name, setName] = useState("My Taal");
  const [cells, setCells] = useState<Cell[]>(
    Array.from({ length: 8 }, () => ({ bolId: null })),
  );
  const [brushId, setBrushId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedTaal[]>([]);
  const draggingFrom = useRef<{ kind: "lib" | "cell"; idx?: number; bolId?: string } | null>(null);

  useEffect(() => {
    startAudio().then(() => setLibrary(getLibrary()));
    return subscribeLibrary(() => setLibrary([...getLibrary()]));
  }, []);

  useEffect(() => setSaved(loadSaved()), []);

  // Default brush to first library item
  useEffect(() => {
    if (!brushId && library.length > 0) setBrushId(library[0].id);
  }, [library, brushId]);

  const libMap = useMemo(() => {
    const m = new Map<string, BolMeta>();
    library.forEach((b) => m.set(b.id, b));
    return m;
  }, [library]);

  const steps: Step[] = useMemo(
    () =>
      cells.map((c) => {
        if (!c.bolId) return { label: "·", sampleId: null };
        const b = libMap.get(c.bolId);
        if (!b) return { label: "?", sampleId: null };
        return { label: b.name, sampleId: b.id };
      }),
    [cells, libMap],
  );

  const paintCell = (i: number) => {
    setCells((cs) => {
      const next = [...cs];
      // toggle off if same brush already there
      if (next[i].bolId && next[i].bolId === brushId) {
        next[i] = { bolId: null };
      } else {
        next[i] = { bolId: brushId };
        if (brushId) playById(brushId);
      }
      return next;
    });
  };

  const clearCell = (i: number) => {
    setCells((cs) => {
      const next = [...cs];
      next[i] = { bolId: null };
      return next;
    });
  };

  const onDrop = (target: number) => {
    const from = draggingFrom.current;
    draggingFrom.current = null;
    if (!from) return;
    setCells((cs) => {
      const next = [...cs];
      if (from.kind === "lib" && from.bolId) {
        next[target] = { bolId: from.bolId };
        playById(from.bolId);
      } else if (from.kind === "cell" && from.idx !== undefined) {
        const moved = next[from.idx];
        next[from.idx] = next[target];
        next[target] = moved;
      }
      return next;
    });
  };

  const addCell = () => setCells((cs) => [...cs, { bolId: null }]);
  const removeCell = () => setCells((cs) => (cs.length > 1 ? cs.slice(0, -1) : cs));
  const clearAll = () => setCells((cs) => cs.map(() => ({ bolId: null })));

  const atLimit = false;

  const save = () => {
    if (atLimit) return;
    const item: SavedTaal = {
      id: crypto.randomUUID(),
      name: name.trim() || "Untitled Taal",
      cells,
      createdAt: Date.now(),
    };
    const next = [item, ...saved];
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const load = (s: SavedTaal) => {
    setName(s.name);
    setCells(s.cells);
  };

  const removeSaved = (id: string) => {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <div className="space-y-6">
      {/* Library palette */}
      <div className="glass rounded-2xl p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h3 className="font-display text-xl text-gold">Bol Palette</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tap a bol to select your brush, then tap a beat below — or drag tiles into the
              timeline.
            </p>
          </div>
        </div>
        {library.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Your library is empty. Open the Sounds tab to upload your bols.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {library.map((b) => {
              const active = b.id === brushId;
              return (
                <button
                  key={b.id}
                  draggable
                  onDragStart={() => {
                    draggingFrom.current = { kind: "lib", bolId: b.id };
                  }}
                  onClick={() => {
                    setBrushId(b.id);
                    playById(b.id);
                  }}
                  className={[
                    "rounded-xl px-3.5 py-2 text-sm font-display border cursor-grab active:cursor-grabbing transition",
                    active
                      ? "border-[color:var(--gold)] text-gold bg-[color:var(--accent)] glow-gold"
                      : "border-border text-foreground bg-[color:var(--card)] hover:border-[color:var(--gold)]/60",
                  ].join(" ")}
                >
                  {b.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sequencer */}
      <div className="glass rounded-2xl p-5 md:p-7">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Taal name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-[color:var(--input)] border border-border px-3 py-2 text-foreground focus:outline-none focus:border-[color:var(--gold)]/60"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={removeCell}
              className="rounded-full border border-border p-2 hover:border-[color:var(--gold)]/60"
              aria-label="Remove beat"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-sm tabular-nums w-16 text-center">{cells.length} beats</span>
            <button
              onClick={addCell}
              className="rounded-full border border-border p-2 hover:border-[color:var(--gold)]/60"
              aria-label="Add beat"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <Eraser className="h-3.5 w-3.5" /> Clear
          </button>
          <button
            onClick={save}
            disabled={atLimit}
            title={atLimit ? `Free tier saves up to ${FREE_LIMIT} taals. Upgrade for unlimited.` : "Save composition"}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-4 py-2 text-sm font-medium text-[color:var(--primary-foreground)] glow-gold hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" /> Save
          </button>
        </div>
        {atLimit && (
          <div className="-mt-2 mb-3 text-xs text-muted-foreground">
            <span className="text-gold">Free tier</span> saves up to {FREE_LIMIT} taals — upgrade to Premium for unlimited compositions and cloud sync.
          </div>
        )}

        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Timeline</p>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {cells.map((c, i) => {
            const b = c.bolId ? libMap.get(c.bolId) : null;
            const filled = Boolean(b);
            return (
              <div
                key={i}
                draggable={filled}
                onDragStart={() => {
                  if (filled) draggingFrom.current = { kind: "cell", idx: i };
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                onClick={() => paintCell(i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  clearCell(i);
                }}
                className={[
                  "relative aspect-[5/4] rounded-xl border flex flex-col items-center justify-center cursor-pointer select-none transition",
                  filled
                    ? "border-[color:var(--gold)]/50 bg-[color:var(--accent)] text-foreground"
                    : "border-dashed border-border bg-[color:var(--card)]/60 text-muted-foreground/50 hover:border-[color:var(--gold)]/40",
                ].join(" ")}
              >
                <span className="absolute top-1 left-2 text-[10px] tabular-nums opacity-60">
                  {i + 1}
                </span>
                <span className="font-display text-sm md:text-base px-1 text-center break-words leading-tight">
                  {b ? b.name : "·"}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Tap empty cell to place selected bol · tap again to clear · right-click / long-press to
          erase · drag to rearrange.
        </p>
      </div>

      <TaalPlayer steps={steps} title={name} subtitle="Custom taal — set BPM, loop, and play" />

      {saved.length > 0 && (
        <div className="glass rounded-2xl p-5 md:p-7">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="h-4 w-4 text-gold" />
            <h3 className="font-display text-xl text-gold">Saved Compositions</h3>
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
                    {s.cells.length} beats · {new Date(s.createdAt).toLocaleDateString()}
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
                    onClick={() => removeSaved(s.id)}
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
