import { describe, it, expect } from "vitest";
import { World } from "../../src/sim/World";
import { KDLH } from "../../src/data/airports/kdlh";
import { createArrival } from "../../src/sim/Aircraft";

describe("scenario: vector arrival onto ILS 27 and land", () => {
  it("reaches handed_off with score 1 and no conflicts", () => {
    const w = new World(KDLH, { now_ms: 0 });
    // Spawn an arrival 10 nm east of threshold, on extended centerline,
    // heading 269 (already aligned), at 4000 ft (just above GS at 10nm),
    // 200 kts.
    const ac = createArrival({
      id: "DAL891", callsign: "DAL891",
      position_nm: { x: 10.84, y: 0 },
      heading_deg: 269,
      altitude_ft: 4000,
      speed_kts: 200,
      spawn_time_s: 0,
    });
    w.aircraft.push(ac);

    // Clear for ILS 27.
    w.enqueueCommand({ kind: "clear_approach", aircraft_id: "DAL891", runway: "27" });

    // Tick repeatedly until handed_off or 600 sec elapsed.
    let handedOff = false;
    w.events.on((e) => {
      if (e.kind === "handed_off") handedOff = true;
    });

    let ticks = 0;
    const dt = 1;
    while (!handedOff && ticks < 600) {
      w.tick(dt);
      ticks += 1;
    }

    expect(handedOff).toBe(true);
    expect(w.session.score).toBe(1);
    expect(w.session.aircraft_lost).toBe(0);
    expect(w.session.conflicts_raised).toBe(0);
  });
});

describe("scenario: separation loss ends session", () => {
  it("emits conflict_raised and session_ended on the same tick", () => {
    const w = new World(KDLH, { now_ms: 0 });
    const ac1 = createArrival({
      id: "A", callsign: "AAL1",
      position_nm: { x: 5, y: 0 },
      heading_deg: 270, altitude_ft: 5000, speed_kts: 250,
      spawn_time_s: 0,
    });
    const ac2 = createArrival({
      id: "B", callsign: "AAL2",
      position_nm: { x: 5.5, y: 0 },     // 0.5 nm apart, same alt
      heading_deg: 270, altitude_ft: 5000, speed_kts: 250,
      spawn_time_s: 0,
    });
    w.aircraft.push(ac1, ac2);

    const seen: string[] = [];
    w.events.on((e) => seen.push(e.kind));

    w.tick(1);

    expect(seen).toContain("conflict_raised");
    expect(seen).toContain("session_ended");
    expect(w.session.status).toBe("ended");
    expect(w.session.end_reason).toBe("separation_loss");
  });
});

describe("scenario: aircraft exits sector uncleared", () => {
  it("ends session with lost_aircraft", () => {
    const w = new World(KDLH, { now_ms: 0 });
    const ac = createArrival({
      id: "X", callsign: "XYZ1",
      position_nm: { x: 36, y: 0 },     // past sector_radius (30) + 5 buffer = 35 nm
      heading_deg: 90, altitude_ft: 8000, speed_kts: 250,
      spawn_time_s: 0,
    });
    w.aircraft.push(ac);

    w.tick(1);

    expect(w.session.status).toBe("ended");
    expect(w.session.end_reason).toBe("lost_aircraft");
    expect(w.session.aircraft_lost).toBe(1);
  });
});
