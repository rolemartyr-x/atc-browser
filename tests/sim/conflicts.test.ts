import { describe, it, expect } from "vitest";
import {
  inConflict,
  findConflicts,
  SEPARATION_LATERAL_NM,
  SEPARATION_VERTICAL_FT,
} from "../../src/sim/conflicts";
import type { Aircraft } from "../../src/sim/types";

function ac(id: string, x: number, y: number, alt: number): Aircraft {
  return {
    id,
    callsign: id,
    kind: "arrival",
    state: "under_control",
    position_nm: { x, y },
    altitude_ft: alt,
    heading_deg: 0,
    speed_kts: 250,
    target_heading: null,
    target_altitude: null,
    target_speed: null,
    cleared_runway: null,
    spawn_time_s: 0,
    handoff_time_s: null,
  };
}

describe("inConflict", () => {
  it("flags pairs within both lateral AND vertical thresholds", () => {
    expect(inConflict(ac("A", 0, 0, 5000), ac("B", 1, 0, 5500))).toBe(true);
  });
  it("does not flag pairs separated laterally", () => {
    const a = ac("A", 0, 0, 5000);
    const b = ac("B", SEPARATION_LATERAL_NM + 0.01, 0, 5500);
    expect(inConflict(a, b)).toBe(false);
  });
  it("does not flag pairs separated vertically", () => {
    const a = ac("A", 0, 0, 5000);
    const b = ac("B", 1, 0, 5000 + SEPARATION_VERTICAL_FT);
    expect(inConflict(a, b)).toBe(false);
  });
  it("requires BOTH thresholds breached", () => {
    // 4 nm apart, but same altitude — still no conflict (lateral OK)
    expect(inConflict(ac("A", 0, 0, 5000), ac("B", 4, 0, 5000))).toBe(false);
    // 1 nm apart, 1000 ft difference — vertical at threshold, NOT below it
    expect(inConflict(ac("A", 0, 0, 5000), ac("B", 1, 0, 6000))).toBe(false);
  });
});

describe("findConflicts", () => {
  it("returns empty for 0 or 1 aircraft", () => {
    expect(findConflicts([])).toEqual([]);
    expect(findConflicts([ac("A", 0, 0, 5000)])).toEqual([]);
  });
  it("finds a single conflicting pair", () => {
    const result = findConflicts([
      ac("A", 0, 0, 5000),
      ac("B", 1, 0, 5500),
      ac("C", 50, 50, 9000),
    ]);
    expect(result).toEqual([["A", "B"]]);
  });
  it("finds multiple conflicting pairs", () => {
    const result = findConflicts([
      ac("A", 0, 0, 5000),
      ac("B", 1, 0, 5500),
      ac("C", 0.5, 0.5, 5200),
    ]);
    expect(result).toContainEqual(["A", "B"]);
    expect(result).toContainEqual(["A", "C"]);
    expect(result).toContainEqual(["B", "C"]);
  });
});
