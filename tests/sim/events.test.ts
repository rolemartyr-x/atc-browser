import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../../src/sim/events";

describe("EventBus", () => {
  it("delivers emitted events to subscribers", () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.on((e) => seen.push(e.kind));
    bus.emit({ kind: "aircraft_spawned", aircraft_id: "X" });
    bus.emit({ kind: "session_ended", reason: "test" });
    expect(seen).toEqual(["aircraft_spawned", "session_ended"]);
  });

  it("supports unsubscribe via returned function", () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const off = bus.on(fn);
    bus.emit({ kind: "aircraft_spawned", aircraft_id: "X" });
    off();
    bus.emit({ kind: "aircraft_spawned", aircraft_id: "Y" });
    expect(fn).toHaveBeenCalledOnce();
  });

  it("delivers to multiple listeners in registration order", () => {
    const bus = new EventBus();
    const order: number[] = [];
    bus.on(() => order.push(1));
    bus.on(() => order.push(2));
    bus.emit({ kind: "aircraft_spawned", aircraft_id: "X" });
    expect(order).toEqual([1, 2]);
  });
});
