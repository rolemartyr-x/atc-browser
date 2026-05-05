// Fixed-step simulation loop driver.
// Advances a tick callback at a stable simulation rate (default 30 Hz)
// regardless of render framerate. Returns a stop() function.
export interface LoopOptions {
  hz?: number;
  onTick: (dt: number) => void;
  onFrame?: () => void;
}

export function startLoop(opts: LoopOptions): () => void {
  const hz = opts.hz ?? 30;
  const dt = 1 / hz;
  let lastMs = performance.now();
  let acc = 0;
  let stopped = false;
  let raf = 0;

  const frame = (now: number) => {
    if (stopped) return;
    const elapsedMs = now - lastMs;
    lastMs = now;
    acc += elapsedMs / 1000;
    // Cap to avoid spiral-of-death after a tab suspend
    if (acc > 1) acc = 1;
    while (acc >= dt) {
      opts.onTick(dt);
      acc -= dt;
    }
    opts.onFrame?.();
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
