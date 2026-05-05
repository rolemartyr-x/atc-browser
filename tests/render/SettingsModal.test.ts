// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { SettingsModal } from "../../src/render/SettingsModal";
import { SettingsStore } from "../../src/app/settings";
import { STORAGE_KEY, type StorageAdapter } from "../../src/storage/Storage";

class MemoryAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  raw() { return this.map.get(STORAGE_KEY) ?? null; }
}

function setup() {
  document.body.innerHTML = `
    <button id="settings-toggle"></button>
    <div id="settings-modal" hidden>
      <div class="modal-card">
        <input id="setting-sfx" type="checkbox" />
        <input id="setting-tts" type="checkbox" />
        <input id="setting-volume" type="range" min="0" max="100" />
        <span id="setting-volume-display"></span>
        <select id="setting-voice"></select>
        <button id="settings-close"></button>
      </div>
    </div>
  `;
  const store = new SettingsStore(new MemoryAdapter());
  const modal = new SettingsModal({
    toggle: document.getElementById("settings-toggle") as HTMLButtonElement,
    root: document.getElementById("settings-modal") as HTMLElement,
    sfx: document.getElementById("setting-sfx") as HTMLInputElement,
    tts: document.getElementById("setting-tts") as HTMLInputElement,
    volume: document.getElementById("setting-volume") as HTMLInputElement,
    volumeDisplay: document.getElementById("setting-volume-display") as HTMLElement,
    voice: document.getElementById("setting-voice") as HTMLSelectElement,
    close: document.getElementById("settings-close") as HTMLButtonElement,
    store,
    listVoices: () => [],
  });
  return { modal, store };
}

describe("SettingsModal", () => {
  it("opens when the toggle is clicked and reflects current settings", () => {
    const { modal, store } = setup();
    store.update({ volume: 0.5, sfx_enabled: false });
    document.getElementById("settings-toggle")!.dispatchEvent(new MouseEvent("click"));
    expect(document.getElementById("settings-modal")!.hasAttribute("hidden")).toBe(false);
    expect((document.getElementById("setting-sfx") as HTMLInputElement).checked).toBe(false);
    expect((document.getElementById("setting-volume") as HTMLInputElement).value).toBe("50");
    expect(document.getElementById("setting-volume-display")!.textContent).toBe("50%");
    void modal;
  });

  it("toggling SFX persists immediately", () => {
    const { store } = setup();
    document.getElementById("settings-toggle")!.dispatchEvent(new MouseEvent("click"));
    const sfx = document.getElementById("setting-sfx") as HTMLInputElement;
    sfx.checked = false;
    sfx.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.settings.sfx_enabled).toBe(false);
  });

  it("volume slider updates store and display in real-time", () => {
    const { store } = setup();
    document.getElementById("settings-toggle")!.dispatchEvent(new MouseEvent("click"));
    const slider = document.getElementById("setting-volume") as HTMLInputElement;
    slider.value = "30";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    expect(store.settings.volume).toBe(0.3);
    expect(document.getElementById("setting-volume-display")!.textContent).toBe("30%");
  });

  it("Close button hides the modal", () => {
    setup();
    document.getElementById("settings-toggle")!.dispatchEvent(new MouseEvent("click"));
    document.getElementById("settings-close")!.dispatchEvent(new MouseEvent("click"));
    expect(document.getElementById("settings-modal")!.hasAttribute("hidden")).toBe(true);
  });

  it("Escape key hides the modal when open", () => {
    setup();
    document.getElementById("settings-toggle")!.dispatchEvent(new MouseEvent("click"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.getElementById("settings-modal")!.hasAttribute("hidden")).toBe(true);
  });
});
