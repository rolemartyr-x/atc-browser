import type { CommandLineController, HotkeyVerb } from "./keyboard";
import type { Projection } from "../render/projection";
import type { World } from "../sim/World";
import type { Aircraft } from "../sim/types";

const VERBS: HotkeyVerb[] = ["H", "A", "S", "L", "X"];

export interface ClickMenuOptions {
  menuEl: HTMLElement;
  controller: CommandLineController;
  projection: Projection;
  world: () => World;
}

export class ClickMenu {
  constructor(private opts: ClickMenuOptions) {
    opts.menuEl.replaceChildren();
    for (const verb of VERBS) {
      const btn = document.createElement("button");
      btn.className = "click-menu-item";
      btn.textContent = verb;
      btn.dataset.verb = verb;
      btn.addEventListener("click", () => this.handleVerb(verb));
      opts.menuEl.appendChild(btn);
    }
    document.addEventListener("click", (e) => this.maybeDismiss(e));
  }

  showFor(aircraftId: string): void {
    const ac = this.opts.world().aircraft.find((a) => a.id === aircraftId);
    if (!ac) {
      this.hide();
      return;
    }
    const screen = this.opts.projection.toScreen(ac.position_nm);
    const el = this.opts.menuEl;
    el.hidden = false;
    el.style.left = `${screen.x + 12}px`;
    el.style.top = `${screen.y + 12}px`;
    el.dataset.aircraftId = aircraftId;
    el.dataset.callsign = ac.callsign;
  }

  hide(): void {
    this.opts.menuEl.hidden = true;
    delete this.opts.menuEl.dataset.aircraftId;
    delete this.opts.menuEl.dataset.callsign;
  }

  private handleVerb(verb: HotkeyVerb): void {
    const callsign = this.opts.menuEl.dataset.callsign;
    if (!callsign) return;
    this.opts.controller.prefill(`${callsign} ${verb} `);
    this.hide();
  }

  private maybeDismiss(e: MouseEvent): void {
    const el = this.opts.menuEl;
    if (el.hidden) return;
    const target = e.target as Node | null;
    if (target && el.contains(target)) return;   // click inside the menu
    // Click was outside; the controller decides whether to re-show on a new selection.
    this.hide();
  }

  // Helper for callers (Task 16): resolve a selected aircraft id back to its current Aircraft,
  // bypassing world lookups elsewhere.
  static findAircraft(world: World, id: string | null): Aircraft | null {
    if (!id) return null;
    return world.aircraft.find((a) => a.id === id) ?? null;
  }
}
