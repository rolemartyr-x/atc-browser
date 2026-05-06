import type { SettingsStore } from "../app/settings";

export type SfxName = "select" | "accept" | "reject" | "conflict" | "handoff" | "lose";

interface SfxToneConfig {
  shape: OscillatorType;
  duration_s: number;
  // A note is a frequency in Hz. Single-note SFX have one entry; chimes have several.
  notes: number[];
  // Fixed gain envelope: peak value reached at `duration_s/8`, fades to ~0 at end.
  peak: number;
  // Pause between notes (used for arpeggios). Single-note tones ignore this.
  gap_s: number;
}

export const SFX_CONFIG: Record<SfxName, SfxToneConfig> = {
  select:   { shape: "square",   duration_s: 0.05, notes: [880],            peak: 0.20, gap_s: 0 },
  accept:   { shape: "sine",     duration_s: 0.10, notes: [1046],           peak: 0.25, gap_s: 0 },
  reject:   { shape: "square",   duration_s: 0.18, notes: [220, 165],       peak: 0.30, gap_s: 0.04 },
  conflict: { shape: "sawtooth", duration_s: 0.40, notes: [740, 740, 740],  peak: 0.45, gap_s: 0.10 },
  handoff:  { shape: "sine",     duration_s: 0.12, notes: [659, 880, 1175], peak: 0.30, gap_s: 0.05 },
  lose:     { shape: "sawtooth", duration_s: 0.35, notes: [440, 330, 220],  peak: 0.40, gap_s: 0.08 },
};

export type AudioContextFactory = () => AudioContext;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  constructor(
    private settings: SettingsStore,
    private factory: AudioContextFactory = () =>
      new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(),
  ) {}

  play(name: SfxName): void {
    if (!this.settings.settings.sfx_enabled) return;
    const cfg = SFX_CONFIG[name];
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;

    // Master volume reflects current setting on every play (cheap; lets the
    // slider feel live without subscribing to settings here).
    this.master.gain.setValueAtTime(this.settings.settings.volume, ctx.currentTime);

    let t = ctx.currentTime;
    for (const freq of cfg.notes) {
      this.scheduleNote(ctx, this.master, cfg.shape, freq, t, cfg.duration_s, cfg.peak);
      t += cfg.duration_s + cfg.gap_s;
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const ctx = this.factory();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.settings.settings.volume;
      this.master.connect(ctx.destination);
      return ctx;
    } catch {
      return null;
    }
  }

  private scheduleNote(
    ctx: AudioContext,
    out: GainNode,
    shape: OscillatorType,
    freq: number,
    startTime: number,
    duration_s: number,
    peak: number,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = shape;
    osc.frequency.setValueAtTime(freq, startTime);

    // ADSR-ish envelope: 8% attack, linear decay to ~0 by the end. Keeps clicks
    // low and gives the tone a natural bell shape.
    const env = ctx.createGain();
    const attack = duration_s * 0.08;
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(peak, startTime + attack);
    env.gain.linearRampToValueAtTime(0.0001, startTime + duration_s);

    osc.connect(env);
    env.connect(out);

    osc.start(startTime);
    osc.stop(startTime + duration_s);
  }
}
