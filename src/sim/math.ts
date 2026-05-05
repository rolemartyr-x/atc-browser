import type { Point2D } from "./types";

export function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function distanceNm(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Compass bearing FROM a TO b: 0 = north (positive y), increasing clockwise.
export function bearingDeg(from: Point2D, to: Point2D): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return normalizeHeading(radToDeg(Math.atan2(dx, dy)));
}

// Shortest signed turn from `from` to `to`, in degrees [-180, 180].
// Positive = turn right (clockwise), negative = turn left.
export function headingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}
