// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Tts } from "../../src/audio/Tts";
import { SettingsStore } from "../../src/app/settings";
import { STORAGE_KEY, type StorageAdapter } from "../../src/storage/Storage";

class MemoryAdapter implements StorageAdapter {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  raw() { return this.map.get(STORAGE_KEY) ?? null; }
}

interface MockUtterance {
  text: string;
  voice: SpeechSynthesisVoice | null;
  volume: number;
  rate: number;
  pitch: number;
  onend: (() => void) | null;
}

function setupSynth() {
  const utterances: MockUtterance[] = [];
  const synth = {
    speak: vi.fn((u: MockUtterance) => utterances.push(u)),
    cancel: vi.fn(() => { utterances.length = 0; }),
    getVoices: vi.fn(() => [
      { name: "VoiceA", voiceURI: "uri-a", lang: "en-US" } as unknown as SpeechSynthesisVoice,
      { name: "VoiceB", voiceURI: "uri-b", lang: "en-GB" } as unknown as SpeechSynthesisVoice,
    ]),
  };
  // Replace global
  (globalThis as unknown as { speechSynthesis: unknown }).speechSynthesis = synth;
  // Provide a constructor that records what was created
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
    text: string;
    voice: SpeechSynthesisVoice | null = null;
    volume = 1;
    rate = 1;
    pitch = 1;
    onend: (() => void) | null = null;
    constructor(text: string) { this.text = text; }
  };
  return { synth, utterances };
}

describe("Tts", () => {
  let store: SettingsStore;
  beforeEach(() => {
    store = new SettingsStore(new MemoryAdapter());
  });

  it("speak forwards utterance to speechSynthesis when enabled", () => {
    const { synth, utterances } = setupSynth();
    const tts = new Tts(store);
    tts.speak("hello");
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(utterances[0]!.text).toBe("hello");
  });

  it("speak is a no-op when TTS is disabled", () => {
    store.update({ tts_enabled: false });
    const { synth } = setupSynth();
    const tts = new Tts(store);
    tts.speak("hello");
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("utterance volume mirrors store volume", () => {
    store.update({ volume: 0.4 });
    const { utterances } = setupSynth();
    const tts = new Tts(store);
    tts.speak("hi");
    expect(utterances[0]!.volume).toBeCloseTo(0.4);
  });

  it("utterance picks the configured voice URI", () => {
    store.update({ voice_uri: "uri-b" });
    const { utterances } = setupSynth();
    const tts = new Tts(store);
    tts.speak("hi");
    expect(utterances[0]!.voice?.voiceURI).toBe("uri-b");
  });

  it("toggling TTS off cancels any pending speech", () => {
    const { synth } = setupSynth();
    const tts = new Tts(store);
    tts.speak("hi");
    store.update({ tts_enabled: false });
    expect(synth.cancel).toHaveBeenCalled();
    void tts;
  });

  it("drops new non-critical when queue is at cap of 3", () => {
    const { utterances } = setupSynth();
    const tts = new Tts(store);
    // Mock onend never fires, so all 3 stay pending and 4th/5th get dropped.
    tts.speak("a");
    tts.speak("b");
    tts.speak("c");
    tts.speak("d");
    tts.speak("e");
    expect(utterances.map((u) => u.text)).toEqual(["a", "b", "c"]);
  });

  it("critical utterances always speak even when queue is full", () => {
    const { utterances } = setupSynth();
    const tts = new Tts(store);
    tts.speak("a");
    tts.speak("b");
    tts.speak("c");
    tts.speak("crit", { critical: true });
    expect(utterances.map((u) => u.text)).toContain("crit");
  });

  it("removes ended utterances from the pending queue (frees a slot)", () => {
    const { utterances } = setupSynth();
    const tts = new Tts(store);
    tts.speak("a");
    tts.speak("b");
    tts.speak("c");
    // Simulate the platform finishing utterance "a"
    utterances[0]!.onend?.();
    tts.speak("d");
    expect(utterances.map((u) => u.text)).toEqual(["a", "b", "c", "d"]);
  });
});
