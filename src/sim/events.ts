import type { GameEvent } from "./types";

export type EventListener = (event: GameEvent) => void;

export class EventBus {
  private listeners: EventListener[] = [];

  on(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit(event: GameEvent): void {
    for (const l of this.listeners) l(event);
  }
}
