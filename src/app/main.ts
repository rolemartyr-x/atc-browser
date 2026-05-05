import { World } from "../sim/World";
import { KDLH } from "../data/airports/kdlh";
import { startLoop } from "./loop";

const root = document.getElementById("app");
if (!root) throw new Error("missing #app element");

const world = new World(KDLH, { now_ms: Date.now() });
world.startTraffic({
  initialIntervalSec: 60,
  minIntervalSec: 30,
  rampDurationSec: 600,
});

world.events.on((e) => {
  console.log("[event]", e);
});

let frameCount = 0;
startLoop({
  hz: 30,
  onTick: (dt) => world.tick(dt),
  onFrame: () => {
    frameCount += 1;
    if (frameCount % 60 === 0) {
      root.textContent = `t=${world.elapsed_sec.toFixed(1)}s  aircraft=${world.aircraft.length}  score=${world.session.score}  status=${world.session.status}`;
    }
  },
});

// Expose for browser-console poking during development.
(window as unknown as { world: World }).world = world;
