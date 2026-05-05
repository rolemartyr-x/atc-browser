import type { Aircraft, Runway } from "./types";
import type { EventBus } from "./events";
import { degToRad, headingDelta } from "./math";

const ESTABLISH_LATERAL_NM = 1;
const ESTABLISH_HEADING_DEG = 30;
const FT_PER_NM = 6076;

export function glideslopeAltitudeFt(rwy: Runway, elevation_ft: number, distFromThresholdNm: number): number {
  if (!rwy.ils) return elevation_ft;
  return elevation_ft + distFromThresholdNm * FT_PER_NM * Math.tan(degToRad(rwy.ils.glideslope_deg));
}

// Perpendicular distance from a point to the localizer course centerline of a runway.
function lateralOffsetNm(ac: Aircraft, rwy: Runway): number {
  if (!rwy.ils) return Infinity;
  const dx = ac.position_nm.x - rwy.ils.threshold.x;
  const dy = ac.position_nm.y - rwy.ils.threshold.y;
  // Localizer course direction unit vector (heading toward runway = inbound to threshold)
  const courseRad = degToRad(rwy.ils.course_deg);
  const ux = Math.sin(courseRad);
  const uy = Math.cos(courseRad);
  // Perpendicular component: |dx * uy - dy * ux|
  return Math.abs(dx * uy - dy * ux);
}

// Distance from aircraft to threshold projected along the localizer (negative = past threshold).
function alongTrackNm(ac: Aircraft, rwy: Runway): number {
  if (!rwy.ils) return -Infinity;
  const dx = ac.position_nm.x - rwy.ils.threshold.x;
  const dy = ac.position_nm.y - rwy.ils.threshold.y;
  const courseRad = degToRad(rwy.ils.course_deg);
  // Outbound direction (from threshold away from runway) = OPPOSITE of inbound course.
  // Inbound course points TOWARD threshold; aircraft east of threshold approaching 269° has positive
  // outbound x. So we project onto outbound direction = -inbound.
  const ox = -Math.sin(courseRad);
  const oy = -Math.cos(courseRad);
  return dx * ox + dy * oy;
}

export function isEstablished(ac: Aircraft, rwy: Runway, elevation_ft: number): boolean {
  if (!rwy.ils) return false;
  const lateral = lateralOffsetNm(ac, rwy);
  if (lateral > ESTABLISH_LATERAL_NM) return false;

  const headingOff = Math.abs(headingDelta(ac.heading_deg, rwy.ils.course_deg));
  if (headingOff > ESTABLISH_HEADING_DEG) return false;

  const along = alongTrackNm(ac, rwy);
  if (along <= 0) return false;  // already past or at threshold

  const gsAlt = glideslopeAltitudeFt(rwy, elevation_ft, along);
  if (ac.altitude_ft > gsAlt + 200) return false;  // small slop

  return true;
}

export function tickApproach(
  ac: Aircraft,
  runways: Runway[],
  elevation_ft: number,
  _dt: number,
  events: EventBus,
): void {
  if (!ac.cleared_runway) return;
  const rwy = runways.find((r) => r.id === ac.cleared_runway);
  if (!rwy || !rwy.ils) return;

  if (ac.state === "under_control") {
    if (isEstablished(ac, rwy, elevation_ft)) {
      ac.state = "cleared_approach";
      ac.target_heading = rwy.ils.course_deg;
      events.emit({ kind: "approach_established", aircraft_id: ac.id, runway: rwy.id });
    }
    return;
  }

  if (ac.state === "cleared_approach") {
    // Glide slope auto-descent: target altitude tracks GS for current distance from threshold.
    const along = alongTrackNm(ac, rwy);
    if (along <= 0) {
      // Reached threshold — handoff handled by World on next tick.
      return;
    }
    ac.target_altitude = glideslopeAltitudeFt(rwy, elevation_ft, along);
    ac.target_heading = rwy.ils.course_deg;
  }
}
