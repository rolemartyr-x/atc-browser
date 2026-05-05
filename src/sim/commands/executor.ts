import type { Aircraft, Airspace, Command } from "../types";

export interface ExecuteResult {
  ok: boolean;
  reason?: string;
}

export interface ExecutorContext {
  aircraft: Aircraft[];
  airspace: Airspace;
  elapsed_sec?: number;
}

const SPEED_MIN_KTS = 100;
const SPEED_MAX_KTS = 350;

export function executeCommand(ctx: ExecutorContext, cmd: Command): ExecuteResult {
  const ac = ctx.aircraft.find((a) => a.id === cmd.aircraft_id || a.callsign === cmd.aircraft_id);
  if (!ac) return { ok: false, reason: `aircraft not found: ${cmd.aircraft_id}` };

  if (ac.state === "cleared_approach") {
    return { ok: false, reason: "aircraft on final approach, cannot vector" };
  }
  if (ac.state === "handed_off") {
    return { ok: false, reason: "aircraft already handed off" };
  }

  switch (cmd.kind) {
    case "assign_heading": {
      const h = cmd.heading_deg;
      if (!Number.isFinite(h) || h < 0 || h > 359) {
        return { ok: false, reason: "heading must be 0-359" };
      }
      ac.target_heading = h;
      return { ok: true };
    }
    case "assign_altitude": {
      const alt = cmd.altitude_ft;
      const { floor_ft, ceiling_ft } = ctx.airspace;
      if (!Number.isFinite(alt) || alt < floor_ft || alt > ceiling_ft) {
        return { ok: false, reason: `altitude must be ${floor_ft}-${ceiling_ft} ft` };
      }
      ac.target_altitude = alt;
      return { ok: true };
    }
    case "assign_speed": {
      const s = cmd.speed_kts;
      if (!Number.isFinite(s) || s < SPEED_MIN_KTS || s > SPEED_MAX_KTS) {
        return { ok: false, reason: `speed must be ${SPEED_MIN_KTS}-${SPEED_MAX_KTS} kts` };
      }
      ac.target_speed = s;
      return { ok: true };
    }
    case "clear_approach": {
      const rwy = ctx.airspace.runways.find((r) => r.id === cmd.runway);
      if (!rwy) return { ok: false, reason: `no runway "${cmd.runway}" in airspace` };
      if (!rwy.ils) return { ok: false, reason: `runway "${cmd.runway}" has no ILS` };
      ac.cleared_runway = rwy.id;
      return { ok: true };
    }
    case "handoff": {
      ac.state = "handed_off";
      ac.handoff_time_s = ctx.elapsed_sec ?? null;
      return { ok: true };
    }
  }
}
