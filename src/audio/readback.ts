import type { Command } from "../sim/types";
import { icaoToSpoken } from "./callsigns";

export function formatReadback(cmd: Command, callsign: string): string {
  const cs = icaoToSpoken(callsign);
  const body = bodyForCommand(cmd);
  return `${cs}, ${body}, ${cs}`;
}

function bodyForCommand(cmd: Command): string {
  switch (cmd.kind) {
    case "assign_heading":
      return `fly heading ${headingDigits(cmd.heading_deg)}`;
    case "assign_altitude":
      return `descend and maintain ${altitudeWords(cmd.altitude_ft)}`;
    case "assign_speed":
      return `reduce speed to ${digitsByDigit(cmd.speed_kts)} knots`;
    case "clear_approach":
      return `cleared ILS ${digitsByDigit(cmd.runway)} approach`;
    case "handoff":
      // "auto" is internally resolved before TTS sees it; default to tower.
      return `contact ${cmd.to === "auto" ? "tower" : cmd.to}`;
  }
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

function headingDigits(deg: number): string {
  const padded = Math.round(deg).toString().padStart(3, "0");
  return [...padded].map((d) => ONES[Number(d)]!).join(" ");
}

function digitsByDigit(input: string | number): string {
  return [...String(input)].map((c) => {
    const n = Number(c);
    return Number.isFinite(n) ? ONES[n]! : c;
  }).join(" ");
}

function altitudeWords(ft: number): string {
  // ATC reads altitudes in thousands and hundreds:
  //   8000 -> "eight thousand"
  //   8500 -> "eight thousand five hundred"
  //   500  -> "five hundred"
  // We don't bother with FL above 18,000 in MVP.
  const thousands = Math.floor(ft / 1000);
  const hundreds = Math.floor((ft % 1000) / 100);
  const parts: string[] = [];
  if (thousands > 0) parts.push(`${ONES[thousands]!} thousand`);
  if (hundreds > 0) parts.push(`${ONES[hundreds]!} hundred`);
  if (parts.length === 0) return "zero";
  return parts.join(" ");
}
