// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { CommandPipeline } from "../../src/input/commandPipeline";
import { World } from "../../src/sim/World";
import { KDLH } from "../../src/data/airports/kdlh";
import { createArrival } from "../../src/sim/Aircraft";
import { createAppState } from "../../src/app/state";
import { SettingsStore } from "../../src/app/settings";
import type { StorageAdapter } from "../../src/storage/Storage";

class MemoryAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe("CommandPipeline", () => {
  let world: World;
  let state: ReturnType<typeof createAppState>;
  let pipeline: CommandPipeline;

  beforeEach(() => {
    world = new World(KDLH, { now_ms: 0 });
    world.aircraft.push(
      createArrival({
        id: "DAL891",
        callsign: "DAL891",
        position_nm: { x: 10, y: 0 },
        heading_deg: 270,
        altitude_ft: 8000,
        speed_kts: 250,
        spawn_time_s: 0,
      }),
    );
    state = createAppState(new SettingsStore(new MemoryAdapter()));
    pipeline = new CommandPipeline({ world, state });
  });

  it("parses and enqueues a valid command", () => {
    pipeline.submit("DAL891 H 240");
    world.tick(0);
    const ac = world.aircraft.find((a) => a.id === "DAL891")!;
    expect(ac.target_heading).toBe(240);
  });

  it("sets an error response on parse failure", () => {
    pipeline.submit("XYZ123 H 240");
    expect(state.response).not.toBeNull();
    expect(state.response!.isError).toBe(true);
    expect(state.response!.text).toMatch(/unknown callsign/i);
  });

  it("sets a non-error response after world acknowledges the command", () => {
    pipeline.submit("DAL891 H 240");
    world.tick(0);
    expect(state.response).not.toBeNull();
    expect(state.response!.isError).toBe(false);
  });

  it("sets an error response when executor rejects (e.g. heading out of range)", () => {
    pipeline.submit("DAL891 H 360");
    world.tick(0);
    expect(state.response).not.toBeNull();
    expect(state.response!.isError).toBe(true);
    expect(state.response!.text).toMatch(/heading/i);
  });
});
