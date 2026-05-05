import type { Aircraft } from "./types";
import { distanceNm } from "./math";

export const SEPARATION_LATERAL_NM = 3;
export const SEPARATION_VERTICAL_FT = 1000;

export function inConflict(a: Aircraft, b: Aircraft): boolean {
  const lateral = distanceNm(a.position_nm, b.position_nm);
  const vertical = Math.abs(a.altitude_ft - b.altitude_ft);
  return lateral < SEPARATION_LATERAL_NM && vertical < SEPARATION_VERTICAL_FT;
}

export function findConflicts(aircraft: Aircraft[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < aircraft.length; i++) {
    for (let j = i + 1; j < aircraft.length; j++) {
      const a = aircraft[i]!;
      const b = aircraft[j]!;
      if (inConflict(a, b)) {
        pairs.push([a.id, b.id]);
      }
    }
  }
  return pairs;
}
