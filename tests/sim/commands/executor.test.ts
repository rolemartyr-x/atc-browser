import { describe, it, expect } from "vitest";
import { executeCommand } from "../../../src/sim/commands/executor";
import { createArrival } from "../../../src/sim/Aircraft";
import type { Aircraft, Airspace } from "../../../src/sim/types";

const airspace: Airspace = {
  icao: "TEST",
  name: "Test",
  elevation_ft: 0,
  magnetic_var_deg: 0,
  runways: [
    { id: "27", heading_deg: 270, threshold: { x: 1, y: 0 }, opposite: "09", length_ft: 10000,
      ils: { course_deg: 270, glideslope_deg: 3, threshold: { x: 1, y: 0 } } },
  ],
  entry_fixes: [],
  exit_fixes: [],
  sector_radius_nm: 30,
  floor_ft: 3000,
  ceiling_ft: 13000,
};

function makeAc(): Aircraft {
  return createArrival({
    id: "DAL891",
    callsign: "DAL891",
    position_nm: { x: 10, y: 0 },
    heading_deg: 270,
    altitude_ft: 8000,
    speed_kts: 250,
    spawn_time_s: 0,
  });
}

describe("executeCommand — assign_heading", () => {
  it("accepts valid heading and sets target", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "assign_heading", aircraft_id: "DAL891", heading_deg: 240,
    });
    expect(r.ok).toBe(true);
    expect(ac.target_heading).toBe(240);
  });
  it("rejects out-of-range heading", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "assign_heading", aircraft_id: "DAL891", heading_deg: 360,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/heading/i);
  });
});

describe("executeCommand — assign_altitude", () => {
  it("accepts altitude within sector floor/ceiling", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "assign_altitude", aircraft_id: "DAL891", altitude_ft: 5000,
    });
    expect(r.ok).toBe(true);
    expect(ac.target_altitude).toBe(5000);
  });
  it("rejects below floor", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "assign_altitude", aircraft_id: "DAL891", altitude_ft: 1000,
    });
    expect(r.ok).toBe(false);
  });
});

describe("executeCommand — assign_speed", () => {
  it("accepts speed within bounds", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "assign_speed", aircraft_id: "DAL891", speed_kts: 210,
    });
    expect(r.ok).toBe(true);
    expect(ac.target_speed).toBe(210);
  });
});

describe("executeCommand — clear_approach", () => {
  it("sets cleared_runway when runway exists with ILS", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "clear_approach", aircraft_id: "DAL891", runway: "27",
    });
    expect(r.ok).toBe(true);
    expect(ac.cleared_runway).toBe("27");
  });
  it("rejects unknown runway", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "clear_approach", aircraft_id: "DAL891", runway: "18",
    });
    expect(r.ok).toBe(false);
  });
});

describe("executeCommand — handoff", () => {
  it("transitions to handed_off", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace, elapsed_sec: 100 }, {
      kind: "handoff", aircraft_id: "DAL891", to: "tower",
    });
    expect(r.ok).toBe(true);
    expect(ac.state).toBe("handed_off");
    expect(ac.handoff_time_s).toBe(100);
  });
});

describe("executeCommand — rejection rules", () => {
  it("rejects commands when aircraft is on final approach (cleared_approach)", () => {
    const ac = makeAc();
    ac.state = "cleared_approach";
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "assign_heading", aircraft_id: "DAL891", heading_deg: 100,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/final approach/i);
  });
  it("rejects when aircraft not found", () => {
    const r = executeCommand({ aircraft: [], airspace }, {
      kind: "assign_heading", aircraft_id: "GHOST", heading_deg: 100,
    });
    expect(r.ok).toBe(false);
  });
});
