import type { Aircraft, Airspace, Command, SessionState } from "./types";
import { EventBus } from "./events";
import { tickAircraft } from "./physics";
import { tickApproach } from "./approach";
import { findConflicts } from "./conflicts";
import { executeCommand } from "./commands/executor";
import { distanceNm } from "./math";
import { TrafficGenerator, type TrafficOptions } from "./traffic";

export interface WorldOptions {
  now_ms: number;
  trafficEnabled?: boolean;
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export class World {
  aircraft: Aircraft[] = [];
  elapsed_sec = 0;
  events = new EventBus();
  session: SessionState;
  airspace: Airspace;
  private commandQueue: Command[] = [];
  private activeConflicts = new Set<string>();
  private traffic: TrafficGenerator | null = null;

  constructor(airspace: Airspace, opts: WorldOptions) {
    this.airspace = airspace;
    this.session = {
      id: newSessionId(),
      started_at_ms: opts.now_ms,
      elapsed_sec: 0,
      aircraft_handled: 0,
      aircraft_lost: 0,
      conflicts_raised: 0,
      score: 0,
      status: "running",
      end_reason: null,
    };
  }

  enqueueCommand(cmd: Command): void {
    this.commandQueue.push(cmd);
  }

  startTraffic(opts: TrafficOptions): void {
    this.traffic = new TrafficGenerator(this.airspace, opts);
  }

  tick(dt: number): void {
    if (this.session.status !== "running") return;
    this.elapsed_sec += dt;
    this.session.elapsed_sec = this.elapsed_sec;

    // 1. drain commands
    const queued = this.commandQueue;
    this.commandQueue = [];
    for (const cmd of queued) {
      const r = executeCommand({ aircraft: this.aircraft, airspace: this.airspace, elapsed_sec: this.elapsed_sec }, cmd);
      if (r.ok) {
        this.events.emit({ kind: "command_accepted", command: cmd, aircraft_id: cmd.aircraft_id });
        if (cmd.kind === "clear_approach") {
          this.events.emit({ kind: "approach_cleared", aircraft_id: cmd.aircraft_id, runway: cmd.runway });
        }
        if (cmd.kind === "handoff") {
          this.session.aircraft_handled += 1;
          this.session.score += 1;
          this.events.emit({
            kind: "handed_off",
            aircraft_id: cmd.aircraft_id,
            to: cmd.to === "auto" ? "tower" : cmd.to,
          });
        }
      } else {
        this.events.emit({
          kind: "command_rejected",
          command: cmd,
          aircraft_id: cmd.aircraft_id,
          reason: r.reason ?? "rejected",
        });
      }
    }

    // 2. physics + approach
    for (const ac of this.aircraft) {
      if (ac.state === "handed_off") continue;
      tickAircraft(ac, dt);
      tickApproach(ac, this.airspace.runways, this.airspace.elevation_ft, dt, this.events);
    }

    // 2.5 spawn
    if (this.traffic) {
      const spawned = this.traffic.tick(dt);
      if (spawned) {
        this.aircraft.push(spawned);
        this.events.emit({ kind: "aircraft_spawned", aircraft_id: spawned.id });
      }
    }

    // 3. handoff/loss detection — auto-handoff at runway threshold for cleared_approach,
    //    auto-handoff at ceiling for departures, sector-exit = lost.
    for (const ac of this.aircraft) {
      if (ac.state === "handed_off") continue;

      // Cleared aircraft reach threshold → handoff to tower
      if (ac.state === "cleared_approach" && ac.cleared_runway) {
        const rwy = this.airspace.runways.find((r) => r.id === ac.cleared_runway);
        if (rwy && distanceNm(ac.position_nm, rwy.threshold) < 0.3) {
          ac.state = "handed_off";
          ac.handoff_time_s = this.elapsed_sec;
          this.session.aircraft_handled += 1;
          this.session.score += 1;
          this.events.emit({ kind: "handed_off", aircraft_id: ac.id, to: "tower" });
          continue;
        }
      }

      // Departures climbing through ceiling → handoff to center
      if (ac.kind === "departure" && ac.altitude_ft >= this.airspace.ceiling_ft && ac.state === "under_control") {
        ac.state = "handed_off";
        ac.handoff_time_s = this.elapsed_sec;
        this.session.aircraft_handled += 1;
        this.session.score += 1;
        this.events.emit({ kind: "handed_off", aircraft_id: ac.id, to: "center" });
        continue;
      }

      // Exited sector boundary uncleared → lost
      const distFromAirport = distanceNm(ac.position_nm, { x: 0, y: 0 });
      if (distFromAirport > this.airspace.sector_radius_nm + 5 && ac.state === "under_control") {
        this.session.aircraft_lost += 1;
        this.events.emit({
          kind: "aircraft_lost",
          aircraft_id: ac.id,
          reason: "exited sector boundary uncleared",
        });
        this.endSession("lost_aircraft");
        return;
      }
    }

    // Sweep handed_off aircraft
    this.aircraft = this.aircraft.filter((ac) => ac.state !== "handed_off");

    // 4. conflict detection
    const pairs = findConflicts(this.aircraft);
    const seen = new Set<string>();
    for (const [a, b] of pairs) {
      const key = [a, b].sort().join("|");
      seen.add(key);
      if (!this.activeConflicts.has(key)) {
        this.activeConflicts.add(key);
        this.session.conflicts_raised += 1;
        this.events.emit({ kind: "conflict_raised", pair: [a, b] });
        this.endSession("separation_loss");
        return;
      }
    }
    for (const key of this.activeConflicts) {
      if (!seen.has(key)) {
        this.activeConflicts.delete(key);
        const [a, b] = key.split("|") as [string, string];
        this.events.emit({ kind: "conflict_resolved", pair: [a, b] });
      }
    }
  }

  private endSession(reason: "separation_loss" | "lost_aircraft"): void {
    this.session.status = "ended";
    this.session.end_reason = reason;
    this.events.emit({ kind: "session_ended", reason });
  }
}
