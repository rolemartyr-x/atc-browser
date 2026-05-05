import { describe, it, expect } from "vitest";
import { hitTestAircraft, HIT_RADIUS_NM } from "../../src/input/mouse";
import { createArrival } from "../../src/sim/Aircraft";

describe("hitTestAircraft", () => {
  function ac(id: string, x: number, y: number) {
    return createArrival({
      id,
      callsign: id,
      position_nm: { x, y },
      heading_deg: 0,
      altitude_ft: 5000,
      speed_kts: 200,
      spawn_time_s: 0,
    });
  }

  it("returns null when no aircraft within the hit radius", () => {
    expect(hitTestAircraft({ x: 0, y: 0 }, [ac("A", 10, 10)])).toBeNull();
  });

  it("returns the aircraft when click is within the hit radius", () => {
    const target = ac("A", 5, 5);
    expect(hitTestAircraft({ x: 5, y: 5 }, [target])).toBe(target);
  });

  it("returns the closest aircraft when multiple are in range", () => {
    const closer = ac("A", 1, 0);
    const farther = ac("B", 2, 0);
    expect(hitTestAircraft({ x: 0, y: 0 }, [closer, farther])).toBe(closer);
  });

  it("respects HIT_RADIUS_NM threshold", () => {
    const just_inside = ac("A", HIT_RADIUS_NM - 0.01, 0);
    const just_outside = ac("B", HIT_RADIUS_NM + 0.01, 0);
    expect(hitTestAircraft({ x: 0, y: 0 }, [just_inside])).toBe(just_inside);
    expect(hitTestAircraft({ x: 0, y: 0 }, [just_outside])).toBeNull();
  });
});
