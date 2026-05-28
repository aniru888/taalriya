import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Play, Trash2, Plus, Save } from "lucide-react";
import {
  listLibrarySounds,
  getSoundPlaybackUrl,
  listTaalAssignments,
  upsertTaalAssignment,
  deleteTaalAssignment,
} from "@/lib/admin.functions";
import { TAALS, VARIATION_KEYS, VARIATION_LABELS, type VariationKey } from "@/lib/taals";
import { registerSample, previewSample, hasSample, ensureAudio } from "@/lib/audio-engine";

interface Sound {
  id: string;
  kind: string;
  name: string;
  storage_path: string;
}
interface Assignment {
  id: string;
  taal_id: string;
  variation: string;
  beat_index: number;
  slot_index: number;
  sound_id: string;
  offset: number;
  velocity: number;
}

const MAX_SLOTS = 4;
const OFFSET_PRESETS = [
  { v: 0, label: "1/1" },
  { v: 0.25, label: "1/4" },
  { v: 1 / 3, label: "1/3" },
  { v: 0.5, label: "1/2" },
  { v: 2 / 3, label: "2/3" },
  { v: 0.75, label: "3/4" },
];

export function BeatAssignmentEditor() {
  const listSounds = useServerFn(listLibrarySounds);
  const listAssigns = useServerFn(listTaalAssignments);
  const upsert = useServerFn(upsertTaalAssignment);
  const remove = useServerFn(deleteTaalAssignment);
  const getUrl = useServerFn(getSoundPlaybackUrl);

  const [sounds, setSounds] = useState<Sound[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [taalId, setTaalId] = useState<string>(TAALS[0].id);
  const [variation, setVariation] = useState<VariationKey>("theka");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const taal = useMemo(() => TAALS.find((t) => t.id === taalId)!, [taalId]);
  const bolSounds = useMemo(() => sounds.filter((s) => s.kind === "bol"), [sounds]);
  const soundById = useMemo(() => Object.fromEntries(sounds.map((s) => [s.id, s])), [sounds]);

  const refresh = async () => {
    setLoading(true);
    const [s, a] = await Promise.all([listSounds(), listAssigns()]);
    setSounds(s.sounds as Sound[]);
    setAssignments(a.assignments as Assignment[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    ensureAudio().catch(() => {});
    // eslint-disable-next-line
  }, []);

  const assignsForBeat = (beatIdx: number) =>
    assignments
      .filter(
        (a) => a.taal_id === taalId && a.variation === variation && a.beat_index === beatIdx,
      )
      .sort((x, y) => x.slot_index - y.slot_index);

  const nextFreeSlot = (beatIdx: number) => {
    const used = new Set(assignsForBeat(beatIdx).map((a) => a.slot_index));
    for (let i = 0; i < MAX_SLOTS; i++) if (!used.has(i)) return i;
    return -1;
  };

  const ensureBuffer = async (sound: Sound) => {
    if (hasSample(sound.id)) return;
    const { url } = await getUrl({ data: { path: sound.storage_path } });
    const res = await fetch(url);
    const blob = await res.blob();
    await registerSample(sound.id, blob);
  };

  const preview = async (sound: Sound) => {
    await ensureAudio();
    await ensureBuffer(sound);
    previewSample(sound.id, 1);
  };

  const onAssign = async (beatIdx: number, slotIdx: number, soundId: string, offset: number) => {
    if (!soundId) return;
    setBusy(`${beatIdx}:${slotIdx}`);
    try {
      const sound = sounds.find((s) => s.id === soundId);
      if (sound) await ensureBuffer(sound);
      await upsert({
        data: {
          taal_id: taalId,
          variation,
          beat_index: beatIdx,
          slot_index: slotIdx,
          sound_id: soundId,
          offset,
          velocity: 1,
        },
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const onRemove = async (a: Assignment) => {
    setBusy(a.id);
    try {
      await remove({ data: { id: a.id } });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const onAddSlot = async (beatIdx: number) => {
    const slot = nextFreeSlot(beatIdx);
    if (slot < 0 || bolSounds.length === 0) return;
    await onAssign(beatIdx, slot, bolSounds[0].id, slot === 0 ? 0 : 0.5);
  };

  const onPlayBeat = async (beatIdx: number) => {
    const slots = assignsForBeat(beatIdx);
    await ensureAudio();
    for (const a of slots) {
      const s = soundById[a.sound_id];
      if (!s) continue;
      await ensureBuffer(s);
      // tiny stagger by offset for preview
      setTimeout(() => previewSample(a.sound_id, a.velocity), Math.round(a.offset * 250));
    }
  };

  return (
    <div className="space-y-5">
      <section className="glass rounded-2xl p-5">
        <h3 className="font-display text-xl text-gold mb-1">Beat Assignment Editor</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Pick a taal and variation, then attach tabla recordings to each matra. Each beat
          supports up to {MAX_SLOTS} subdivisions ("ti ti", "dha ge", "tirakita"…). These
          assignments are global — every signed-in user hears the same playback.
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          {TAALS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTaalId(t.id)}
              className={
                "rounded-full px-3 py-1.5 text-xs border transition " +
                (t.id === taalId
                  ? "border-[color:var(--gold)] text-gold bg-[color:var(--accent)] glow-gold"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {t.name} <span className="opacity-60 ml-1 tabular-nums">{t.beats}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-2">
          {VARIATION_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setVariation(k)}
              className={
                "rounded-full px-3 py-1 text-[11px] uppercase tracking-wider border transition " +
                (k === variation
                  ? "border-[color:var(--gold)]/70 text-gold bg-[color:var(--accent)]/70"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {VARIATION_LABELS[k]}
            </button>
          ))}
        </div>

        {!loading && bolSounds.length === 0 && (
          <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
            No tabla bol recordings uploaded yet. Use the uploader above to add your first recording.
          </div>
        )}
      </section>

      {loading ? (
        <div className="text-sm text-muted-foreground text-center py-8">Loading…</div>
      ) : (
        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {taal[variation].map((label, beatIdx) => {
            const slots = assignsForBeat(beatIdx);
            const isSam = beatIdx + 1 === taal.sam;
            const isKhali = taal.khali.includes(beatIdx + 1);
            const canAdd = slots.length < MAX_SLOTS && bolSounds.length > 0;
            return (
              <div
                key={beatIdx}
                className={
                  "rounded-xl border p-3 bg-[color:var(--card)]/70 " +
                  (isSam
                    ? "border-[color:var(--gold)] glow-gold"
                    : isKhali
                      ? "border-destructive/40"
                      : "border-border")
                }
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Beat {beatIdx + 1}
                      {isSam && " · Sam"}
                      {isKhali && " · Khali"}
                    </div>
                    <div className="font-display text-base text-foreground">{label}</div>
                  </div>
                  <button
                    onClick={() => onPlayBeat(beatIdx)}
                    disabled={slots.length === 0}
                    className="h-7 w-7 rounded-full bg-[color:var(--accent)] border border-[color:var(--gold)]/40 flex items-center justify-center disabled:opacity-30 hover:glow-gold"
                    title="Preview beat"
                  >
                    <Play className="h-3 w-3 fill-[color:var(--gold)] text-[color:var(--gold)]" />
                  </button>
                </div>

                <ul className="space-y-1.5">
                  {slots.map((a) => {
                    const s = soundById[a.sound_id];
                    return (
                      <li key={a.id} className="rounded-md border border-border bg-background/40 p-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--accent)]/60 text-muted-foreground">
                            #{a.slot_index + 1}
                          </span>
                          <select
                            value={a.sound_id}
                            onChange={(e) =>
                              onAssign(beatIdx, a.slot_index, e.target.value, a.offset)
                            }
                            className="flex-1 min-w-0 rounded bg-[color:var(--input)] border border-border px-1 py-0.5 text-xs"
                          >
                            {bolSounds.map((b) => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => s && preview(s)}
                            className="h-6 w-6 rounded text-muted-foreground hover:text-gold flex items-center justify-center"
                          >
                            <Play className="h-3 w-3" />
                          </button>
                          <button
                            disabled={busy === a.id}
                            onClick={() => onRemove(a)}
                            className="h-6 w-6 rounded text-muted-foreground hover:text-destructive flex items-center justify-center"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">at</span>
                          <select
                            value={String(a.offset)}
                            onChange={(e) =>
                              onAssign(beatIdx, a.slot_index, a.sound_id, parseFloat(e.target.value))
                            }
                            className="flex-1 rounded bg-[color:var(--input)] border border-border px-1 py-0.5 text-[10px]"
                          >
                            {OFFSET_PRESETS.map((p) => (
                              <option key={p.v} value={p.v}>{p.label}</option>
                            ))}
                          </select>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {canAdd && (
                  <button
                    onClick={() => onAddSlot(beatIdx)}
                    disabled={busy === `${beatIdx}:${nextFreeSlot(beatIdx)}`}
                    className="mt-2 w-full inline-flex items-center justify-center gap-1 rounded-md border border-dashed border-border text-[11px] py-1 text-muted-foreground hover:text-gold hover:border-[color:var(--gold)]/50"
                  >
                    <Plus className="h-3 w-3" /> Add subdivision
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Save className="h-3 w-3" /> Changes save instantly.
      </p>
    </div>
  );
}
