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
