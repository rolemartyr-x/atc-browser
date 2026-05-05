import { describe, it, expect } from "vitest";
import { createArrival, createDeparture, generateCallsign } from "../../src/sim/Aircraft";

describe("createArrival", () => {
  it("starts in under_control with sensible defaults", () => {
    const ac = createArrival({
      id: "ac1",
      callsign: "DAL891",
      position_nm: { x: 15, y: 15 },
      heading_deg: 270,
      altitude_ft: 11000,
      speed_kts: 250,
      spawn_time_s: 0,
    });
    expect(ac.kind).toBe("arrival");
    expect(ac.state).toBe("under_control");
    expect(ac.target_heading).toBeNull();
    expect(ac.cleared_runway).toBeNull();
    expect(ac.handoff_time_s).toBeNull();
  });
});

describe("createDeparture", () => {
  it("starts at runway threshold in under_control", () => {
    const ac = createDeparture({
      id: "ac2",
      callsign: "SWA42",
      position_nm: { x: 0.84, y: 0 },
      heading_deg: 269,
      altitude_ft: 1428,
      speed_kts: 0,
      spawn_time_s: 100,
    });
    expect(ac.kind).toBe("departure");
    expect(ac.state).toBe("under_control");
  });
});

describe("generateCallsign", () => {
  it("produces a string matching <prefix><digits>", () => {
    const cs = generateCallsign();
    expect(cs).toMatch(/^[A-Z]{2,3}\d{1,4}$/);
  });
});
