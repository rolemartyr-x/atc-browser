import type { Aircraft, Point2D } from "../sim/types";
import { distanceNm } from "../sim/math";
import type { Projection } from "../render/projection";
import type { World } from "../sim/World";

// Clicks within this many nautical miles of an aircraft's position select it.
export const HIT_RADIUS_NM = 1.5;

export function hitTestAircraft(click_nm: Point2D, aircraft: Aircraft[]): Aircraft | null {
  let best: Aircraft | null = null;
  let bestDist = HIT_RADIUS_NM;
  for (const ac of aircraft) {
    const d = distanceNm(click_nm, ac.position_nm);
    if (d <= bestDist) {
      best = ac;
      bestDist = d;
    }
  }
  return best;
}

export interface MouseOptions {
  canvas: HTMLCanvasElement;
  projection: Projection;
  world: () => World;
  onSelect: (aircraftId: string | null) => void;
}

export class MouseInput {
  constructor(private opts: MouseOptions) {
    opts.canvas.addEventListener("click", (e) => this.handleClick(e));
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.opts.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const nm = this.opts.projection.toWorld(screen);
    const hit = hitTestAircraft(nm, this.opts.world().aircraft);
    this.opts.onSelect(hit?.id ?? null);
  }
}
