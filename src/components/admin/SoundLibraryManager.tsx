import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Trash2, Check, X, Star } from "lucide-react";
import {
  listLibrarySounds,
  deleteLibrarySound,
  updateLibrarySound,
  getSoundPlaybackUrl,
} from "@/lib/admin.functions";
import { SoundUploader } from "./SoundUploader";
import { WaveformPreview } from "./WaveformPreview";

type Kind = "bol" | "tanpura" | "taal_loop";

interface Sound {
  id: string;
  kind: Kind;
  name: string;
  description: string | null;
  tags: string[];
  bpm: number | null;
  scale: string | null;
  category: string | null;
  taal_name: string | null;
  storage_path: string;
  duration_ms: number | null;
  is_featured: boolean;
  created_at: string;
}

export function SoundLibraryManager({ kind, title }: { kind: Kind; title: string }) {
  const list = useServerFn(listLibrarySounds);
  const del = useServerFn(deleteLibrarySound);
  const update = useServerFn(updateLibrarySound);
  const getUrl = useServerFn(getSoundPlaybackUrl);

  const [items, setItems] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const refresh = async () => {
    setLoading(true);
    const r = await list();
    setItems((r.sounds as Sound[]).filter((s) => s.kind === kind));
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [kind]);

  const onPlay = async (s: Sound) => {
    if (previewUrls[s.id]) return;
    const { url } = await getUrl({ data: { path: s.storage_path } });
    setPreviewUrls((m) => ({ ...m, [s.id]: url }));
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this sound permanently?")) return;
    await del({ data: { id } });
    refresh();
  };

  const onToggleFeatured = async (s: Sound) => {
    await update({ data: { id: s.id, is_featured: !s.is_featured } });
    refresh();
  };

  const commitEdit = async (id: string) => {
    await update({ data: { id, name: editName.trim(), description: editDesc.trim() || null } });
    setEditingId(null);
    refresh();
  };

  return (
    <div className="space-y-6">
      <SoundUploader defaultKind={kind} onUploaded={refresh} />

      <section className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-gold">{title}</h3>
          <span className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</span>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing here yet. Upload your first {kind === "taal_loop" ? "taal loop" : kind} above.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((s) => {
              const editing = editingId === s.id;
              return (
                <li key={s.id} className="rounded-xl border border-border bg-[color:var(--card)]/60 p-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      {editing ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-md bg-[color:var(--input)] border border-border px-2 py-1 font-display text-lg"
                        />
                      ) : (
                        <div className="font-display text-lg text-foreground flex items-center gap-2">
                          {s.name}
                          {s.is_featured && <Star className="h-3.5 w-3.5 fill-[color:var(--gold)] text-[color:var(--gold)]" />}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {s.category && <span>· {s.category}</span>}
                        {s.taal_name && <span>· {s.taal_name}</span>}
                        {s.bpm && <span>· {s.bpm} BPM</span>}
                        {s.scale && <span>· {s.scale}</span>}
                        {s.duration_ms && <span>· {(s.duration_ms / 1000).toFixed(2)}s</span>}
                      </div>
                      {s.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {s.tags.map((t) => (
                            <span key={t} className="text-[10px] rounded-full bg-[color:var(--accent)]/50 px-2 py-0.5 text-muted-foreground">{t}</span>
                          ))}
                        </div>
                      )}
                      {editing ? (
                        <textarea
                          rows={2}
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Description"
                          className="mt-2 w-full rounded-md bg-[color:var(--input)] border border-border px-2 py-1 text-sm resize-none"
                        />
                      ) : (
                        s.description && <p className="text-xs text-muted-foreground mt-2">{s.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {editing ? (
                        <>
                          <button onClick={() => commitEdit(s.id)} className="p-1.5 rounded-full text-gold hover:bg-[color:var(--accent)]"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => onToggleFeatured(s)}
                            title={s.is_featured ? "Unfeature" : "Feature"}
                            className="p-1.5 rounded-full text-muted-foreground hover:text-gold"
                          >
                            <Star className={"h-3.5 w-3.5 " + (s.is_featured ? "fill-[color:var(--gold)] text-[color:var(--gold)]" : "")} />
                          </button>
                          <button
                            onClick={() => { setEditingId(s.id); setEditName(s.name); setEditDesc(s.description ?? ""); onPlay(s); }}
                            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => onDelete(s.id)} className="p-1.5 rounded-full text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    {previewUrls[s.id] ? (
                      <WaveformPreview src={previewUrls[s.id]} height={48} />
                    ) : (
                      <button onClick={() => onPlay(s)} className="text-xs text-muted-foreground hover:text-gold">
                        ▶ Load preview
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
