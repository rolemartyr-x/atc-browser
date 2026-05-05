import type { SettingsStore } from "../app/settings";

export interface SettingsModalElements {
  toggle: HTMLButtonElement;
  root: HTMLElement;
  sfx: HTMLInputElement;
  tts: HTMLInputElement;
  volume: HTMLInputElement;
  volumeDisplay: HTMLElement;
  voice: HTMLSelectElement;
  close: HTMLButtonElement;
  store: SettingsStore;
  // Injected so tests can supply a deterministic voice list.
  listVoices: () => SpeechSynthesisVoice[];
}

export class SettingsModal {
  constructor(private el: SettingsModalElements) {
    el.toggle.addEventListener("click", () => this.open());
    el.close.addEventListener("click", () => this.hide());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !el.root.hasAttribute("hidden")) this.hide();
    });

    el.sfx.addEventListener("change", () => {
      el.store.update({ sfx_enabled: el.sfx.checked });
    });
    el.tts.addEventListener("change", () => {
      el.store.update({ tts_enabled: el.tts.checked });
    });
    el.volume.addEventListener("input", () => {
      const pct = Number(el.volume.value);
      el.volumeDisplay.textContent = `${pct}%`;
      el.store.update({ volume: pct / 100 });
    });
    el.voice.addEventListener("change", () => {
      const value = el.voice.value;
      el.store.update({ voice_uri: value === "" ? null : value });
    });
  }

  /**
   * Refresh the voice picker with the supplied voices. Call on construction
   * and again when SpeechSynthesis fires `onvoiceschanged`.
   */
  refreshVoices(): void {
    const voices = this.el.listVoices();
    const current = this.el.store.settings.voice_uri;
    this.el.voice.innerHTML = "";
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "(default)";
    this.el.voice.appendChild(blank);
    for (const v of voices) {
      const opt = document.createElement("option");
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} (${v.lang})`;
      this.el.voice.appendChild(opt);
    }
    this.el.voice.value = current ?? "";
  }

  private open(): void {
    this.refreshFromStore();
    this.refreshVoices();
    this.el.root.removeAttribute("hidden");
  }

  private hide(): void {
    this.el.root.setAttribute("hidden", "");
  }

  private refreshFromStore(): void {
    const s = this.el.store.settings;
    this.el.sfx.checked = s.sfx_enabled;
    this.el.tts.checked = s.tts_enabled;
    const pct = Math.round(s.volume * 100);
    this.el.volume.value = String(pct);
    this.el.volumeDisplay.textContent = `${pct}%`;
  }
}
