import { describe, it, expect } from "vitest";
import { World } from "../../src/sim/World";
import { KDLH } from "../../src/data/airports/kdlh";
import { createArrival } from "../../src/sim/Aircraft";

describe("World — basics", () => {
  it("starts with empty aircraft list and running session", () => {
    const w = new World(KDLH, { now_ms: 0 });
    expect(w.aircraft).toEqual([]);
    expect(w.session.status).toBe("running");
    expect(w.elapsed_sec).toBe(0);
  });

  it("ticks advance elapsed_sec", () => {
    const w = new World(KDLH, { now_ms: 0 });
    w.tick(1);
    w.tick(0.5);
    expect(w.elapsed_sec).toBe(1.5);
    expect(w.session.elapsed_sec).toBe(1.5);
  });

  it("tick() applies physics to aircraft", () => {
    const w = new World(KDLH, { now_ms: 0 });
    const ac = createArrival({
      id: "T1", callsign: "T1",
      position_nm: { x: 0, y: 10 }, heading_deg: 180,
      altitude_ft: 8000, speed_kts: 360,
      spawn_time_s: 0,
    });
    w.aircraft.push(ac);
    w.tick(10);
    expect(ac.position_nm.y).toBeCloseTo(9.0, 6);  // moved 1 nm south
  });

  it("enqueueCommand applies the command on the next tick", () => {
    const w = new World(KDLH, { now_ms: 0 });
    const ac = createArrival({
      id: "T1", callsign: "T1",
      position_nm: { x: 0, y: 10 }, heading_deg: 180,
      altitude_ft: 8000, speed_kts: 250,
      spawn_time_s: 0,
    });
    w.aircraft.push(ac);
    w.enqueueCommand({ kind: "assign_heading", aircraft_id: "T1", heading_deg: 90 });
    w.tick(1);
    expect(ac.target_heading).toBe(90);
  });

  it("emits command_accepted on success and command_rejected on failure", () => {
    const w = new World(KDLH, { now_ms: 0 });
    const ac = createArrival({
      id: "T1", callsign: "T1",
      position_nm: { x: 0, y: 10 }, heading_deg: 180,
      altitude_ft: 8000, speed_kts: 250,
      spawn_time_s: 0,
    });
    w.aircraft.push(ac);
    const seen: string[] = [];
    w.events.on((e) => seen.push(e.kind));

    w.enqueueCommand({ kind: "assign_heading", aircraft_id: "T1", heading_deg: 90 });
    w.tick(0);
    expect(seen).toContain("command_accepted");

    w.enqueueCommand({ kind: "assign_heading", aircraft_id: "T1", heading_deg: 999 });
    w.tick(0);
    expect(seen).toContain("command_rejected");
  });
});
