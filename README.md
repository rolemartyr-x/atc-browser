# atc-browser

Browser-based approach control (TRACON) radar simulator. Vector arrivals, sequence them onto the ILS, depart traffic, hand off, and don't lose separation.

**Play it:** https://rolemartyr-x.github.io/atc-browser/

> Requires GitHub Pages to be enabled in repo settings (Settings → Pages → Source: GitHub Actions). The first push to `main` after enabling Pages will publish.

## Quickstart (local dev)

```bash
npm install
npm run dev          # http://localhost:5173
```

Requires Node 20+.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Vitest unit tests (sim core + adapters) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Controls

- **Click** an aircraft to select it.
- **Type** commands at the bottom prompt:
  - `<callsign> H 240` — fly heading 240
  - `<callsign> A 80` — descend/climb to 8000 ft
  - `<callsign> S 210` — speed 210 kts
  - `<callsign> L 27` — cleared ILS runway 27 approach
  - `<callsign> X` — handoff (auto: tower for arrivals, center for departures)
- **Hotkeys** with an aircraft selected: H / A / S / L / X prefill the command line.
- **Tab** completes a partial callsign. **Up/Down** scroll history. **Esc** clears.
- **⚙** in the top-right opens audio settings.

## Architecture

A pure simulation core in `src/sim/` with no DOM/Canvas/audio dependencies. Adapter layers wrap it:

| Layer | Path |
|---|---|
| Render | `src/render/` |
| Input | `src/input/` |
| Audio | `src/audio/` |
| Storage | `src/storage/` |
| App bootstrap | `src/app/` |

See `docs/superpowers/specs/2026-05-04-atc-browser-design.md` for the full design.

## Plan history

- `docs/superpowers/plans/2026-05-04-plan-1-sim-core.md` — headless simulation
- `docs/superpowers/plans/2026-05-05-plan-2-interactive-game.md` — render + input
- `docs/superpowers/plans/2026-05-05-plan-3-audio-persistence-deployment.md` — audio + persistence + deploy
