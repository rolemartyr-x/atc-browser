import { describe, it, expect } from "vitest";
import { integrateHeading, TURN_RATE_DEG_PER_SEC } from "../../src/sim/physics";

describe("integrateHeading", () => {
  it("turns right toward target at 3°/sec", () => {
    expect(integrateHeading(0, 90, 1)).toBe(TURN_RATE_DEG_PER_SEC);
    expect(integrateHeading(0, 90, 10)).toBe(30);
  });

  it("turns left toward target", () => {
    expect(integrateHeading(0, 270, 1)).toBe(360 - TURN_RATE_DEG_PER_SEC);
  });

  it("snaps to target when within one tick of it", () => {
    expect(integrateHeading(89, 90, 1)).toBe(90);
    expect(integrateHeading(90, 89, 1)).toBe(89);
  });

  it("handles 360 wrap", () => {
    expect(integrateHeading(355, 5, 1)).toBe(358);
    expect(integrateHeading(5, 355, 1)).toBe(2);
  });

  it("returns target if delta is zero", () => {
    expect(integrateHeading(123, 123, 5)).toBe(123);
  });
});

import {
  integrateAltitude,
  integrateSpeed,
  VERTICAL_RATE_FPS,
  ACCEL_KTS_PER_SEC,
} from "../../src/sim/physics";

describe("integrateAltitude", () => {
  it("descends at the configured rate", () => {
    expect(integrateAltitude(10000, 5000, 1)).toBe(10000 - VERTICAL_RATE_FPS);
    expect(integrateAltitude(10000, 5000, 10)).toBe(10000 - VERTICAL_RATE_FPS * 10);
  });
  it("climbs at the configured rate", () => {
    expect(integrateAltitude(5000, 10000, 1)).toBe(5000 + VERTICAL_RATE_FPS);
  });
  it("snaps to target when within one tick of it", () => {
    expect(integrateAltitude(10000, 9999, 1)).toBe(9999);
    expect(integrateAltitude(10000, 10001, 1)).toBe(10001);
  });
  it("returns current if delta is zero", () => {
    expect(integrateAltitude(8000, 8000, 1)).toBe(8000);
  });
});

describe("integrateSpeed", () => {
  it("decelerates at 1 kt/sec", () => {
    expect(integrateSpeed(250, 200, 1)).toBe(250 - ACCEL_KTS_PER_SEC);
  });
  it("accelerates at 1 kt/sec", () => {
    expect(integrateSpeed(200, 250, 1)).toBe(200 + ACCEL_KTS_PER_SEC);
  });
  it("snaps to target when within one tick", () => {
    expect(integrateSpeed(250, 249.5, 1)).toBe(249.5);
  });
});

import { integratePosition, tickAircraft } from "../../src/sim/physics";
import type { Aircraft } from "../../src/sim/types";

describe("integratePosition", () => {
  it("flies due north at the right rate", () => {
    // 360 kts = 0.1 nm/sec; over 10 sec, +1.0 nm north.
    const result = integratePosition({ x: 0, y: 0 }, 0, 360, 10);
    expect(result.x).toBeCloseTo(0, 9);
    expect(result.y).toBeCloseTo(1.0, 9);
  });

  it("flies due east", () => {
    const result = integratePosition({ x: 0, y: 0 }, 90, 360, 10);
    expect(result.x).toBeCloseTo(1.0, 9);
    expect(result.y).toBeCloseTo(0, 9);
  });

  it("flies northeast (045°)", () => {
    const result = integratePosition({ x: 0, y: 0 }, 45, 360, 10);
    expect(result.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(result.y).toBeCloseTo(Math.SQRT1_2, 6);
  });
});

describe("tickAircraft", () => {
  function jet(): Aircraft {
    return {
      id: "test",
      callsign: "TEST1",
      kind: "arrival",
      state: "under_control",
      position_nm: { x: 0, y: 10 },
      altitude_ft: 10000,
      heading_deg: 180,         // due south
      speed_kts: 360,
      target_heading: null,
      target_altitude: null,
      target_speed: null,
      cleared_runway: null,
      spawn_time_s: 0,
      handoff_time_s: null,
    };
  }

  it("integrates position by current heading and speed when no targets set", () => {
    const ac = jet();
    tickAircraft(ac, 10);
    expect(ac.position_nm.x).toBeCloseTo(0, 9);
    expect(ac.position_nm.y).toBeCloseTo(9.0, 9);  // moved 1 nm south
  });

  it("turns toward target_heading at 3°/sec", () => {
    const ac = jet();
    ac.target_heading = 270;  // turn right 90°
    tickAircraft(ac, 1);
    // turning right = clockwise; from 180, +3 = 183
    expect(ac.heading_deg).toBe(183);
  });

  it("descends and decelerates simultaneously", () => {
    const ac = jet();
    ac.target_altitude = 8000;
    ac.target_speed = 250;
    tickAircraft(ac, 1);
    expect(ac.altitude_ft).toBe(10000 - 30);  // -30 ft in 1 sec
    expect(ac.speed_kts).toBe(360 - 1);        // -1 kt in 1 sec
  });
});
