import { describe, it, expect, vi } from "vitest";
import { SettingsStore } from "../../src/app/settings";
import { STORAGE_KEY, defaultBlob, type StorageAdapter } from "../../src/storage/Storage";

class MemoryAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  raw() { return this.map.get(STORAGE_KEY) ?? null; }
}

describe("SettingsStore", () => {
  it("loads defaults when storage is empty", () => {
    const a = new MemoryAdapter();
    const store = new SettingsStore(a);
    expect(store.settings).toEqual(defaultBlob().settings);
  });

  it("update merges patch and persists to storage", () => {
    const a = new MemoryAdapter();
    const store = new SettingsStore(a);
    store.update({ volume: 0.3, sfx_enabled: false });
    expect(store.settings.volume).toBe(0.3);
    expect(store.settings.sfx_enabled).toBe(false);
    expect(store.settings.tts_enabled).toBe(true);   // unchanged

    // Persistence: a fresh store on the same adapter sees the same values
    const fresh = new SettingsStore(a);
    expect(fresh.settings.volume).toBe(0.3);
    expect(fresh.settings.sfx_enabled).toBe(false);
  });

  it("notifies subscribers on update", () => {
    const store = new SettingsStore(new MemoryAdapter());
    const cb = vi.fn();
    store.onChange(cb);
    store.update({ volume: 0.6 });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0].volume).toBe(0.6);
  });

  it("recordHighScore persists and exposes the new top list", () => {
    const a = new MemoryAdapter();
    const store = new SettingsStore(a);
    store.recordHighScore("kdlh", { score: 7, duration_sec: 300, ended_at: "x" });
    expect(store.highScores("kdlh")).toEqual([
      { score: 7, duration_sec: 300, ended_at: "x" },
    ]);
    const fresh = new SettingsStore(a);
    expect(fresh.highScores("kdlh")).toHaveLength(1);
  });

  it("onChange returns an unsubscribe function", () => {
    const store = new SettingsStore(new MemoryAdapter());
    const cb = vi.fn();
    const off = store.onChange(cb);
    off();
    store.update({ volume: 0.5 });
    expect(cb).not.toHaveBeenCalled();
  });
});
