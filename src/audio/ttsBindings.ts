import type { World } from "../sim/World";
import type { Tts } from "./Tts";
import { formatReadback } from "./readback";

export function bindTtsToWorld(world: World, tts: Tts): () => void {
  return world.events.on((e) => {
    if (e.kind !== "command_accepted") return;
    const ac = world.aircraft.find((a) => a.id === e.aircraft_id);
    if (!ac) return;
    tts.speak(formatReadback(e.command, ac.callsign));
  });
}
