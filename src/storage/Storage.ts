// Versioned localStorage blob. All persisted shape is defined here.
//
// Single key keeps the surface minimal and lets us version/migrate as one
// unit. `StorageAdapter` is a 2-method seam so tests can use an in-memory
// map without jsdom.

export const STORAGE_KEY = "atc-browser:v1";
export const STORAGE_VERSION = 1;

export interface PersistedSettings {
  sfx_enabled: boolean;
  tts_enabled: boolean;
  volume: number;          // 0..1
  voice_uri: string | null;
}

export interface HighScore {
  score: number;
  duration_sec: number;
  ended_at: string;        // ISO 8601
}

export interface PersistedBlob {
  v: number;
  settings: PersistedSettings;
  high_scores: Record<string, HighScore[]>;   // keyed by lowercased ICAO, e.g. "kdlh"
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  sfx_enabled: true,
  tts_enabled: true,
  volume: 0.8,
  voice_uri: null,
};

export function defaultBlob(): PersistedBlob {
  return {
    v: STORAGE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    high_scores: {},
  };
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Quota exceeded or storage disabled — silently drop. We never want
      // a persistence failure to break gameplay.
    }
  }
}

// Migrate any unknown blob shape forward to the current version.
// Today there's only v1, so the migration is "if it doesn't look like v1,
// fall back to defaults." Any future version bump adds a case here.
export function migrate(raw: unknown): PersistedBlob {
  if (!isObject(raw)) return defaultBlob();
  const v = (raw as { v?: unknown }).v;
  if (v === STORAGE_VERSION) {
    return mergeWithDefaults(raw as Partial<PersistedBlob>);
  }
  // Unknown / future version — discard, start fresh.
  return defaultBlob();
}

function mergeWithDefaults(blob: Partial<PersistedBlob>): PersistedBlob {
  const base = defaultBlob();
  const settings: PersistedSettings = {
    ...base.settings,
    ...(isObject(blob.settings) ? sanitizeSettings(blob.settings as Record<string, unknown>) : {}),
  };
  const high_scores: Record<string, HighScore[]> = {};
  if (isObject(blob.high_scores)) {
    for (const [icao, list] of Object.entries(blob.high_scores as Record<string, unknown>)) {
      if (Array.isArray(list)) {
        high_scores[icao] = list.filter(isHighScore);
      }
    }
  }
  return { v: STORAGE_VERSION, settings, high_scores };
}

function sanitizeSettings(raw: Record<string, unknown>): Partial<PersistedSettings> {
  const out: Partial<PersistedSettings> = {};
  if (typeof raw.sfx_enabled === "boolean") out.sfx_enabled = raw.sfx_enabled;
  if (typeof raw.tts_enabled === "boolean") out.tts_enabled = raw.tts_enabled;
  if (typeof raw.volume === "number" && raw.volume >= 0 && raw.volume <= 1) {
    out.volume = raw.volume;
  }
  if (raw.voice_uri === null || typeof raw.voice_uri === "string") {
    out.voice_uri = raw.voice_uri;
  }
  return out;
}

function isHighScore(x: unknown): x is HighScore {
  return (
    isObject(x) &&
    typeof x.score === "number" &&
    typeof x.duration_sec === "number" &&
    typeof x.ended_at === "string"
  );
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function loadBlob(adapter: StorageAdapter): PersistedBlob {
  const raw = adapter.getItem(STORAGE_KEY);
  if (raw === null) return defaultBlob();
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return defaultBlob();
  }
}

export function saveBlob(adapter: StorageAdapter, blob: PersistedBlob): void {
  adapter.setItem(STORAGE_KEY, JSON.stringify(blob));
}
