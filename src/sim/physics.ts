import { headingDelta, normalizeHeading, degToRad } from "./math.ts";
import type { Aircraft, Point2D } from "./types.ts";

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

const SECONDS_PER_HOUR = 3600;

export function integratePosition(
  pos: Point2D,
  heading_deg: number,
  speed_kts: number,
  dt: number,
): Point2D {
  const distNm = (speed_kts / SECONDS_PER_HOUR) * dt;
  const rad = degToRad(heading_deg);
  return {
    x: pos.x + distNm * Math.sin(rad),
    y: pos.y + distNm * Math.cos(rad),
  };
}

export function tickAircraft(ac: Aircraft, dt: number): void {
  if (ac.target_heading != null) {
    ac.heading_deg = integrateHeading(ac.heading_deg, ac.target_heading, dt);
  }
  if (ac.target_altitude != null) {
    ac.altitude_ft = integrateAltitude(ac.altitude_ft, ac.target_altitude, dt);
  }
  if (ac.target_speed != null) {
    ac.speed_kts = integrateSpeed(ac.speed_kts, ac.target_speed, dt);
  }
  ac.position_nm = integratePosition(ac.position_nm, ac.heading_deg, ac.speed_kts, dt);
}
