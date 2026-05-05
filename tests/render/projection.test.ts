import { describe, it, expect } from "vitest";
import { Projection } from "../../src/render/projection";

describe("Projection", () => {
  it("centers world (0,0) at viewport center", () => {
    const p = new Projection(800, 600, 30);
    expect(p.toScreen({ x: 0, y: 0 })).toEqual({ x: 400, y: 300 });
  });

  it("flips y so positive y (north) is screen-up", () => {
    const p = new Projection(800, 600, 30);
    const ten_north = p.toScreen({ x: 0, y: 10 });
    expect(ten_north.y).toBeLessThan(300);
    const ten_south = p.toScreen({ x: 0, y: -10 });
    expect(ten_south.y).toBeGreaterThan(300);
  });

  it("scales so range diameter fits the smaller viewport dimension", () => {
    const p = new Projection(800, 600, 30);
    // smaller dim = 600 px, range diameter = 60 nm, so 1 nm = 10 px
    expect(p.pixelsPerNm()).toBeCloseTo(10, 6);
  });

  it("toScreen and toWorld are inverses", () => {
    const p = new Projection(800, 600, 30);
    const a = { x: 5, y: -7 };
    const back = p.toWorld(p.toScreen(a));
    expect(back.x).toBeCloseTo(5, 6);
    expect(back.y).toBeCloseTo(-7, 6);
  });

  it("recalculates on resize", () => {
    const p = new Projection(800, 600, 30);
    p.resize(1600, 1200);
    expect(p.pixelsPerNm()).toBeCloseTo(20, 6);   // 1200 / 60
    expect(p.toScreen({ x: 0, y: 0 })).toEqual({ x: 800, y: 600 });
  });

  it("accepts a new range", () => {
    const p = new Projection(600, 600, 30);
    p.setRange(15);
    expect(p.pixelsPerNm()).toBeCloseTo(20, 6);   // 600 / 30
  });
});
