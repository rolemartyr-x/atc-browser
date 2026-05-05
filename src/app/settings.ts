import {
  loadBlob,
  saveBlob,
  type PersistedBlob,
  type PersistedSettings,
  type StorageAdapter,
  type HighScore,
} from "../storage/Storage";
import { recordHighScore, getHighScores } from "../storage/highScores";

export type SettingsListener = (settings: PersistedSettings) => void;

export class SettingsStore {
  private blob: PersistedBlob;
  private listeners: SettingsListener[] = [];

  constructor(private adapter: StorageAdapter) {
    this.blob = loadBlob(adapter);
  }

  get settings(): PersistedSettings {
    return this.blob.settings;
  }

  update(patch: Partial<PersistedSettings>): void {
    this.blob = {
      ...this.blob,
      settings: { ...this.blob.settings, ...patch },
    };
    saveBlob(this.adapter, this.blob);
    for (const l of this.listeners) l(this.blob.settings);
  }

  onChange(listener: SettingsListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  recordHighScore(icao: string, entry: HighScore): void {
    this.blob = recordHighScore(this.blob, icao, entry);
    saveBlob(this.adapter, this.blob);
  }

  highScores(icao: string): HighScore[] {
    return getHighScores(this.blob, icao);
  }
}
