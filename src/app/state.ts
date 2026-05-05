import type { HudResponseState } from "../render/Hud";

export interface AppState {
  selectedAircraftId: string | null;
  response: HudResponseState | null;
}

export function createAppState(): AppState {
  return {
    selectedAircraftId: null,
    response: null,
  };
}
