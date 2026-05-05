import type { World } from "../sim/World";
import type { AppState } from "../app/state";
import type { AircraftKind } from "../sim/types";
import { parseCommandLine } from "../sim/commands/parser";

export interface CommandPipelineOptions {
  world: World;
  state: AppState;
}

function describeCommand(cmd: { kind: string; runway?: string; heading_deg?: number; altitude_ft?: number; speed_kts?: number; to?: string }): string {
  switch (cmd.kind) {
    case "assign_heading":
      return `heading ${cmd.heading_deg}`;
    case "assign_altitude":
      return `altitude ${cmd.altitude_ft}`;
    case "assign_speed":
      return `speed ${cmd.speed_kts}`;
    case "clear_approach":
      return `cleared ILS ${cmd.runway}`;
    case "handoff":
      return `handoff to ${cmd.to}`;
    default:
      return cmd.kind;
  }
}

export class CommandPipeline {
  constructor(private opts: CommandPipelineOptions) {
    opts.world.events.on((e) => this.handleEvent(e));
  }

  submit(text: string): void {
    const lookup = (cs: string): { id: string; kind: AircraftKind } | null => {
      const ac = this.opts.world.aircraft.find((a) => a.callsign === cs || a.id === cs);
      return ac ? { id: ac.id, kind: ac.kind } : null;
    };
    const result = parseCommandLine(text, lookup);
    if ("error" in result) {
      this.setResponse(result.error, true);
      return;
    }
    for (const cmd of result) {
      this.opts.world.enqueueCommand(cmd);
    }
  }

  private handleEvent(e: { kind: string }): void {
    if (e.kind === "command_accepted") {
      const ev = e as unknown as { command: Parameters<typeof describeCommand>[0]; aircraft_id: string };
      const cs = this.callsignFor(ev.aircraft_id);
      this.setResponse(`${cs}, ${describeCommand(ev.command)}`, false);
    } else if (e.kind === "command_rejected") {
      const reason = (e as unknown as { reason: string }).reason;
      this.setResponse(reason, true);
    } else if (e.kind === "session_ended") {
      const reason = (e as unknown as { reason: string }).reason;
      this.setResponse(`Session ended: ${reason}`, true);
    }
  }

  private callsignFor(id: string): string {
    const ac = this.opts.world.aircraft.find((a) => a.id === id);
    return ac?.callsign ?? id;
  }

  private setResponse(text: string, isError: boolean): void {
    this.opts.state.response = { text, isError, shownAt_ms: Date.now() };
  }
}
