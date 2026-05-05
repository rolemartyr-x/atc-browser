import type { Airspace } from "../../sim/types";

// KDLH — Duluth International (Duluth, MN)
// Source: FAA Airport Diagram, ILS RWY 27 chart (verify before merge to main)
// Coordinate system: planar nm, airport reference point at origin, x = east, y = north.
//
// MVP simplifications:
//   - Only runway 09/27 modeled. 03/21 deferred.
//   - Entry fixes are simplified placeholder points (real KDLH STAR fixes
//     vary by procedure; we don't model STARs in MVP).
//   - Magnetic variation rolled into runway/ILS course numbers (we use
//     magnetic bearings everywhere — pilots fly magnetic).

const RUNWAY_27_LEN_NM = 10162 / 6076;  // ~1.673
const HALF_LEN = RUNWAY_27_LEN_NM / 2;

export const KDLH: Airspace = {
  icao: "KDLH",
  name: "Duluth International",
  elevation_ft: 1428,
  magnetic_var_deg: 1,             // ~1°W

  runways: [
    {
      id: "27",
      heading_deg: 269,
      threshold: { x: HALF_LEN, y: 0 },     // east end (touchdown for 27 inbound)
      opposite: "09",
      length_ft: 10162,
      ils: {
        course_deg: 269,
        glideslope_deg: 3.0,
        threshold: { x: HALF_LEN, y: 0 },
      },
    },
    {
      id: "09",
      heading_deg: 89,
      threshold: { x: -HALF_LEN, y: 0 },    // west end
      opposite: "27",
      length_ft: 10162,
      ils: {
        course_deg: 89,
        glideslope_deg: 3.0,
        threshold: { x: -HALF_LEN, y: 0 },
      },
    },
  ],

  entry_fixes: [
    { name: "OBELE", position_nm: { x: 22, y: 22 }, suggested_alt_ft: 11000 },
    { name: "GIVKE", position_nm: { x: 22, y: -22 }, suggested_alt_ft: 11000 },
  ],

  exit_fixes: [
    { name: "DULUH", position_nm: { x: -22, y: 22 } },
  ],

  sector_radius_nm: 30,
  floor_ft: 3000,
  ceiling_ft: 13000,
};
