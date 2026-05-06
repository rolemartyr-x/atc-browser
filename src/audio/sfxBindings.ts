import type { World } from "../sim/World";
import type { Sfx } from "./Sfx";

/**
 * Subscribe to world events and play matching SFX. Returns an unsubscribe
 * function. Selection-driven SFX is wired separately at the call site in
 * main.ts because selection lives in AppState, not in world.events.
 */
export function bindSfxToWorld(world: World, sfx: Sfx): () => void {
  return world.events.on((e) => {
    switch (e.kind) {
      case "command_accepted":
        sfx.play("accept");
        return;
      case "command_rejected":
        sfx.play("reject");
        return;
      case "handed_off":
        sfx.play("handoff");
        return;
      case "conflict_raised":
        sfx.play("conflict");
        return;
      case "session_ended":
        sfx.play("lose");
        return;
      default:
        return;
    }
  });
}
