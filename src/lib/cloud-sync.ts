// Cloud sync helpers (browser-side, uses RLS-respecting client).
import { supabase } from "@/integrations/supabase/client";
import { loadSettings, saveSettings, type AppSettings } from "./settings";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  tier: "free" | "premium";
  settings: Partial<AppSettings>;
  favorites: string[];
  total_practice_ms: number;
}

export async function fetchProfile(): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, avatar_url, tier, settings, favorites, total_practice_ms")
    .maybeSingle();
  if (error) {
    console.warn("[cloud-sync] fetchProfile", error.message);
    return null;
  }
  return data as ProfileRow | null;
}

/** Pull cloud profile and merge into local settings (cloud wins for tracked keys). */
export async function pullProfileIntoLocal(): Promise<ProfileRow | null> {
  const p = await fetchProfile();
  if (!p) return null;
  const local = loadSettings();
  const merged: Partial<AppSettings> = {
    ...local,
    ...(p.settings ?? {}),
    favorites: Array.from(new Set([...(p.favorites ?? []), ...local.favorites])),
    totalPracticeMs: Math.max(local.totalPracticeMs, p.total_practice_ms ?? 0),
  };
  saveSettings(merged);
  return p;
}

/** Push current local settings up to cloud (debounced upstream). */
export async function pushSettingsToCloud() {
  const s = loadSettings();
  const { error } = await supabase
    .from("profiles")
    .update({
      settings: {
        taalId: s.taalId,
        variation: s.variation,
        bpm: s.bpm,
        volume: s.volume,
        tablaSemitones: s.tablaSemitones,
        tanpuraScale: s.tanpuraScale,
        tanpuraVolume: s.tanpuraVolume,
      },
      favorites: s.favorites,
      total_practice_ms: s.totalPracticeMs,
    })
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
  if (error) console.warn("[cloud-sync] push", error.message);
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
export function schedulePush(delayMs = 1200) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; pushSettingsToCloud(); }, delayMs);
}
