import { useEffect, useState, useRef } from "react";
import { useAuth } from "./useAuth";
import { listTaalAssignments, listLibrarySounds, getSoundPlaybackUrl } from "@/lib/admin.functions";
import { registerSample, hasSample, ensureAudio } from "@/lib/audio-engine";

interface ServerAssignment {
  taal_id: string;
  variation: string;
  beat_index: number;
  slot_index: number;
  sound_id: string;
  offset: number;
  velocity: number;
}

interface LibrarySound {
  id: string;
  name: string;
  storage_path: string;
}

interface ServerStepOverride {
  sampleId: string;
  offset: number;
  velocity: number;
}

export function useServerAssignments(taalId: string, variation: string) {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState<Map<number, ServerStepOverride>>(new Map());
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef<string>("");

  useEffect(() => {
    if (!user) {
      setOverrides(new Map());
      return;
    }

    const key = `${taalId}:${variation}`;
    if (fetchedRef.current === key) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [assignResult, soundResult] = await Promise.all([
          listTaalAssignments(),
          listLibrarySounds(),
        ]);

        if (cancelled) return;

        const assignments = (assignResult.assignments as ServerAssignment[]).filter(
          (a) => a.taal_id === taalId && a.variation === variation,
        );

        if (assignments.length === 0) {
          fetchedRef.current = key;
          setLoading(false);
          return;
        }

        const soundMap = new Map<string, LibrarySound>();
        for (const s of soundResult.sounds as LibrarySound[]) {
          soundMap.set(s.id, s);
        }

        await ensureAudio();

        const map = new Map<number, ServerStepOverride>();

        for (const a of assignments) {
          const sound = soundMap.get(a.sound_id);
          if (!sound) continue;

          if (!hasSample(a.sound_id)) {
            try {
              const { url } = await getSoundPlaybackUrl({ data: { path: sound.storage_path } });
              const resp = await fetch(url);
              const blob = await resp.blob();
              await registerSample(a.sound_id, blob);
            } catch (e) {
              console.warn("Failed to load server sound", sound.name, e);
              continue;
            }
          }

          map.set(a.beat_index, {
            sampleId: a.sound_id,
            offset: a.offset,
            velocity: a.velocity,
          });
        }

        if (cancelled) return;
        fetchedRef.current = key;
        setOverrides(map);
      } catch (e) {
        console.warn("Server assignments fetch failed, using local defaults", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user, taalId, variation]);

  return { overrides, loading };
}
