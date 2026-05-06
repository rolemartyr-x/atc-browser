# atc-browser MVP — Plan 3: Audio, Persistence, and Deployment

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v0.1 MVP. Plan 1 built the headless sim, Plan 2 made it playable in a browser. Plan 3 adds the three remaining MVP slices: SFX + TTS audio with toggles, `localStorage`-backed settings + high scores, and an automated GitHub Pages deploy. By the end of this plan a player can open the deployed URL, hear a conflict alarm and a TTS readback, see a high-score table on game over, and have their settings persist across reloads.

**Architecture:** Three new adapter slices wrap the existing simulation core.
1. `src/storage/` — versioned localStorage blob via a `StorageAdapter` seam, with pure migration and high-score helpers (Vitest-only, no DOM).
2. `src/audio/` — `Sfx` (Web Audio synthesis) and `Tts` (`SpeechSynthesisUtterance` queue) classes, each subscribing to `world.events`. Audio adapters are mocked in tests; real audio is validated by play.
3. Game-over overlay + settings modal — DOM components driven by the existing `World` snapshot and a new `SettingsStore`. CI builds the project and `actions/deploy-pages` ships the `dist/` output to GitHub Pages on every `main` push.

**Procedural SFX deviation from spec:** Spec § 8.1 lists `.ogg/.wav` assets. We synthesize the six MVP sounds at runtime via Web Audio so the build has zero binary dependencies and no licensing/sourcing step. The `Sfx` interface stays swappable; replacing synthesis with `<audio>`-loaded assets is a one-class change post-MVP.

**Tech Stack:** TypeScript strict (existing), Web Audio API, Web Speech API (`speechSynthesis`), localStorage, GitHub Actions + `actions/deploy-pages`. No new runtime dependencies. Tests use Vitest with per-file `// @vitest-environment jsdom` directives where DOM APIs are needed.

**Spec reference:** `docs/superpowers/specs/2026-05-04-atc-browser-design.md` — § 8 Audio, § 9 Persistence, § 12 Deployment.

**Plans 1 & 2 already on `main`:** headless sim core (`src/sim/`), KDLH airspace (`src/data/airports/kdlh.ts`), render layer (`src/render/`), input layer (`src/input/`), bootstrap (`src/app/main.ts`, `src/app/loop.ts`, `src/app/state.ts`), CI (`.github/workflows/ci.yml`).

---

## File Structure

Files this plan creates or modifies:

```
src/storage/
  Storage.ts                # StorageAdapter, PersistedBlob, load/save, migrate
  highScores.ts             # recordHighScore, topN, comparator (pure)

src/app/
  settings.ts               # SettingsStore: load on boot, persist on update, change events
  state.ts                  # MODIFIED — add `settings: SettingsStore` reference
  main.ts                   # MODIFIED — wire Storage + Settings + Sfx + Tts + Overlays

src/audio/
  Sfx.ts                    # Web Audio synth, plays the six SFX names
  sfxBindings.ts            # Bridge: world.events → Sfx.play
  callsigns.ts              # icaoToSpoken("DAL891") → "Delta eight ninety one"
  readback.ts               # formatReadback(command, callsign) → string
  Tts.ts                    # SpeechSynthesis queue wrapper, voice selection
  ttsBindings.ts            # Bridge: world.events → Tts.speak

src/render/
  SettingsModal.ts          # Cog button + modal dialog: SFX/TTS/volume/voice
  GameOverScreen.ts         # Overlay: final score, high-score table, Play Again

src/styles.css              # MODIFIED — modal, overlay, cog button styles
index.html                  # MODIFIED — settings cog, modal shell, game-over overlay shell

.github/workflows/
  deploy.yml                # GitHub Pages deploy on push to main

README.md                   # MODIFIED — deployed URL placeholder + dev quickstart

tests/storage/
  Storage.test.ts
  highScores.test.ts

tests/app/
  settings.test.ts          # node env (no DOM)

tests/audio/
  callsigns.test.ts
  readback.test.ts
  Sfx.test.ts               # uses jsdom + AudioContext mock
  Tts.test.ts               # uses jsdom + speechSynthesis mock

tests/render/
  SettingsModal.test.ts     # uses jsdom
  GameOverScreen.test.ts    # uses jsdom
```

**Test environment note:** the existing `vitest.config.ts` uses `environment: "node"`. Per-file overrides via the `// @vitest-environment jsdom` pragma at the top of any test that touches `document` / `window`. No global config change.

## Branch / PR Strategy

| Branch | Tasks | Outcome |
|---|---|---|
| `feat/storage` | T1 → T3 | localStorage blob load/save + high-score helpers, fully unit-tested |
| `feat/settings` | T4 → T7 | SettingsStore + cog button + modal with SFX/TTS/volume/voice toggles |
| `feat/audio-sfx` | T8 → T10 | Six SFX names play via Web Audio; selections, accepts, rejects, conflicts, handoffs, game-over all wired |
| `feat/audio-tts` | T11 → T14 | Callsign translation + readback formatter + queued TTS, voice picker live |
| `feat/game-over` | T15 → T17 | Game-over overlay shows final score + top-10 high scores; Play Again restarts the session |
| `feat/deployment` | T18 → T19 | `deploy.yml` ships the build to GitHub Pages; README points at the deployed URL |

Per the user's CLAUDE.md, git operations on personal repos are autonomous: commit at logical milestones, open one PR per branch, merge when green.

## Implementation conventions (apply to ALL tasks below)

Repo-wide conventions established in Plans 1 and 2 — every subagent must follow:

- **Imports:** drop `.ts` extensions on relative imports (`tsconfig` has `allowImportingTsExtensions: false`).
- **Strict TS:** every file passes `tsc --noEmit` cleanly. No `any` without a one-line `// eslint-disable` justification.
- **Tests:** TDD where a unit is testable. Pure logic (storage migrate, high-score sort, callsign translation, readback formatter) gets full unit tests. Audio classes are mocked at the Web Audio / SpeechSynthesis boundary; the real thing is validated by play.
- **Per-file jsdom:** files touching `document`/`window`/`speechSynthesis`/`AudioContext` get `// @vitest-environment jsdom` as line 1.
- **No `git add .`** — stage specific files per commit.
- **Commit messages:** imperative, present tense.
- **Exact code:** use the code blocks below verbatim. If you find a real bug in the plan, fix it and report the deviation.

---

## Task 1: Storage types, defaults, and adapter seam

**Files:**
- Create: `src/storage/Storage.ts`

**Branch:** `feat/storage`

Pure module: types + defaults + a `StorageAdapter` interface so we can unit-test without `localStorage` and inject a real `localStorage`-backed adapter at runtime.

Required exports:
- `STORAGE_KEY = "atc-browser:v1"`, `STORAGE_VERSION = 1`
- Types: `PersistedSettings { sfx_enabled, tts_enabled, volume, voice_uri }`, `HighScore { score, duration_sec, ended_at }`, `PersistedBlob { v, settings, high_scores: Record<string, HighScore[]> }`
- `DEFAULT_SETTINGS = { sfx_enabled: true, tts_enabled: true, volume: 0.8, voice_uri: null }`
- `defaultBlob()` returns a fresh blob with current version + defaulted settings + empty high_scores
- `StorageAdapter` interface: `getItem(key): string | null`, `setItem(key, value): void`
- `LocalStorageAdapter implements StorageAdapter` — try/catch around both methods, silent failure on quota or disabled storage
- `migrate(raw: unknown): PersistedBlob` — non-object → defaults; unknown `v` → defaults; `v === STORAGE_VERSION` → merge with defaults; volume validated [0,1]; high-score arrays filter out malformed entries
- `loadBlob(adapter)` — reads, parses JSON, runs `migrate`; falls back to defaults on missing/malformed JSON
- `saveBlob(adapter, blob)` — JSON-stringify and `setItem`

Internal helpers: `mergeWithDefaults`, `sanitizeSettings`, `isHighScore`, `isObject` (file-private).

**Implementation note:** TypeScript strict mode rejects unnecessary `as HighScore` casts inside `isHighScore` after `isObject(x)` narrows to `Record<string, unknown>`. Drop the casts — `typeof x.score === "number"` works directly.

Tests come in Task 2.

Commit: `Add versioned localStorage blob types and adapter seam`

---

## Task 2: Storage round-trip + migration tests

**Files:**
- Create: `tests/storage/Storage.test.ts`

**Branch:** `feat/storage`

Pure-logic tests, no jsdom needed. Define an inline `MemoryAdapter implements StorageAdapter` class. 8 tests:

1. `loadBlob` returns defaults when storage is empty
2. save then load round-trips a full blob
3. `loadBlob` falls back to defaults on malformed JSON
4. `migrate` returns defaults for non-objects (null, number, string, array)
5. `migrate` discards unknown future versions
6. `migrate` fills missing settings keys with defaults
7. `migrate` rejects out-of-range volume
8. `migrate` filters malformed high-score entries

Imports come from `../../src/storage/Storage` (no `.ts` extension).

Commit: `Test localStorage blob round-trip and migration`

---

## Task 3: High-score helpers

**Files:**
- Create: `src/storage/highScores.ts`
- Create: `tests/storage/highScores.test.ts`

**Branch:** `feat/storage` (final task — push and open PR after this commit)

```ts
import type { HighScore, PersistedBlob } from "./Storage";

export const MAX_HIGH_SCORES = 10;

export function recordHighScore(
  blob: PersistedBlob,
  icao: string,
  entry: HighScore,
): PersistedBlob {
  const key = icao.toLowerCase();
  const existing = blob.high_scores[key] ?? [];
  const merged = [...existing, entry].sort(compareScores).slice(0, MAX_HIGH_SCORES);
  return {
    ...blob,
    high_scores: { ...blob.high_scores, [key]: merged },
  };
}

export function getHighScores(blob: PersistedBlob, icao: string): HighScore[] {
  return blob.high_scores[icao.toLowerCase()] ?? [];
}

function compareScores(a: HighScore, b: HighScore): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.duration_sec - b.duration_sec;
}
```

Tests (6): MAX_HIGH_SCORES is 10 / insert into empty + immutability / sort by score desc with duration tiebreak / trim to 10 / unknown airport returns [] / case-insensitive lookup.

Push branch + open PR titled "Add versioned localStorage blob and high-score helpers".

Commit: `Add high-score record/top-10 helpers`

---

## Task 4: SettingsStore class

**Files:**
- Create: `src/app/settings.ts`
- Create: `tests/app/settings.test.ts`

**Branch:** `feat/settings`

```ts
import {
  loadBlob, saveBlob,
  type PersistedBlob, type PersistedSettings, type StorageAdapter, type HighScore,
} from "../storage/Storage";
import { recordHighScore, getHighScores } from "../storage/highScores";

export type SettingsListener = (settings: PersistedSettings) => void;

export class SettingsStore {
  private blob: PersistedBlob;
  private listeners: SettingsListener[] = [];

  constructor(private adapter: StorageAdapter) {
    this.blob = loadBlob(adapter);
  }

  get settings(): PersistedSettings { return this.blob.settings; }

  update(patch: Partial<PersistedSettings>): void {
    this.blob = { ...this.blob, settings: { ...this.blob.settings, ...patch } };
    saveBlob(this.adapter, this.blob);
    for (const l of this.listeners) l(this.blob.settings);
  }

  onChange(listener: SettingsListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }

  recordHighScore(icao: string, entry: HighScore): void {
    this.blob = recordHighScore(this.blob, icao, entry);
    saveBlob(this.adapter, this.blob);
  }

  highScores(icao: string): HighScore[] {
    return getHighScores(this.blob, icao);
  }
}
```

Tests (5): loads defaults / update merges + persists / onChange notifies / recordHighScore persists + reads back / onChange returns working unsubscribe.

Commit: `Add SettingsStore for runtime + persisted settings`

---

## Task 5: Settings modal HTML and styles

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`

**Branch:** `feat/settings`

In `<header id="hud-top">`, after the STATUS span add a cog button:

```html
<button id="settings-toggle" type="button" aria-label="Settings" title="Settings">⚙</button>
```

After the existing `<div id="click-menu" hidden></div>` (still inside `<div id="app">`), add the modal shell with:
- Container `<div id="settings-modal" hidden role="dialog" aria-labelledby="settings-title">`
- `<h2 id="settings-title">Settings</h2>`
- Three `<label class="setting-row">` rows for `setting-sfx` checkbox, `setting-tts` checkbox, `setting-volume` range (0–100) with `setting-volume-display` span
- One row with `setting-voice` `<select>`
- `<div class="modal-actions">` with `<button id="settings-close">Close</button>`

CSS appended to `src/styles.css`:
- `#settings-toggle` — transparent button, scope-dim border, scope color, hover -> scope-bright
- `#settings-modal, #game-over` — fixed inset 0, dark backdrop, flex centered, `[hidden]` overrides display
- `.modal-card` — black bg, scope border, padded card with subtle box-shadow
- `.modal-card h2` — scope-bright, letter-spacing
- `.setting-row` — flex row, gap 12px, padding 6px 0, cursor pointer
- range/checkbox `accent-color: var(--scope)`
- `.setting-row select` — dark with scope colors
- `.volume-display` — right-aligned, scope-bright, min-width
- `.modal-actions` — right-aligned, top margin 16px
- `.modal-actions button` — scope border, scope-bright text, hover with subtle bg

Commit: `Add settings cog button and modal shell`

---

## Task 6: SettingsModal controller

**Files:**
- Create: `src/render/SettingsModal.ts`
- Create: `tests/render/SettingsModal.test.ts`

**Branch:** `feat/settings`

`SettingsModalElements` interface with: toggle, root, sfx, tts, volume, volumeDisplay, voice, close, store, listVoices.

`SettingsModal` class:
- Constructor wires: toggle click → open(), close click → hide(), document keydown Escape → hide() if visible, sfx/tts change → store.update, volume input → display + store.update (pct/100), voice change → store.update with null when value is empty
- `refreshVoices()` (public): clears select, prepends blank `(default)` option, appends each voice as `<option value=voiceURI>name (lang)</option>`, sets value to current `voice_uri ?? ""`
- `open()` (private): refreshFromStore + refreshVoices + removeAttribute hidden
- `hide()` (private): setAttribute hidden
- `refreshFromStore()` (private): syncs all input values from current settings; volume input value is `Math.round(s.volume * 100)`, display is `${pct}%`

Tests use jsdom (`// @vitest-environment jsdom` line 1). 5 tests:
1. opens on toggle click and reflects current settings (volume 0.5 → "50", "50%", sfx unchecked when disabled)
2. toggling SFX checkbox persists immediately to store
3. volume slider updates store (pct/100) and display in real-time on `input` event
4. Close button hides modal
5. Escape key hides modal when open

Commit: `Add SettingsModal controller wired to SettingsStore`

---

## Task 7: Wire SettingsStore + Modal into bootstrap

**Files:**
- Modify: `src/app/state.ts`
- Modify: `src/app/main.ts`

**Branch:** `feat/settings` (final — push + PR)

Update `src/app/state.ts`:

```ts
import type { HudResponseState } from "../render/Hud";
import type { SettingsStore } from "./settings";

export interface AppState {
  selectedAircraftId: string | null;
  response: HudResponseState | null;
  settings: SettingsStore;
}

export function createAppState(settings: SettingsStore): AppState {
  return { selectedAircraftId: null, response: null, settings };
}
```

In `src/app/main.ts`:
- Add imports: `LocalStorageAdapter`, `SettingsStore`, `SettingsModal`
- Replace `const appState = createAppState();` with `const settingsStore = new SettingsStore(new LocalStorageAdapter()); const appState = createAppState(settingsStore);`
- After `MouseInput` construction (before `window.addEventListener("resize", ...)`), construct `SettingsModal` against the existing DOM IDs and wire `speechSynthesis voiceschanged` to `settingsModal.refreshVoices()` (guarded by `typeof speechSynthesis !== "undefined"`)
- Expand the window-debug exposure to include `settingsStore` and `settingsModal`

**Note on the `createAppState` signature change:** there is also a callsite in `tests/input/commandPipeline.test.ts` that calls `createAppState()` with no args. Update it to construct a SettingsStore with the inline `MemoryAdapter` pattern. This third file is required for typecheck to pass.

Push branch + open PR titled "Add SettingsStore and settings modal".

Commit: `Wire SettingsStore and SettingsModal into bootstrap`

---

## Task 8: Sfx synthesizer class

**Files:**
- Create: `src/audio/Sfx.ts`
- Create: `tests/audio/Sfx.test.ts`

**Branch:** `feat/audio-sfx`

`SfxName = "select" | "accept" | "reject" | "conflict" | "handoff" | "lose"`.

```ts
const SFX_CONFIG: Record<SfxName, SfxToneConfig> = {
  select:   { shape: "square",   duration_s: 0.05, notes: [880],            peak: 0.20, gap_s: 0 },
  accept:   { shape: "sine",     duration_s: 0.10, notes: [1046],           peak: 0.25, gap_s: 0 },
  reject:   { shape: "square",   duration_s: 0.18, notes: [220, 165],       peak: 0.30, gap_s: 0.04 },
  conflict: { shape: "sawtooth", duration_s: 0.40, notes: [740, 740, 740],  peak: 0.45, gap_s: 0.10 },
  handoff:  { shape: "sine",     duration_s: 0.12, notes: [659, 880, 1175], peak: 0.30, gap_s: 0.05 },
  lose:     { shape: "sawtooth", duration_s: 0.35, notes: [440, 330, 220],  peak: 0.40, gap_s: 0.08 },
};
```

`Sfx` class:
- Constructor takes `SettingsStore` + optional `AudioContextFactory` (defaults to `new (window.AudioContext ?? webkitAudioContext)()`)
- `play(name)`: no-op when `sfx_enabled` is false; lazy-init context via `ensureContext`; set master gain to current volume; schedule each note in cfg with `scheduleNote`
- `ensureContext()` — returns cached ctx; otherwise creates ctx + master GainNode connected to destination; try/catch returns null on failure
- `scheduleNote(ctx, out, shape, freq, startTime, duration_s, peak)` — creates oscillator + envelope gain with 8% attack / linear decay to 0.0001 by end; oscillator.start/stop bracketing the duration

Tests (jsdom env) use a mock AudioContext with `createGain` that returns a special `masterGain` on first call (so volume tests can inspect it). 6 tests:
1. SFX_CONFIG covers all six MVP names
2. play creates an oscillator when SFX is enabled
3. play is a no-op when SFX disabled
4. master gain follows store volume on each play (`setValueAtTime(0.4, ...)`)
5. multi-note SFX (handoff) creates 3 oscillators
6. createContext factory is called only once across multiple plays

Commit: `Add Web Audio SFX synthesizer with six MVP sounds`

---

## Task 9: Bind SFX to world events + selection

**Files:**
- Create: `src/audio/sfxBindings.ts`
- Modify: `src/app/main.ts`

**Branch:** `feat/audio-sfx`

```ts
import type { World } from "../sim/World";
import type { Sfx } from "./Sfx";

export function bindSfxToWorld(world: World, sfx: Sfx): () => void {
  return world.events.on((e) => {
    switch (e.kind) {
      case "command_accepted": sfx.play("accept"); return;
      case "command_rejected": sfx.play("reject"); return;
      case "handed_off":       sfx.play("handoff"); return;
      case "conflict_raised":  sfx.play("conflict"); return;
      case "session_ended":    sfx.play("lose"); return;
      default: return;
    }
  });
}
```

In `main.ts`:
- Import `Sfx` and `bindSfxToWorld`
- After `appState` construction (before Strips/MouseInput): `const sfx = new Sfx(settingsStore); bindSfxToWorld(world, sfx);`
- In Strips constructor callback and MouseInput onSelect: when `id !== appState.selectedAircraftId && id !== null`, play `"select"` *before* assigning the new id

Note: `conflict_raised` immediately ends the session in MVP, so the "looping alarm" from spec § 8.1 reduces to a single one-shot. The session_ended event fires lose right after.

Commit: `Wire SFX to world events and selection`

---

## Task 10: Live-mute SFX on settings change

**Files:**
- Modify: `src/audio/Sfx.ts`

**Branch:** `feat/audio-sfx` (final — push + PR)

Add a `settings.onChange(...)` subscription in the `Sfx` constructor. When toggled, set master gain via `setValueAtTime` to either current volume or 0:

```ts
constructor(
  private settings: SettingsStore,
  private factory: AudioContextFactory = () =>
    new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(),
) {
  settings.onChange((s) => {
    if (this.master && this.ctx) {
      const target = s.sfx_enabled ? s.volume : 0;
      this.master.gain.setValueAtTime(target, this.ctx.currentTime);
    }
  });
}
```

Push branch + open PR titled "Add SFX layer with Web Audio synth and event bindings".

Commit: `Live-mute SFX master gain when settings toggle changes`

---

## Task 11: Callsign-to-spoken converter

**Files:**
- Create: `src/audio/callsigns.ts`
- Create: `tests/audio/callsigns.test.ts`

**Branch:** `feat/audio-tts`

Map ICAO airline codes (3 letters) to telephony names. MVP carriers:
`AAL: American, DAL: Delta, UAL: United, SWA: Southwest, JBU: JetBlue, FFT: Frontier, SKW: Skywest, ENY: Envoy, GJS: Gojet, AAY: Allegiant`. Unknown carriers fall back to NATO letter-by-letter.

`icaoToSpoken(callsign)` rules:
- Trim + uppercase
- Match `/^([A-Z]*)(\d*)$/` (allow letters-only, digits-only, or both)
- Letters: known carrier → telephony name; unknown → NATO letter spelled (`A` → `Alpha`)
- Digits: ATC convention by length
  - 1 digit → ones table
  - 2 digits → speakTwo (`42` → "forty two", `15` → "fifteen")
  - 3 digits → leading digit + speakTwo on last 2 (`891` → "eight ninety one")
  - 4 digits → speakTwo + speakTwo (`1234` → "twelve thirty four")
  - 5+ digits → digit-by-digit
- All-digits input (no carrier letters): force digit-by-digit ("123" → "one two three", not "one twenty three"). This is a deliberate divergence from the carrier-aware grouping.

Helpers: `speakLetters`, `speakFlightNumber`, `speakTwo`, plus const tables `ONES`, `TEENS`, `TENS`, `AIRLINE_TELEPHONY`, `NATO`.

Tests (9): DAL891 / UAL237 / SWA42 / AAL14 / 4-digit pair grouping / single digit / digit-by-digit for `"123"` / unknown carrier `"ZZZ12"` letter-by-letter / whitespace + case tolerance.

Commit: `Add ICAO callsign to spoken-form translator`

---

## Task 12: Readback formatter

**Files:**
- Create: `src/audio/readback.ts`
- Create: `tests/audio/readback.test.ts`

**Branch:** `feat/audio-tts`

```ts
import type { Command } from "../sim/types";
import { icaoToSpoken } from "./callsigns";

export function formatReadback(cmd: Command, callsign: string): string {
  const cs = icaoToSpoken(callsign);
  return `${cs}, ${bodyForCommand(cmd)}, ${cs}`;
}

function bodyForCommand(cmd: Command): string {
  switch (cmd.kind) {
    case "assign_heading":  return `fly heading ${headingDigits(cmd.heading_deg)}`;
    case "assign_altitude": return `descend and maintain ${altitudeWords(cmd.altitude_ft)}`;
    case "assign_speed":    return `reduce speed to ${digitsByDigit(cmd.speed_kts)} knots`;
    case "clear_approach":  return `cleared ILS ${digitsByDigit(cmd.runway)} approach`;
    case "handoff":         return `contact ${cmd.to === "auto" ? "tower" : cmd.to}`;
  }
}
```

Helpers:
- `headingDigits(deg)` — pad to 3 digits, speak each digit ("240" → "two four zero", "90" → "zero nine zero")
- `digitsByDigit(input)` — speak each character; numeric chars use ones table, non-numeric pass through
- `altitudeWords(ft)` — "thousands and hundreds" form: 8000 → "eight thousand", 8500 → "eight thousand five hundred"; fallback "zero" if both parts are 0

Tests (8): heading 240 / heading 90 (zero pad) / altitude 8000 / altitude 8500 / speed 210 / clear ILS 27 / handoff tower / handoff center.

Commit: `Add command readback formatter for TTS`

---

## Task 13: Tts queue wrapper

**Files:**
- Create: `src/audio/Tts.ts`
- Create: `tests/audio/Tts.test.ts`

**Branch:** `feat/audio-tts`

A thin wrapper around `speechSynthesis`:
- Disabled when `tts_enabled` is false (and cancels any in-flight speech on toggle off).
- Volume mirrors the master volume.
- Voice URI is honored when one is selected.
- Per spec § 8.2 (queue management): we cap our internal pending queue at 3. Once at cap, **incoming non-critical speech is dropped** and **critical speech always speaks**. This is the "drop newest non-critical" simplification of the spec's "drop oldest" — spec intent (bounded queue, critical preserved) is honored, and we avoid the cancel-and-replay complexity that the platform `speechSynthesis` API would require to truly drop oldest. Item is removed from our pending queue in `onend`.

```ts
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
    u.onend = () => { this.pending = this.pending.filter((p) => p !== item); };

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
    return voices.find((x) => x.lang.startsWith("en")) ?? null;
  }
}
```

Tests (jsdom env, mock `speechSynthesis` and `SpeechSynthesisUtterance`). 8 tests:
1. speak forwards utterance to speechSynthesis when enabled
2. speak is a no-op when TTS disabled
3. utterance volume mirrors store volume
4. utterance picks the configured voice URI
5. toggling TTS off cancels any pending speech (`synth.cancel` called)
6. drops new non-critical when queue is at cap of 3 (5 speaks → only first 3 reach platform)
7. critical utterances always speak even when queue is full
8. removes ended utterances from pending (onend frees a slot)

Commit: `Add TTS queue wrapper with cap and live disable`

---

## Task 14: Bind TTS to command_accepted

**Files:**
- Create: `src/audio/ttsBindings.ts`
- Modify: `src/app/main.ts`

**Branch:** `feat/audio-tts` (final — push + PR)

```ts
import type { World } from "../sim/World";
import type { Tts } from "./Tts";
import { formatReadback } from "./readback";

export function bindTtsToWorld(world: World, tts: Tts): () => void {
  return world.events.on((e) => {
    if (e.kind !== "command_accepted") return;
    const ac = world.aircraft.find((a) => a.id === e.aircraft_id);
    if (!ac) return;
    tts.speak(formatReadback(e.command, ac.callsign));
  });
}
```

In `main.ts`, after `bindSfxToWorld(world, sfx);` add `const tts = new Tts(settingsStore); bindTtsToWorld(world, tts);` plus matching imports.

Push branch + open PR titled "Add TTS layer with callsign translation and readbacks".

Commit: `Wire TTS readbacks to accepted commands`

---

## Task 15: Game-over overlay markup and styles

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`

**Branch:** `feat/game-over`

After the `#settings-modal` block (still inside `#app`), insert:

```html
<div id="game-over" hidden role="dialog" aria-labelledby="game-over-title">
  <div class="modal-card">
    <h2 id="game-over-title">Game Over</h2>
    <div id="game-over-reason" class="game-over-reason"></div>
    <div class="score-summary">
      <div class="score-row">
        <span class="hud-label">FINAL SCORE</span>
        <span id="game-over-score" class="score-value">0</span>
      </div>
      <div class="score-row">
        <span class="hud-label">DURATION</span>
        <span id="game-over-duration" class="score-value">0:00</span>
      </div>
    </div>
    <h3 class="high-score-title">High Scores</h3>
    <ol id="game-over-highscores" class="high-score-list"></ol>
    <div class="modal-actions">
      <button id="game-over-restart" type="button">Play Again</button>
    </div>
  </div>
</div>
```

CSS additions:
- `.game-over-reason` — error color, 12px margin-bottom
- `.score-summary` — 16px margin-bottom
- `.score-row` — flex row with space-between, 14px font
- `.score-value` — scope-bright, bold
- `.high-score-title` — small heading, scope-bright, letter-spacing
- `.high-score-list` — decimal-inside, max-height 200px scroll, gap-laid rows
- `.high-score-list li` — flex row with gap, justify space-between
- `.high-score-list li.current` — scope-bright bold (highlights the just-finished run)
- `.high-score-list .empty` — scope-dim italic placeholder

Note: `#game-over` shares overlay rules with `#settings-modal` (already declared in T5).

Commit: `Add game-over overlay shell`

---

## Task 16: GameOverScreen controller

**Files:**
- Create: `src/render/GameOverScreen.ts`
- Create: `tests/render/GameOverScreen.test.ts`

**Branch:** `feat/game-over`

`GameOverScreenElements`: root, reason, score, duration, highScores (HTMLOListElement), restart, onRestart callback.

`GameOverPayload`: reason (string), score, duration_sec, highScores (HighScore[]), currentEndedAt (string | null).

`REASON_TEXT` lookup:
- `separation_loss` → "Separation loss — two aircraft came within 3 nm and 1000 ft."
- `lost_aircraft` → "Aircraft exited the sector boundary uncleared."

Class:
- Constructor wires restart click → onRestart
- `show(payload)` — sets reason text (lookup or fallback), score.toString(), formatted duration, renderHighScores, removes hidden
- `hide()` — sets hidden
- `renderHighScores(list, currentEndedAt)`:
  - Empty list → single `<li class="empty">No high scores yet.</li>`
  - Otherwise: each item `<li>` with `.current` class when `h.ended_at === currentEndedAt`, two child spans: `${h.score} pts` (left) and formatted duration (right)

Helper: `formatDuration(sec)` → "M:SS" (e.g. 200 → "3:20"), with floor + Math.max(0, ...) guards.

Tests (jsdom env, 4 tests):
1. show populates overlay and removes hidden; correct reason / score "5" / duration "3:20"; current row has .current class
2. empty high-scores renders an empty placeholder
3. Play Again button invokes onRestart callback
4. hide adds the hidden attribute

Commit: `Add GameOverScreen overlay controller`

---

## Task 17: Wire game-over to session_ended

**Files:**
- Modify: `src/app/main.ts`

**Branch:** `feat/game-over` (final — push + PR)

After SettingsModal is constructed, add:

```ts
const gameOver = new GameOverScreen({
  root: getElement("game-over"),
  reason: getElement("game-over-reason"),
  score: getElement("game-over-score"),
  duration: getElement("game-over-duration"),
  highScores: getElement<HTMLOListElement>("game-over-highscores"),
  restart: getElement<HTMLButtonElement>("game-over-restart"),
  onRestart: () => window.location.reload(),
});

world.events.on((e) => {
  if (e.kind !== "session_ended") return;
  const endedAt = new Date().toISOString();
  const entry = {
    score: world.session.score,
    duration_sec: Math.floor(world.elapsed_sec),
    ended_at: endedAt,
  };
  settingsStore.recordHighScore(world.airspace.icao, entry);
  gameOver.show({
    reason: world.session.end_reason ?? e.reason,
    score: entry.score,
    duration_sec: entry.duration_sec,
    highScores: settingsStore.highScores(world.airspace.icao),
    currentEndedAt: endedAt,
  });
});
```

Push branch + open PR titled "Add game-over overlay with persisted high scores".

Commit: `Show game-over overlay on session_ended and persist high score`

---

## Task 18: GitHub Pages deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Branch:** `feat/deployment`

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch: {}

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
          cache: "npm"
      # npm bug 4828: lockfile was generated on Windows and lacks the Linux
      # rolldown native binding that vitest 4 needs. Drop the lockfile and
      # reinstall fresh so optional native deps resolve cleanly.
      - run: rm -f package-lock.json
      - run: npm install
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Vite base is already `"./"` → relative asset URLs work under the GH Pages subpath without additional config.

Commit: `Add GitHub Pages deploy workflow`

---

## Task 19: README quickstart + deployed URL

**Files:**
- Modify: `README.md`

**Branch:** `feat/deployment` (final — push + PR)

Replace the existing terse README with one that includes:
- Project tagline + deployed URL placeholder (`https://<your-github-user>.github.io/atc-browser/`)
- Note that GH Pages must be enabled in repo settings (Source: GitHub Actions)
- Quickstart (npm install + npm run dev)
- Scripts table (dev, build, preview, test, typecheck, lint)
- Controls cheatsheet (click select, type commands H/A/S/L/X, hotkeys, Tab/Up/Down/Esc, ⚙ for settings)
- Architecture overview (sim core + four adapter layers)
- Plan history pointers

Push branch + open PR titled "Add GitHub Pages deploy workflow and update README".

Post-merge: enable Pages in repo Settings → Pages → Source: "GitHub Actions"; re-run the failed first deploy.

Commit: `Document deployed URL, quickstart, and controls`

---

## Spec coverage check

| Spec section | Covered by |
|---|---|
| § 8.1 SFX library (six names) | Task 8 (`SFX_CONFIG`), Task 9 (event bindings + selection) |
| § 8.2 TTS readbacks | Task 11 (callsigns), Task 12 (readback formatter), Task 13 (Tts queue), Task 14 (bindings) |
| § 8.3 Toggles (SFX, TTS, volume, voice) — persisted | Tasks 4–7 (settings + modal), Tasks 10/13 (live response) |
| § 9 Persistence — versioned blob, settings + high scores | Tasks 1–3 (Storage + highScores), Task 4 (SettingsStore), Task 17 (recording on game over) |
| § 9 Migration | Task 1 (`migrate`), Task 2 (tests for unknown version + malformed) |
| § 12 GitHub Pages deploy via Actions | Tasks 18–19 |
| § 12 Deployed URL | Task 19 (README placeholder) |

The conflict alarm "looping" detail in § 8.1 is reduced to a one-shot per the in-MVP World behavior (first conflict ends the session); noted at the head of Task 9.

## Out-of-scope (intentional)

Left for `docs/backlog.md` or a Plan 4:

- Audio asset files (`.ogg/.wav`) — synthesis covers MVP; assets can swap in later behind the existing `Sfx` interface.
- Custom domain on the GitHub Pages site.
- Source maps disabled in production (currently enabled via `vite.config.ts`; harmless for an open-source project).
- Pause-the-game UI when the settings modal is open. Time keeps advancing while the modal is up — acceptable for MVP since it's brief.
