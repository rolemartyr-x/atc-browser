// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Sfx, SFX_CONFIG } from "../../src/audio/Sfx";
import { SettingsStore } from "../../src/app/settings";
import { STORAGE_KEY, type StorageAdapter } from "../../src/storage/Storage";

class MemoryAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  raw() { return this.map.get(STORAGE_KEY) ?? null; }
}

interface MockOscillator {
  type: OscillatorType;
  frequency: { value: number; setValueAtTime: ReturnType<typeof vi.fn> };
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

interface MockGain {
  gain: { value: number; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn> };
  connect: ReturnType<typeof vi.fn>;
}

function makeMockContext() {
  const oscillators: MockOscillator[] = [];
  const gains: MockGain[] = [];
  const masterGain: MockGain = {
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  };
  const ctx = {
    currentTime: 0,
    destination: {},
    state: "running" as AudioContextState,
    createOscillator: vi.fn(() => {
      const osc: MockOscillator = {
        type: "sine",
        frequency: { value: 0, setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => {
      const g: MockGain = {
        gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      };
      gains.push(g);
      return g;
    }),
    resume: vi.fn(() => Promise.resolve()),
  };
  // First createGain returns the master gain so volume tests can inspect it.
  let firstGainCreated = false;
  ctx.createGain = vi.fn(() => {
    if (!firstGainCreated) {
      firstGainCreated = true;
      return masterGain;
    }
    const g: MockGain = {
      gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
    gains.push(g);
    return g;
  });
  return { ctx, oscillators, gains, masterGain };
}

describe("Sfx", () => {
  let mock: ReturnType<typeof makeMockContext>;
  let store: SettingsStore;

  beforeEach(() => {
    mock = makeMockContext();
    store = new SettingsStore(new MemoryAdapter());
  });

  it("SFX_CONFIG covers all six MVP names", () => {
    expect(Object.keys(SFX_CONFIG).sort()).toEqual(
      ["accept", "conflict", "handoff", "lose", "reject", "select"].sort(),
    );
  });

  it("play creates an oscillator when SFX is enabled", () => {
    const sfx = new Sfx(store, () => mock.ctx as unknown as AudioContext);
    sfx.play("accept");
    expect(mock.oscillators.length).toBeGreaterThanOrEqual(1);
  });

  it("play is a no-op when SFX is disabled in settings", () => {
    store.update({ sfx_enabled: false });
    const sfx = new Sfx(store, () => mock.ctx as unknown as AudioContext);
    sfx.play("accept");
    expect(mock.oscillators).toHaveLength(0);
  });

  it("master gain follows store volume on each play", () => {
    store.update({ volume: 0.4 });
    const sfx = new Sfx(store, () => mock.ctx as unknown as AudioContext);
    sfx.play("accept");
    expect(mock.masterGain.gain.setValueAtTime).toHaveBeenCalledWith(0.4, expect.any(Number));
  });

  it("multi-note SFX (handoff) creates multiple oscillators", () => {
    const sfx = new Sfx(store, () => mock.ctx as unknown as AudioContext);
    sfx.play("handoff");
    // handoff has 3 notes
    expect(mock.oscillators.length).toBe(3);
  });

  it("createContext is only called once across multiple plays", () => {
    const factory = vi.fn(() => mock.ctx as unknown as AudioContext);
    const sfx = new Sfx(store, factory);
    sfx.play("accept");
    sfx.play("reject");
    sfx.play("handoff");
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
