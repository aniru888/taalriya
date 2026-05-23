// Lightweight localStorage-backed app settings.
const KEY = "taalriya:settings:v1";

export interface AppSettings {
  taalId: string;
  variation: string;
  bpm: number;
  volume: number;
  tablaSemitones: number;
  tanpuraScale: string;
  tanpuraVolume: number;
  favorites: string[];
  totalPracticeMs: number;
}

const DEFAULTS: AppSettings = {
  taalId: "teentaal",
  variation: "theka",
  bpm: 80,
  volume: 0.9,
  tablaSemitones: 0,
  tanpuraScale: "C",
  tanpuraVolume: 0.7,
  favorites: [],
  totalPracticeMs: 0,
};

export function loadSettings(): AppSettings {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<AppSettings>) {
  if (typeof localStorage === "undefined") return;
  const cur = loadSettings();
  const next = { ...cur, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* noop */ }
}
