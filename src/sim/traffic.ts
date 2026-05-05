import type { Aircraft, Airspace, Fix } from "./types";
import { createArrival, generateCallsign } from "./Aircraft";

export interface TrafficOptions {
  initialIntervalSec: number;     // spawn interval at t=0
  minIntervalSec: number;         // floor as ramp completes
  rampDurationSec: number;        // how long to interpolate from initial → min
  rng?: () => number;
  idGen?: () => string;
}

export class TrafficGenerator {
  private elapsed = 0;
  private nextSpawnAt: number;
  private rng: () => number;
  private idGen: () => string;

  constructor(
    private readonly airspace: Airspace,
    private readonly opts: TrafficOptions,
  ) {
    this.rng = opts.rng ?? Math.random;
    this.idGen = opts.idGen ?? (() => `ac-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    this.nextSpawnAt = opts.initialIntervalSec;
  }

  intervalAt(elapsedSec: number): number {
    const t = Math.min(1, elapsedSec / this.opts.rampDurationSec);
    return this.opts.initialIntervalSec + (this.opts.minIntervalSec - this.opts.initialIntervalSec) * t;
  }

  tick(dt: number): Aircraft | null {
    this.elapsed += dt;
    if (this.elapsed < this.nextSpawnAt) return null;

    const fixes = this.airspace.entry_fixes;
    if (fixes.length === 0) return null;
    const fix = fixes[Math.floor(this.rng() * fixes.length)] as Fix;

    const ac = createArrival({
      id: this.idGen(),
      callsign: generateCallsign(this.rng),
      position_nm: { ...fix.position_nm },
      heading_deg: bearingToOrigin(fix.position_nm),
      altitude_ft: fix.suggested_alt_ft ?? 11000,
      speed_kts: 250,
      spawn_time_s: this.elapsed,
    });

    this.nextSpawnAt = this.elapsed + this.intervalAt(this.elapsed);
    return ac;
  }
}

function bearingToOrigin(p: { x: number; y: number }): number {
  // Heading from p toward (0,0) — used so spawned arrivals point inbound.
  const rad = Math.atan2(-p.x, -p.y);
  const deg = (rad * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}
