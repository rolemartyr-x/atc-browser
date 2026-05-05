import type { Aircraft, AircraftKind, Point2D } from "./types";

interface BaseSpawnArgs {
  id: string;
  callsign: string;
  position_nm: Point2D;
  heading_deg: number;
  altitude_ft: number;
  speed_kts: number;
  spawn_time_s: number;
}

function spawn(kind: AircraftKind, args: BaseSpawnArgs): Aircraft {
  return {
    id: args.id,
    callsign: args.callsign,
    kind,
    state: "under_control",
    position_nm: { ...args.position_nm },
    altitude_ft: args.altitude_ft,
    heading_deg: args.heading_deg,
    speed_kts: args.speed_kts,
    target_heading: null,
    target_altitude: null,
    target_speed: null,
    cleared_runway: null,
    spawn_time_s: args.spawn_time_s,
    handoff_time_s: null,
  };
}

export function createArrival(args: BaseSpawnArgs): Aircraft {
  return spawn("arrival", args);
}

export function createDeparture(args: BaseSpawnArgs): Aircraft {
  return spawn("departure", args);
}

const PREFIXES = ["UAL", "DAL", "SWA", "AAL", "JBU", "SKW", "FFT"];

export function generateCallsign(rng: () => number = Math.random): string {
  const prefix = PREFIXES[Math.floor(rng() * PREFIXES.length)]!;
  const number = 1 + Math.floor(rng() * 9999);
  return `${prefix}${number}`;
}
