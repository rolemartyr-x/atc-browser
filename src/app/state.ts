import type { HudResponseState } from "../render/Hud";
import type { SettingsStore } from "./settings";

export interface AppState {
  selectedAircraftId: string | null;
  response: HudResponseState | null;
  settings: SettingsStore;
}

export function createAppState(settings: SettingsStore): AppState {
  return {
    selectedAircraftId: null,
    response: null,
    settings,
  };
}
