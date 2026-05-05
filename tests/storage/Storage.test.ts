import { describe, it, expect } from "vitest";
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  defaultBlob,
  loadBlob,
  saveBlob,
  migrate,
  type PersistedBlob,
  type StorageAdapter,
} from "../../src/storage/Storage";

class MemoryAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  raw() {
    return this.map.get(STORAGE_KEY) ?? null;
  }
}

describe("Storage", () => {
  it("loadBlob returns defaults when storage is empty", () => {
    const a = new MemoryAdapter();
    expect(loadBlob(a)).toEqual(defaultBlob());
  });

  it("save then load round-trips a full blob", () => {
    const a = new MemoryAdapter();
    const blob: PersistedBlob = {
      v: STORAGE_VERSION,
      settings: { sfx_enabled: false, tts_enabled: true, volume: 0.5, voice_uri: "VoiceX" },
      high_scores: {
        kdlh: [{ score: 9, duration_sec: 412, ended_at: "2026-05-05T12:00:00.000Z" }],
      },
    };
    saveBlob(a, blob);
    expect(loadBlob(a)).toEqual(blob);
  });

  it("loadBlob falls back to defaults when JSON is malformed", () => {
    const a = new MemoryAdapter();
    a.setItem(STORAGE_KEY, "not json {{{");
    expect(loadBlob(a)).toEqual(defaultBlob());
  });

  it("migrate returns defaults for non-objects", () => {
    expect(migrate(null)).toEqual(defaultBlob());
    expect(migrate(42)).toEqual(defaultBlob());
    expect(migrate("hi")).toEqual(defaultBlob());
    expect(migrate([])).toEqual(defaultBlob());
  });

  it("migrate discards unknown future versions", () => {
    expect(migrate({ v: 99, settings: {}, high_scores: {} })).toEqual(defaultBlob());
  });

  it("migrate fills missing settings keys with defaults", () => {
    const out = migrate({ v: STORAGE_VERSION, settings: { volume: 0.3 }, high_scores: {} });
    expect(out.settings.volume).toBe(0.3);
    expect(out.settings.sfx_enabled).toBe(true);   // default
    expect(out.settings.tts_enabled).toBe(true);   // default
    expect(out.settings.voice_uri).toBe(null);     // default
  });

  it("migrate rejects out-of-range volume", () => {
    const out = migrate({ v: STORAGE_VERSION, settings: { volume: 99 }, high_scores: {} });
    expect(out.settings.volume).toBe(0.8);   // default
  });

  it("migrate filters malformed high-score entries", () => {
    const out = migrate({
      v: STORAGE_VERSION,
      settings: {},
      high_scores: {
        kdlh: [
          { score: 5, duration_sec: 200, ended_at: "2026-05-05T00:00:00.000Z" },
          { score: "nope" },                       // invalid
          null,                                    // invalid
        ],
      },
    });
    expect(out.high_scores.kdlh).toHaveLength(1);
    expect(out.high_scores.kdlh![0]!.score).toBe(5);
  });
});
