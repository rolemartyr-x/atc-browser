import { describe, it, expect } from "vitest";
import { formatReadback } from "../../src/audio/readback";
import type { Command } from "../../src/sim/types";

describe("formatReadback", () => {
  it("formats an assign_heading command (heading 240)", () => {
    const cmd: Command = { kind: "assign_heading", aircraft_id: "x", heading_deg: 240 };
    expect(formatReadback(cmd, "DAL891")).toBe(
      "Delta eight ninety one, fly heading two four zero, Delta eight ninety one",
    );
  });

  it("formats heading 90 with leading zero (zero nine zero)", () => {
    const cmd: Command = { kind: "assign_heading", aircraft_id: "x", heading_deg: 90 };
    expect(formatReadback(cmd, "UAL237")).toBe(
      "United two thirty seven, fly heading zero nine zero, United two thirty seven",
    );
  });

  it("formats an assign_altitude command (8000 ft as 'eight thousand')", () => {
    const cmd: Command = { kind: "assign_altitude", aircraft_id: "x", altitude_ft: 8000 };
    expect(formatReadback(cmd, "DAL891")).toBe(
      "Delta eight ninety one, descend and maintain eight thousand, Delta eight ninety one",
    );
  });

  it("formats altitudes ending in 500 (8500 -> 'eight thousand five hundred')", () => {
    const cmd: Command = { kind: "assign_altitude", aircraft_id: "x", altitude_ft: 8500 };
    expect(formatReadback(cmd, "DAL891")).toBe(
      "Delta eight ninety one, descend and maintain eight thousand five hundred, Delta eight ninety one",
    );
  });

  it("formats an assign_speed command", () => {
    const cmd: Command = { kind: "assign_speed", aircraft_id: "x", speed_kts: 210 };
    expect(formatReadback(cmd, "DAL891")).toBe(
      "Delta eight ninety one, reduce speed to two one zero knots, Delta eight ninety one",
    );
  });

  it("formats a clear_approach command", () => {
    const cmd: Command = { kind: "clear_approach", aircraft_id: "x", runway: "27" };
    expect(formatReadback(cmd, "SWA42")).toBe(
      "Southwest forty two, cleared ILS two seven approach, Southwest forty two",
    );
  });

  it("formats a handoff command", () => {
    const cmd: Command = { kind: "handoff", aircraft_id: "x", to: "tower" };
    expect(formatReadback(cmd, "AAL14")).toBe(
      "American fourteen, contact tower, American fourteen",
    );
  });

  it("formats a center handoff", () => {
    const cmd: Command = { kind: "handoff", aircraft_id: "x", to: "center" };
    expect(formatReadback(cmd, "AAL14")).toBe(
      "American fourteen, contact center, American fourteen",
    );
  });
});
