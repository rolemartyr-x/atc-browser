# atc-browser MVP — Plan 1: Scaffold + Headless Simulation Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vite/TypeScript/Vitest project skeleton and a fully unit-tested headless simulation core. By the end of this plan, `World.tick(dt)` correctly advances aircraft physics, applies commands, detects conflicts, spawns traffic, runs ILS auto-fly, and emits events — all without any browser, Canvas, audio, or input dependencies.

**Architecture:** Pure simulation core in `src/sim/` with no I/O. Adapter layers (render, input, audio) come in Plan 2 and Plan 3. See spec § 4 for the architecture contract this plan implements.

**Tech Stack:** Node 20 LTS, TypeScript (strict), Vite, Vitest, ESLint, Prettier. Target output: ES2022 / ESM.

**Spec reference:** `docs/superpowers/specs/2026-05-04-atc-browser-design.md`

---

## File Structure

Files this plan creates (in dependency order):

```
package.json                              # npm config + scripts
.nvmrc                                    # Node version pin
tsconfig.json                             # TS strict config
vite.config.ts                            # Vite dev/build config
vitest.config.ts                          # Vitest config
.eslintrc.cjs                             # ESLint config
.prettierrc.json                          # Prettier config
.editorconfig                             # Editor settings
README.md                                 # Project intro
.github/workflows/ci.yml                  # GitHub Actions: typecheck + test on PR
index.html                                # Vite entry HTML
src/styles.css                            # Empty CSS placeholder
src/app/main.ts                           # Entry point — bootstraps World (headless for now)
src/app/loop.ts                           # Fixed-step sim loop
src/sim/types.ts                          # Shared domain types (Aircraft, Airspace, Command, Event, Session)
src/sim/math.ts                           # heading/distance/bearing utilities
src/sim/physics.ts                        # turn/altitude/speed/position integration
src/sim/conflicts.ts                      # separation detection
src/sim/events.ts                         # EventBus
src/sim/commands/parser.ts                # typed command-line parser
src/sim/commands/executor.ts              # apply Command to World
src/sim/approach.ts                       # ILS establishment + auto-fly
src/sim/traffic.ts                        # spawn schedule + entry-fix randomizer
src/sim/Aircraft.ts                       # Aircraft factory helpers
src/sim/World.ts                          # World class + tick orchestration
src/data/airports/kdlh.ts                 # KDLH airspace data
tests/sim/math.test.ts
tests/sim/physics.test.ts
tests/sim/conflicts.test.ts
tests/sim/events.test.ts
tests/sim/commands/parser.test.ts
tests/sim/commands/executor.test.ts
tests/sim/approach.test.ts
tests/sim/traffic.test.ts
tests/sim/world.test.ts
tests/sim/scenarios.test.ts
```

## Branch / PR Strategy

Per the user's global CLAUDE.md, every code task uses a feature branch off `main`. To avoid 24 branches per plan, group tasks into logical PR-sized chunks. Open one PR per branch; commit at logical milestones inside the branch.

| Branch | Tasks | Outcome |
|---|---|---|
| `feat/scaffold` | T1 → T6 | Empty Vite/TS/Vitest project with passing CI |
| `feat/sim-domain` | T7 | Shared domain types compiled |
| `feat/sim-math-physics` | T8 → T12 | Math + physics integrators tested |
| `feat/sim-conflicts-events` | T13 → T14 | Separation + event bus tested |
| `feat/sim-commands` | T15 → T17 | Parser + executor tested |
| `feat/sim-traffic-airspace` | T18 → T19 | Traffic generator + KDLH data |
| `feat/sim-approach` | T20 | ILS establishment + auto-fly |
| `feat/sim-world` | T21 → T23 | World class + scenarios + headless bootstrap |

`git push` and `gh pr create` are approval-gated; implementers MUST pause before pushing.

---

## Task 1: Initialize npm package and install dependencies

**Files:**
- Create: `package.json`
- Create: `.nvmrc`

**Branch:** `feat/scaffold`

- [ ] **Step 1: Create the feature branch**

```
git checkout -b feat/scaffold
```

- [ ] **Step 2: Pin Node version**

Create `.nvmrc`:

```
20
```

- [ ] **Step 3: Initialize package.json**

Run: `npm init -y`

Then overwrite `package.json` with:

```json
{
  "name": "atc-browser",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "Browser-based approach control radar simulator",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"**/*.{ts,tsx,css,html,json,md}\""
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 4: Install dev dependencies**

Run:

```
npm install --save-dev typescript@^5.5 vite@^5.4 vitest@^2.1 @vitest/coverage-v8@^2.1 @types/node@^20 eslint@^9 @typescript-eslint/parser@^8 @typescript-eslint/eslint-plugin@^8 prettier@^3.3 eslint-config-prettier@^9
```

Expected: install completes without errors. `node_modules/` and `package-lock.json` created.

- [ ] **Step 5: Verify**

Run: `npm run typecheck`
Expected: error about missing `tsconfig.json` (we add it next) — proves npm scripts wire up correctly.

- [ ] **Step 6: Commit**

```
git add package.json package-lock.json .nvmrc
git commit -m "Add npm scaffold with Vite/Vitest/TypeScript dependencies"
```

---

## Task 2: TypeScript configuration

**Files:**
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`

**Branch:** `feat/scaffold` (continue)

- [ ] **Step 1: Write tsconfig.json**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true,
    "useDefineForClassFields": true,
    "allowImportingTsExtensions": false,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": false
  },
  "include": ["src/**/*", "tests/**/*"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 2: Write tsconfig.node.json**

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: passes with no output (no source files yet, but TS config is valid).

- [ ] **Step 4: Commit**

```
git add tsconfig.json tsconfig.node.json
git commit -m "Add strict TypeScript configuration"
```

---

## Task 3: Vite + Vitest configuration

**Files:**
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/styles.css`
- Create: `src/app/main.ts`

**Branch:** `feat/scaffold` (continue)

- [ ] **Step 1: Write vite.config.ts**

Create `vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { port: 5173, strictPort: true },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
  },
});
```

- [ ] **Step 2: Write vitest.config.ts**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/sim/**/*.ts", "src/data/**/*.ts"],
      exclude: ["src/sim/types.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

- [ ] **Step 3: Write index.html**

Create `index.html`:

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
    <div id="app"></div>
    <script type="module" src="/src/app/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Write src/styles.css**

Create `src/styles.css`:

```css
:root {
  background: #000;
  color: #4ade80;
  font-family: "Cascadia Mono", "Consolas", monospace;
}
body { margin: 0; }
```

- [ ] **Step 5: Write src/app/main.ts placeholder**

Create `src/app/main.ts`:

```ts
const root = document.getElementById("app");
if (root) root.textContent = "atc-browser — sim core (headless bootstrap pending)";
```

- [ ] **Step 6: Verify dev server**

Run: `npm run dev`
Expected: Vite starts and prints `Local: http://localhost:5173`. Open it; the page shows the placeholder text. Stop with Ctrl+C.

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: build succeeds; `dist/` is created with `index.html` + bundled JS + sourcemap.

- [ ] **Step 8: Commit**

```
git add vite.config.ts vitest.config.ts index.html src/styles.css src/app/main.ts
git commit -m "Add Vite/Vitest config and placeholder entry point"
```

---

## Task 4: ESLint, Prettier, EditorConfig

**Files:**
- Create: `.eslintrc.cjs`
- Create: `.eslintignore`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `.editorconfig`

**Branch:** `feat/scaffold` (continue)

- [ ] **Step 1: Write .eslintrc.cjs**

Create `.eslintrc.cjs`:

```js
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": "error",
  },
};
```

- [ ] **Step 2: Write .eslintignore**

Create `.eslintignore`:

```
dist
node_modules
coverage
.superpowers
```

- [ ] **Step 3: Write .prettierrc.json**

Create `.prettierrc.json`:

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "singleQuote": false,
  "semi": true,
  "trailingComma": "all",
  "endOfLine": "lf"
}
```

- [ ] **Step 4: Write .prettierignore**

Create `.prettierignore`:

```
dist
node_modules
coverage
.superpowers
package-lock.json
```

- [ ] **Step 5: Write .editorconfig**

Create `.editorconfig`:

```
root = true

[*]
indent_style = space
indent_size = 2
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 6: Verify lint passes**

Run: `npm run lint`
Expected: no errors (no source files have content yet besides the placeholder).

- [ ] **Step 7: Commit**

```
git add .eslintrc.cjs .eslintignore .prettierrc.json .prettierignore .editorconfig
git commit -m "Add ESLint, Prettier, and EditorConfig"
```

---

## Task 5: Directory skeleton + README + smoke test

**Files:**
- Create: `README.md`
- Create: `src/sim/.gitkeep`, `src/render/.gitkeep`, `src/input/.gitkeep`, `src/audio/.gitkeep`, `src/storage/.gitkeep`, `src/data/airports/.gitkeep`
- Create: `tests/sim/.gitkeep`
- Create: `public/audio/.gitkeep`
- Create: `tests/smoke.test.ts`

**Branch:** `feat/scaffold` (continue)

- [ ] **Step 1: Write README.md**

Create `README.md`:

```markdown
# atc-browser

Browser-based approach control radar simulator. MVP at Duluth Approach (KDLH).

See `docs/superpowers/specs/2026-05-04-atc-browser-design.md` for the design.

## Develop

\`\`\`
npm install
npm run dev          # http://localhost:5173
npm test             # one-shot
npm run test:watch   # TDD
npm run typecheck
npm run lint
npm run build
\`\`\`

Requires Node 20+.
```

(Replace the `\`` escapes with real backticks when saving the file.)

- [ ] **Step 2: Create empty directories with .gitkeep**

Create empty files at all of:

```
src/sim/.gitkeep
src/sim/commands/.gitkeep
src/render/.gitkeep
src/input/.gitkeep
src/audio/.gitkeep
src/storage/.gitkeep
src/data/airports/.gitkeep
tests/sim/.gitkeep
tests/sim/commands/.gitkeep
public/audio/.gitkeep
```

- [ ] **Step 3: Write smoke test**

Create `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("vitest is alive", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Verify smoke test**

Run: `npm test`
Expected: `1 passed`. No errors.

- [ ] **Step 5: Verify typecheck still passes**

Run: `npm run typecheck`
Expected: passes silently.

- [ ] **Step 6: Commit**

```
git add README.md src/ tests/ public/
git commit -m "Add directory skeleton, README, and smoke test"
```

---

## Task 6: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Branch:** `feat/scaffold` (final task on this branch — open PR after)

- [ ] **Step 1: Write the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
          cache: "npm"

      - run: npm ci

      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Verify the workflow YAML is valid syntax**

Run: `node -e "require('js-yaml')" 2>/dev/null || echo "skipping yaml lint"`

(Optional check; the workflow is validated by GitHub on push.)

- [ ] **Step 3: Commit**

```
git add .github/workflows/ci.yml
git commit -m "Add GitHub Actions CI workflow"
```

- [ ] **Step 4: PAUSE for approval — push branch and open PR**

The user must approve before pushing. State to user:

> "Branch `feat/scaffold` is ready (6 commits). Push and open PR? Target: `main`. The remote needs to be created on GitHub first; tell me whether to create it as `atc-browser` (public, since GitHub Pages free tier needs public)."

If user approves: create remote, push, open PR with body summarizing scaffold + CI. After PR merge, return to `main`, pull, and continue from Task 7 on a new branch.

---

## Task 7: Domain types

**Files:**
- Create: `src/sim/types.ts`

**Branch:** `feat/sim-domain`

- [ ] **Step 1: Branch off freshly-pulled main**

```
git checkout main && git pull
git checkout -b feat/sim-domain
```

- [ ] **Step 2: Write src/sim/types.ts**

Create `src/sim/types.ts`:

```ts
// Geometry: planar coordinates in nautical miles, airport reference point at origin.
// x = east (positive), y = north (positive).
export interface Point2D {
  x: number;
  y: number;
}

// Aircraft

export type AircraftKind = "arrival" | "departure";

export type AircraftState =
  | "entering"
  | "under_control"
  | "cleared_approach"
  | "handed_off";

export interface Aircraft {
  id: string;
  callsign: string;
  kind: AircraftKind;
  state: AircraftState;

  position_nm: Point2D;
  altitude_ft: number;
  heading_deg: number;
  speed_kts: number;

  target_heading: number | null;
  target_altitude: number | null;
  target_speed: number | null;
  cleared_runway: string | null;

  spawn_time_s: number;
  handoff_time_s: number | null;
}

// Airspace

export interface IlsApproach {
  course_deg: number;        // magnetic; the inbound course aircraft fly to land
  glideslope_deg: number;    // typically 3.0
  threshold: Point2D;        // touchdown point of this runway end
}

export interface Runway {
  id: string;                // "27" — the magnetic heading rounded to nearest 10 / 10
  heading_deg: number;       // takeoff / landing direction
  threshold: Point2D;        // touchdown point of THIS direction (i.e. for "27" it's the east end)
  opposite: string;          // id of the opposite direction, e.g. "09" for runway 27
  length_ft: number;
  ils?: IlsApproach;
}

export interface Fix {
  name: string;
  position_nm: Point2D;
  suggested_alt_ft?: number;
}

export interface Airspace {
  icao: string;
  name: string;
  elevation_ft: number;
  magnetic_var_deg: number;  // east is negative, west is positive

  runways: Runway[];
  entry_fixes: Fix[];        // arrival entry points
  exit_fixes: Fix[];         // departure handoff points

  sector_radius_nm: number;
  floor_ft: number;
  ceiling_ft: number;
}

// Commands

export type Command =
  | { kind: "assign_heading"; aircraft_id: string; heading_deg: number }
  | { kind: "assign_altitude"; aircraft_id: string; altitude_ft: number }
  | { kind: "assign_speed"; aircraft_id: string; speed_kts: number }
  | { kind: "clear_approach"; aircraft_id: string; runway: string }
  | { kind: "handoff"; aircraft_id: string; to: "tower" | "center" | "auto" };

// Events

export type GameEvent =
  | { kind: "aircraft_spawned"; aircraft_id: string }
  | { kind: "command_accepted"; command: Command; aircraft_id: string }
  | { kind: "command_rejected"; command: Command; aircraft_id: string; reason: string }
  | { kind: "approach_cleared"; aircraft_id: string; runway: string }
  | { kind: "approach_established"; aircraft_id: string; runway: string }
  | { kind: "handed_off"; aircraft_id: string; to: "tower" | "center" }
  | { kind: "conflict_raised"; pair: [string, string] }
  | { kind: "conflict_resolved"; pair: [string, string] }
  | { kind: "aircraft_lost"; aircraft_id: string; reason: string }
  | { kind: "session_ended"; reason: string };

// Session

export interface SessionState {
  id: string;
  started_at_ms: number;
  elapsed_sec: number;
  aircraft_handled: number;
  aircraft_lost: number;
  conflicts_raised: number;
  score: number;
  status: "running" | "ended";
  end_reason: "separation_loss" | "lost_aircraft" | null;
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: passes silently.

- [ ] **Step 4: Commit**

```
git add src/sim/types.ts
git commit -m "Add core domain types for sim core"
```

- [ ] **Step 5: PAUSE for approval — push branch and open PR**

State to user:

> "Branch `feat/sim-domain` ready (1 commit). Push and open PR?"

After merge, return to `main`, pull, branch fresh.

---

## Task 8: Math utilities

**Files:**
- Create: `src/sim/math.ts`
- Create: `tests/sim/math.test.ts`

**Branch:** `feat/sim-math-physics`

- [ ] **Step 1: Branch fresh**

```
git checkout main && git pull
git checkout -b feat/sim-math-physics
```

- [ ] **Step 2: Write the failing test**

Create `tests/sim/math.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeHeading,
  degToRad,
  radToDeg,
  distanceNm,
  bearingDeg,
  headingDelta,
} from "../../src/sim/math.ts";

describe("normalizeHeading", () => {
  it("wraps positive overflow", () => {
    expect(normalizeHeading(360)).toBe(0);
    expect(normalizeHeading(450)).toBe(90);
  });
  it("wraps negative", () => {
    expect(normalizeHeading(-10)).toBe(350);
    expect(normalizeHeading(-360)).toBe(0);
  });
  it("preserves in-range values", () => {
    expect(normalizeHeading(180)).toBe(180);
    expect(normalizeHeading(0)).toBe(0);
  });
});

describe("degToRad / radToDeg", () => {
  it("are inverses of each other", () => {
    expect(degToRad(0)).toBe(0);
    expect(degToRad(180)).toBeCloseTo(Math.PI, 9);
    expect(radToDeg(Math.PI)).toBeCloseTo(180, 9);
  });
});

describe("distanceNm", () => {
  it("returns 0 for same point", () => {
    expect(distanceNm({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
  });
  it("returns euclidean distance in nm", () => {
    expect(distanceNm({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("bearingDeg", () => {
  it("0° = due north (positive y)", () => {
    expect(bearingDeg({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(0);
  });
  it("90° = due east (positive x)", () => {
    expect(bearingDeg({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(90);
  });
  it("180° = due south", () => {
    expect(bearingDeg({ x: 0, y: 0 }, { x: 0, y: -1 })).toBe(180);
  });
  it("270° = due west", () => {
    expect(bearingDeg({ x: 0, y: 0 }, { x: -1, y: 0 })).toBe(270);
  });
});

describe("headingDelta", () => {
  it("returns shortest signed turn in [-180, 180]", () => {
    expect(headingDelta(0, 90)).toBe(90);
    expect(headingDelta(90, 0)).toBe(-90);
    expect(headingDelta(0, 350)).toBe(-10);
    expect(headingDelta(350, 10)).toBe(20);
    expect(headingDelta(180, 0)).toBe(-180);
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npm test`
Expected: tests fail to compile because `src/sim/math.ts` doesn't exist.

- [ ] **Step 4: Implement src/sim/math.ts**

Create `src/sim/math.ts`:

```ts
import type { Point2D } from "./types.ts";

export function normalizeHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function distanceNm(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Compass bearing FROM a TO b: 0 = north (positive y), increasing clockwise.
export function bearingDeg(from: Point2D, to: Point2D): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return normalizeHeading(radToDeg(Math.atan2(dx, dy)));
}

// Shortest signed turn from `from` to `to`, in degrees [-180, 180].
// Positive = turn right (clockwise), negative = turn left.
export function headingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test`
Expected: all 11 assertions pass.

- [ ] **Step 6: Commit**

```
git add src/sim/math.ts tests/sim/math.test.ts
git commit -m "Add math utilities (heading, distance, bearing) with tests"
```

---

## Task 9: Physics — heading integration

**Files:**
- Create: `src/sim/physics.ts`
- Create: `tests/sim/physics.test.ts`

**Branch:** `feat/sim-math-physics` (continue)

- [ ] **Step 1: Write the failing test**

Create `tests/sim/physics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { integrateHeading, TURN_RATE_DEG_PER_SEC } from "../../src/sim/physics.ts";

describe("integrateHeading", () => {
  it("turns right toward target at 3°/sec", () => {
    expect(integrateHeading(0, 90, 1)).toBe(TURN_RATE_DEG_PER_SEC);
    expect(integrateHeading(0, 90, 10)).toBe(30);
  });

  it("turns left toward target", () => {
    expect(integrateHeading(0, 270, 1)).toBe(360 - TURN_RATE_DEG_PER_SEC);
  });

  it("snaps to target when within one tick of it", () => {
    expect(integrateHeading(89, 90, 1)).toBe(90);
    expect(integrateHeading(90, 89, 1)).toBe(89);
  });

  it("handles 360 wrap", () => {
    expect(integrateHeading(355, 5, 1)).toBe(358);
    expect(integrateHeading(5, 355, 1)).toBe(2);
  });

  it("returns target if delta is zero", () => {
    expect(integrateHeading(123, 123, 5)).toBe(123);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test`
Expected: compile error, `src/sim/physics.ts` does not exist.

- [ ] **Step 3: Implement initial physics.ts**

Create `src/sim/physics.ts`:

```ts
import { headingDelta, normalizeHeading } from "./math.ts";

export const TURN_RATE_DEG_PER_SEC = 3;

export function integrateHeading(current: number, target: number, dt: number): number {
  const delta = headingDelta(current, target);
  if (delta === 0) return current;
  const maxTurn = TURN_RATE_DEG_PER_SEC * dt;
  if (Math.abs(delta) <= maxTurn) return normalizeHeading(target);
  const sign = delta >= 0 ? 1 : -1;
  return normalizeHeading(current + sign * maxTurn);
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test`
Expected: heading tests pass.

- [ ] **Step 5: Commit**

```
git add src/sim/physics.ts tests/sim/physics.test.ts
git commit -m "Add heading integration with 3°/sec turn rate"
```

---

## Task 10: Physics — altitude and speed integration

**Files:**
- Modify: `src/sim/physics.ts`
- Modify: `tests/sim/physics.test.ts`

**Branch:** `feat/sim-math-physics` (continue)

- [ ] **Step 1: Add the failing tests**

Append to `tests/sim/physics.test.ts`:

```ts
import {
  integrateAltitude,
  integrateSpeed,
  VERTICAL_RATE_FPS,
  ACCEL_KTS_PER_SEC,
} from "../../src/sim/physics.ts";

describe("integrateAltitude", () => {
  it("descends at the configured rate", () => {
    expect(integrateAltitude(10000, 5000, 1)).toBe(10000 - VERTICAL_RATE_FPS);
    expect(integrateAltitude(10000, 5000, 10)).toBe(10000 - VERTICAL_RATE_FPS * 10);
  });
  it("climbs at the configured rate", () => {
    expect(integrateAltitude(5000, 10000, 1)).toBe(5000 + VERTICAL_RATE_FPS);
  });
  it("snaps to target when within one tick of it", () => {
    expect(integrateAltitude(10000, 9999, 1)).toBe(9999);
    expect(integrateAltitude(10000, 10001, 1)).toBe(10001);
  });
  it("returns current if delta is zero", () => {
    expect(integrateAltitude(8000, 8000, 1)).toBe(8000);
  });
});

describe("integrateSpeed", () => {
  it("decelerates at 1 kt/sec", () => {
    expect(integrateSpeed(250, 200, 1)).toBe(250 - ACCEL_KTS_PER_SEC);
  });
  it("accelerates at 1 kt/sec", () => {
    expect(integrateSpeed(200, 250, 1)).toBe(200 + ACCEL_KTS_PER_SEC);
  });
  it("snaps to target when within one tick", () => {
    expect(integrateSpeed(250, 249.5, 1)).toBe(249.5);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test`
Expected: compile error — `integrateAltitude` and `integrateSpeed` not exported.

- [ ] **Step 3: Add to src/sim/physics.ts**

Append to `src/sim/physics.ts`:

```ts
// Vertical: jet climb/descent at ~1800 fpm = 30 fps.
export const VERTICAL_RATE_FPS = 30;

export function integrateAltitude(current: number, target: number, dt: number): number {
  const delta = target - current;
  if (delta === 0) return current;
  const maxChange = VERTICAL_RATE_FPS * dt;
  if (Math.abs(delta) <= maxChange) return target;
  return current + Math.sign(delta) * maxChange;
}

// Acceleration: 1 kt/sec.
export const ACCEL_KTS_PER_SEC = 1;

export function integrateSpeed(current: number, target: number, dt: number): number {
  const delta = target - current;
  if (delta === 0) return current;
  const maxChange = ACCEL_KTS_PER_SEC * dt;
  if (Math.abs(delta) <= maxChange) return target;
  return current + Math.sign(delta) * maxChange;
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test`
Expected: all altitude/speed assertions pass.

- [ ] **Step 5: Commit**

```
git add src/sim/physics.ts tests/sim/physics.test.ts
git commit -m "Add altitude (1800 fpm) and speed (1 kt/sec) integration"
```

---

## Task 11: Physics — position integration and combined aircraft tick

**Files:**
- Modify: `src/sim/physics.ts`
- Modify: `tests/sim/physics.test.ts`

**Branch:** `feat/sim-math-physics` (continue)

- [ ] **Step 1: Add the failing tests**

Append to `tests/sim/physics.test.ts`:

```ts
import { integratePosition, tickAircraft } from "../../src/sim/physics.ts";
import type { Aircraft } from "../../src/sim/types.ts";

describe("integratePosition", () => {
  it("flies due north at the right rate", () => {
    // 360 kts = 0.1 nm/sec; over 10 sec, +1.0 nm north.
    const result = integratePosition({ x: 0, y: 0 }, 0, 360, 10);
    expect(result.x).toBeCloseTo(0, 9);
    expect(result.y).toBeCloseTo(1.0, 9);
  });

  it("flies due east", () => {
    const result = integratePosition({ x: 0, y: 0 }, 90, 360, 10);
    expect(result.x).toBeCloseTo(1.0, 9);
    expect(result.y).toBeCloseTo(0, 9);
  });

  it("flies northeast (045°)", () => {
    const result = integratePosition({ x: 0, y: 0 }, 45, 360, 10);
    expect(result.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(result.y).toBeCloseTo(Math.SQRT1_2, 6);
  });
});

describe("tickAircraft", () => {
  function jet(): Aircraft {
    return {
      id: "test",
      callsign: "TEST1",
      kind: "arrival",
      state: "under_control",
      position_nm: { x: 0, y: 10 },
      altitude_ft: 10000,
      heading_deg: 180,         // due south
      speed_kts: 360,
      target_heading: null,
      target_altitude: null,
      target_speed: null,
      cleared_runway: null,
      spawn_time_s: 0,
      handoff_time_s: null,
    };
  }

  it("integrates position by current heading and speed when no targets set", () => {
    const ac = jet();
    tickAircraft(ac, 10);
    expect(ac.position_nm.x).toBeCloseTo(0, 9);
    expect(ac.position_nm.y).toBeCloseTo(9.0, 9);  // moved 1 nm south
  });

  it("turns toward target_heading at 3°/sec", () => {
    const ac = jet();
    ac.target_heading = 270;  // turn right 90°
    tickAircraft(ac, 1);
    // turning right = clockwise; from 180, +3 = 183
    expect(ac.heading_deg).toBe(183);
  });

  it("descends and decelerates simultaneously", () => {
    const ac = jet();
    ac.target_altitude = 8000;
    ac.target_speed = 250;
    tickAircraft(ac, 1);
    expect(ac.altitude_ft).toBe(10000 - 30);  // -30 ft in 1 sec
    expect(ac.speed_kts).toBe(360 - 1);        // -1 kt in 1 sec
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test`
Expected: compile error — `integratePosition` and `tickAircraft` not exported.

- [ ] **Step 3: Add to src/sim/physics.ts**

Append to `src/sim/physics.ts`:

```ts
import { degToRad } from "./math.ts";
import type { Aircraft, Point2D } from "./types.ts";

const SECONDS_PER_HOUR = 3600;

export function integratePosition(
  pos: Point2D,
  heading_deg: number,
  speed_kts: number,
  dt: number,
): Point2D {
  const distNm = (speed_kts / SECONDS_PER_HOUR) * dt;
  const rad = degToRad(heading_deg);
  return {
    x: pos.x + distNm * Math.sin(rad),
    y: pos.y + distNm * Math.cos(rad),
  };
}

export function tickAircraft(ac: Aircraft, dt: number): void {
  if (ac.target_heading != null) {
    ac.heading_deg = integrateHeading(ac.heading_deg, ac.target_heading, dt);
  }
  if (ac.target_altitude != null) {
    ac.altitude_ft = integrateAltitude(ac.altitude_ft, ac.target_altitude, dt);
  }
  if (ac.target_speed != null) {
    ac.speed_kts = integrateSpeed(ac.speed_kts, ac.target_speed, dt);
  }
  ac.position_nm = integratePosition(ac.position_nm, ac.heading_deg, ac.speed_kts, dt);
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test`
Expected: all physics tests pass.

- [ ] **Step 5: Commit**

```
git add src/sim/physics.ts tests/sim/physics.test.ts
git commit -m "Add position integration and combined aircraft tick"
```

- [ ] **Step 6: PAUSE for approval — push branch and open PR**

State to user: "Branch `feat/sim-math-physics` ready (3 commits). Push and open PR?"

After merge: return to `main`, pull, branch fresh.

---

## Task 12: Conflicts — separation detection

**Files:**
- Create: `src/sim/conflicts.ts`
- Create: `tests/sim/conflicts.test.ts`

**Branch:** `feat/sim-conflicts-events`

- [ ] **Step 1: Branch fresh**

```
git checkout main && git pull
git checkout -b feat/sim-conflicts-events
```

- [ ] **Step 2: Write the failing test**

Create `tests/sim/conflicts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  inConflict,
  findConflicts,
  SEPARATION_LATERAL_NM,
  SEPARATION_VERTICAL_FT,
} from "../../src/sim/conflicts.ts";
import type { Aircraft } from "../../src/sim/types.ts";

function ac(id: string, x: number, y: number, alt: number): Aircraft {
  return {
    id,
    callsign: id,
    kind: "arrival",
    state: "under_control",
    position_nm: { x, y },
    altitude_ft: alt,
    heading_deg: 0,
    speed_kts: 250,
    target_heading: null,
    target_altitude: null,
    target_speed: null,
    cleared_runway: null,
    spawn_time_s: 0,
    handoff_time_s: null,
  };
}

describe("inConflict", () => {
  it("flags pairs within both lateral AND vertical thresholds", () => {
    expect(inConflict(ac("A", 0, 0, 5000), ac("B", 1, 0, 5500))).toBe(true);
  });
  it("does not flag pairs separated laterally", () => {
    const a = ac("A", 0, 0, 5000);
    const b = ac("B", SEPARATION_LATERAL_NM + 0.01, 0, 5500);
    expect(inConflict(a, b)).toBe(false);
  });
  it("does not flag pairs separated vertically", () => {
    const a = ac("A", 0, 0, 5000);
    const b = ac("B", 1, 0, 5000 + SEPARATION_VERTICAL_FT);
    expect(inConflict(a, b)).toBe(false);
  });
  it("requires BOTH thresholds breached", () => {
    // 4 nm apart, but same altitude — still no conflict (lateral OK)
    expect(inConflict(ac("A", 0, 0, 5000), ac("B", 4, 0, 5000))).toBe(false);
    // 1 nm apart, 1000 ft difference — vertical at threshold, NOT below it
    expect(inConflict(ac("A", 0, 0, 5000), ac("B", 1, 0, 6000))).toBe(false);
  });
});

describe("findConflicts", () => {
  it("returns empty for 0 or 1 aircraft", () => {
    expect(findConflicts([])).toEqual([]);
    expect(findConflicts([ac("A", 0, 0, 5000)])).toEqual([]);
  });
  it("finds a single conflicting pair", () => {
    const result = findConflicts([
      ac("A", 0, 0, 5000),
      ac("B", 1, 0, 5500),
      ac("C", 50, 50, 9000),
    ]);
    expect(result).toEqual([["A", "B"]]);
  });
  it("finds multiple conflicting pairs", () => {
    const result = findConflicts([
      ac("A", 0, 0, 5000),
      ac("B", 1, 0, 5500),
      ac("C", 0.5, 0.5, 5200),
    ]);
    expect(result).toContainEqual(["A", "B"]);
    expect(result).toContainEqual(["A", "C"]);
    expect(result).toContainEqual(["B", "C"]);
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npm test`
Expected: compile error.

- [ ] **Step 4: Implement src/sim/conflicts.ts**

Create `src/sim/conflicts.ts`:

```ts
import type { Aircraft } from "./types.ts";
import { distanceNm } from "./math.ts";

export const SEPARATION_LATERAL_NM = 3;
export const SEPARATION_VERTICAL_FT = 1000;

export function inConflict(a: Aircraft, b: Aircraft): boolean {
  const lateral = distanceNm(a.position_nm, b.position_nm);
  const vertical = Math.abs(a.altitude_ft - b.altitude_ft);
  return lateral < SEPARATION_LATERAL_NM && vertical < SEPARATION_VERTICAL_FT;
}

export function findConflicts(aircraft: Aircraft[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < aircraft.length; i++) {
    for (let j = i + 1; j < aircraft.length; j++) {
      const a = aircraft[i]!;
      const b = aircraft[j]!;
      if (inConflict(a, b)) {
        pairs.push([a.id, b.id]);
      }
    }
  }
  return pairs;
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test`
Expected: all conflict tests pass.

- [ ] **Step 6: Commit**

```
git add src/sim/conflicts.ts tests/sim/conflicts.test.ts
git commit -m "Add separation detection (3 nm AND <1000 ft both required)"
```

---

## Task 13: Event bus

**Files:**
- Create: `src/sim/events.ts`
- Create: `tests/sim/events.test.ts`

**Branch:** `feat/sim-conflicts-events` (continue)

- [ ] **Step 1: Write the failing test**

Create `tests/sim/events.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../../src/sim/events.ts";

describe("EventBus", () => {
  it("delivers emitted events to subscribers", () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.on((e) => seen.push(e.kind));
    bus.emit({ kind: "aircraft_spawned", aircraft_id: "X" });
    bus.emit({ kind: "session_ended", reason: "test" });
    expect(seen).toEqual(["aircraft_spawned", "session_ended"]);
  });

  it("supports unsubscribe via returned function", () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const off = bus.on(fn);
    bus.emit({ kind: "aircraft_spawned", aircraft_id: "X" });
    off();
    bus.emit({ kind: "aircraft_spawned", aircraft_id: "Y" });
    expect(fn).toHaveBeenCalledOnce();
  });

  it("delivers to multiple listeners in registration order", () => {
    const bus = new EventBus();
    const order: number[] = [];
    bus.on(() => order.push(1));
    bus.on(() => order.push(2));
    bus.emit({ kind: "aircraft_spawned", aircraft_id: "X" });
    expect(order).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test`
Expected: compile error.

- [ ] **Step 3: Implement src/sim/events.ts**

Create `src/sim/events.ts`:

```ts
import type { GameEvent } from "./types.ts";

export type EventListener = (event: GameEvent) => void;

export class EventBus {
  private listeners: EventListener[] = [];

  on(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit(event: GameEvent): void {
    for (const l of this.listeners) l(event);
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test`
Expected: all event tests pass.

- [ ] **Step 5: Commit**

```
git add src/sim/events.ts tests/sim/events.test.ts
git commit -m "Add EventBus with subscribe/unsubscribe/emit"
```

- [ ] **Step 6: PAUSE for approval — push branch and open PR**

State to user: "Branch `feat/sim-conflicts-events` ready (2 commits). Push and open PR?"

After merge: return to `main`, pull, branch fresh.

---

## Task 14: Aircraft factory helpers

**Files:**
- Create: `src/sim/Aircraft.ts`
- Create: `tests/sim/aircraft.test.ts`

**Branch:** `feat/sim-commands`

- [ ] **Step 1: Branch fresh**

```
git checkout main && git pull
git checkout -b feat/sim-commands
```

- [ ] **Step 2: Write the failing test**

Create `tests/sim/aircraft.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createArrival, createDeparture, generateCallsign } from "../../src/sim/Aircraft.ts";

describe("createArrival", () => {
  it("starts in under_control with sensible defaults", () => {
    const ac = createArrival({
      id: "ac1",
      callsign: "DAL891",
      position_nm: { x: 15, y: 15 },
      heading_deg: 270,
      altitude_ft: 11000,
      speed_kts: 250,
      spawn_time_s: 0,
    });
    expect(ac.kind).toBe("arrival");
    expect(ac.state).toBe("under_control");
    expect(ac.target_heading).toBeNull();
    expect(ac.cleared_runway).toBeNull();
    expect(ac.handoff_time_s).toBeNull();
  });
});

describe("createDeparture", () => {
  it("starts at runway threshold in under_control", () => {
    const ac = createDeparture({
      id: "ac2",
      callsign: "SWA42",
      position_nm: { x: 0.84, y: 0 },
      heading_deg: 269,
      altitude_ft: 1428,
      speed_kts: 0,
      spawn_time_s: 100,
    });
    expect(ac.kind).toBe("departure");
    expect(ac.state).toBe("under_control");
  });
});

describe("generateCallsign", () => {
  it("produces a string matching <prefix><digits>", () => {
    const cs = generateCallsign();
    expect(cs).toMatch(/^[A-Z]{2,3}\d{1,4}$/);
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npm test`
Expected: compile error.

- [ ] **Step 4: Implement src/sim/Aircraft.ts**

Create `src/sim/Aircraft.ts`:

```ts
import type { Aircraft, AircraftKind, Point2D } from "./types.ts";

interface BaseSpawnArgs {
  id: string;
  callsign: string;
  position_nm: Point2D;
  heading_deg: number;
  altitude_ft: number;
  speed_kts: number;
  spawn_time_s: number;
}

function spawn(kind: AircraftKind, args: BaseSpawnArgs): Aircraft {
  return {
    id: args.id,
    callsign: args.callsign,
    kind,
    state: "under_control",
    position_nm: { ...args.position_nm },
    altitude_ft: args.altitude_ft,
    heading_deg: args.heading_deg,
    speed_kts: args.speed_kts,
    target_heading: null,
    target_altitude: null,
    target_speed: null,
    cleared_runway: null,
    spawn_time_s: args.spawn_time_s,
    handoff_time_s: null,
  };
}

export function createArrival(args: BaseSpawnArgs): Aircraft {
  return spawn("arrival", args);
}

export function createDeparture(args: BaseSpawnArgs): Aircraft {
  return spawn("departure", args);
}

const PREFIXES = ["UAL", "DAL", "SWA", "AAL", "JBU", "SKW", "FFT"];

export function generateCallsign(rng: () => number = Math.random): string {
  const prefix = PREFIXES[Math.floor(rng() * PREFIXES.length)]!;
  const number = 1 + Math.floor(rng() * 9999);
  return `${prefix}${number}`;
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test`
Expected: all aircraft tests pass.

- [ ] **Step 6: Commit**

```
git add src/sim/Aircraft.ts tests/sim/aircraft.test.ts
git commit -m "Add Aircraft factory helpers and callsign generator"
```

---

## Task 15: Command parser

**Files:**
- Create: `src/sim/commands/parser.ts`
- Create: `tests/sim/commands/parser.test.ts`

**Branch:** `feat/sim-commands` (continue)

- [ ] **Step 1: Write the failing test**

Create `tests/sim/commands/parser.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseCommandLine } from "../../../src/sim/commands/parser.ts";
import type { AircraftKind } from "../../../src/sim/types.ts";

const lookup = (cs: string): { id: string; kind: AircraftKind } | null => {
  if (cs === "DAL891") return { id: "DAL891", kind: "arrival" };
  if (cs === "SWA42") return { id: "SWA42", kind: "departure" };
  return null;
};

describe("parseCommandLine", () => {
  it("parses heading", () => {
    expect(parseCommandLine("DAL891 H 240", lookup)).toEqual([
      { kind: "assign_heading", aircraft_id: "DAL891", heading_deg: 240 },
    ]);
  });

  it("parses altitude as hundreds of feet", () => {
    expect(parseCommandLine("DAL891 A 80", lookup)).toEqual([
      { kind: "assign_altitude", aircraft_id: "DAL891", altitude_ft: 8000 },
    ]);
  });

  it("parses speed", () => {
    expect(parseCommandLine("DAL891 S 210", lookup)).toEqual([
      { kind: "assign_speed", aircraft_id: "DAL891", speed_kts: 210 },
    ]);
  });

  it("parses ILS clearance", () => {
    expect(parseCommandLine("DAL891 L 27", lookup)).toEqual([
      { kind: "clear_approach", aircraft_id: "DAL891", runway: "27" },
    ]);
  });

  it("parses handoff with auto-routing for arrival -> tower", () => {
    expect(parseCommandLine("DAL891 X", lookup)).toEqual([
      { kind: "handoff", aircraft_id: "DAL891", to: "tower" },
    ]);
  });

  it("parses handoff with auto-routing for departure -> center", () => {
    expect(parseCommandLine("SWA42 X", lookup)).toEqual([
      { kind: "handoff", aircraft_id: "SWA42", to: "center" },
    ]);
  });

  it("parses chained verbs", () => {
    expect(parseCommandLine("DAL891 H 240 A 80 S 210", lookup)).toEqual([
      { kind: "assign_heading", aircraft_id: "DAL891", heading_deg: 240 },
      { kind: "assign_altitude", aircraft_id: "DAL891", altitude_ft: 8000 },
      { kind: "assign_speed", aircraft_id: "DAL891", speed_kts: 210 },
    ]);
  });

  it("is case-insensitive and whitespace-tolerant", () => {
    expect(parseCommandLine("  dal891  h  240  ", lookup)).toEqual([
      { kind: "assign_heading", aircraft_id: "DAL891", heading_deg: 240 },
    ]);
  });

  it("rejects unknown callsign", () => {
    const r = parseCommandLine("XXX111 H 240", lookup);
    expect("error" in r).toBe(true);
  });

  it("rejects unknown verb", () => {
    const r = parseCommandLine("DAL891 Z 50", lookup);
    expect("error" in r).toBe(true);
  });

  it("rejects missing value for verb", () => {
    const r = parseCommandLine("DAL891 H", lookup);
    expect("error" in r).toBe(true);
  });

  it("rejects non-numeric value where numeric expected", () => {
    const r = parseCommandLine("DAL891 H abc", lookup);
    expect("error" in r).toBe(true);
  });

  it("rejects empty input", () => {
    const r = parseCommandLine("", lookup);
    expect("error" in r).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test`
Expected: compile error.

- [ ] **Step 3: Implement src/sim/commands/parser.ts**

Create `src/sim/commands/parser.ts`:

```ts
import type { AircraftKind, Command } from "../types.ts";

export interface ParseError {
  error: string;
}

export type ParseResult = Command[] | ParseError;

export type CallsignLookup = (callsign: string) => { id: string; kind: AircraftKind } | null;

export function parseCommandLine(input: string, lookup: CallsignLookup): ParseResult {
  const tokens = input.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return { error: "expected: <CALLSIGN> <verb> <value>..." };
  }
  const callsign = tokens[0]!;
  const ac = lookup(callsign);
  if (!ac) return { error: `unknown callsign: ${callsign}` };

  const commands: Command[] = [];
  let i = 1;
  while (i < tokens.length) {
    const verb = tokens[i]!;
    switch (verb) {
      case "H": {
        const raw = tokens[i + 1];
        const v = raw === undefined ? NaN : Number(raw);
        if (!Number.isFinite(v)) {
          return { error: `H: expected heading, got "${raw ?? ""}"` };
        }
        commands.push({ kind: "assign_heading", aircraft_id: ac.id, heading_deg: v });
        i += 2;
        break;
      }
      case "A": {
        const raw = tokens[i + 1];
        const v = raw === undefined ? NaN : Number(raw);
        if (!Number.isFinite(v)) {
          return { error: `A: expected altitude (hundreds of feet), got "${raw ?? ""}"` };
        }
        commands.push({ kind: "assign_altitude", aircraft_id: ac.id, altitude_ft: v * 100 });
        i += 2;
        break;
      }
      case "S": {
        const raw = tokens[i + 1];
        const v = raw === undefined ? NaN : Number(raw);
        if (!Number.isFinite(v)) {
          return { error: `S: expected speed, got "${raw ?? ""}"` };
        }
        commands.push({ kind: "assign_speed", aircraft_id: ac.id, speed_kts: v });
        i += 2;
        break;
      }
      case "L": {
        const raw = tokens[i + 1];
        if (!raw) return { error: "L: expected runway id" };
        commands.push({ kind: "clear_approach", aircraft_id: ac.id, runway: raw });
        i += 2;
        break;
      }
      case "X": {
        const to: "tower" | "center" = ac.kind === "arrival" ? "tower" : "center";
        commands.push({ kind: "handoff", aircraft_id: ac.id, to });
        i += 1;
        break;
      }
      default:
        return { error: `unknown verb: ${verb}` };
    }
  }
  return commands;
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test`
Expected: all parser tests pass.

- [ ] **Step 5: Commit**

```
git add src/sim/commands/parser.ts tests/sim/commands/parser.test.ts
git commit -m "Add command-line parser with auto-routed handoff"
```

---

## Task 16: Command executor

**Files:**
- Create: `src/sim/commands/executor.ts`
- Create: `tests/sim/commands/executor.test.ts`

**Branch:** `feat/sim-commands` (continue)

For testing the executor in isolation, we need a minimal `World`-like surface. We'll define an `ExecutorContext` interface here so the executor doesn't yet depend on the full `World` class (which we'll write later).

- [ ] **Step 1: Write the failing test**

Create `tests/sim/commands/executor.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { executeCommand } from "../../../src/sim/commands/executor.ts";
import { createArrival } from "../../../src/sim/Aircraft.ts";
import type { Aircraft, Airspace } from "../../../src/sim/types.ts";

const airspace: Airspace = {
  icao: "TEST",
  name: "Test",
  elevation_ft: 0,
  magnetic_var_deg: 0,
  runways: [
    { id: "27", heading_deg: 270, threshold: { x: 1, y: 0 }, opposite: "09", length_ft: 10000,
      ils: { course_deg: 270, glideslope_deg: 3, threshold: { x: 1, y: 0 } } },
  ],
  entry_fixes: [],
  exit_fixes: [],
  sector_radius_nm: 30,
  floor_ft: 3000,
  ceiling_ft: 13000,
};

function makeAc(): Aircraft {
  return createArrival({
    id: "DAL891",
    callsign: "DAL891",
    position_nm: { x: 10, y: 0 },
    heading_deg: 270,
    altitude_ft: 8000,
    speed_kts: 250,
    spawn_time_s: 0,
  });
}

describe("executeCommand — assign_heading", () => {
  it("accepts valid heading and sets target", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "assign_heading", aircraft_id: "DAL891", heading_deg: 240,
    });
    expect(r.ok).toBe(true);
    expect(ac.target_heading).toBe(240);
  });
  it("rejects out-of-range heading", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "assign_heading", aircraft_id: "DAL891", heading_deg: 360,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/heading/i);
  });
});

describe("executeCommand — assign_altitude", () => {
  it("accepts altitude within sector floor/ceiling", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "assign_altitude", aircraft_id: "DAL891", altitude_ft: 5000,
    });
    expect(r.ok).toBe(true);
    expect(ac.target_altitude).toBe(5000);
  });
  it("rejects below floor", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "assign_altitude", aircraft_id: "DAL891", altitude_ft: 1000,
    });
    expect(r.ok).toBe(false);
  });
});

describe("executeCommand — assign_speed", () => {
  it("accepts speed within bounds", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "assign_speed", aircraft_id: "DAL891", speed_kts: 210,
    });
    expect(r.ok).toBe(true);
    expect(ac.target_speed).toBe(210);
  });
});

describe("executeCommand — clear_approach", () => {
  it("sets cleared_runway when runway exists with ILS", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "clear_approach", aircraft_id: "DAL891", runway: "27",
    });
    expect(r.ok).toBe(true);
    expect(ac.cleared_runway).toBe("27");
  });
  it("rejects unknown runway", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "clear_approach", aircraft_id: "DAL891", runway: "18",
    });
    expect(r.ok).toBe(false);
  });
});

describe("executeCommand — handoff", () => {
  it("transitions to handed_off", () => {
    const ac = makeAc();
    const r = executeCommand({ aircraft: [ac], airspace, elapsed_sec: 100 }, {
      kind: "handoff", aircraft_id: "DAL891", to: "tower",
    });
    expect(r.ok).toBe(true);
    expect(ac.state).toBe("handed_off");
    expect(ac.handoff_time_s).toBe(100);
  });
});

describe("executeCommand — rejection rules", () => {
  it("rejects commands when aircraft is on final approach (cleared_approach)", () => {
    const ac = makeAc();
    ac.state = "cleared_approach";
    const r = executeCommand({ aircraft: [ac], airspace }, {
      kind: "assign_heading", aircraft_id: "DAL891", heading_deg: 100,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/final approach/i);
  });
  it("rejects when aircraft not found", () => {
    const r = executeCommand({ aircraft: [], airspace }, {
      kind: "assign_heading", aircraft_id: "GHOST", heading_deg: 100,
    });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test`
Expected: compile error.

- [ ] **Step 3: Implement src/sim/commands/executor.ts**

Create `src/sim/commands/executor.ts`:

```ts
import type { Aircraft, Airspace, Command } from "../types.ts";

export interface ExecuteResult {
  ok: boolean;
  reason?: string;
}

export interface ExecutorContext {
  aircraft: Aircraft[];
  airspace: Airspace;
  elapsed_sec?: number;
}

const SPEED_MIN_KTS = 100;
const SPEED_MAX_KTS = 350;

export function executeCommand(ctx: ExecutorContext, cmd: Command): ExecuteResult {
  const ac = ctx.aircraft.find((a) => a.id === cmd.aircraft_id || a.callsign === cmd.aircraft_id);
  if (!ac) return { ok: false, reason: `aircraft not found: ${cmd.aircraft_id}` };

  if (ac.state === "cleared_approach") {
    return { ok: false, reason: "aircraft on final approach, cannot vector" };
  }
  if (ac.state === "handed_off") {
    return { ok: false, reason: "aircraft already handed off" };
  }

  switch (cmd.kind) {
    case "assign_heading": {
      const h = cmd.heading_deg;
      if (!Number.isFinite(h) || h < 0 || h > 359) {
        return { ok: false, reason: "heading must be 0-359" };
      }
      ac.target_heading = h;
      return { ok: true };
    }
    case "assign_altitude": {
      const alt = cmd.altitude_ft;
      const { floor_ft, ceiling_ft } = ctx.airspace;
      if (!Number.isFinite(alt) || alt < floor_ft || alt > ceiling_ft) {
        return { ok: false, reason: `altitude must be ${floor_ft}-${ceiling_ft} ft` };
      }
      ac.target_altitude = alt;
      return { ok: true };
    }
    case "assign_speed": {
      const s = cmd.speed_kts;
      if (!Number.isFinite(s) || s < SPEED_MIN_KTS || s > SPEED_MAX_KTS) {
        return { ok: false, reason: `speed must be ${SPEED_MIN_KTS}-${SPEED_MAX_KTS} kts` };
      }
      ac.target_speed = s;
      return { ok: true };
    }
    case "clear_approach": {
      const rwy = ctx.airspace.runways.find((r) => r.id === cmd.runway);
      if (!rwy) return { ok: false, reason: `no runway "${cmd.runway}" in airspace` };
      if (!rwy.ils) return { ok: false, reason: `runway "${cmd.runway}" has no ILS` };
      ac.cleared_runway = rwy.id;
      return { ok: true };
    }
    case "handoff": {
      ac.state = "handed_off";
      ac.handoff_time_s = ctx.elapsed_sec ?? null;
      return { ok: true };
    }
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test`
Expected: all executor tests pass.

- [ ] **Step 5: Commit**

```
git add src/sim/commands/executor.ts tests/sim/commands/executor.test.ts
git commit -m "Add command executor with validation and rejection rules"
```

- [ ] **Step 6: PAUSE for approval — push branch and open PR**

State to user: "Branch `feat/sim-commands` ready (3 commits). Push and open PR?"

After merge: `main`, pull, branch fresh.

---

## Task 17: Traffic generator

**Files:**
- Create: `src/sim/traffic.ts`
- Create: `tests/sim/traffic.test.ts`

**Branch:** `feat/sim-traffic-airspace`

- [ ] **Step 1: Branch fresh**

```
git checkout main && git pull
git checkout -b feat/sim-traffic-airspace
```

- [ ] **Step 2: Write the failing test**

Create `tests/sim/traffic.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TrafficGenerator } from "../../src/sim/traffic.ts";
import type { Airspace } from "../../src/sim/types.ts";

const airspace: Airspace = {
  icao: "TEST",
  name: "Test",
  elevation_ft: 1000,
  magnetic_var_deg: 0,
  runways: [
    { id: "27", heading_deg: 270, threshold: { x: 1, y: 0 }, opposite: "09", length_ft: 10000,
      ils: { course_deg: 270, glideslope_deg: 3, threshold: { x: 1, y: 0 } } },
  ],
  entry_fixes: [
    { name: "FIXA", position_nm: { x: 20, y: 20 }, suggested_alt_ft: 11000 },
    { name: "FIXB", position_nm: { x: -20, y: -20 }, suggested_alt_ft: 11000 },
  ],
  exit_fixes: [{ name: "OUT1", position_nm: { x: -20, y: 20 } }],
  sector_radius_nm: 30,
  floor_ft: 3000,
  ceiling_ft: 13000,
};

describe("TrafficGenerator", () => {
  it("respects the spawn interval — does not spawn twice within the same window", () => {
    let counter = 0;
    const gen = new TrafficGenerator(airspace, {
      initialIntervalSec: 60,
      minIntervalSec: 30,
      rampDurationSec: 600,
      rng: () => 0,                     // deterministic
      idGen: () => `id${++counter}`,
    });
    // First tick at t=0 should not spawn yet.
    expect(gen.tick(0)).toBeNull();
    // After 30 sec elapsed, still not at the 60-sec interval.
    expect(gen.tick(30)).toBeNull();
    // At 60 sec — first spawn.
    const ac = gen.tick(30);
    expect(ac).not.toBeNull();
    expect(ac!.kind).toBe("arrival");
  });

  it("ramps spawn rate over time — interval shrinks toward minIntervalSec", () => {
    const gen = new TrafficGenerator(airspace, {
      initialIntervalSec: 60,
      minIntervalSec: 30,
      rampDurationSec: 600,
      rng: () => 0,
      idGen: () => "id",
    });
    // After full ramp, interval should be ~minInterval.
    const intervalAtRampEnd = gen.intervalAt(600);
    expect(intervalAtRampEnd).toBeCloseTo(30, 1);
    const intervalAtHalf = gen.intervalAt(300);
    expect(intervalAtHalf).toBeCloseTo(45, 1);
  });

  it("alternates between arrival entry fixes deterministically given rng", () => {
    let counter = 0;
    const gen = new TrafficGenerator(airspace, {
      initialIntervalSec: 60,
      minIntervalSec: 60,
      rampDurationSec: 600,
      rng: () => 0,                     // always picks first fix
      idGen: () => `id${++counter}`,
    });
    gen.tick(60);    // first spawn at t=60
    const ac1 = gen.tick(60);  // would be at t=120 but tick increments by 60
    expect(ac1?.position_nm).toEqual({ x: 20, y: 20 }); // FIXA
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npm test`
Expected: compile error.

- [ ] **Step 4: Implement src/sim/traffic.ts**

Create `src/sim/traffic.ts`:

```ts
import type { Aircraft, Airspace, Fix } from "./types.ts";
import { createArrival, generateCallsign } from "./Aircraft.ts";

export interface TrafficOptions {
  initialIntervalSec: number;     // spawn interval at t=0
  minIntervalSec: number;         // floor as ramp completes
  rampDurationSec: number;        // how long to interpolate from initial → min
  rng?: () => number;
  idGen?: () => string;
}

export class TrafficGenerator {
  private elapsed = 0;
  private nextSpawnAt: number;
  private rng: () => number;
  private idGen: () => string;

  constructor(
    private readonly airspace: Airspace,
    private readonly opts: TrafficOptions,
  ) {
    this.rng = opts.rng ?? Math.random;
    this.idGen = opts.idGen ?? (() => `ac-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    this.nextSpawnAt = opts.initialIntervalSec;
  }

  intervalAt(elapsedSec: number): number {
    const t = Math.min(1, elapsedSec / this.opts.rampDurationSec);
    return this.opts.initialIntervalSec + (this.opts.minIntervalSec - this.opts.initialIntervalSec) * t;
  }

  tick(dt: number): Aircraft | null {
    this.elapsed += dt;
    if (this.elapsed < this.nextSpawnAt) return null;

    const fixes = this.airspace.entry_fixes;
    if (fixes.length === 0) return null;
    const fix = fixes[Math.floor(this.rng() * fixes.length)] as Fix;

    const ac = createArrival({
      id: this.idGen(),
      callsign: generateCallsign(this.rng),
      position_nm: { ...fix.position_nm },
      heading_deg: bearingToOrigin(fix.position_nm),
      altitude_ft: fix.suggested_alt_ft ?? 11000,
      speed_kts: 250,
      spawn_time_s: this.elapsed,
    });

    this.nextSpawnAt = this.elapsed + this.intervalAt(this.elapsed);
    return ac;
  }
}

function bearingToOrigin(p: { x: number; y: number }): number {
  // Heading from p toward (0,0) — used so spawned arrivals point inbound.
  const rad = Math.atan2(-p.x, -p.y);
  const deg = (rad * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test`
Expected: all traffic tests pass.

- [ ] **Step 6: Commit**

```
git add src/sim/traffic.ts tests/sim/traffic.test.ts
git commit -m "Add traffic generator with ramping spawn interval"
```

---

## Task 18: KDLH airspace data

**Files:**
- Create: `src/data/airports/kdlh.ts`

**Branch:** `feat/sim-traffic-airspace` (continue)

KDLH coordinates from FAA Airport Diagram (effective 2026, current at time of plan; verify before merge):

- Airport reference point: 46°50′32″N, 92°11′37″W
- Elevation: 1428 ft
- Runway 09/27: 10,162 ft × 150 ft, asphalt; magnetic 089°/269° (mag var ~1°W)
- Runway 03/21: 5,719 ft × 150 ft (not used in MVP)
- ILS RWY 27 course: 269° magnetic, glideslope 3.0°

For MVP we render in **planar nm**, so we convert: airport reference at (0, 0). Runway 27 length is 10,162 ft ≈ 1.673 nm; threshold of 27 (touchdown for inbound aircraft on 27, i.e. east end of pavement) at approximately (+0.84, 0).

The two MVP entry fixes are simplified placeholders (real KDLH approach charts have transition fixes named on STARs we are not yet modeling). They are positioned to give a reasonable sequencing geometry: one northeast, one southeast, both at the sector boundary.

- [ ] **Step 1: Write src/data/airports/kdlh.ts**

Create `src/data/airports/kdlh.ts`:

```ts
import type { Airspace } from "../../sim/types.ts";

// KDLH — Duluth International (Duluth, MN)
// Source: FAA Airport Diagram, ILS RWY 27 chart (verify before merge to main)
// Coordinate system: planar nm, airport reference point at origin, x = east, y = north.
//
// MVP simplifications:
//   - Only runway 09/27 modeled. 03/21 deferred.
//   - Entry fixes are simplified placeholder points (real KDLH STAR fixes
//     vary by procedure; we don't model STARs in MVP).
//   - Magnetic variation rolled into runway/ILS course numbers (we use
//     magnetic bearings everywhere — pilots fly magnetic).

const RUNWAY_27_LEN_NM = 10162 / 6076;  // ~1.673
const HALF_LEN = RUNWAY_27_LEN_NM / 2;

export const KDLH: Airspace = {
  icao: "KDLH",
  name: "Duluth International",
  elevation_ft: 1428,
  magnetic_var_deg: 1,             // ~1°W

  runways: [
    {
      id: "27",
      heading_deg: 269,
      threshold: { x: HALF_LEN, y: 0 },     // east end (touchdown for 27 inbound)
      opposite: "09",
      length_ft: 10162,
      ils: {
        course_deg: 269,
        glideslope_deg: 3.0,
        threshold: { x: HALF_LEN, y: 0 },
      },
    },
    {
      id: "09",
      heading_deg: 89,
      threshold: { x: -HALF_LEN, y: 0 },    // west end
      opposite: "27",
      length_ft: 10162,
      ils: {
        course_deg: 89,
        glideslope_deg: 3.0,
        threshold: { x: -HALF_LEN, y: 0 },
      },
    },
  ],

  entry_fixes: [
    { name: "OBELE", position_nm: { x: 22, y: 22 }, suggested_alt_ft: 11000 },
    { name: "GIVKE", position_nm: { x: 22, y: -22 }, suggested_alt_ft: 11000 },
  ],

  exit_fixes: [
    { name: "DULUH", position_nm: { x: -22, y: 22 } },
  ],

  sector_radius_nm: 30,
  floor_ft: 3000,
  ceiling_ft: 13000,
};
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: passes silently.

- [ ] **Step 3: Verify all tests still pass**

Run: `npm test`
Expected: existing tests still pass.

- [ ] **Step 4: Commit**

```
git add src/data/airports/kdlh.ts
git commit -m "Add KDLH airspace data (MVP simplified)"
```

- [ ] **Step 5: PAUSE for approval — push branch and open PR**

State to user: "Branch `feat/sim-traffic-airspace` ready (2 commits). Push and open PR? Note: KDLH coordinates are approximate per published charts; please verify against the current FAA airport diagram before merging."

After merge: `main`, pull, branch fresh.

---

## Task 19: Approach establishment + auto-fly

**Files:**
- Create: `src/sim/approach.ts`
- Create: `tests/sim/approach.test.ts`

**Branch:** `feat/sim-approach`

Per spec § 6.6, an aircraft becomes "established" on the ILS when ALL of:
1. Lateral position within 1 nm of localizer course (perpendicular distance), AND
2. Heading within 30° of localizer course inbound, AND
3. Altitude at or below glideslope intercept altitude for current distance.

Glideslope intercept altitude at distance D from threshold = elevation + D × tan(3°) × 6076 (approximation in feet).

Once established, `state` flips to `cleared_approach`, `target_heading` is overridden to localizer course, and the aircraft auto-descends along the glideslope until reaching the threshold (= handoff to tower).

- [ ] **Step 1: Branch fresh**

```
git checkout main && git pull
git checkout -b feat/sim-approach
```

- [ ] **Step 2: Write the failing test**

Create `tests/sim/approach.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  isEstablished,
  glideslopeAltitudeFt,
  tickApproach,
} from "../../src/sim/approach.ts";
import { createArrival } from "../../src/sim/Aircraft.ts";
import { EventBus } from "../../src/sim/events.ts";
import type { Aircraft, Runway } from "../../src/sim/types.ts";

const rwy27: Runway = {
  id: "27",
  heading_deg: 269,
  threshold: { x: 0.84, y: 0 },
  opposite: "09",
  length_ft: 10000,
  ils: {
    course_deg: 269,
    glideslope_deg: 3.0,
    threshold: { x: 0.84, y: 0 },
  },
};

function arrivalAt(x: number, y: number, heading: number, alt: number): Aircraft {
  return createArrival({
    id: "DAL891",
    callsign: "DAL891",
    position_nm: { x, y },
    heading_deg: heading,
    altitude_ft: alt,
    speed_kts: 200,
    spawn_time_s: 0,
  });
}

describe("glideslopeAltitudeFt", () => {
  it("equals elevation at threshold", () => {
    expect(glideslopeAltitudeFt(rwy27, 1428, 0)).toBeCloseTo(1428, 0);
  });
  it("rises with distance from threshold at 3°", () => {
    // 5 nm out: ~1428 + 5 * 6076 * tan(3°) ≈ 1428 + 1593 ≈ 3021 ft
    expect(glideslopeAltitudeFt(rwy27, 1428, 5)).toBeCloseTo(3021, -1);
  });
});

describe("isEstablished", () => {
  it("returns true when on localizer, on heading, and at/below GS", () => {
    // 5 nm east of threshold along extended centerline: x=5.84, y=0, heading 269, alt at GS
    const ac = arrivalAt(5.84, 0, 269, 3000);
    expect(isEstablished(ac, rwy27, 1428)).toBe(true);
  });
  it("returns false when too far laterally from localizer", () => {
    const ac = arrivalAt(5.84, 2, 269, 3000);
    expect(isEstablished(ac, rwy27, 1428)).toBe(false);
  });
  it("returns false when heading too far off course", () => {
    const ac = arrivalAt(5.84, 0, 200, 3000);
    expect(isEstablished(ac, rwy27, 1428)).toBe(false);
  });
  it("returns false when above the glideslope", () => {
    const ac = arrivalAt(5.84, 0, 269, 9000);
    expect(isEstablished(ac, rwy27, 1428)).toBe(false);
  });
  it("returns false when not approaching the runway end (behind threshold)", () => {
    // Aircraft is on the wrong side of the threshold (west of it)
    const ac = arrivalAt(-5, 0, 269, 3000);
    expect(isEstablished(ac, rwy27, 1428)).toBe(false);
  });
});

describe("tickApproach", () => {
  it("transitions under_control + cleared_runway to cleared_approach when established", () => {
    const ac = arrivalAt(5.84, 0, 269, 3000);
    ac.cleared_runway = "27";
    const events = new EventBus();
    const seen: string[] = [];
    events.on((e) => seen.push(e.kind));

    tickApproach(ac, [rwy27], 1428, 1, events);

    expect(ac.state).toBe("cleared_approach");
    expect(ac.target_heading).toBe(269);
    expect(seen).toContain("approach_established");
  });

  it("does not transition without cleared_runway", () => {
    const ac = arrivalAt(5.84, 0, 269, 3000);
    const events = new EventBus();
    tickApproach(ac, [rwy27], 1428, 1, events);
    expect(ac.state).toBe("under_control");
  });

  it("once cleared_approach, descends toward threshold along glideslope", () => {
    const ac = arrivalAt(5.84, 0, 269, 3000);
    ac.state = "cleared_approach";
    ac.cleared_runway = "27";
    ac.target_altitude = null;  // auto-fly takes over
    const events = new EventBus();
    tickApproach(ac, [rwy27], 1428, 1, events);
    // Target altitude should now be set to the glideslope altitude for current distance.
    expect(ac.target_altitude).not.toBeNull();
    expect(ac.target_altitude!).toBeLessThan(3000);
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npm test`
Expected: compile error.

- [ ] **Step 4: Implement src/sim/approach.ts**

Create `src/sim/approach.ts`:

```ts
import type { Aircraft, Runway } from "./types.ts";
import type { EventBus } from "./events.ts";
import { degToRad, distanceNm, headingDelta } from "./math.ts";

const ESTABLISH_LATERAL_NM = 1;
const ESTABLISH_HEADING_DEG = 30;
const FT_PER_NM = 6076;

export function glideslopeAltitudeFt(rwy: Runway, elevation_ft: number, distFromThresholdNm: number): number {
  if (!rwy.ils) return elevation_ft;
  return elevation_ft + distFromThresholdNm * FT_PER_NM * Math.tan(degToRad(rwy.ils.glideslope_deg));
}

// Perpendicular distance from a point to the localizer course centerline of a runway.
function lateralOffsetNm(ac: Aircraft, rwy: Runway): number {
  if (!rwy.ils) return Infinity;
  const dx = ac.position_nm.x - rwy.ils.threshold.x;
  const dy = ac.position_nm.y - rwy.ils.threshold.y;
  // Localizer course direction unit vector (heading toward runway = inbound to threshold)
  const courseRad = degToRad(rwy.ils.course_deg);
  const ux = Math.sin(courseRad);
  const uy = Math.cos(courseRad);
  // Perpendicular component: |dx * uy - dy * ux|
  return Math.abs(dx * uy - dy * ux);
}

// Distance from aircraft to threshold projected along the localizer (negative = past threshold).
function alongTrackNm(ac: Aircraft, rwy: Runway): number {
  if (!rwy.ils) return -Infinity;
  const dx = ac.position_nm.x - rwy.ils.threshold.x;
  const dy = ac.position_nm.y - rwy.ils.threshold.y;
  const courseRad = degToRad(rwy.ils.course_deg);
  // Outbound direction (from threshold away from runway) = OPPOSITE of inbound course.
  // Inbound course points TOWARD threshold; aircraft east of threshold approaching 269° has positive
  // outbound x. So we project onto outbound direction = -inbound.
  const ox = -Math.sin(courseRad);
  const oy = -Math.cos(courseRad);
  return dx * ox + dy * oy;
}

export function isEstablished(ac: Aircraft, rwy: Runway, elevation_ft: number): boolean {
  if (!rwy.ils) return false;
  const lateral = lateralOffsetNm(ac, rwy);
  if (lateral > ESTABLISH_LATERAL_NM) return false;

  const headingOff = Math.abs(headingDelta(ac.heading_deg, rwy.ils.course_deg));
  if (headingOff > ESTABLISH_HEADING_DEG) return false;

  const along = alongTrackNm(ac, rwy);
  if (along <= 0) return false;  // already past or at threshold

  const gsAlt = glideslopeAltitudeFt(rwy, elevation_ft, along);
  if (ac.altitude_ft > gsAlt + 200) return false;  // small slop

  return true;
}

export function tickApproach(
  ac: Aircraft,
  runways: Runway[],
  elevation_ft: number,
  _dt: number,
  events: EventBus,
): void {
  if (!ac.cleared_runway) return;
  const rwy = runways.find((r) => r.id === ac.cleared_runway);
  if (!rwy || !rwy.ils) return;

  if (ac.state === "under_control") {
    if (isEstablished(ac, rwy, elevation_ft)) {
      ac.state = "cleared_approach";
      ac.target_heading = rwy.ils.course_deg;
      events.emit({ kind: "approach_established", aircraft_id: ac.id, runway: rwy.id });
    }
    return;
  }

  if (ac.state === "cleared_approach") {
    // Glide slope auto-descent: target altitude tracks GS for current distance from threshold.
    const along = alongTrackNm(ac, rwy);
    if (along <= 0) {
      // Reached threshold — handoff handled by World on next tick.
      return;
    }
    ac.target_altitude = glideslopeAltitudeFt(rwy, elevation_ft, along);
    ac.target_heading = rwy.ils.course_deg;
  }
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test`
Expected: all approach tests pass.

- [ ] **Step 6: Commit**

```
git add src/sim/approach.ts tests/sim/approach.test.ts
git commit -m "Add ILS establishment detection and glideslope auto-fly"
```

- [ ] **Step 7: PAUSE for approval — push branch and open PR**

State to user: "Branch `feat/sim-approach` ready (1 commit). Push and open PR?"

After merge: `main`, pull, branch fresh.

---

## Task 20: World class — skeleton + command queue + physics tick

**Files:**
- Create: `src/sim/World.ts`
- Create: `tests/sim/world.test.ts`

**Branch:** `feat/sim-world`

- [ ] **Step 1: Branch fresh**

```
git checkout main && git pull
git checkout -b feat/sim-world
```

- [ ] **Step 2: Write the failing test**

Create `tests/sim/world.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { World } from "../../src/sim/World.ts";
import { KDLH } from "../../src/data/airports/kdlh.ts";
import { createArrival } from "../../src/sim/Aircraft.ts";

describe("World — basics", () => {
  it("starts with empty aircraft list and running session", () => {
    const w = new World(KDLH, { now_ms: 0 });
    expect(w.aircraft).toEqual([]);
    expect(w.session.status).toBe("running");
    expect(w.elapsed_sec).toBe(0);
  });

  it("ticks advance elapsed_sec", () => {
    const w = new World(KDLH, { now_ms: 0 });
    w.tick(1);
    w.tick(0.5);
    expect(w.elapsed_sec).toBe(1.5);
    expect(w.session.elapsed_sec).toBe(1.5);
  });

  it("tick() applies physics to aircraft", () => {
    const w = new World(KDLH, { now_ms: 0 });
    const ac = createArrival({
      id: "T1", callsign: "T1",
      position_nm: { x: 0, y: 10 }, heading_deg: 180,
      altitude_ft: 8000, speed_kts: 360,
      spawn_time_s: 0,
    });
    w.aircraft.push(ac);
    w.tick(10);
    expect(ac.position_nm.y).toBeCloseTo(9.0, 6);  // moved 1 nm south
  });

  it("enqueueCommand applies the command on the next tick", () => {
    const w = new World(KDLH, { now_ms: 0 });
    const ac = createArrival({
      id: "T1", callsign: "T1",
      position_nm: { x: 0, y: 10 }, heading_deg: 180,
      altitude_ft: 8000, speed_kts: 250,
      spawn_time_s: 0,
    });
    w.aircraft.push(ac);
    w.enqueueCommand({ kind: "assign_heading", aircraft_id: "T1", heading_deg: 90 });
    w.tick(1);
    expect(ac.target_heading).toBe(90);
  });

  it("emits command_accepted on success and command_rejected on failure", () => {
    const w = new World(KDLH, { now_ms: 0 });
    const ac = createArrival({
      id: "T1", callsign: "T1",
      position_nm: { x: 0, y: 10 }, heading_deg: 180,
      altitude_ft: 8000, speed_kts: 250,
      spawn_time_s: 0,
    });
    w.aircraft.push(ac);
    const seen: string[] = [];
    w.events.on((e) => seen.push(e.kind));

    w.enqueueCommand({ kind: "assign_heading", aircraft_id: "T1", heading_deg: 90 });
    w.tick(0);
    expect(seen).toContain("command_accepted");

    w.enqueueCommand({ kind: "assign_heading", aircraft_id: "T1", heading_deg: 999 });
    w.tick(0);
    expect(seen).toContain("command_rejected");
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npm test`
Expected: compile error.

- [ ] **Step 4: Implement src/sim/World.ts**

Create `src/sim/World.ts`:

```ts
import type { Aircraft, Airspace, Command, SessionState } from "./types.ts";
import { EventBus } from "./events.ts";
import { tickAircraft } from "./physics.ts";
import { tickApproach } from "./approach.ts";
import { findConflicts } from "./conflicts.ts";
import { executeCommand } from "./commands/executor.ts";
import { distanceNm } from "./math.ts";

export interface WorldOptions {
  now_ms: number;
  trafficEnabled?: boolean;
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export class World {
  aircraft: Aircraft[] = [];
  elapsed_sec = 0;
  events = new EventBus();
  session: SessionState;
  airspace: Airspace;
  private commandQueue: Command[] = [];
  private activeConflicts = new Set<string>();

  constructor(airspace: Airspace, opts: WorldOptions) {
    this.airspace = airspace;
    this.session = {
      id: newSessionId(),
      started_at_ms: opts.now_ms,
      elapsed_sec: 0,
      aircraft_handled: 0,
      aircraft_lost: 0,
      conflicts_raised: 0,
      score: 0,
      status: "running",
      end_reason: null,
    };
  }

  enqueueCommand(cmd: Command): void {
    this.commandQueue.push(cmd);
  }

  tick(dt: number): void {
    if (this.session.status !== "running") return;
    this.elapsed_sec += dt;
    this.session.elapsed_sec = this.elapsed_sec;

    // 1. drain commands
    const queued = this.commandQueue;
    this.commandQueue = [];
    for (const cmd of queued) {
      const r = executeCommand({ aircraft: this.aircraft, airspace: this.airspace, elapsed_sec: this.elapsed_sec }, cmd);
      if (r.ok) {
        this.events.emit({ kind: "command_accepted", command: cmd, aircraft_id: cmd.aircraft_id });
        if (cmd.kind === "clear_approach") {
          this.events.emit({ kind: "approach_cleared", aircraft_id: cmd.aircraft_id, runway: cmd.runway });
        }
        if (cmd.kind === "handoff") {
          this.session.aircraft_handled += 1;
          this.session.score += 1;
          this.events.emit({
            kind: "handed_off",
            aircraft_id: cmd.aircraft_id,
            to: cmd.to === "auto" ? "tower" : cmd.to,
          });
        }
      } else {
        this.events.emit({
          kind: "command_rejected",
          command: cmd,
          aircraft_id: cmd.aircraft_id,
          reason: r.reason ?? "rejected",
        });
      }
    }

    // 2. physics + approach
    for (const ac of this.aircraft) {
      if (ac.state === "handed_off") continue;
      tickAircraft(ac, dt);
      tickApproach(ac, this.airspace.runways, this.airspace.elevation_ft, dt, this.events);
    }

    // 3. handoff/loss detection — auto-handoff at runway threshold for cleared_approach,
    //    auto-handoff at ceiling for departures, sector-exit = lost.
    for (const ac of this.aircraft) {
      if (ac.state === "handed_off") continue;

      // Cleared aircraft reach threshold → handoff to tower
      if (ac.state === "cleared_approach" && ac.cleared_runway) {
        const rwy = this.airspace.runways.find((r) => r.id === ac.cleared_runway);
        if (rwy && distanceNm(ac.position_nm, rwy.threshold) < 0.3) {
          ac.state = "handed_off";
          ac.handoff_time_s = this.elapsed_sec;
          this.session.aircraft_handled += 1;
          this.session.score += 1;
          this.events.emit({ kind: "handed_off", aircraft_id: ac.id, to: "tower" });
          continue;
        }
      }

      // Departures climbing through ceiling → handoff to center
      if (ac.kind === "departure" && ac.altitude_ft >= this.airspace.ceiling_ft && ac.state === "under_control") {
        ac.state = "handed_off";
        ac.handoff_time_s = this.elapsed_sec;
        this.session.aircraft_handled += 1;
        this.session.score += 1;
        this.events.emit({ kind: "handed_off", aircraft_id: ac.id, to: "center" });
        continue;
      }

      // Exited sector boundary uncleared → lost
      const distFromAirport = distanceNm(ac.position_nm, { x: 0, y: 0 });
      if (distFromAirport > this.airspace.sector_radius_nm + 5 && ac.state === "under_control") {
        this.session.aircraft_lost += 1;
        this.events.emit({
          kind: "aircraft_lost",
          aircraft_id: ac.id,
          reason: "exited sector boundary uncleared",
        });
        this.endSession("lost_aircraft");
        return;
      }
    }

    // Sweep handed_off aircraft
    this.aircraft = this.aircraft.filter((ac) => ac.state !== "handed_off");

    // 4. conflict detection
    const pairs = findConflicts(this.aircraft);
    const seen = new Set<string>();
    for (const [a, b] of pairs) {
      const key = [a, b].sort().join("|");
      seen.add(key);
      if (!this.activeConflicts.has(key)) {
        this.activeConflicts.add(key);
        this.session.conflicts_raised += 1;
        this.events.emit({ kind: "conflict_raised", pair: [a, b] });
        this.endSession("separation_loss");
        return;
      }
    }
    for (const key of this.activeConflicts) {
      if (!seen.has(key)) {
        this.activeConflicts.delete(key);
        const [a, b] = key.split("|") as [string, string];
        this.events.emit({ kind: "conflict_resolved", pair: [a, b] });
      }
    }
  }

  private endSession(reason: "separation_loss" | "lost_aircraft"): void {
    this.session.status = "ended";
    this.session.end_reason = reason;
    this.events.emit({ kind: "session_ended", reason });
  }
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test`
Expected: all world basics tests pass.

- [ ] **Step 6: Commit**

```
git add src/sim/World.ts tests/sim/world.test.ts
git commit -m "Add World class with command queue, physics, and event emission"
```

---

## Task 21: World — traffic generator integration

**Files:**
- Modify: `src/sim/World.ts`
- Modify: `tests/sim/world.test.ts`

**Branch:** `feat/sim-world` (continue)

- [ ] **Step 1: Add the failing test**

Append to `tests/sim/world.test.ts`:

```ts
describe("World — traffic", () => {
  it("spawns aircraft using the configured TrafficGenerator", () => {
    const w = new World(KDLH, { now_ms: 0 });
    w.startTraffic({
      initialIntervalSec: 30,
      minIntervalSec: 30,
      rampDurationSec: 600,
      rng: () => 0,
      idGen: () => "spawn-1",
    });
    const seen: string[] = [];
    w.events.on((e) => { if (e.kind === "aircraft_spawned") seen.push(e.aircraft_id); });

    w.tick(30);
    expect(w.aircraft).toHaveLength(1);
    expect(seen).toEqual(["spawn-1"]);
  });

  it("does not spawn when traffic is not started", () => {
    const w = new World(KDLH, { now_ms: 0 });
    w.tick(60);
    expect(w.aircraft).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test`
Expected: `World.startTraffic` doesn't exist.

- [ ] **Step 3: Add traffic to World**

Modify `src/sim/World.ts` — add the field, method, and tick step:

In imports, add:
```ts
import { TrafficGenerator, type TrafficOptions } from "./traffic.ts";
```

In the `World` class, add a private field:
```ts
  private traffic: TrafficGenerator | null = null;
```

Add this method on the class:
```ts
  startTraffic(opts: TrafficOptions): void {
    this.traffic = new TrafficGenerator(this.airspace, opts);
  }
```

Inside `tick()`, between step 2 (physics) and step 3 (handoff/loss), insert:
```ts
    // 2.5 spawn
    if (this.traffic) {
      const spawned = this.traffic.tick(dt);
      if (spawned) {
        this.aircraft.push(spawned);
        this.events.emit({ kind: "aircraft_spawned", aircraft_id: spawned.id });
      }
    }
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add src/sim/World.ts tests/sim/world.test.ts
git commit -m "Wire TrafficGenerator into World tick"
```

---

## Task 22: Deterministic end-to-end scenario test

**Files:**
- Create: `tests/sim/scenarios.test.ts`

**Branch:** `feat/sim-world` (continue)

This validates the full sim pipeline by scripting commands against a synthetic scenario.

- [ ] **Step 1: Write the scenario test**

Create `tests/sim/scenarios.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { World } from "../../src/sim/World.ts";
import { KDLH } from "../../src/data/airports/kdlh.ts";
import { createArrival } from "../../src/sim/Aircraft.ts";

describe("scenario: vector arrival onto ILS 27 and land", () => {
  it("reaches handed_off with score 1 and no conflicts", () => {
    const w = new World(KDLH, { now_ms: 0 });
    // Spawn an arrival 10 nm east of threshold, on extended centerline,
    // heading 269 (already aligned), at 4000 ft (just above GS at 10nm),
    // 200 kts.
    const ac = createArrival({
      id: "DAL891", callsign: "DAL891",
      position_nm: { x: 10.84, y: 0 },
      heading_deg: 269,
      altitude_ft: 4000,
      speed_kts: 200,
      spawn_time_s: 0,
    });
    w.aircraft.push(ac);

    // Clear for ILS 27.
    w.enqueueCommand({ kind: "clear_approach", aircraft_id: "DAL891", runway: "27" });

    // Tick repeatedly until handed_off or 600 sec elapsed.
    let handedOff = false;
    w.events.on((e) => {
      if (e.kind === "handed_off") handedOff = true;
    });

    let ticks = 0;
    const dt = 1;
    while (!handedOff && ticks < 600) {
      w.tick(dt);
      ticks += 1;
    }

    expect(handedOff).toBe(true);
    expect(w.session.score).toBe(1);
    expect(w.session.aircraft_lost).toBe(0);
    expect(w.session.conflicts_raised).toBe(0);
  });
});

describe("scenario: separation loss ends session", () => {
  it("emits conflict_raised and session_ended on the same tick", () => {
    const w = new World(KDLH, { now_ms: 0 });
    const ac1 = createArrival({
      id: "A", callsign: "AAL1",
      position_nm: { x: 5, y: 0 },
      heading_deg: 270, altitude_ft: 5000, speed_kts: 250,
      spawn_time_s: 0,
    });
    const ac2 = createArrival({
      id: "B", callsign: "AAL2",
      position_nm: { x: 5.5, y: 0 },     // 0.5 nm apart, same alt
      heading_deg: 270, altitude_ft: 5000, speed_kts: 250,
      spawn_time_s: 0,
    });
    w.aircraft.push(ac1, ac2);

    const seen: string[] = [];
    w.events.on((e) => seen.push(e.kind));

    w.tick(1);

    expect(seen).toContain("conflict_raised");
    expect(seen).toContain("session_ended");
    expect(w.session.status).toBe("ended");
    expect(w.session.end_reason).toBe("separation_loss");
  });
});

describe("scenario: aircraft exits sector uncleared", () => {
  it("ends session with lost_aircraft", () => {
    const w = new World(KDLH, { now_ms: 0 });
    const ac = createArrival({
      id: "X", callsign: "XYZ1",
      position_nm: { x: 32, y: 0 },     // already past sector_radius (30) + 5
      heading_deg: 90, altitude_ft: 8000, speed_kts: 250,
      spawn_time_s: 0,
    });
    w.aircraft.push(ac);

    w.tick(1);

    expect(w.session.status).toBe("ended");
    expect(w.session.end_reason).toBe("lost_aircraft");
    expect(w.session.aircraft_lost).toBe(1);
  });
});
```

- [ ] **Step 2: Run — expect pass**

Run: `npm test`
Expected: all three scenarios pass. If any fail, fix the underlying module — do NOT modify the scenario to match incorrect behavior.

- [ ] **Step 3: Run coverage check**

Run: `npm run test:coverage`
Expected: coverage thresholds (80% lines/funcs/statements, 75% branches) met for `src/sim/`.

If coverage fails, add targeted tests rather than dropping the threshold.

- [ ] **Step 4: Commit**

```
git add tests/sim/scenarios.test.ts
git commit -m "Add deterministic end-to-end scenario tests"
```

---

## Task 23: Headless bootstrap in main.ts

**Files:**
- Create: `src/app/loop.ts`
- Modify: `src/app/main.ts`

**Branch:** `feat/sim-world` (continue)

By the end of this task, opening the dev server prints sim state to the browser console — proving the full pipeline runs end-to-end with no rendering. Plan 2 will replace the console output with an actual Canvas scope.

- [ ] **Step 1: Write src/app/loop.ts**

Create `src/app/loop.ts`:

```ts
// Fixed-step simulation loop driver.
// Advances a tick callback at a stable simulation rate (default 30 Hz)
// regardless of render framerate. Returns a stop() function.
export interface LoopOptions {
  hz?: number;
  onTick: (dt: number) => void;
  onFrame?: () => void;
}

export function startLoop(opts: LoopOptions): () => void {
  const hz = opts.hz ?? 30;
  const dt = 1 / hz;
  let lastMs = performance.now();
  let acc = 0;
  let stopped = false;
  let raf = 0;

  const frame = (now: number) => {
    if (stopped) return;
    const elapsedMs = now - lastMs;
    lastMs = now;
    acc += elapsedMs / 1000;
    // Cap to avoid spiral-of-death after a tab suspend
    if (acc > 1) acc = 1;
    while (acc >= dt) {
      opts.onTick(dt);
      acc -= dt;
    }
    opts.onFrame?.();
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);

  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
```

- [ ] **Step 2: Replace src/app/main.ts**

Overwrite `src/app/main.ts`:

```ts
import { World } from "../sim/World.ts";
import { KDLH } from "../data/airports/kdlh.ts";
import { startLoop } from "./loop.ts";

const root = document.getElementById("app");
if (!root) throw new Error("missing #app element");

const world = new World(KDLH, { now_ms: Date.now() });
world.startTraffic({
  initialIntervalSec: 60,
  minIntervalSec: 30,
  rampDurationSec: 600,
});

world.events.on((e) => {
  // eslint-disable-next-line no-console
  console.log("[event]", e);
});

let frameCount = 0;
startLoop({
  hz: 30,
  onTick: (dt) => world.tick(dt),
  onFrame: () => {
    frameCount += 1;
    if (frameCount % 60 === 0) {
      root.textContent = `t=${world.elapsed_sec.toFixed(1)}s  aircraft=${world.aircraft.length}  score=${world.session.score}  status=${world.session.status}`;
    }
  },
});

// Expose for browser-console poking during development.
(window as unknown as { world: World }).world = world;
```

- [ ] **Step 3: Verify dev server**

Run: `npm run dev`
Open `http://localhost:5173`. Expected:
- Page shows "t=… aircraft=… score=… status=running" updating roughly every second.
- After about 60 sec, the first aircraft spawns. The page text updates.
- DevTools console shows `[event] { kind: "aircraft_spawned", ... }`.

You can poke `window.world.aircraft` from the console to inspect state.

Stop the dev server with Ctrl+C.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds. `dist/index.html` and bundled JS exist.

- [ ] **Step 5: Verify all checks**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```
git add src/app/loop.ts src/app/main.ts
git commit -m "Bootstrap headless World in main.ts via fixed-step loop"
```

- [ ] **Step 7: PAUSE for approval — push branch and open PR**

State to user: "Branch `feat/sim-world` ready (4 commits — World class, traffic integration, scenario tests, bootstrap). This is the final branch of Plan 1. After merge, the headless sim core is fully functional. Push and open PR?"

After merge: `main`, pull. Plan 1 is complete.

---

## Plan 1 Done — what now?

After all PRs above are merged, the repo is at:

- A passing CI on every push.
- A pure simulation core in `src/sim/` with > 80% line coverage.
- A deterministic World that ticks correctly, accepts commands, detects conflicts, runs ILS auto-fly, spawns traffic, and emits events.
- `npm run dev` shows the headless sim running (no graphics yet).

**Next:** Return to the brainstorming/writing-plans flow to write **Plan 2: Interactive game** (Canvas scope renderer + HTML strips/HUD + keyboard command line + mouse selection + click menu + hotkeys). Plan 2 leaves audio, persistence, and deployment for Plan 3.

---

## Self-Review Checklist (run before handing off)

Already executed in this draft:

- ✅ **Spec coverage:** every spec § 4–§ 9 element that belongs in the sim core has a corresponding task. Render/input/audio/persistence/deploy are explicitly out-of-scope for this plan (they're in Plans 2 and 3).
- ✅ **Placeholder scan:** no "TBD"/"TODO"/"add validation". Each step has full code.
- ✅ **Type consistency:** `Aircraft`, `Airspace`, `Runway.heading_deg`, `Runway.threshold`, `IlsApproach.course_deg` defined in Task 7, used identically in Tasks 16/19/20.
- ✅ **Branch strategy:** every task is bound to a feature branch with explicit pause-for-approval before push.
- ⚠️ **One known approximation:** the KDLH airspace data in Task 18 uses approximate published values; the implementer is told to verify against the current FAA airport diagram before merge. This is intentional — locking exact values requires chart access.
