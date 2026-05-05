import { describe, it, expect } from "vitest";
import { parseCommandLine } from "../../../src/sim/commands/parser";
import type { AircraftKind } from "../../../src/sim/types";

const lookup = (cs: string): { id: string; kind: AircraftKind } | null => {
  if (cs === "DAL891") return { id: "DAL891", kind: "arrival" };
  if (cs === "SWA42") return { id: "SWA42", kind: "departure" };
  return null;
};

describe("parseCommandLine", () => {
  it("parses heading", () => {
    expect(parseCommandLine("DAL891 H 240", lookup)).toEqual([
      { kind: "assign_heading", aircraft_id: "DAL891", heading_deg: 240 },
    ]);
  });

  it("parses altitude as hundreds of feet", () => {
    expect(parseCommandLine("DAL891 A 80", lookup)).toEqual([
      { kind: "assign_altitude", aircraft_id: "DAL891", altitude_ft: 8000 },
    ]);
  });

  it("parses speed", () => {
    expect(parseCommandLine("DAL891 S 210", lookup)).toEqual([
      { kind: "assign_speed", aircraft_id: "DAL891", speed_kts: 210 },
    ]);
  });

  it("parses ILS clearance", () => {
    expect(parseCommandLine("DAL891 L 27", lookup)).toEqual([
      { kind: "clear_approach", aircraft_id: "DAL891", runway: "27" },
    ]);
  });

  it("parses handoff with auto-routing for arrival -> tower", () => {
    expect(parseCommandLine("DAL891 X", lookup)).toEqual([
      { kind: "handoff", aircraft_id: "DAL891", to: "tower" },
    ]);
  });

  it("parses handoff with auto-routing for departure -> center", () => {
    expect(parseCommandLine("SWA42 X", lookup)).toEqual([
      { kind: "handoff", aircraft_id: "SWA42", to: "center" },
    ]);
  });

  it("parses chained verbs", () => {
    expect(parseCommandLine("DAL891 H 240 A 80 S 210", lookup)).toEqual([
      { kind: "assign_heading", aircraft_id: "DAL891", heading_deg: 240 },
      { kind: "assign_altitude", aircraft_id: "DAL891", altitude_ft: 8000 },
      { kind: "assign_speed", aircraft_id: "DAL891", speed_kts: 210 },
    ]);
  });

  it("is case-insensitive and whitespace-tolerant", () => {
    expect(parseCommandLine("  dal891  h  240  ", lookup)).toEqual([
      { kind: "assign_heading", aircraft_id: "DAL891", heading_deg: 240 },
    ]);
  });

  it("rejects unknown callsign", () => {
    const r = parseCommandLine("XXX111 H 240", lookup);
    expect("error" in r).toBe(true);
  });

  it("rejects unknown verb", () => {
    const r = parseCommandLine("DAL891 Z 50", lookup);
    expect("error" in r).toBe(true);
  });

  it("rejects missing value for verb", () => {
    const r = parseCommandLine("DAL891 H", lookup);
    expect("error" in r).toBe(true);
  });

  it("rejects non-numeric value where numeric expected", () => {
    const r = parseCommandLine("DAL891 H abc", lookup);
    expect("error" in r).toBe(true);
  });

  it("rejects empty input", () => {
    const r = parseCommandLine("", lookup);
    expect("error" in r).toBe(true);
  });
});
