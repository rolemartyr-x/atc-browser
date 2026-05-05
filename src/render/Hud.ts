import type { World } from "../sim/World";

export interface HudElements {
  clock: HTMLElement;
  selected: HTMLElement;
  score: HTMLElement;
  conflicts: HTMLElement;
  status: HTMLElement;
  response: HTMLElement;
}

export interface HudResponseState {
  text: string;
  isError: boolean;
  // Wall-clock timestamp (ms) used to fade the message after RESPONSE_TTL_MS.
  shownAt_ms: number;
}

const RESPONSE_TTL_MS = 3000;

export class Hud {
  constructor(private elements: HudElements) {}

  render(
    world: World,
    selectedCallsign: string | null,
    response: HudResponseState | null,
  ): void {
    this.elements.clock.textContent = formatClock(world.elapsed_sec);
    this.elements.selected.textContent = selectedCallsign ?? "--";
    this.elements.score.textContent = world.session.score.toString();
    this.elements.conflicts.textContent = world.session.conflicts_raised.toString();
    this.elements.status.textContent =
      world.session.status === "ended"
        ? `ENDED (${world.session.end_reason ?? "unknown"})`
        : "running";
    this.renderResponse(response);
  }

  private renderResponse(response: HudResponseState | null): void {
    const el = this.elements.response;
    if (!response) {
      el.textContent = "";
      el.classList.remove("error");
      return;
    }
    const age = Date.now() - response.shownAt_ms;
    if (age > RESPONSE_TTL_MS) {
      el.textContent = "";
      el.classList.remove("error");
      return;
    }
    el.textContent = response.text;
    el.classList.toggle("error", response.isError);
  }
}

function formatClock(elapsedSec: number): string {
  const total = Math.max(0, Math.floor(elapsedSec));
  const mm = Math.floor(total / 60).toString().padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
