# atc-browser — Design Spec

| | |
|---|---|
| **Date** | 2026-05-04 |
| **Owner** | Jake Tauer |
| **Status** | Draft, pending implementation plan |

---

## 1. Vision

A realistic, browser-based **approach control (TRACON)** radar simulator. Players vector aircraft, sequence arrivals onto the ILS, depart traffic, and hand off to adjacent sectors — using a hybrid keyboard+mouse interface against a classic STARS-style green-on-black scope.

**North star:** Endless ATC. We are deliberately leaning into realism (real airports, real procedures, real radio phraseology) rather than arcade abstraction, but with a low-floor input layer so non-controllers can play.

**Long-term direction:** A career mode where the player progresses from a small regional airport up through national hubs to a major international hub, plus a sandbox mode for free play. The MVP only ships the smallest playable kernel; everything else is roadmap.

## 2. MVP scope (v0.1)

A single-airport endless mode at **Duluth Approach (KDLH)**, with realism intentionally stripped down to validate the core loop quickly.

### In scope

- KDLH airspace; one active runway (default RWY 27); realistic ILS approach geometry for that runway. (Missed approach is **not** modeled in MVP — once an aircraft is established on the ILS the auto-fly is one-way to the threshold. See § 6.6.)
- Arrivals enter at one of two simplified entry fixes (real KDLH IAFs); spawn rate ramps over the shift.
- Departures spawn at the runway threshold; player issues initial heading + climb; departures hand off to Center at the airspace ceiling.
- One aircraft performance category (generic medium jet) with realistic-ish turn rate, climb/descent rate, and speed envelope.
- Player commands via hybrid input: click → context menu, **or** type `DAL891 H 240 A 80 L 27` style commands; hotkeys mirror typed shortcuts; tab-complete callsigns.
- Available commands: assign heading, assign altitude, assign speed, clear for ILS approach, hand off.
- Separation rules: 3 nm lateral OR 1000 ft vertical (basic; no wake categories yet).
- Conflict alerts when separation is violated.
- TTS readbacks via browser SpeechSynthesis (toggleable); SFX (toggleable).
- Score = aircraft successfully handed off; session ends on first separation loss OR aircraft running out of airspace.
- High scores saved to `localStorage`.
- Deployed to GitHub Pages.

### Explicitly NOT in MVP (deferred to post-v0.1)

- SIDs / STARs (named procedures) — manual vectoring only.
- Wind, runway flips, multiple runway configurations.
- Wake separation categories (heavy / medium / light).
- Multiple aircraft performance categories.
- Weather (wind, ceilings, storms).
- Emergencies (low fuel, medical, mechanical).
- Holding patterns (we deny entry instead if airspace saturates).
- Other airports.
- Career mode, scenarios, sandbox controls.
- Cloud save / accounts.

### Success criteria

A non-ATC-nerd can open the URL, learn the controls in under 5 minutes, and play a meaningful 3–10 minute round. An ATC nerd can see that the bones are real and want to keep playing.

## 3. Locked decisions

| Topic | Decision |
|---|---|
| Genre | Realistic radar approach-control sim, browser-based |
| Scope | TRACON / approach control |
| Input | Hybrid: click + type, hotkeys, tab-complete callsigns |
| Difficulty | No artificial difficulty — natural ATC challenge only |
| MVP airport | KDLH (Duluth) Approach |
| MVP game structure | Endless mode (survival) |
| Long-term game structure | Career / progression (small → hub airports) + sandbox |
| Airports | Real-world only |
| MVP realism | Stripped-down: single runway, manual vectoring, one aircraft type, no wake/weather/emergencies |
| Tech stack | Vanilla TypeScript + HTML Canvas 2D + Vite |
| Visual style | Classic STARS — monochrome green-on-black, monospace |
| Audio | SFX + TTS readbacks; all toggleable |
| Game time | Real-time only (no acceleration in MVP) |
| Persistence | `localStorage` (settings + high scores) |
| Deployment | GitHub Pages (public repo) |

## 4. Architecture

**Principle:** A pure simulation core with no DOM, Canvas, audio, or input dependencies. Adapter layers wrap it for presentation. This makes the sim unit-testable without a browser and lets us swap presentation independently.

### 4.1 Module layout

```
src/
  sim/                        # pure simulation, no DOM/Canvas/audio
    World.ts                  # the live world: aircraft list, clock, score, events
    Aircraft.ts               # aircraft entity: position, vectors, physics, state machine
    Airspace.ts               # static data shape for an airport
    physics.ts                # turn rate, climb/descent rate, speed integration
    conflicts.ts              # separation monitor (3 nm / 1000 ft)
    traffic.ts                # spawn schedule, entry-fix randomizer
    commands/
      types.ts                # Command discriminated union
      parser.ts               # "DAL891 H 240 A 80" → Command[]
      executor.ts             # apply Command to World
    events.ts                 # event types and bus

  render/                     # reads World, never mutates
    Scope.ts                  # Canvas 2D radar scope
    Strips.ts                 # HTML aircraft strip list
    Hud.ts                    # HTML score, clock, alerts, settings
    theme.ts                  # STARS green-on-black palette

  input/                      # keyboard + mouse → Command
    keyboard.ts               # command-line input + hotkeys
    mouse.ts                  # click-to-select, context menu
    commandPipeline.ts        # unified queue: click and typed → Command

  audio/
    Sfx.ts                    # button clicks, conflict alarm, handoff chime
    Tts.ts                    # SpeechSynthesis wrapper

  storage/
    Storage.ts                # localStorage wrapper

  app/
    main.ts                   # bootstrap
    loop.ts                   # fixed-step sim + variable-step render
    settings.ts               # runtime settings model

  data/
    airports/
      kdlh.ts                 # KDLH airspace data

  index.html
  styles.css

tests/
  sim/                        # vitest suites mirroring src/sim/

public/
  audio/                      # SFX assets (.ogg / .wav)
```

### 4.2 Game loop

- **Simulation tick:** fixed step at **30 Hz**. Each tick: drain Command queue → integrate physics → run conflict detection → run spawn / handoff logic → emit events.
- **Render:** `requestAnimationFrame` (typically 60 fps). Renderer reads the latest World snapshot every frame; never mutates anything.
- **Real-time only** for MVP (no time acceleration).

### 4.3 State flow

```
Input (keyboard/mouse) ──► commandPipeline ──► Command queue
                                                   │
                                                   ▼
                            ┌──── World (sim tick: physics + conflicts + spawn) ◄─── time
                            │
                            ▼
                          Events ──► audio (TTS, SFX), HUD updates, strips
                            │
                            ▼
                          Render (Canvas Scope reads World every frame)
                            │
                            ▼
                        localStorage (on game-over: score; on settings change: settings)
```

### 4.4 Mutability decision

A single mutable `World` object, mutated only by the executor and the loop. Renderers and other adapters read but do not mutate. Reasoning: aircraft physics ticks 30×/sec; cloning the world every tick wastes CPU and complicates debugging. Mutation is correctly contained because the write surface is narrow.

## 5. Domain model

### 5.1 Aircraft

```ts
interface Aircraft {
  id: string;                    // stable internal id
  callsign: string;              // "DAL891"
  kind: "arrival" | "departure";
  state: "entering" | "under_control" | "cleared_approach" | "handed_off";

  position_nm: { x: number; y: number };  // planar nm, airport at origin
  altitude_ft: number;
  heading_deg: number;                     // 0–359, magnetic
  speed_kts: number;                       // indicated airspeed

  target_heading: number | null;
  target_altitude: number | null;
  target_speed: number | null;
  cleared_runway: string | null;           // e.g. "27" once cleared for ILS

  spawn_time_s: number;
  handoff_time_s: number | null;
}
```

**Physics integration each sim tick:**
- Turn toward `target_heading` at ≈3°/sec for jets.
- Climb/descend toward `target_altitude` at ~1500–2000 fpm.
- Accelerate/decelerate toward `target_speed` at ~1 kt/sec.
- When `cleared_runway` is set and the aircraft satisfies the establishment criteria (see § 6.6), the executor transitions the aircraft to `cleared_approach` and overrides `target_heading` with the localizer course; the aircraft then auto-flies the approach down to the threshold (= handoff to tower, count as success).

**State transitions:**

```
spawn ──► entering ──[crosses sector boundary]──► under_control
under_control ──[player issues handoff, departure climbing]──► handed_off  (+ score)
under_control ──[clear_approach + established on ILS]──► cleared_approach
cleared_approach ──[reaches runway]──► handed_off  (+ score)
under_control ──[separation lost]──► game over
under_control ──[exits sector boundary uncleared]──► aircraft lost (game over)
```

### 5.2 Airspace (data file: `src/data/airports/kdlh.ts`)

```ts
interface Airspace {
  icao: string;                  // "KDLH"
  name: string;                  // "Duluth International"
  elevation_ft: number;
  magnetic_var_deg: number;

  runways: Runway[];
  entry_fixes: Fix[];            // simplified IAFs
  exit_fixes: Fix[];             // departure handoff points

  sector_radius_nm: number;
  floor_ft: number;              // below = handed off / past tower
  ceiling_ft: number;            // above = handed off to center
}

interface Runway {
  id: string;                    // "09" / "27"
  heading: number;
  threshold: { x: number; y: number };
  opposite: string;
  length_ft: number;
  ils?: { course: number; glideslope_deg: number; dme_at_threshold: number };
}

interface Fix {
  name: string;
  position_nm: { x: number; y: number };
  suggested_alt_ft?: number;
}
```

KDLH-specific values (runway lat/lons, fix coordinates, ILS magnetic course) will be researched and locked when wiring up the data file, sourcing from FAA airport diagrams and chart supplements.

### 5.3 Session

```ts
interface Session {
  id: string;
  started_at: number;            // epoch ms
  elapsed_sec: number;
  aircraft_handled: number;
  aircraft_lost: number;         // 0 in MVP — first loss = game over
  conflicts_raised: number;
  score: number;                 // = aircraft_handled in MVP
  status: "running" | "ended";
  end_reason: "separation_loss" | "lost_aircraft" | null;
}
```

High scores live in `localStorage` as a small array per airport (top 10).

### 5.4 Commands (discriminated union)

```ts
type Command =
  | { kind: "assign_heading";  aircraft_id: string; heading_deg: number }
  | { kind: "assign_altitude"; aircraft_id: string; altitude_ft: number }
  | { kind: "assign_speed";    aircraft_id: string; speed_kts: number }
  | { kind: "clear_approach";  aircraft_id: string; runway: string }
  | { kind: "handoff";         aircraft_id: string; to: "tower" | "center" };
```

Both the typed parser ("DAL891 H 240 A 80 L 27") and the click-menu produce `Command` values of this same type.

### 5.5 Events

```ts
type Event =
  | { kind: "aircraft_spawned";   aircraft_id: string }
  | { kind: "command_accepted";   command: Command; aircraft_id: string }
  | { kind: "command_rejected";   command: Command; aircraft_id: string; reason: string }
  | { kind: "approach_cleared";   aircraft_id: string; runway: string }
  | { kind: "handed_off";         aircraft_id: string; to: "tower" | "center" }
  | { kind: "conflict_raised";    pair: [string, string] }
  | { kind: "conflict_resolved";  pair: [string, string] }
  | { kind: "aircraft_lost";      aircraft_id: string; reason: string }
  | { kind: "session_ended";      reason: string };
```

Audio listens for these (TTS reads back accepted commands, alarm on conflict, chime on handoff); HUD/strips re-render on relevant ones.

## 6. Input

**Both** the typed command line and the click-menu produce `Command` values into a single queue.

### 6.1 Typed grammar

Case-insensitive, whitespace-tolerant. Multiple verbs per line allowed.

```
<callsign> <verb> <value> [<verb> <value>...]

Verbs:
  H <0–359>          heading
  A <hundreds-feet>  altitude (e.g. "A 80" = 8000 ft)
  S <kts>            speed
  L <runway>         cleared for ILS approach
  X                  handoff (auto-routes: arrival→tower, departure→center)
```

**Examples:**

```
DAL891 H 240 A 80
UAL237 S 210
SWA42 L 27
AAL14 X
```

### 6.2 Editor behavior

- Tab-completes a partially-typed callsign.
- Up/Down arrow scrolls command history.
- Esc cancels the current line.
- Enter submits.

### 6.3 Click-menu fallback

Click an aircraft → right-side context menu with H / A / S / L / X options. Each opens an inline numeric input (or runway picker for L). Submit produces the same `Command` type.

### 6.4 Hotkeys

When an aircraft is selected, pressing H / A / S / L / X focuses the command line pre-filled with `<callsign> <verb> ` so the player can just type the value.

### 6.5 Validation & rejection

The executor validates: heading ∈ 0–359, altitude within sector floor/ceiling, runway exists in airspace, etc. On rejection, emit `command_rejected` with a human-readable reason; HUD shows it briefly in red, SFX plays a short reject buzz.

### 6.6 Approach clearance lifecycle

Issuing `L <runway>` is **authorization only** — it sets `cleared_runway` but does **not** change the aircraft's vectoring. The aircraft continues to fly whatever `target_heading` / `target_altitude` / `target_speed` the player has assigned. The player must vector the aircraft onto the final approach course manually.

**Establishment criteria** (all must be true on the same sim tick):

1. Lateral position within 1 nm of the localizer course, **and**
2. Heading within 30° of the localizer course (inbound), **and**
3. Altitude at or below the glideslope intercept altitude for the aircraft's distance from threshold.

When all three are true, the executor transitions `state` from `under_control` to `cleared_approach`, sets `target_heading` to the localizer course, and engages glideslope auto-descent.

**Player commands while `cleared_runway` is set but state is still `under_control`:** accepted normally. (The player is still vectoring toward intercept.)

**Player commands once state is `cleared_approach`:** rejected with reason `"aircraft on final approach, cannot vector"`. (No cancel-approach / go-around command in MVP — that's a post-MVP feature.)

**Aircraft that fly through the localizer without capturing it:** state stays `under_control` with `cleared_runway` still set; the player can vector them around to try again, or eventually they exit the sector boundary and are lost (game over).

## 7. Render

### 7.1 Canvas scope

Fills the viewport behind HTML overlays. Draw order (back to front, every frame):

1. Black background
2. Range rings every 10 nm (dim green)
3. Airspace boundary polygon (dim green)
4. Runways (solid bright lines) + extended centerline / ILS final approach course (dashed)
5. Entry/exit fixes (small triangles + label)
6. Aircraft trails — last ~30 sec of position dots, fading by age
7. Aircraft blip + datablock + (if selected) target-heading vector
8. Conflict indicator — flashing line between offending pair

**Datablock format** (STARS-ish, monospace, leading-line from blip):

```
DAL891
080 210
```

Line 1: callsign. Line 2: altitude (hundreds of feet, 3 digits) and speed (kts). Selected aircraft datablock is brighter; cleared-for-approach aircraft get a leading `*`; conflicts flash.

### 7.2 HTML overlays

Positioned absolutely over the Canvas:

- **Top-left:** session clock + selected callsign.
- **Top-right:** score, separation-violation count, settings cog (opens modal with SFX/TTS toggles, voice picker, volume).
- **Right side panel:** aircraft strip list — one row per active aircraft, monospace, sorted by distance from airport. Click a strip = select that aircraft.
- **Bottom:** persistent command line `CMD>` with blinking caret. Last response (rejection reason or readback echo) shown above it for 3 seconds.

### 7.3 Resize and projection

Canvas resizes with the window. Scope projection is "1 nm = N pixels," with N derived from the smaller viewport dimension so the airspace always fits. For MVP we use a simple equirectangular projection centered on the airport — over a 30 nm sector, distortion is negligible.

## 8. Audio

### 8.1 SFX library (preloaded)

- `select.ogg` — soft tick when selecting an aircraft
- `accept.ogg` — short blip on command accepted
- `reject.ogg` — short buzz on command rejected
- `conflict.ogg` — alarm tone, repeats until conflict resolves
- `handoff.ogg` — pleasant chime on successful handoff
- `lose.ogg` — game-over tone

### 8.2 TTS

Uses browser `SpeechSynthesisUtterance`:

- Pick the first English voice on first run; user can override in settings.
- Rate ~1.1, pitch ~1.0 (real readbacks are quick).
- Format: `"<callsign>, <readback>, <callsign>"` — ATC convention is callsign at both ends.
- Examples:
  - `DAL891 H 240 A 80` → "Delta eight ninety one, heading two four zero, descending eight thousand, Delta eight ninety one"
  - `SWA42 L 27` → "Southwest forty two, cleared ILS two seven approach, Southwest forty two"
- Queue is naturally serial; if depth > 3, drop oldest non-critical readbacks (do not drop conflict-related speech).

### 8.3 Toggles (persisted)

- SFX on/off (master)
- TTS on/off (master)
- Master volume 0–100%
- Voice selection (dropdown of available system voices)

## 9. Persistence

Single `localStorage` key `atc-browser:v1` with a versioned JSON blob:

```json
{
  "v": 1,
  "settings": {
    "sfx_enabled": true,
    "tts_enabled": true,
    "volume": 0.8,
    "voice_uri": "Microsoft Aria"
  },
  "high_scores": {
    "kdlh": [
      { "score": 14, "duration_sec": 412, "ended_at": "2026-05-04T..." }
    ]
  }
}
```

Read on boot, write on settings change and on session end. Migration: bump `v` and write a migration function when the shape changes.

## 10. Tooling

| Tool | Use |
|---|---|
| **Vite** | Dev server + build. Fast HMR, zero-config. |
| **TypeScript** | Strict mode (`strict`, `noUncheckedIndexedAccess`). |
| **Vitest** | Unit tests for `sim/`. Vite-native, Jest-compatible API. |
| **Playwright** | One or two end-to-end smoke tests post-MVP. *Not in MVP.* |
| **ESLint + Prettier** | Defaults; no bikeshedding. |
| **Node 20 LTS** | Toolchain. |

## 11. Testing strategy

The simulation core is the only place that needs heavy testing.

| Module | What to test |
|---|---|
| `sim/physics` | Turn rate, climb/descent integration, speed integration, ILS auto-fly. Boundary cases (heading wrap at 360, level-off at target). |
| `sim/conflicts` | Separation pair detection across edge geometries. |
| `sim/commands/parser` | Round-trip `string → Command`; reject malformed input with helpful errors. |
| `sim/commands/executor` | Apply Command to World; check rejection rules. |
| `sim/World` | Full deterministic tick: feed initial state + scripted commands + N ticks → assert resulting state. Replayable scenarios. |

Adapter layers (`render`, `input`, `audio`) get spot-checked; they are validated by play.

**Coverage target:** 80%+ on `sim/`. No required floor on adapters.

## 12. Deployment

- Public GitHub repo (required for free GitHub Pages).
- GitHub Actions on `main` push: install → typecheck → test → `vite build` → deploy `dist/` to GitHub Pages via `actions/deploy-pages`.
- Site at `https://<username>.github.io/atc-browser/` until/unless a custom domain is wired up.

## 13. Repo / git workflow

Per Jake's global CLAUDE.md:

- Initialize git locally; create the GitHub repo; default branch `main`.
- **Every code task gets a feature branch off `main`.** Commit at logical milestones (not one giant commit per branch).
- Open PRs for merging — even solo, this gives clean history and triggers CI.
- `git push`, `gh pr create`, and `gh pr merge` are approval-gated.

## 14. Project structure (top level)

```
atc-browser/
  .github/workflows/ci.yml
  .github/workflows/deploy.yml
  src/...                          # per Section 4.1
  tests/...
  public/audio/...
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  vitest.config.ts
  .eslintrc.cjs
  .prettierrc
  .gitignore                       # includes .superpowers/, dist/, node_modules/
  README.md
  docs/superpowers/specs/2026-05-04-atc-browser-design.md
```

## 15. Roadmap (post-MVP, rough order)

Highest play-value-per-effort first. Order is indicative, not committed.

1. Multiple aircraft performance categories (heavy / medium / light) + wake separation rules.
2. Wind + runway flips — single wind vector, configurable; flip threshold; player must replan.
3. Holding patterns — `H AT <fix>` command; auto-spacing on the hold.
4. Emergencies — low-fuel and medical, prioritized handling.
5. SIDs & STARs — named procedures aircraft fly until intervention; arrivals enter on a STAR; departures fly a SID.
6. Second airport — small (e.g., KBJI Bemidji), proves out the multi-airport architecture.
7. Career mode v1 — sequence of unlocked airports of increasing complexity, persistent progress, simple difficulty curve.
8. Sandbox mode — pick airport + traffic rate + wind, free play.
9. More airports, growing toward MSP / KORD / KLAX as final-tier hubs.

## 16. Open risks & unresolved details

| Risk | Mitigation |
|---|---|
| Real KDLH airspace data (runway lat/lons, fix coordinates, ILS course) needs research before wiring. | Source from FAA airport diagrams and chart supplements during the implementation phase. Keep the data structure airport-agnostic so values can be revised without code changes. |
| TTS voice quality varies wildly by OS/browser. | Accept it — free feature with graceful fallback (toggle off). Default to first English voice; expose voice picker in settings. |
| Scope projection accuracy beyond 30 nm. | MVP uses simple equirectangular centered on airport (negligible distortion at this scale). Revisit with proper Mercator projection if any future sector exceeds ~100 nm. |
| Single mutable `World` could be misused if adapter code starts mutating. | Discipline + code review. Optionally enforce via TypeScript `Readonly<>` exposure later if it becomes a problem. |

---

## Appendix A — Command examples

| Typed | Effect |
|---|---|
| `DAL891 H 240` | Delta 891 turn left/right to heading 240. |
| `DAL891 A 80` | Delta 891 climb/descend to 8,000 ft. |
| `DAL891 S 210` | Delta 891 reduce/increase speed to 210 kts. |
| `DAL891 H 240 A 80 S 210` | All three at once. |
| `DAL891 L 27` | Delta 891 cleared ILS runway 27 approach. |
| `DAL891 X` | Hand off Delta 891 (auto: tower for arrival, center for departure). |
