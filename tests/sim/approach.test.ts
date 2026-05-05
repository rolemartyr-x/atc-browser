import { describe, it, expect } from "vitest";
import {
  isEstablished,
  glideslopeAltitudeFt,
  tickApproach,
} from "../../src/sim/approach";
import { createArrival } from "../../src/sim/Aircraft";
import { EventBus } from "../../src/sim/events";
import type { Aircraft, Runway } from "../../src/sim/types";

const rwy27: Runway = {
  id: "27",
  heading_deg: 269,
  threshold: { x: 0.84, y: 0 },
  opposite: "09",
  length_ft: 10000,
  ils: {
    course_deg: 269,
    glideslope_deg: 3.0,
    threshold: { x: 0.84, y: 0 },
  },
};

function arrivalAt(x: number, y: number, heading: number, alt: number): Aircraft {
  return createArrival({
    id: "DAL891",
    callsign: "DAL891",
    position_nm: { x, y },
    heading_deg: heading,
    altitude_ft: alt,
    speed_kts: 200,
    spawn_time_s: 0,
  });
}

describe("glideslopeAltitudeFt", () => {
  it("equals elevation at threshold", () => {
    expect(glideslopeAltitudeFt(rwy27, 1428, 0)).toBeCloseTo(1428, 0);
  });
  it("rises with distance from threshold at 3°", () => {
    // 5 nm out: ~1428 + 5 * 6076 * tan(3°) ≈ 1428 + 1593 ≈ 3021 ft
    expect(glideslopeAltitudeFt(rwy27, 1428, 5)).toBeCloseTo(3021, -1);
  });
});

describe("isEstablished", () => {
  it("returns true when on localizer, on heading, and at/below GS", () => {
    // 5 nm east of threshold along extended centerline: x=5.84, y=0, heading 269, alt at GS
    const ac = arrivalAt(5.84, 0, 269, 3000);
    expect(isEstablished(ac, rwy27, 1428)).toBe(true);
  });
  it("returns false when too far laterally from localizer", () => {
    const ac = arrivalAt(5.84, 2, 269, 3000);
    expect(isEstablished(ac, rwy27, 1428)).toBe(false);
  });
  it("returns false when heading too far off course", () => {
    const ac = arrivalAt(5.84, 0, 200, 3000);
    expect(isEstablished(ac, rwy27, 1428)).toBe(false);
  });
  it("returns false when above the glideslope", () => {
    const ac = arrivalAt(5.84, 0, 269, 9000);
    expect(isEstablished(ac, rwy27, 1428)).toBe(false);
  });
  it("returns false when not approaching the runway end (behind threshold)", () => {
    // Aircraft is on the wrong side of the threshold (west of it)
    const ac = arrivalAt(-5, 0, 269, 3000);
    expect(isEstablished(ac, rwy27, 1428)).toBe(false);
  });
});

describe("tickApproach", () => {
  it("transitions under_control + cleared_runway to cleared_approach when established", () => {
    const ac = arrivalAt(5.84, 0, 269, 3000);
    ac.cleared_runway = "27";
    const events = new EventBus();
    const seen: string[] = [];
    events.on((e) => seen.push(e.kind));

    tickApproach(ac, [rwy27], 1428, 1, events);

    expect(ac.state).toBe("cleared_approach");
    expect(ac.target_heading).toBe(269);
    expect(seen).toContain("approach_established");
  });

  it("does not transition without cleared_runway", () => {
    const ac = arrivalAt(5.84, 0, 269, 3000);
    const events = new EventBus();
    tickApproach(ac, [rwy27], 1428, 1, events);
    expect(ac.state).toBe("under_control");
  });

  it("once cleared_approach, descends toward threshold along glideslope", () => {
    // Aircraft at 5 nm from threshold on 3° GS: GS alt ≈ 1428 + 5*6076*tan(3°) ≈ 3021 ft.
    // Start above GS so target altitude is below current altitude.
    const ac = arrivalAt(5.84, 0, 269, 5000);
    ac.state = "cleared_approach";
    ac.cleared_runway = "27";
    ac.target_altitude = null;  // auto-fly takes over
    const events = new EventBus();
    tickApproach(ac, [rwy27], 1428, 1, events);
    // Target altitude should now be set to the glideslope altitude for current distance.
    expect(ac.target_altitude).not.toBeNull();
    expect(ac.target_altitude!).toBeLessThan(5000);
  });
});
