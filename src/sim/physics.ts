import { headingDelta, normalizeHeading } from "./math.ts";

export const TURN_RATE_DEG_PER_SEC = 3;

export function integrateHeading(current: number, target: number, dt: number): number {
  const delta = headingDelta(current, target);
  if (delta === 0) return current;
  const maxTurn = TURN_RATE_DEG_PER_SEC * dt;
  if (Math.abs(delta) <= maxTurn) return normalizeHeading(target);
  const sign = delta >= 0 ? 1 : -1;
  return normalizeHeading(current + sign * maxTurn);
}

// Vertical: jet climb/descent at ~1800 fpm = 30 fps.
export const VERTICAL_RATE_FPS = 30;

export function integrateAltitude(current: number, target: number, dt: number): number {
  const delta = target - current;
  if (delta === 0) return current;
  const maxChange = VERTICAL_RATE_FPS * dt;
  if (Math.abs(delta) <= maxChange) return target;
  return current + Math.sign(delta) * maxChange;
}

// Acceleration: 1 kt/sec.
export const ACCEL_KTS_PER_SEC = 1;

export function integrateSpeed(current: number, target: number, dt: number): number {
  const delta = target - current;
  if (delta === 0) return current;
  const maxChange = ACCEL_KTS_PER_SEC * dt;
  if (Math.abs(delta) <= maxChange) return target;
  return current + Math.sign(delta) * maxChange;
}
