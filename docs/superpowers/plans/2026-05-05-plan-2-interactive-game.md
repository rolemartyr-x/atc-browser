# atc-browser MVP — Plan 2: Interactive Game (Render + Input)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the headless sim core (Plan 1) into a playable browser game. By the end of this plan, a player can open the dev URL, see a real STARS-style radar scope with KDLH airspace, click aircraft to select them, type or click commands, and see them carry out the instructions visually.

**Architecture:** Two adapter layers wrap the existing pure simulation core. `src/render/` consumes a `World` snapshot each frame and draws Canvas + DOM. `src/input/` consumes keyboard and mouse events and pushes `Command`s into `world.enqueueCommand`. Both layers share a tiny `AppState` for cross-cutting UI state (selected aircraft, last command response). Audio, persistence, and deployment remain out of scope (Plan 3).

**Tech Stack:** TypeScript strict (existing), HTML5 Canvas 2D, vanilla DOM. No new runtime dependencies. Vitest with `jsdom` environment for DOM tests.

**Spec reference:** `docs/superpowers/specs/2026-05-04-atc-browser-design.md` — §6 Input, §7 Render.

**Plan 1 outputs already on `main`:** `src/sim/` (types, math, physics, conflicts, events, Aircraft, parser, executor, traffic, approach, World), `src/data/airports/kdlh.ts`, `src/app/loop.ts`, headless `src/app/main.ts`.

---

## File Structure

Files this plan creates or modifies:

```
src/render/
  theme.ts                  # COLORS, FONTS, LINES constants
  projection.ts             # nm ↔ pixel coord conversion (resizable)
  Scope.ts                  # Canvas 2D radar scope renderer
  Strips.ts                 # right-side aircraft strip panel
  Hud.ts                    # top/bottom HUD bars + response line

src/input/
  mouse.ts                  # canvas click → selection / clear
  keyboard.ts               # command line + history + tab-complete + hotkeys
  clickMenu.ts              # floating H/A/S/L/X menu near selected aircraft
  commandPipeline.ts        # parse text, enqueue Commands, set lastResponse

src/app/
  state.ts                  # AppState (selected id, last response)
  main.ts                   # MODIFIED — wires sim + render + input together

src/styles.css              # MODIFIED — full layout and HUD styles
index.html                  # MODIFIED — adds canvas, sidebar, top/bottom bars

tests/render/
  projection.test.ts

tests/input/
  keyboard.test.ts          # uses jsdom
  mouse.test.ts             # pure hit-test math, node env
  commandPipeline.test.ts   # uses jsdom for response element
```

A jsdom test environment is needed for some `tests/input/` files. The existing `vitest.config.ts` uses `environment: "node"`. Per-test-file overrides via `// @vitest-environment jsdom` directive at the top of those specific files. No global config change required.

## Branch / PR Strategy

| Branch | Tasks | Outcome |
|---|---|---|
| `feat/render-foundation` | T1 → T4 | Static scope renders: background, range rings, runways with ILS centerlines, entry/exit fixes |
| `feat/render-aircraft` | T5 → T7 | Aircraft visible as blips + datablocks with trails and selection / conflict cues |
| `feat/render-strips-hud` | T8 → T9 | Right-panel strip list + top/bottom HUD bars |
| `feat/input-keyboard` | T10 → T12 | Command line works: type commands, history, tab-complete, hotkeys with selected aircraft |
| `feat/input-mouse-pipeline` | T13 → T15 | Click aircraft to select, click-menu prefills command line, parse pipeline + response feedback |
| `feat/integrate-game` | T16 | Full wiring in `main.ts`; visual end-to-end smoke test in browser |

Per the user's CLAUDE.md, git operations including push/PR/merge are autonomous on personal repos. Commit at logical milestones; don't bundle unrelated changes.

## Implementation conventions (apply to ALL tasks below)

These are repo-wide conventions established in Plan 1 that all subagents must follow:

- **Imports:** drop `.ts` extensions on relative imports. The project's `tsconfig.json` has `allowImportingTsExtensions: false`.
- **Strict TS:** every file passes `tsc --noEmit` cleanly. No `any` without an inline `// eslint-disable` and a one-line justification.
- **Tests:** TDD where the unit is testable. Pure logic (math, parsing, hit-testing) gets full unit tests; Canvas drawing is validated by play, not unit-tested.
- **No `git add .`:** stage specific files per commit.
- **Commit messages:** imperative mood, present tense.
- **Exact code:** use the code blocks from this plan verbatim. If you find a real bug in the plan (off-by-one, type mismatch, contradiction), fix it and report the deviation.

---

## Task 1: Theme constants

**Files:**
- Create: `src/render/theme.ts`

**Branch:** `feat/render-foundation`

- [ ] **Step 1: Branch fresh**

```
git checkout main && git pull
git checkout -b feat/render-foundation
```

- [ ] **Step 2: Write `src/render/theme.ts`**

```ts
// STARS-style radar palette. All visual constants live here so the rest of
// render/ uses semantic names instead of color literals.

export const COLORS = {
  background: "#000",
  scope: "#4ade80",          // primary STARS green
  scopeDim: "#1a4d2e",        // range rings, sector boundary, dim chrome
  scopeBright: "#86efac",     // selected / cleared aircraft
  conflict: "#ff4444",        // separation violation
  text: "#4ade80",
  textBright: "#86efac",
  textError: "#ff6666",
} as const;

export const FONTS = {
  scope: "11px ui-monospace, 'Cascadia Mono', Consolas, monospace",
  hud: "13px ui-monospace, 'Cascadia Mono', Consolas, monospace",
  strip: "12px ui-monospace, 'Cascadia Mono', Consolas, monospace",
} as const;

export const LINES = {
  ring: 0.5,
  runway: 2,
  centerline: 1,
  trail: 1,
  targetVector: 1,
  fix: 1,
  conflict: 2,
  selectionHalo: 1,
} as const;
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: passes silently.

- [ ] **Step 4: Commit**

```
git add src/render/theme.ts
git commit -m "Add STARS theme constants for render layer"
```

---

## Task 2: Projection math

**Files:**
- Create: `src/render/projection.ts`
- Create: `tests/render/projection.test.ts`

**Branch:** `feat/render-foundation` (continue)

- [ ] **Step 1: Write the failing test**

Create `tests/render/projection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Projection } from "../../src/render/projection";

describe("Projection", () => {
  it("centers world (0,0) at viewport center", () => {
    const p = new Projection(800, 600, 30);
    expect(p.toScreen({ x: 0, y: 0 })).toEqual({ x: 400, y: 300 });
  });

  it("flips y so positive y (north) is screen-up", () => {
    const p = new Projection(800, 600, 30);
    const ten_north = p.toScreen({ x: 0, y: 10 });
    expect(ten_north.y).toBeLessThan(300);
    const ten_south = p.toScreen({ x: 0, y: -10 });
    expect(ten_south.y).toBeGreaterThan(300);
  });

  it("scales so range diameter fits the smaller viewport dimension", () => {
    const p = new Projection(800, 600, 30);
    // smaller dim = 600 px, range diameter = 60 nm, so 1 nm = 10 px
    expect(p.pixelsPerNm()).toBeCloseTo(10, 6);
  });

  it("toScreen and toWorld are inverses", () => {
    const p = new Projection(800, 600, 30);
    const a = { x: 5, y: -7 };
    const back = p.toWorld(p.toScreen(a));
    expect(back.x).toBeCloseTo(5, 6);
    expect(back.y).toBeCloseTo(-7, 6);
  });

  it("recalculates on resize", () => {
    const p = new Projection(800, 600, 30);
    p.resize(1600, 1200);
    expect(p.pixelsPerNm()).toBeCloseTo(20, 6);   // 1200 / 60
    expect(p.toScreen({ x: 0, y: 0 })).toEqual({ x: 800, y: 600 });
  });

  it("accepts a new range", () => {
    const p = new Projection(600, 600, 30);
    p.setRange(15);
    expect(p.pixelsPerNm()).toBeCloseTo(20, 6);   // 600 / 30
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test`
Expected: compile error, `src/render/projection.ts` does not exist.

- [ ] **Step 3: Implement `src/render/projection.ts`**

```ts
import type { Point2D } from "../sim/types";

export interface ScreenPoint {
  x: number;
  y: number;
}

// Projects between world coordinates (nm, x=east, y=north, origin = airport ARP)
// and screen coordinates (px, x=right, y=DOWN). Y is flipped so that "north up"
// is intuitive in the world model.
export class Projection {
  private nmPerPx = 0;
  private cx = 0;
  private cy = 0;

  constructor(
    private viewportW: number,
    private viewportH: number,
    private rangeNm: number,
  ) {
    this.recalc();
  }

  resize(w: number, h: number): void {
    this.viewportW = w;
    this.viewportH = h;
    this.recalc();
  }

  setRange(rangeNm: number): void {
    this.rangeNm = rangeNm;
    this.recalc();
  }

  private recalc(): void {
    const minDim = Math.min(this.viewportW, this.viewportH);
    // Diameter (2 * rangeNm) fits in smaller dimension.
    this.nmPerPx = (2 * this.rangeNm) / minDim;
    this.cx = this.viewportW / 2;
    this.cy = this.viewportH / 2;
  }

  toScreen(p: Point2D): ScreenPoint {
    return {
      x: this.cx + p.x / this.nmPerPx,
      y: this.cy - p.y / this.nmPerPx,
    };
  }

  toWorld(p: ScreenPoint): Point2D {
    return {
      x: (p.x - this.cx) * this.nmPerPx,
      y: -(p.y - this.cy) * this.nmPerPx,
    };
  }

  pixelsPerNm(): number {
    return 1 / this.nmPerPx;
  }

  get viewportSize(): { w: number; h: number } {
    return { w: this.viewportW, h: this.viewportH };
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test`
Expected: all 6 projection assertions pass; no other tests regress.

- [ ] **Step 5: Commit**

```
git add src/render/projection.ts tests/render/projection.test.ts
git commit -m "Add Projection for nm↔pixel coordinate conversion"
```

---

## Task 3: HTML layout and CSS

**Files:**
- Modify: `index.html`
- Modify: `src/styles.css`

**Branch:** `feat/render-foundation` (continue)

This task replaces the placeholder layout with the real game shell — canvas in the middle, top HUD, bottom command line, right-side strip panel, and a hidden click menu.

- [ ] **Step 1: Replace `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>atc-browser</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <div id="app">
      <header id="hud-top">
        <div id="hud-clock">00:00</div>
        <div id="hud-selected">--</div>
        <div id="hud-stats">
          <span><span class="hud-label">SCORE</span> <span id="hud-score">0</span></span>
          <span><span class="hud-label">CONFLICTS</span> <span id="hud-conflicts">0</span></span>
          <span><span class="hud-label">STATUS</span> <span id="hud-status">running</span></span>
        </div>
      </header>
      <canvas id="scope"></canvas>
      <aside id="strips"></aside>
      <footer id="hud-bottom">
        <div id="hud-response"></div>
        <div id="hud-cmdline">
          <span class="prompt">CMD&gt;</span>
          <input id="cmd-input" type="text" autocomplete="off" spellcheck="false" autofocus />
        </div>
      </footer>
      <div id="click-menu" hidden></div>
    </div>
    <script type="module" src="/src/app/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace `src/styles.css`**

```css
:root {
  --bg: #000;
  --scope: #4ade80;
  --scope-dim: #1a4d2e;
  --scope-bright: #86efac;
  --conflict: #ff4444;
  --error: #ff6666;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
}

body {
  background: var(--bg);
  color: var(--scope);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 12px;
}

#app {
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 1fr 220px;
}

#hud-top {
  grid-row: 1;
  grid-column: 1 / -1;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--scope-dim);
  font-size: 13px;
}

#hud-stats {
  display: flex;
  gap: 18px;
}

.hud-label {
  color: var(--scope-dim);
  font-size: 11px;
}

#scope {
  grid-row: 2;
  grid-column: 1;
  width: 100%;
  height: 100%;
  display: block;
  cursor: crosshair;
}

#strips {
  grid-row: 2;
  grid-column: 2;
  background: rgba(0, 0, 0, 0.85);
  border-left: 1px solid var(--scope-dim);
  overflow-y: auto;
  padding: 6px;
  font-size: 12px;
}

.strip {
  padding: 4px 8px;
  margin-bottom: 2px;
  cursor: pointer;
  border-left: 2px solid transparent;
  white-space: pre;
}

.strip:hover {
  background: rgba(74, 222, 128, 0.1);
}

.strip.selected {
  background: rgba(74, 222, 128, 0.2);
  color: var(--scope-bright);
  border-left-color: var(--scope-bright);
}

.strip.conflict {
  color: var(--conflict);
}

.strip.cleared {
  color: var(--scope-bright);
}

#hud-bottom {
  grid-row: 3;
  grid-column: 1 / -1;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.9);
  border-top: 1px solid var(--scope-dim);
}

#hud-response {
  min-height: 16px;
  font-size: 11px;
  opacity: 0.85;
}

#hud-response.error {
  color: var(--error);
}

#hud-cmdline {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 2px;
}

.prompt {
  color: var(--scope);
  font-size: 14px;
}

#cmd-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--scope-bright);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  caret-color: var(--scope);
}

#click-menu {
  position: absolute;
  background: rgba(0, 0, 0, 0.92);
  border: 1px solid var(--scope);
  padding: 4px 0;
  z-index: 100;
  font-size: 12px;
  min-width: 100px;
}

.click-menu-item {
  display: block;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--scope);
  padding: 4px 12px;
  text-align: left;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.click-menu-item:hover {
  background: rgba(74, 222, 128, 0.2);
  color: var(--scope-bright);
}
```

- [ ] **Step 3: Sanity check the layout in dev**

Run `npm run dev` in the background and open `http://localhost:5173`. Expected: black background, top bar with "00:00 -- SCORE 0 CONFLICTS 0 STATUS running", an empty black middle area (canvas), an empty right sidebar, a bottom bar with a `CMD>` prompt and a focusable input. Existing `main.ts` placeholder text is gone (the `#app textContent = ...` from Plan 1 was on the old `<div id="app">`; that line will conflict with our new structured layout — the visible "t=…" text will be set on the `#app` outer div, replacing all child elements). That visual regression is fine for now and is fixed in Task 16. Stop the dev server with Ctrl+C.

- [ ] **Step 4: Commit**

```
git add index.html src/styles.css
git commit -m "Add HTML layout shell and STARS-style CSS"
```

---

## Task 4: Scope class — static elements

**Files:**
- Create: `src/render/Scope.ts`

**Branch:** `feat/render-foundation` (final task on this branch)

This task introduces the `Scope` class with a `render(world, selectedId)` entry point. For now we only draw the static elements (background, range rings, sector boundary, runways with ILS centerlines, entry/exit fixes). Aircraft and conflicts come in Tasks 5–7.

No unit tests for this task — Canvas drawing is validated by running the dev server.

- [ ] **Step 1: Write `src/render/Scope.ts`**

```ts
import type { World } from "../sim/World";
import type { Airspace, Runway } from "../sim/types";
import { degToRad } from "../sim/math";
import { COLORS, FONTS, LINES } from "./theme";
import type { Projection } from "./projection";

const RANGE_RING_INTERVAL_NM = 10;
const ILS_CENTERLINE_LENGTH_NM = 12;

export class Scope {
  constructor(
    private canvas: HTMLCanvasElement,
    private projection: Projection,
  ) {}

  // Re-renders the entire scope from scratch every frame.
  render(world: World, _selectedId: string | null): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    this.syncCanvasSize(ctx);
    const { w, h } = this.projection.viewportSize;
    this.drawBackground(ctx, w, h);
    this.drawRangeRings(ctx, world.airspace);
    this.drawRunways(ctx, world.airspace);
    this.drawFixes(ctx, world.airspace);
    // Aircraft + conflicts rendered in subsequent tasks (5-7).
  }

  private syncCanvasSize(ctx: CanvasRenderingContext2D): void {
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    const wantW = Math.round(cssW * dpr);
    const wantH = Math.round(cssH * dpr);
    if (this.canvas.width !== wantW || this.canvas.height !== wantH) {
      this.canvas.width = wantW;
      this.canvas.height = wantH;
      this.projection.resize(cssW, cssH);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);
  }

  private drawRangeRings(ctx: CanvasRenderingContext2D, airspace: Airspace): void {
    ctx.strokeStyle = COLORS.scopeDim;
    ctx.lineWidth = LINES.ring;
    const center = this.projection.toScreen({ x: 0, y: 0 });
    const ppn = this.projection.pixelsPerNm();
    for (let r = RANGE_RING_INTERVAL_NM; r < airspace.sector_radius_nm; r += RANGE_RING_INTERVAL_NM) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, r * ppn, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Sector boundary, slightly brighter/thicker
    ctx.strokeStyle = COLORS.scope;
    ctx.lineWidth = LINES.ring * 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, airspace.sector_radius_nm * ppn, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawRunways(ctx: CanvasRenderingContext2D, airspace: Airspace): void {
    const seenPair = new Set<string>();
    for (const rwy of airspace.runways) {
      const pairKey = [rwy.id, rwy.opposite].sort().join("/");
      if (seenPair.has(pairKey)) continue;
      seenPair.add(pairKey);

      const opp = airspace.runways.find((r) => r.id === rwy.opposite);
      if (!opp) continue;

      // Solid runway line
      ctx.strokeStyle = COLORS.scope;
      ctx.lineWidth = LINES.runway;
      const a = this.projection.toScreen(rwy.threshold);
      const b = this.projection.toScreen(opp.threshold);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // Dashed extended centerline (final approach course) for each end with ILS
      if (rwy.ils) this.drawIlsCenterline(ctx, rwy);
      if (opp.ils) this.drawIlsCenterline(ctx, opp);
    }
  }

  private drawIlsCenterline(ctx: CanvasRenderingContext2D, rwy: Runway): void {
    if (!rwy.ils) return;
    ctx.save();
    ctx.strokeStyle = COLORS.scopeDim;
    ctx.lineWidth = LINES.centerline;
    ctx.setLineDash([4, 3]);
    // Outbound vector points away from the threshold along the OPPOSITE
    // of the inbound ILS course.
    const courseRad = degToRad(rwy.ils.course_deg);
    const ox = -Math.sin(courseRad);
    const oy = -Math.cos(courseRad);
    const endNm = {
      x: rwy.threshold.x + ox * ILS_CENTERLINE_LENGTH_NM,
      y: rwy.threshold.y + oy * ILS_CENTERLINE_LENGTH_NM,
    };
    const a = this.projection.toScreen(rwy.threshold);
    const b = this.projection.toScreen(endNm);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  private drawFixes(ctx: CanvasRenderingContext2D, airspace: Airspace): void {
    ctx.strokeStyle = COLORS.scope;
    ctx.fillStyle = COLORS.scope;
    ctx.lineWidth = LINES.fix;
    ctx.font = FONTS.scope;
    for (const fix of [...airspace.entry_fixes, ...airspace.exit_fixes]) {
      const p = this.projection.toScreen(fix.position_nm);
      // Triangle pointing up (small, ~8 px tall)
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 5);
      ctx.lineTo(p.x - 4, p.y + 3);
      ctx.lineTo(p.x + 4, p.y + 3);
      ctx.closePath();
      ctx.stroke();
      ctx.fillText(fix.name, p.x + 7, p.y + 4);
    }
  }
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass.

- [ ] **Step 3: Commit**

```
git add src/render/Scope.ts
git commit -m "Add Scope class rendering background, rings, runways, and fixes"
```

- [ ] **Step 4: Push branch and open PR**

```
git push -u origin feat/render-foundation
gh pr create --title "Add render foundation: theme, projection, layout, static scope" --body "Implements Plan 2 / Branch 1. Adds:
- src/render/theme.ts: STARS color/font/line constants
- src/render/projection.ts: Projection class for nm↔pixel conversion (resizable, with tests)
- index.html + src/styles.css: full layout shell (top HUD, canvas, sidebar, bottom command line)
- src/render/Scope.ts: Scope class rendering background, range rings, sector boundary, runways with ILS centerlines, and entry/exit fixes

No aircraft rendering yet — that's Branch 2. Visual smoke check is deferred to Task 16."
```

---

## Task 5: Render aircraft blip + datablock

**Files:**
- Modify: `src/render/Scope.ts`

**Branch:** `feat/render-aircraft`

- [ ] **Step 1: Branch fresh**

```
git checkout main && git pull
git checkout -b feat/render-aircraft
```

- [ ] **Step 2: Add aircraft rendering to `Scope`**

In `src/render/Scope.ts`, add an additional import:

```ts
import type { Aircraft } from "../sim/types";
```

Inside the `render` method, after `this.drawFixes(...)`, add:

```ts
    this.drawAircraft(ctx, world.aircraft, _selectedId);
```

Add the new private method on the class:

```ts
  private drawAircraft(
    ctx: CanvasRenderingContext2D,
    aircraft: Aircraft[],
    selectedId: string | null,
  ): void {
    ctx.font = FONTS.scope;
    for (const ac of aircraft) {
      const p = this.projection.toScreen(ac.position_nm);
      const isSelected = ac.id === selectedId;
      const isCleared = ac.state === "cleared_approach";
      const color = isSelected || isCleared ? COLORS.scopeBright : COLORS.scope;

      // Blip: 4x4 px square, centered on the position.
      ctx.fillStyle = color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);

      // Datablock: callsign on line 1; "<altitude_hundreds> <speed>" on line 2.
      const altHundreds = Math.round(ac.altitude_ft / 100).toString().padStart(3, "0");
      const speed = Math.round(ac.speed_kts).toString();
      const line1 = `${isCleared ? "*" : ""}${ac.callsign}`;
      const line2 = `${altHundreds} ${speed}`;

      ctx.fillStyle = color;
      const dx = 8;
      const dy = -4;
      ctx.fillText(line1, p.x + dx, p.y + dy);
      ctx.fillText(line2, p.x + dx, p.y + dy + 12);

      // Leader line from blip toward the datablock.
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x + 2, p.y);
      ctx.lineTo(p.x + dx - 1, p.y + dy - 4);
      ctx.stroke();
    }
  }
```

Rename the unused parameter from `_selectedId` to `selectedId` in the `render` method signature (it's now used).

- [ ] **Step 3: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: passes.

- [ ] **Step 4: Commit**

```
git add src/render/Scope.ts
git commit -m "Render aircraft blips with STARS-style datablocks"
```

---

## Task 6: Render aircraft trails

**Files:**
- Modify: `src/render/Scope.ts`

**Branch:** `feat/render-aircraft` (continue)

Trails are sampled positions over the last 30 seconds. The Scope owns the trail history because it's pure presentation state. Sample once per second of sim time per aircraft.

- [ ] **Step 1: Add trail tracking to `Scope`**

In `src/render/Scope.ts`, add another import:

```ts
import type { Point2D } from "../sim/types";
```

Add a private field on the `Scope` class:

```ts
  private trails = new Map<string, Array<{ pos: Point2D; t: number }>>();
```

Add constants near the existing `RANGE_RING_INTERVAL_NM`:

```ts
const TRAIL_SAMPLE_INTERVAL_S = 1;
const TRAIL_MAX_AGE_S = 30;
```

In the `render` method, between `drawFixes` and `drawAircraft`, add:

```ts
    this.updateTrails(world.elapsed_sec, world.aircraft);
    this.drawTrails(ctx);
```

Add the two new private methods on the class:

```ts
  private updateTrails(elapsedSec: number, aircraft: Aircraft[]): void {
    const liveIds = new Set<string>();
    for (const ac of aircraft) {
      liveIds.add(ac.id);
      let trail = this.trails.get(ac.id);
      if (!trail) {
        trail = [];
        this.trails.set(ac.id, trail);
      }
      const last = trail[trail.length - 1];
      if (!last || elapsedSec - last.t >= TRAIL_SAMPLE_INTERVAL_S) {
        trail.push({ pos: { ...ac.position_nm }, t: elapsedSec });
      }
      while (trail.length > 0 && elapsedSec - trail[0]!.t > TRAIL_MAX_AGE_S) {
        trail.shift();
      }
    }
    // Drop trails for aircraft no longer present.
    for (const id of [...this.trails.keys()]) {
      if (!liveIds.has(id)) this.trails.delete(id);
    }
  }

  private drawTrails(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.scope;
    for (const trail of this.trails.values()) {
      // Newest sample is at the end; oldest at the start.
      const n = trail.length;
      for (let i = 0; i < n; i++) {
        const { pos } = trail[i]!;
        const age = (n - 1 - i) / Math.max(1, n - 1);   // 0 = newest, 1 = oldest
        const alpha = 1 - age;
        ctx.globalAlpha = Math.max(0.05, alpha * 0.6);
        const sp = this.projection.toScreen(pos);
        ctx.fillRect(sp.x - 0.5, sp.y - 0.5, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: passes.

- [ ] **Step 3: Commit**

```
git add src/render/Scope.ts
git commit -m "Render fading 30-second trails behind each aircraft"
```

---

## Task 7: Selection halo, target-heading vector, conflict indicator

**Files:**
- Modify: `src/render/Scope.ts`

**Branch:** `feat/render-aircraft` (final task on this branch)

- [ ] **Step 1: Add selection cues and conflict rendering**

In `src/render/Scope.ts`, add the import:

```ts
import { findConflicts } from "../sim/conflicts";
```

In the `render` method, after `this.drawAircraft(...)`, add:

```ts
    this.drawConflicts(ctx, world.aircraft);
```

Modify `drawAircraft` to draw the selection halo and target-heading vector inside the per-aircraft loop. Replace the body of `drawAircraft` with:

```ts
  private drawAircraft(
    ctx: CanvasRenderingContext2D,
    aircraft: Aircraft[],
    selectedId: string | null,
  ): void {
    ctx.font = FONTS.scope;
    for (const ac of aircraft) {
      const p = this.projection.toScreen(ac.position_nm);
      const isSelected = ac.id === selectedId;
      const isCleared = ac.state === "cleared_approach";
      const color = isSelected || isCleared ? COLORS.scopeBright : COLORS.scope;

      // Selection halo
      if (isSelected) {
        ctx.strokeStyle = COLORS.scopeBright;
        ctx.lineWidth = LINES.selectionHalo;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Blip
      ctx.fillStyle = color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);

      // Target-heading vector when selected
      if (isSelected && ac.target_heading != null) {
        ctx.save();
        ctx.strokeStyle = COLORS.scopeBright;
        ctx.lineWidth = LINES.targetVector;
        ctx.setLineDash([3, 2]);
        const rad = degToRad(ac.target_heading);
        const dx = Math.sin(rad);
        const dy = -Math.cos(rad);   // y flipped: north = -y on screen
        const len = 40;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + dx * len, p.y + dy * len);
        ctx.stroke();
        ctx.restore();
      }

      // Datablock
      const altHundreds = Math.round(ac.altitude_ft / 100).toString().padStart(3, "0");
      const speed = Math.round(ac.speed_kts).toString();
      const line1 = `${isCleared ? "*" : ""}${ac.callsign}`;
      const line2 = `${altHundreds} ${speed}`;

      ctx.fillStyle = color;
      const dx = 8;
      const dy = -4;
      ctx.fillText(line1, p.x + dx, p.y + dy);
      ctx.fillText(line2, p.x + dx, p.y + dy + 12);

      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x + 2, p.y);
      ctx.lineTo(p.x + dx - 1, p.y + dy - 4);
      ctx.stroke();
    }
  }
```

Add the new conflict-drawing method on the class:

```ts
  private drawConflicts(ctx: CanvasRenderingContext2D, aircraft: Aircraft[]): void {
    const pairs = findConflicts(aircraft);
    if (pairs.length === 0) return;
    const byId = new Map<string, Aircraft>();
    for (const ac of aircraft) byId.set(ac.id, ac);

    // Flash on/off at 2 Hz based on render time.
    const flash = Math.floor(performance.now() / 250) % 2 === 0;
    if (!flash) return;

    ctx.strokeStyle = COLORS.conflict;
    ctx.lineWidth = LINES.conflict;
    for (const [a, b] of pairs) {
      const acA = byId.get(a);
      const acB = byId.get(b);
      if (!acA || !acB) continue;
      const pA = this.projection.toScreen(acA.position_nm);
      const pB = this.projection.toScreen(acB.position_nm);
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    }
  }
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: passes.

- [ ] **Step 3: Commit**

```
git add src/render/Scope.ts
git commit -m "Draw selection halo, target-heading vector, and conflict indicator"
```

- [ ] **Step 4: Push branch and open PR**

```
git push -u origin feat/render-aircraft
gh pr create --title "Render aircraft blips, datablocks, trails, selection, and conflicts" --body "Implements Plan 2 / Branch 2. Extends Scope to render:
- Aircraft blips (4×4 px) with two-line STARS datablocks (callsign / altitude×100 / speed) and leader line
- 30-second fading trails sampled at 1 Hz
- Selection halo, target-heading vector for selected aircraft
- Flashing conflict line between offending pairs (2 Hz)

3 commits."
```

---

## Task 8: Aircraft strip panel

**Files:**
- Create: `src/render/Strips.ts`

**Branch:** `feat/render-strips-hud`

The strip panel is a right-side scrollable list of all aircraft, sorted by distance from the airport. Click a strip to select that aircraft. Re-rendered every frame; cheap because the list is small (< 20 elements).

- [ ] **Step 1: Branch fresh**

```
git checkout main && git pull
git checkout -b feat/render-strips-hud
```

- [ ] **Step 2: Write `src/render/Strips.ts`**

```ts
import type { World } from "../sim/World";
import type { Aircraft } from "../sim/types";
import { distanceNm } from "../sim/math";
import { findConflicts } from "../sim/conflicts";

export type SelectHandler = (aircraftId: string | null) => void;

export class Strips {
  constructor(
    private container: HTMLElement,
    private onSelect: SelectHandler,
  ) {
    container.addEventListener("click", (e) => this.handleClick(e));
  }

  render(world: World, selectedId: string | null): void {
    const sorted = [...world.aircraft].sort(
      (a, b) =>
        distanceNm(a.position_nm, { x: 0, y: 0 }) -
        distanceNm(b.position_nm, { x: 0, y: 0 }),
    );
    const conflictIds = new Set<string>();
    for (const [a, b] of findConflicts(world.aircraft)) {
      conflictIds.add(a);
      conflictIds.add(b);
    }
    this.container.replaceChildren();
    for (const ac of sorted) {
      this.container.appendChild(this.buildStrip(ac, selectedId, conflictIds));
    }
  }

  private buildStrip(
    ac: Aircraft,
    selectedId: string | null,
    conflictIds: Set<string>,
  ): HTMLElement {
    const el = document.createElement("div");
    el.className = "strip";
    el.dataset.aircraftId = ac.id;
    if (ac.id === selectedId) el.classList.add("selected");
    if (conflictIds.has(ac.id)) el.classList.add("conflict");
    if (ac.state === "cleared_approach") el.classList.add("cleared");

    const altHundreds = Math.round(ac.altitude_ft / 100).toString().padStart(3, "0");
    const speed = Math.round(ac.speed_kts).toString().padStart(3, " ");
    const hdg = Math.round(ac.heading_deg).toString().padStart(3, "0");
    const tag = ac.kind === "arrival" ? "A" : "D";
    const cleared = ac.cleared_runway ? `*${ac.cleared_runway}` : "  ";
    el.textContent = `${tag} ${ac.callsign.padEnd(7)} ${altHundreds} ${speed} ${hdg} ${cleared}`;
    return el;
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const stripEl = target.closest<HTMLElement>(".strip");
    if (!stripEl) return;
    const id = stripEl.dataset.aircraftId;
    if (!id) return;
    this.onSelect(id);
  }
}
```

- [ ] **Step 3: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: passes.

- [ ] **Step 4: Commit**

```
git add src/render/Strips.ts
git commit -m "Add Strips panel with click-to-select and conflict highlighting"
```

---

## Task 9: HUD top + bottom bars

**Files:**
- Create: `src/render/Hud.ts`

**Branch:** `feat/render-strips-hud` (final task on this branch)

The HUD reads from `World` and `AppState` (introduced in Task 10) and updates a fixed set of DOM elements. To keep this task self-contained, the HUD takes the response state as a parameter rather than depending on `AppState` directly — Task 16 wires it together.

- [ ] **Step 1: Write `src/render/Hud.ts`**

```ts
import type { World } from "../sim/World";

export interface HudElements {
  clock: HTMLElement;
  selected: HTMLElement;
  score: HTMLElement;
  conflicts: HTMLElement;
  status: HTMLElement;
  response: HTMLElement;
}

export interface HudResponseState {
  text: string;
  isError: boolean;
  // Wall-clock timestamp (ms) used to fade the message after RESPONSE_TTL_MS.
  shownAt_ms: number;
}

const RESPONSE_TTL_MS = 3000;

export class Hud {
  constructor(private elements: HudElements) {}

  render(
    world: World,
    selectedCallsign: string | null,
    response: HudResponseState | null,
  ): void {
    this.elements.clock.textContent = formatClock(world.elapsed_sec);
    this.elements.selected.textContent = selectedCallsign ?? "--";
    this.elements.score.textContent = world.session.score.toString();
    this.elements.conflicts.textContent = world.session.conflicts_raised.toString();
    this.elements.status.textContent =
      world.session.status === "ended"
        ? `ENDED (${world.session.end_reason ?? "unknown"})`
        : "running";
    this.renderResponse(response);
  }

  private renderResponse(response: HudResponseState | null): void {
    const el = this.elements.response;
    if (!response) {
      el.textContent = "";
      el.classList.remove("error");
      return;
    }
    const age = Date.now() - response.shownAt_ms;
    if (age > RESPONSE_TTL_MS) {
      el.textContent = "";
      el.classList.remove("error");
      return;
    }
    el.textContent = response.text;
    el.classList.toggle("error", response.isError);
  }
}

function formatClock(elapsedSec: number): string {
  const total = Math.max(0, Math.floor(elapsedSec));
  const mm = Math.floor(total / 60).toString().padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: passes.

- [ ] **Step 3: Commit**

```
git add src/render/Hud.ts
git commit -m "Add Hud bars (clock, selected, score, conflicts, status, response)"
```

- [ ] **Step 4: Push branch and open PR**

```
git push -u origin feat/render-strips-hud
gh pr create --title "Add Strips panel and HUD bars" --body "Implements Plan 2 / Branch 3. Adds:
- src/render/Strips.ts: right-panel aircraft list, sorted by distance, click-to-select, conflict highlighting
- src/render/Hud.ts: top-bar (clock, selected callsign, score, conflicts, status) and bottom-bar response with 3-second TTL

2 commits."
```

---

## Task 10: AppState shared object

**Files:**
- Create: `src/app/state.ts`

**Branch:** `feat/input-keyboard`

AppState is a tiny mutable object shared between input (which writes) and render (which reads). No subscription mechanism — render runs every frame so it always sees current values.

- [ ] **Step 1: Branch fresh**

```
git checkout main && git pull
git checkout -b feat/input-keyboard
```

- [ ] **Step 2: Write `src/app/state.ts`**

```ts
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
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 4: Commit**

```
git add src/app/state.ts
git commit -m "Add AppState shared between input and render"
```

---

## Task 11: Command-line input handler

**Files:**
- Create: `src/input/keyboard.ts`
- Create: `tests/input/keyboard.test.ts`

**Branch:** `feat/input-keyboard` (continue)

This handler owns the `<input id="cmd-input">` element. It maintains command history and tab-completes callsigns. The actual parsing/execution happens in `commandPipeline` (Task 15) — `keyboard.ts` just collects input and invokes a `submit` callback.

We unit-test the pure logic (history navigation, tab completion). DOM wiring is validated by play.

- [ ] **Step 1: Write the failing test**

Create `tests/input/keyboard.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { CommandLineController, completeCallsign, navigateHistory } from "../../src/input/keyboard";

describe("completeCallsign", () => {
  it("returns the unique match for a prefix", () => {
    const candidates = ["DAL891", "DAL142", "UAL237"];
    expect(completeCallsign("U", candidates)).toBe("UAL237");
  });
  it("returns the longest common prefix when multiple match", () => {
    const candidates = ["DAL891", "DAL142", "UAL237"];
    expect(completeCallsign("DA", candidates)).toBe("DAL");
  });
  it("returns null when no candidate matches", () => {
    expect(completeCallsign("XYZ", ["DAL891"])).toBeNull();
  });
  it("is case-insensitive", () => {
    expect(completeCallsign("dal8", ["DAL891"])).toBe("DAL891");
  });
});

describe("navigateHistory", () => {
  it("Up steps backward (toward older)", () => {
    const history = ["a", "b", "c"];
    expect(navigateHistory(history, null, "up")).toEqual({ value: "c", index: 2 });
    expect(navigateHistory(history, 2, "up")).toEqual({ value: "b", index: 1 });
    expect(navigateHistory(history, 0, "up")).toEqual({ value: "a", index: 0 });
  });
  it("Down steps forward (toward newer); past end clears the input", () => {
    const history = ["a", "b", "c"];
    expect(navigateHistory(history, 0, "down")).toEqual({ value: "b", index: 1 });
    expect(navigateHistory(history, 2, "down")).toEqual({ value: "", index: null });
  });
  it("returns same when history empty", () => {
    expect(navigateHistory([], null, "up")).toEqual({ value: "", index: null });
  });
});

describe("CommandLineController", () => {
  function setup() {
    document.body.innerHTML = `<input id="cmd-input" />`;
    const input = document.getElementById("cmd-input") as HTMLInputElement;
    const submit = vi.fn();
    const ctrl = new CommandLineController(input, {
      onSubmit: submit,
      callsigns: () => ["DAL891", "UAL237"],
    });
    return { input, submit, ctrl };
  }

  it("invokes onSubmit with trimmed text on Enter", () => {
    const { input, submit } = setup();
    input.value = "  DAL891 H 240  ";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(submit).toHaveBeenCalledWith("DAL891 H 240");
    expect(input.value).toBe("");
  });

  it("clears the input on Escape and does not submit", () => {
    const { input, submit } = setup();
    input.value = "DAL891 H 240";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(input.value).toBe("");
    expect(submit).not.toHaveBeenCalled();
  });

  it("Tab completes the leading callsign token", () => {
    const { input } = setup();
    input.value = "U";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }));
    expect(input.value).toBe("UAL237 ");
  });

  it("Up arrow recalls the most recent submitted command", () => {
    const { input } = setup();
    input.value = "DAL891 H 240";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    input.value = "UAL237 A 80";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect(input.value).toBe("UAL237 A 80");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect(input.value).toBe("DAL891 H 240");
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test`
Expected: compile error, `src/input/keyboard.ts` does not exist.

- [ ] **Step 3: Implement `src/input/keyboard.ts`**

```ts
export interface CommandLineOptions {
  onSubmit: (text: string) => void;
  // Returns the current set of valid callsigns for tab-completion.
  callsigns: () => string[];
}

export function completeCallsign(prefix: string, candidates: string[]): string | null {
  const upper = prefix.toUpperCase();
  const matches = candidates.filter((c) => c.toUpperCase().startsWith(upper));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;
  // Longest common prefix among matches
  let lcp = matches[0]!;
  for (let i = 1; i < matches.length; i++) {
    let j = 0;
    while (j < lcp.length && j < matches[i]!.length && lcp[j] === matches[i]![j]) {
      j++;
    }
    lcp = lcp.slice(0, j);
    if (lcp.length === 0) break;
  }
  return lcp.length >= upper.length ? lcp : null;
}

export type HistoryDirection = "up" | "down";

export interface HistoryStep {
  value: string;
  index: number | null;
}

export function navigateHistory(
  history: string[],
  current: number | null,
  dir: HistoryDirection,
): HistoryStep {
  if (history.length === 0) return { value: "", index: null };
  if (dir === "up") {
    const next = current === null ? history.length - 1 : Math.max(0, current - 1);
    return { value: history[next]!, index: next };
  }
  // down
  if (current === null) return { value: "", index: null };
  const next = current + 1;
  if (next >= history.length) return { value: "", index: null };
  return { value: history[next]!, index: next };
}

export class CommandLineController {
  private history: string[] = [];
  private historyIndex: number | null = null;

  constructor(
    private input: HTMLInputElement,
    private opts: CommandLineOptions,
  ) {
    input.addEventListener("keydown", (e) => this.handleKey(e));
  }

  prefill(text: string): void {
    this.input.value = text;
    this.input.focus();
    this.input.setSelectionRange(text.length, text.length);
  }

  focus(): void {
    this.input.focus();
  }

  private handleKey(e: KeyboardEvent): void {
    switch (e.key) {
      case "Enter": {
        e.preventDefault();
        const text = this.input.value.trim();
        if (text.length > 0) {
          this.history.push(text);
          this.opts.onSubmit(text);
        }
        this.input.value = "";
        this.historyIndex = null;
        return;
      }
      case "Escape": {
        e.preventDefault();
        this.input.value = "";
        this.historyIndex = null;
        return;
      }
      case "Tab": {
        e.preventDefault();
        const value = this.input.value;
        const spaceIdx = value.indexOf(" ");
        const prefix = spaceIdx === -1 ? value : value.slice(0, spaceIdx);
        const rest = spaceIdx === -1 ? "" : value.slice(spaceIdx);
        const completed = completeCallsign(prefix, this.opts.callsigns());
        if (completed) {
          this.input.value = completed + (rest.length > 0 ? rest : " ");
          this.input.setSelectionRange(this.input.value.length, this.input.value.length);
        }
        return;
      }
      case "ArrowUp": {
        e.preventDefault();
        const step = navigateHistory(this.history, this.historyIndex, "up");
        this.historyIndex = step.index;
        this.input.value = step.value;
        return;
      }
      case "ArrowDown": {
        e.preventDefault();
        const step = navigateHistory(this.history, this.historyIndex, "down");
        this.historyIndex = step.index;
        this.input.value = step.value;
        return;
      }
    }
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test`
Expected: all keyboard tests pass; existing 89 tests still pass.

- [ ] **Step 5: Commit**

```
git add src/input/keyboard.ts tests/input/keyboard.test.ts
git commit -m "Add command-line controller with history and tab-completion"
```

---

## Task 12: Hotkeys (H/A/S/L/X) for selected aircraft

**Files:**
- Modify: `src/input/keyboard.ts`
- Modify: `tests/input/keyboard.test.ts`

**Branch:** `feat/input-keyboard` (final task on this branch)

When an aircraft is selected and the player presses one of H/A/S/L/X *while the command line is empty and not focused on something else*, the controller prefills `<callsign> <verb> ` and focuses the command line.

We register a global `keydown` listener on `window` for hotkeys. To avoid hijacking typing in the input, we ignore the event when `document.activeElement` is the input itself.

- [ ] **Step 1: Add the failing test**

Append to `tests/input/keyboard.test.ts`:

```ts
import { HotkeyHandler } from "../../src/input/keyboard";

describe("HotkeyHandler", () => {
  function setup() {
    document.body.innerHTML = `<input id="cmd-input" /><div id="other"></div>`;
    const input = document.getElementById("cmd-input") as HTMLInputElement;
    let selected: { id: string; callsign: string } | null = null;
    const ctrl = new CommandLineController(input, {
      onSubmit: () => {},
      callsigns: () => [],
    });
    const hotkeys = new HotkeyHandler({
      input,
      controller: ctrl,
      getSelected: () => selected,
    });
    return {
      input,
      hotkeys,
      select(id: string, callsign: string) {
        selected = { id, callsign };
      },
      clear() {
        selected = null;
      },
    };
  }

  it("prefills the command line when H is pressed with an aircraft selected", () => {
    const t = setup();
    t.select("ac1", "DAL891");
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "h", bubbles: true }));
    expect(t.input.value).toBe("DAL891 H ");
    expect(document.activeElement).toBe(t.input);
  });

  it("supports A, S, L, X verbs", () => {
    const t = setup();
    t.select("ac1", "DAL891");
    for (const verb of ["a", "s", "l", "x"]) {
      t.input.value = "";
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: verb, bubbles: true }));
      expect(t.input.value).toBe(`DAL891 ${verb.toUpperCase()} `);
    }
  });

  it("does nothing when no aircraft is selected", () => {
    const t = setup();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "h", bubbles: true }));
    expect(t.input.value).toBe("");
  });

  it("does not hijack typing when the command line is already focused", () => {
    const t = setup();
    t.select("ac1", "DAL891");
    t.input.focus();
    t.input.value = "DAL891 H 24";
    // Simulate typing "0"
    t.input.dispatchEvent(new KeyboardEvent("keydown", { key: "0", bubbles: true }));
    expect(t.input.value).toBe("DAL891 H 24");   // Hotkey did NOT replace it
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test`
Expected: compile error — `HotkeyHandler` is not exported.

- [ ] **Step 3: Implement `HotkeyHandler` in `src/input/keyboard.ts`**

Append to `src/input/keyboard.ts`:

```ts
export type HotkeyVerb = "H" | "A" | "S" | "L" | "X";
const HOTKEY_KEYS: Record<string, HotkeyVerb> = {
  h: "H",
  a: "A",
  s: "S",
  l: "L",
  x: "X",
};

export interface HotkeyOptions {
  input: HTMLInputElement;
  controller: CommandLineController;
  getSelected: () => { id: string; callsign: string } | null;
}

export class HotkeyHandler {
  constructor(private opts: HotkeyOptions) {
    document.addEventListener("keydown", (e) => this.handleKey(e), true);
  }

  private handleKey(e: KeyboardEvent): void {
    if (document.activeElement === this.opts.input) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const verb = HOTKEY_KEYS[e.key.toLowerCase()];
    if (!verb) return;
    const selected = this.opts.getSelected();
    if (!selected) return;
    e.preventDefault();
    this.opts.controller.prefill(`${selected.callsign} ${verb} `);
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test`
Expected: hotkey tests pass; all prior tests still pass.

- [ ] **Step 5: Commit**

```
git add src/input/keyboard.ts tests/input/keyboard.test.ts
git commit -m "Add H/A/S/L/X hotkeys that prefill command line for selected aircraft"
```

- [ ] **Step 6: Push branch and open PR**

```
git push -u origin feat/input-keyboard
gh pr create --title "Add command-line input, history, tab-complete, and hotkeys" --body "Implements Plan 2 / Branch 4. Adds:
- src/app/state.ts: AppState shared between input and render layers
- src/input/keyboard.ts: CommandLineController (Enter/Esc/Tab/Up/Down) and HotkeyHandler (H/A/S/L/X prefill when aircraft selected and input not focused)

Pure logic (completeCallsign, navigateHistory) plus DOM behavior tested with jsdom. 3 commits."
```

---

## Task 13: Mouse selection

**Files:**
- Create: `src/input/mouse.ts`
- Create: `tests/input/mouse.test.ts`

**Branch:** `feat/input-mouse-pipeline`

Click on canvas → hit-test against world.aircraft → set selection (or clear it if no hit).

Hit-test: convert click point to nm via projection, then find the nearest aircraft within a hit-radius.

- [ ] **Step 1: Branch fresh**

```
git checkout main && git pull
git checkout -b feat/input-mouse-pipeline
```

- [ ] **Step 2: Write the failing test**

Create `tests/input/mouse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hitTestAircraft, HIT_RADIUS_NM } from "../../src/input/mouse";
import { createArrival } from "../../src/sim/Aircraft";

describe("hitTestAircraft", () => {
  function ac(id: string, x: number, y: number) {
    return createArrival({
      id,
      callsign: id,
      position_nm: { x, y },
      heading_deg: 0,
      altitude_ft: 5000,
      speed_kts: 200,
      spawn_time_s: 0,
    });
  }

  it("returns null when no aircraft within the hit radius", () => {
    expect(hitTestAircraft({ x: 0, y: 0 }, [ac("A", 10, 10)])).toBeNull();
  });

  it("returns the aircraft when click is within the hit radius", () => {
    const target = ac("A", 5, 5);
    expect(hitTestAircraft({ x: 5, y: 5 }, [target])).toBe(target);
  });

  it("returns the closest aircraft when multiple are in range", () => {
    const closer = ac("A", 1, 0);
    const farther = ac("B", 2, 0);
    expect(hitTestAircraft({ x: 0, y: 0 }, [closer, farther])).toBe(closer);
  });

  it("respects HIT_RADIUS_NM threshold", () => {
    const just_inside = ac("A", HIT_RADIUS_NM - 0.01, 0);
    const just_outside = ac("B", HIT_RADIUS_NM + 0.01, 0);
    expect(hitTestAircraft({ x: 0, y: 0 }, [just_inside])).toBe(just_inside);
    expect(hitTestAircraft({ x: 0, y: 0 }, [just_outside])).toBeNull();
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npm test`
Expected: compile error.

- [ ] **Step 4: Implement `src/input/mouse.ts`**

```ts
import type { Aircraft, Point2D } from "../sim/types";
import { distanceNm } from "../sim/math";
import type { Projection } from "../render/projection";
import type { World } from "../sim/World";

// Clicks within this many nautical miles of an aircraft's position select it.
export const HIT_RADIUS_NM = 1.5;

export function hitTestAircraft(click_nm: Point2D, aircraft: Aircraft[]): Aircraft | null {
  let best: Aircraft | null = null;
  let bestDist = HIT_RADIUS_NM;
  for (const ac of aircraft) {
    const d = distanceNm(click_nm, ac.position_nm);
    if (d <= bestDist) {
      best = ac;
      bestDist = d;
    }
  }
  return best;
}

export interface MouseOptions {
  canvas: HTMLCanvasElement;
  projection: Projection;
  world: () => World;
  onSelect: (aircraftId: string | null) => void;
}

export class MouseInput {
  constructor(private opts: MouseOptions) {
    opts.canvas.addEventListener("click", (e) => this.handleClick(e));
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.opts.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const nm = this.opts.projection.toWorld(screen);
    const hit = hitTestAircraft(nm, this.opts.world().aircraft);
    this.opts.onSelect(hit?.id ?? null);
  }
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test`
Expected: hit-test tests pass.

- [ ] **Step 6: Commit**

```
git add src/input/mouse.ts tests/input/mouse.test.ts
git commit -m "Add mouse hit-testing for aircraft selection"
```

---

## Task 14: Click menu

**Files:**
- Create: `src/input/clickMenu.ts`

**Branch:** `feat/input-mouse-pipeline` (continue)

When an aircraft is selected, a small floating menu appears near it with H / A / S / L / X buttons. Clicking a button prefills the command line via the existing `CommandLineController.prefill(...)` and closes the menu. Clicking elsewhere closes the menu.

The menu position is computed in screen coordinates from the aircraft's projected position. To keep this layer simple, the menu element is shown/hidden by toggling its `hidden` attribute and updating `style.left`/`style.top`.

- [ ] **Step 1: Write `src/input/clickMenu.ts`**

```ts
import type { CommandLineController, HotkeyVerb } from "./keyboard";
import type { Projection } from "../render/projection";
import type { World } from "../sim/World";
import type { Aircraft } from "../sim/types";

const VERBS: HotkeyVerb[] = ["H", "A", "S", "L", "X"];

export interface ClickMenuOptions {
  menuEl: HTMLElement;
  controller: CommandLineController;
  projection: Projection;
  world: () => World;
}

export class ClickMenu {
  constructor(private opts: ClickMenuOptions) {
    opts.menuEl.replaceChildren();
    for (const verb of VERBS) {
      const btn = document.createElement("button");
      btn.className = "click-menu-item";
      btn.textContent = verb;
      btn.dataset.verb = verb;
      btn.addEventListener("click", () => this.handleVerb(verb));
      opts.menuEl.appendChild(btn);
    }
    document.addEventListener("click", (e) => this.maybeDismiss(e));
  }

  showFor(aircraftId: string): void {
    const ac = this.opts.world().aircraft.find((a) => a.id === aircraftId);
    if (!ac) {
      this.hide();
      return;
    }
    const screen = this.opts.projection.toScreen(ac.position_nm);
    const el = this.opts.menuEl;
    el.hidden = false;
    el.style.left = `${screen.x + 12}px`;
    el.style.top = `${screen.y + 12}px`;
    el.dataset.aircraftId = aircraftId;
    el.dataset.callsign = ac.callsign;
  }

  hide(): void {
    this.opts.menuEl.hidden = true;
    delete this.opts.menuEl.dataset.aircraftId;
    delete this.opts.menuEl.dataset.callsign;
  }

  private handleVerb(verb: HotkeyVerb): void {
    const callsign = this.opts.menuEl.dataset.callsign;
    if (!callsign) return;
    this.opts.controller.prefill(`${callsign} ${verb} `);
    this.hide();
  }

  private maybeDismiss(e: MouseEvent): void {
    const el = this.opts.menuEl;
    if (el.hidden) return;
    const target = e.target as Node | null;
    if (target && el.contains(target)) return;   // click inside the menu
    // Click was outside; the controller decides whether to re-show on a new selection.
    this.hide();
  }

  // Helper for callers (Task 16): resolve a selected aircraft id back to its current Aircraft,
  // bypassing world lookups elsewhere.
  static findAircraft(world: World, id: string | null): Aircraft | null {
    if (!id) return null;
    return world.aircraft.find((a) => a.id === id) ?? null;
  }
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: passes.

- [ ] **Step 3: Commit**

```
git add src/input/clickMenu.ts
git commit -m "Add click menu with H/A/S/L/X verb buttons that prefill the command line"
```

---

## Task 15: Command pipeline

**Files:**
- Create: `src/input/commandPipeline.ts`
- Create: `tests/input/commandPipeline.test.ts`

**Branch:** `feat/input-mouse-pipeline` (final task on this branch)

The pipeline takes a raw text string from the command line, parses it via `parseCommandLine`, and either enqueues each resulting `Command` on the World or sets a response error. It also subscribes to `world.events` to surface accept/reject feedback to the HUD via `AppState.response`.

- [ ] **Step 1: Write the failing test**

Create `tests/input/commandPipeline.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { CommandPipeline } from "../../src/input/commandPipeline";
import { World } from "../../src/sim/World";
import { KDLH } from "../../src/data/airports/kdlh";
import { createArrival } from "../../src/sim/Aircraft";
import { createAppState } from "../../src/app/state";

describe("CommandPipeline", () => {
  let world: World;
  let state: ReturnType<typeof createAppState>;
  let pipeline: CommandPipeline;

  beforeEach(() => {
    world = new World(KDLH, { now_ms: 0 });
    world.aircraft.push(
      createArrival({
        id: "DAL891",
        callsign: "DAL891",
        position_nm: { x: 10, y: 0 },
        heading_deg: 270,
        altitude_ft: 8000,
        speed_kts: 250,
        spawn_time_s: 0,
      }),
    );
    state = createAppState();
    pipeline = new CommandPipeline({ world, state });
  });

  it("parses and enqueues a valid command", () => {
    pipeline.submit("DAL891 H 240");
    world.tick(0);
    const ac = world.aircraft.find((a) => a.id === "DAL891")!;
    expect(ac.target_heading).toBe(240);
  });

  it("sets an error response on parse failure", () => {
    pipeline.submit("XYZ123 H 240");
    expect(state.response).not.toBeNull();
    expect(state.response!.isError).toBe(true);
    expect(state.response!.text).toMatch(/unknown callsign/i);
  });

  it("sets a non-error response after world acknowledges the command", () => {
    pipeline.submit("DAL891 H 240");
    world.tick(0);
    expect(state.response).not.toBeNull();
    expect(state.response!.isError).toBe(false);
  });

  it("sets an error response when executor rejects (e.g. heading out of range)", () => {
    pipeline.submit("DAL891 H 360");
    world.tick(0);
    expect(state.response).not.toBeNull();
    expect(state.response!.isError).toBe(true);
    expect(state.response!.text).toMatch(/heading/i);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test`
Expected: compile error.

- [ ] **Step 3: Implement `src/input/commandPipeline.ts`**

```ts
import type { World } from "../sim/World";
import type { AppState } from "../app/state";
import type { AircraftKind } from "../sim/types";
import { parseCommandLine } from "../sim/commands/parser";

export interface CommandPipelineOptions {
  world: World;
  state: AppState;
}

function describeCommand(cmd: { kind: string; runway?: string; heading_deg?: number; altitude_ft?: number; speed_kts?: number; to?: string }): string {
  switch (cmd.kind) {
    case "assign_heading":
      return `heading ${cmd.heading_deg}`;
    case "assign_altitude":
      return `altitude ${cmd.altitude_ft}`;
    case "assign_speed":
      return `speed ${cmd.speed_kts}`;
    case "clear_approach":
      return `cleared ILS ${cmd.runway}`;
    case "handoff":
      return `handoff to ${cmd.to}`;
    default:
      return cmd.kind;
  }
}

export class CommandPipeline {
  constructor(private opts: CommandPipelineOptions) {
    opts.world.events.on((e) => this.handleEvent(e));
  }

  submit(text: string): void {
    const lookup = (cs: string): { id: string; kind: AircraftKind } | null => {
      const ac = this.opts.world.aircraft.find((a) => a.callsign === cs || a.id === cs);
      return ac ? { id: ac.id, kind: ac.kind } : null;
    };
    const result = parseCommandLine(text, lookup);
    if ("error" in result) {
      this.setResponse(result.error, true);
      return;
    }
    for (const cmd of result) {
      this.opts.world.enqueueCommand(cmd);
    }
  }

  private handleEvent(e: { kind: string }): void {
    if (e.kind === "command_accepted") {
      const cmd = (e as { command: Parameters<typeof describeCommand>[0]; aircraft_id: string }).command;
      const id = (e as { aircraft_id: string }).aircraft_id;
      const cs = this.callsignFor(id);
      this.setResponse(`${cs}, ${describeCommand(cmd)}`, false);
    } else if (e.kind === "command_rejected") {
      const reason = (e as { reason: string }).reason;
      this.setResponse(reason, true);
    } else if (e.kind === "session_ended") {
      const reason = (e as { reason: string }).reason;
      this.setResponse(`Session ended: ${reason}`, true);
    }
  }

  private callsignFor(id: string): string {
    const ac = this.opts.world.aircraft.find((a) => a.id === id);
    return ac?.callsign ?? id;
  }

  private setResponse(text: string, isError: boolean): void {
    this.opts.state.response = { text, isError, shownAt_ms: Date.now() };
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test`
Expected: pipeline tests pass; all prior tests still pass.

- [ ] **Step 5: Commit**

```
git add src/input/commandPipeline.ts tests/input/commandPipeline.test.ts
git commit -m "Add command pipeline that parses, enqueues, and surfaces responses"
```

- [ ] **Step 6: Push branch and open PR**

```
git push -u origin feat/input-mouse-pipeline
gh pr create --title "Add mouse selection, click menu, and command pipeline" --body "Implements Plan 2 / Branch 5. Adds:
- src/input/mouse.ts: hit-testing (1.5 nm radius) and canvas click → selection
- src/input/clickMenu.ts: floating H/A/S/L/X menu near selected aircraft, prefills command line on click
- src/input/commandPipeline.ts: parse → enqueue + listens to world events to surface accept/reject feedback in AppState.response

3 commits. Pure logic tested; DOM behavior validated by play."
```

---

## Task 16: Wire it all up in main.ts

**Files:**
- Modify: `src/app/main.ts`

**Branch:** `feat/integrate-game`

This task replaces the headless `main.ts` with the full integration: build World, AppState, Projection, Scope, Strips, Hud, CommandLineController, HotkeyHandler, MouseInput, ClickMenu, CommandPipeline. Each render frame, draw the scope and update the HUD/strips. AppState updates from input flow into the next frame's render.

After this commits, `npm run dev` shows a fully playable browser game.

- [ ] **Step 1: Branch fresh**

```
git checkout main && git pull
git checkout -b feat/integrate-game
```

- [ ] **Step 2: Replace `src/app/main.ts`**

```ts
import { World } from "../sim/World";
import { KDLH } from "../data/airports/kdlh";
import { startLoop } from "./loop";
import { createAppState } from "./state";
import { Projection } from "../render/projection";
import { Scope } from "../render/Scope";
import { Strips } from "../render/Strips";
import { Hud } from "../render/Hud";
import { CommandLineController, HotkeyHandler } from "../input/keyboard";
import { MouseInput } from "../input/mouse";
import { ClickMenu } from "../input/clickMenu";
import { CommandPipeline } from "../input/commandPipeline";

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

const canvas = getElement<HTMLCanvasElement>("scope");
const stripsEl = getElement("strips");
const cmdInput = getElement<HTMLInputElement>("cmd-input");
const menuEl = getElement("click-menu");
const hudClock = getElement("hud-clock");
const hudSelected = getElement("hud-selected");
const hudScore = getElement("hud-score");
const hudConflicts = getElement("hud-conflicts");
const hudStatus = getElement("hud-status");
const hudResponse = getElement("hud-response");

const world = new World(KDLH, { now_ms: Date.now() });
world.startTraffic({
  initialIntervalSec: 60,
  minIntervalSec: 30,
  rampDurationSec: 600,
});

const appState = createAppState();
const projection = new Projection(canvas.clientWidth, canvas.clientHeight, KDLH.sector_radius_nm);
const scope = new Scope(canvas, projection);
const strips = new Strips(stripsEl, (id) => {
  appState.selectedAircraftId = id;
  if (id) clickMenu.showFor(id);
  else clickMenu.hide();
});
const hud = new Hud({
  clock: hudClock,
  selected: hudSelected,
  score: hudScore,
  conflicts: hudConflicts,
  status: hudStatus,
  response: hudResponse,
});

const pipeline = new CommandPipeline({ world, state: appState });

const cmdController = new CommandLineController(cmdInput, {
  onSubmit: (text) => pipeline.submit(text),
  callsigns: () => world.aircraft.map((a) => a.callsign),
});

const clickMenu = new ClickMenu({
  menuEl,
  controller: cmdController,
  projection,
  world: () => world,
});

new HotkeyHandler({
  input: cmdInput,
  controller: cmdController,
  getSelected: () => {
    const id = appState.selectedAircraftId;
    if (!id) return null;
    const ac = world.aircraft.find((a) => a.id === id);
    return ac ? { id: ac.id, callsign: ac.callsign } : null;
  },
});

new MouseInput({
  canvas,
  projection,
  world: () => world,
  onSelect: (id) => {
    appState.selectedAircraftId = id;
    if (id) clickMenu.showFor(id);
    else clickMenu.hide();
  },
});

window.addEventListener("resize", () => {
  projection.resize(canvas.clientWidth, canvas.clientHeight);
});

startLoop({
  hz: 30,
  onTick: (dt) => world.tick(dt),
  onFrame: () => {
    scope.render(world, appState.selectedAircraftId);
    strips.render(world, appState.selectedAircraftId);
    const selectedAc = appState.selectedAircraftId
      ? world.aircraft.find((a) => a.id === appState.selectedAircraftId) ?? null
      : null;
    hud.render(world, selectedAc?.callsign ?? null, appState.response);
  },
});

(window as unknown as { world: World; appState: typeof appState }).world = world;
(window as unknown as { world: World; appState: typeof appState }).appState = appState;
```

- [ ] **Step 3: Verify all checks**

```
npm run typecheck
npm run lint
npm test
npm run build
```

All four must pass cleanly.

- [ ] **Step 4: Visual smoke test**

Run `npm run dev` (background) and open `http://localhost:5173`. Confirm:

1. The scope shows a black background with green range rings, the sector boundary, the KDLH 09/27 runway with two dashed ILS centerlines extending outbound, and triangles labeled OBELE / GIVKE / DULUH at the entry/exit fixes.
2. The top HUD shows clock advancing (00:00 → 00:01 → ...), `--` for selected, score 0, conflicts 0, status "running".
3. After ~60 seconds the first arrival spawns at OBELE or GIVKE. A blip + datablock appears, and a strip is added to the right panel.
4. Click the aircraft on the scope → it highlights, datablock brightens, the click menu appears near it with H/A/S/L/X buttons. The strip on the right panel is highlighted. The HUD top-bar shows the callsign.
5. Click `H` in the click menu → the command line is prefilled with `<callsign> H ` and focused. Type `240` and press Enter → the response line shows "<callsign>, heading 240" briefly. The aircraft starts turning toward 240°. After several seconds the heading visibly changes; the target-heading vector points at 240°.
6. Type a bogus command like `BADCS H 100` → the response line shows the parser error in red.
7. Press Esc with no aircraft selected → command line clears.
8. With an aircraft selected, press `A` (lowercase a) on the keyboard → command line prefills `<callsign> A ` and gets focus.
9. After typing several commands, press Up arrow to see history.

If any of the above fail, fix the underlying issue rather than ignoring it.

Stop the dev server.

- [ ] **Step 5: Commit**

```
git add src/app/main.ts
git commit -m "Wire sim, render, and input into a fully playable browser game"
```

- [ ] **Step 6: Push branch and open PR**

```
git push -u origin feat/integrate-game
gh pr create --title "Wire sim + render + input into playable game" --body "Implements Plan 2 / Branch 6. Replaces the headless main.ts with the full integration:
- World + KDLH airspace + traffic ramp
- AppState (selected, response)
- Projection + Scope + Strips + Hud
- CommandLineController (history, tab-complete) + HotkeyHandler (H/A/S/L/X)
- MouseInput (hit-testing) + ClickMenu (floating verb buttons)
- CommandPipeline (parse + enqueue + accept/reject feedback)

After merge, Plan 2 is complete and the game is playable. Plan 3 adds audio, persistence, and deployment.

Visual smoke test passed (see PR template / Task 16 step 4 in the plan)."
```

---

## Plan 2 Done — what next?

After all PRs above are merged, the repo is at:
- A fully playable browser game.
- ~120+ unit tests (Plan 1's 89 + render/input additions).
- Static-site build still produces ~15 kB gzipped.
- `npm run dev` is the canonical "play it" command.

**Plan 3** picks up with audio (SFX + TTS readbacks), persistence (settings + high scores in localStorage), end-of-session flow, GitHub Actions deploy workflow, and GitHub Pages publish.

---

## Self-Review Checklist (run before handoff)

- ✅ **Spec coverage:** every spec § 6 (Input) and § 7 (Render) requirement maps to a task above. Audio (§ 8), persistence (§ 9), deployment (§ 12) are explicitly Plan 3.
- ✅ **Placeholder scan:** no "TBD", "TODO", "implement later". All code blocks are complete.
- ✅ **Type consistency:** `AppState`, `HudResponseState`, `Projection.toScreen/toWorld`, `CommandLineController.prefill`, `HotkeyVerb`, `HitTest` types are defined once and used identically across tasks.
- ✅ **Branch strategy:** 6 branches, each producing a coherent visible result. PR text included.
- ✅ **TDD where applicable:** projection math, callsign completion, history navigation, hit-testing, command pipeline all have failing-test-first steps. Pure-canvas drawing is validated by play (Task 16 step 4 lists the explicit smoke checks).
- ⚠️ **One known limitation:** trail rendering relies on `world.elapsed_sec` advancing monotonically. If World ever resets without a fresh Scope instance, trails would persist incorrectly. Not a bug today; flag if Plan 3 introduces session restart.
