// Geometry: planar coordinates in nautical miles, airport reference point at origin.
// x = east (positive), y = north (positive).
export interface Point2D {
  x: number;
  y: number;
}

// Aircraft

export type AircraftKind = "arrival" | "departure";

export type AircraftState =
  | "entering"
  | "under_control"
  | "cleared_approach"
  | "handed_off";

export interface Aircraft {
  id: string;
  callsign: string;
  kind: AircraftKind;
  state: AircraftState;

  position_nm: Point2D;
  altitude_ft: number;
  heading_deg: number;
  speed_kts: number;

  target_heading: number | null;
  target_altitude: number | null;
  target_speed: number | null;
  cleared_runway: string | null;

  spawn_time_s: number;
  handoff_time_s: number | null;
}

// Airspace

export interface IlsApproach {
  course_deg: number;        // magnetic; the inbound course aircraft fly to land
  glideslope_deg: number;    // typically 3.0
  threshold: Point2D;        // touchdown point of this runway end
}

export interface Runway {
  id: string;                // "27" — the magnetic heading rounded to nearest 10 / 10
  heading_deg: number;       // takeoff / landing direction
  threshold: Point2D;        // touchdown point of THIS direction (i.e. for "27" it's the east end)
  opposite: string;          // id of the opposite direction, e.g. "09" for runway 27
  length_ft: number;
  ils?: IlsApproach;
}

export interface Fix {
  name: string;
  position_nm: Point2D;
  suggested_alt_ft?: number;
}

export interface Airspace {
  icao: string;
  name: string;
  elevation_ft: number;
  magnetic_var_deg: number;  // east is negative, west is positive

  runways: Runway[];
  entry_fixes: Fix[];        // arrival entry points
  exit_fixes: Fix[];         // departure handoff points

  sector_radius_nm: number;
  floor_ft: number;
  ceiling_ft: number;
}

// Commands

export type Command =
  | { kind: "assign_heading"; aircraft_id: string; heading_deg: number }
  | { kind: "assign_altitude"; aircraft_id: string; altitude_ft: number }
  | { kind: "assign_speed"; aircraft_id: string; speed_kts: number }
  | { kind: "clear_approach"; aircraft_id: string; runway: string }
  | { kind: "handoff"; aircraft_id: string; to: "tower" | "center" | "auto" };

// Events

export type GameEvent =
  | { kind: "aircraft_spawned"; aircraft_id: string }
  | { kind: "command_accepted"; command: Command; aircraft_id: string }
  | { kind: "command_rejected"; command: Command; aircraft_id: string; reason: string }
  | { kind: "approach_cleared"; aircraft_id: string; runway: string }
  | { kind: "approach_established"; aircraft_id: string; runway: string }
  | { kind: "handed_off"; aircraft_id: string; to: "tower" | "center" }
  | { kind: "conflict_raised"; pair: [string, string] }
  | { kind: "conflict_resolved"; pair: [string, string] }
  | { kind: "aircraft_lost"; aircraft_id: string; reason: string }
  | { kind: "session_ended"; reason: string };

// Session

export interface SessionState {
  id: string;
  started_at_ms: number;
  elapsed_sec: number;
  aircraft_handled: number;
  aircraft_lost: number;
  conflicts_raised: number;
  score: number;
  status: "running" | "ended";
  end_reason: "separation_loss" | "lost_aircraft" | null;
}
