import { describe, it, expect } from "vitest";
import {
  normalizeHeading,
  degToRad,
  radToDeg,
  distanceNm,
  bearingDeg,
  headingDelta,
} from "../../src/sim/math.ts";

describe("normalizeHeading", () => {
  it("wraps positive overflow", () => {
    expect(normalizeHeading(360)).toBe(0);
    expect(normalizeHeading(450)).toBe(90);
  });
  it("wraps negative", () => {
    expect(normalizeHeading(-10)).toBe(350);
    expect(normalizeHeading(-360)).toBe(0);
  });
  it("preserves in-range values", () => {
    expect(normalizeHeading(180)).toBe(180);
    expect(normalizeHeading(0)).toBe(0);
  });
});

describe("degToRad / radToDeg", () => {
  it("are inverses of each other", () => {
    expect(degToRad(0)).toBe(0);
    expect(degToRad(180)).toBeCloseTo(Math.PI, 9);
    expect(radToDeg(Math.PI)).toBeCloseTo(180, 9);
  });
});

describe("distanceNm", () => {
  it("returns 0 for same point", () => {
    expect(distanceNm({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
  });
  it("returns euclidean distance in nm", () => {
    expect(distanceNm({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("bearingDeg", () => {
  it("0° = due north (positive y)", () => {
    expect(bearingDeg({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(0);
  });
  it("90° = due east (positive x)", () => {
    expect(bearingDeg({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(90);
  });
  it("180° = due south", () => {
    expect(bearingDeg({ x: 0, y: 0 }, { x: 0, y: -1 })).toBe(180);
  });
  it("270° = due west", () => {
    expect(bearingDeg({ x: 0, y: 0 }, { x: -1, y: 0 })).toBe(270);
  });
});

describe("headingDelta", () => {
  it("returns shortest signed turn in [-180, 180]", () => {
    expect(headingDelta(0, 90)).toBe(90);
    expect(headingDelta(90, 0)).toBe(-90);
    expect(headingDelta(0, 350)).toBe(-10);
    expect(headingDelta(350, 10)).toBe(20);
    expect(headingDelta(180, 0)).toBe(-180);
  });
});
