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
  /** Explicit map of bol label (e.g. "Dha") -> uploaded sample id.
   *  Uploaded recordings only play in preset taals when listed here.
   *  This replaces the old implicit name-matching that caused recordings
   *  to attach to random beats automatically. */
  bolAssignments: Record<string, string>;
  /** Master compressor/limiter toggle (default on for tabla clarity). */
  compressorEnabled: boolean;
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
  bolAssignments: {},
  compressorEnabled: true,
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
