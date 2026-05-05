import type { World } from "../sim/World";
import type { Aircraft } from "../sim/types";
import { distanceNm } from "../sim/math";
import { findConflicts } from "../sim/conflicts";

export type SelectHandler = (aircraftId: string | null) => void;

export class Strips {
  constructor(
    private container: HTMLElement,
    private onSelect: SelectHandler,
  ) {
    container.addEventListener("click", (e) => this.handleClick(e));
  }

  render(world: World, selectedId: string | null): void {
    const sorted = [...world.aircraft].sort(
      (a, b) =>
        distanceNm(a.position_nm, { x: 0, y: 0 }) -
        distanceNm(b.position_nm, { x: 0, y: 0 }),
    );
    const conflictIds = new Set<string>();
    for (const [a, b] of findConflicts(world.aircraft)) {
      conflictIds.add(a);
      conflictIds.add(b);
    }
    this.container.replaceChildren();
    for (const ac of sorted) {
      this.container.appendChild(this.buildStrip(ac, selectedId, conflictIds));
    }
  }

  private buildStrip(
    ac: Aircraft,
    selectedId: string | null,
    conflictIds: Set<string>,
  ): HTMLElement {
    const el = document.createElement("div");
    el.className = "strip";
    el.dataset.aircraftId = ac.id;
    if (ac.id === selectedId) el.classList.add("selected");
    if (conflictIds.has(ac.id)) el.classList.add("conflict");
    if (ac.state === "cleared_approach") el.classList.add("cleared");

    const altHundreds = Math.round(ac.altitude_ft / 100).toString().padStart(3, "0");
    const speed = Math.round(ac.speed_kts).toString().padStart(3, " ");
    const hdg = Math.round(ac.heading_deg).toString().padStart(3, "0");
    const tag = ac.kind === "arrival" ? "A" : "D";
    const cleared = ac.cleared_runway ? `*${ac.cleared_runway}` : "  ";
    el.textContent = `${tag} ${ac.callsign.padEnd(7)} ${altHundreds} ${speed} ${hdg} ${cleared}`;
    return el;
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const stripEl = target.closest<HTMLElement>(".strip");
    if (!stripEl) return;
    const id = stripEl.dataset.aircraftId;
    if (!id) return;
    this.onSelect(id);
  }
}
