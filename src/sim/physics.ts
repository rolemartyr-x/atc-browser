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
