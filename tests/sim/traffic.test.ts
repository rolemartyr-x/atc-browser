import { describe, it, expect } from "vitest";
import { TrafficGenerator } from "../../src/sim/traffic";
import { createArrival } from "../../src/sim/Aircraft";
import type { Airspace } from "../../src/sim/types";

const airspace: Airspace = {
  icao: "TEST",
  name: "Test",
  elevation_ft: 1000,
  magnetic_var_deg: 0,
  runways: [
    { id: "27", heading_deg: 270, threshold: { x: 1, y: 0 }, opposite: "09", length_ft: 10000,
      ils: { course_deg: 270, glideslope_deg: 3, threshold: { x: 1, y: 0 } } },
  ],
  entry_fixes: [
    { name: "FIXA", position_nm: { x: 20, y: 20 }, suggested_alt_ft: 11000 },
    { name: "FIXB", position_nm: { x: -20, y: -20 }, suggested_alt_ft: 11000 },
  ],
  exit_fixes: [{ name: "OUT1", position_nm: { x: -20, y: 20 } }],
  sector_radius_nm: 30,
  floor_ft: 3000,
  ceiling_ft: 13000,
};

describe("TrafficGenerator", () => {
  it("respects the spawn interval — does not spawn twice within the same window", () => {
    let counter = 0;
    const gen = new TrafficGenerator(airspace, {
      initialIntervalSec: 60,
      minIntervalSec: 30,
      rampDurationSec: 600,
      rng: () => 0,                     // deterministic
      idGen: () => `id${++counter}`,
    });
    // First tick at t=0 should not spawn yet.
    expect(gen.tick(0)).toBeNull();
    // After 30 sec elapsed, still not at the 60-sec interval.
    expect(gen.tick(30)).toBeNull();
    // At 60 sec — first spawn.
    const ac = gen.tick(30);
    expect(ac).not.toBeNull();
    expect(ac!.kind).toBe("arrival");
  });

  it("ramps spawn rate over time — interval shrinks toward minIntervalSec", () => {
    const gen = new TrafficGenerator(airspace, {
      initialIntervalSec: 60,
      minIntervalSec: 30,
      rampDurationSec: 600,
      rng: () => 0,
      idGen: () => "id",
    });
    // After full ramp, interval should be ~minInterval.
    const intervalAtRampEnd = gen.intervalAt(600);
    expect(intervalAtRampEnd).toBeCloseTo(30, 1);
    const intervalAtHalf = gen.intervalAt(300);
    expect(intervalAtHalf).toBeCloseTo(45, 1);
  });

  it("alternates between arrival entry fixes deterministically given rng", () => {
    let counter = 0;
    const gen = new TrafficGenerator(airspace, {
      initialIntervalSec: 60,
      minIntervalSec: 60,
      rampDurationSec: 600,
      rng: () => 0,                     // always picks first fix
      idGen: () => `id${++counter}`,
    });
    gen.tick(60);    // first spawn at t=60
    const ac1 = gen.tick(60);  // would be at t=120 but tick increments by 60
    expect(ac1?.position_nm).toEqual({ x: 20, y: 20 }); // FIXA
  });

  it("skips a fix that already has an aircraft within SAFE_SPAWN_RADIUS_NM", () => {
    let counter = 0;
    const gen = new TrafficGenerator(airspace, {
      initialIntervalSec: 60,
      minIntervalSec: 60,
      rampDurationSec: 600,
      rng: () => 0,                     // always picks fixes[0] when available
      idGen: () => `id${++counter}`,
    });

    // First spawn at FIXA (20, 20).
    const ac1 = gen.tick(60);
    expect(ac1?.position_nm).toEqual({ x: 20, y: 20 });

    // Pretend the first aircraft is still at FIXA (within SAFE_SPAWN_RADIUS_NM).
    // The second spawn must avoid FIXA and pick the only other fix (FIXB).
    const ac2 = gen.tick(60, [ac1!]);
    expect(ac2?.position_nm).toEqual({ x: -20, y: -20 });
  });

  it("defers the next spawn when all entry fixes are occupied", () => {
    let counter = 0;
    const gen = new TrafficGenerator(airspace, {
      initialIntervalSec: 60,
      minIntervalSec: 60,
      rampDurationSec: 600,
      rng: () => 0,
      idGen: () => `id${++counter}`,
    });

    // Build a fake aircraft list with one near each fix to occupy both.
    const ac1 = createArrival({
      id: "occA",
      callsign: "OCCA",
      position_nm: { x: 20, y: 20 },
      heading_deg: 225,
      altitude_ft: 11000,
      speed_kts: 250,
      spawn_time_s: 0,
    });
    const ac2 = createArrival({
      id: "occB",
      callsign: "OCCB",
      position_nm: { x: -20, y: -20 },
      heading_deg: 45,
      altitude_ft: 11000,
      speed_kts: 250,
      spawn_time_s: 0,
    });

    expect(gen.tick(60, [ac1, ac2])).toBeNull();
  });
});
