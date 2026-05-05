import { describe, it, expect } from "vitest";
import { integrateHeading, TURN_RATE_DEG_PER_SEC } from "../../src/sim/physics.ts";

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
