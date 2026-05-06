import type { SettingsStore } from "../app/settings";

export interface TtsSpeakOptions {
  /** Critical speech (e.g. conflict alerts) is never dropped from the queue. */
  critical?: boolean;
}

interface PendingUtterance {
  utterance: SpeechSynthesisUtterance;
  critical: boolean;
}

const MAX_QUEUE_DEPTH = 3;
const DEFAULT_RATE = 1.1;
const DEFAULT_PITCH = 1.0;

export class Tts {
  // Tracks utterances we've handed to speechSynthesis that haven't ended yet.
  // Used only for our own drop-on-overflow gate; the platform owns playback.
  private pending: PendingUtterance[] = [];

  constructor(private settings: SettingsStore) {
    settings.onChange((s) => {
      if (!s.tts_enabled) this.cancel();
    });
  }

  speak(text: string, opts: TtsSpeakOptions = {}): void {
    if (!this.settings.settings.tts_enabled) return;
    if (typeof speechSynthesis === "undefined") return;
    if (typeof SpeechSynthesisUtterance === "undefined") return;

    const critical = !!opts.critical;
    if (this.pending.length >= MAX_QUEUE_DEPTH && !critical) return;

    const u = new SpeechSynthesisUtterance(text);
    u.volume = this.settings.settings.volume;
    u.rate = DEFAULT_RATE;
    u.pitch = DEFAULT_PITCH;
    const voice = this.findVoice();
    if (voice) u.voice = voice;

    const item: PendingUtterance = { utterance: u, critical };
    this.pending.push(item);
    u.onend = () => {
      this.pending = this.pending.filter((p) => p !== item);
    };

    speechSynthesis.speak(u);
  }

  cancel(): void {
    this.pending = [];
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }

  private findVoice(): SpeechSynthesisVoice | null {
    const voiceUri = this.settings.settings.voice_uri;
    const voices = speechSynthesis.getVoices();
    if (voiceUri) {
      const v = voices.find((x) => x.voiceURI === voiceUri);
      if (v) return v;
    }
    // Default: first English voice.
    return voices.find((x) => x.lang.startsWith("en")) ?? null;
  }
}
