import type { AircraftKind, Command } from "../types";

export interface ParseError {
  error: string;
}

export type ParseResult = Command[] | ParseError;

export type CallsignLookup = (callsign: string) => { id: string; kind: AircraftKind } | null;

export function parseCommandLine(input: string, lookup: CallsignLookup): ParseResult {
  const tokens = input.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return { error: "expected: <CALLSIGN> <verb> <value>..." };
  }
  const callsign = tokens[0]!;
  const ac = lookup(callsign);
  if (!ac) return { error: `unknown callsign: ${callsign}` };

  const commands: Command[] = [];
  let i = 1;
  while (i < tokens.length) {
    const verb = tokens[i]!;
    switch (verb) {
      case "H": {
        const raw = tokens[i + 1];
        const v = raw === undefined ? NaN : Number(raw);
        if (!Number.isFinite(v)) {
          return { error: `H: expected heading, got "${raw ?? ""}"` };
        }
        commands.push({ kind: "assign_heading", aircraft_id: ac.id, heading_deg: v });
        i += 2;
        break;
      }
      case "A": {
        const raw = tokens[i + 1];
        const v = raw === undefined ? NaN : Number(raw);
        if (!Number.isFinite(v)) {
          return { error: `A: expected altitude (hundreds of feet), got "${raw ?? ""}"` };
        }
        commands.push({ kind: "assign_altitude", aircraft_id: ac.id, altitude_ft: v * 100 });
        i += 2;
        break;
      }
      case "S": {
        const raw = tokens[i + 1];
        const v = raw === undefined ? NaN : Number(raw);
        if (!Number.isFinite(v)) {
          return { error: `S: expected speed, got "${raw ?? ""}"` };
        }
        commands.push({ kind: "assign_speed", aircraft_id: ac.id, speed_kts: v });
        i += 2;
        break;
      }
      case "L": {
        const raw = tokens[i + 1];
        if (!raw) return { error: "L: expected runway id" };
        commands.push({ kind: "clear_approach", aircraft_id: ac.id, runway: raw });
        i += 2;
        break;
      }
      case "X": {
        const to: "tower" | "center" = ac.kind === "arrival" ? "tower" : "center";
        commands.push({ kind: "handoff", aircraft_id: ac.id, to });
        i += 1;
        break;
      }
      default:
        return { error: `unknown verb: ${verb}` };
    }
  }
  return commands;
}
