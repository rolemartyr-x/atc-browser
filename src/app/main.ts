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
import { LocalStorageAdapter } from "../storage/Storage";
import { SettingsStore } from "./settings";
import { SettingsModal } from "../render/SettingsModal";
import { Sfx } from "../audio/Sfx";
import { bindSfxToWorld } from "../audio/sfxBindings";
import { Tts } from "../audio/Tts";
import { bindTtsToWorld } from "../audio/ttsBindings";
import { GameOverScreen } from "../render/GameOverScreen";

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

const settingsStore = new SettingsStore(new LocalStorageAdapter());
const appState = createAppState(settingsStore);
const sfx = new Sfx(settingsStore);
bindSfxToWorld(world, sfx);
const tts = new Tts(settingsStore);
bindTtsToWorld(world, tts);
// Add ~15% margin around the sector boundary so the scope doesn't fill the
// canvas edge-to-edge. Aircraft outside the sector still render (briefly,
// before they exit and the session ends).
const SCOPE_RANGE_NM = KDLH.sector_radius_nm * 1.15;
const projection = new Projection(canvas.clientWidth, canvas.clientHeight, SCOPE_RANGE_NM);
const scope = new Scope(canvas, projection);
const strips = new Strips(stripsEl, (id) => {
  if (id !== appState.selectedAircraftId && id !== null) sfx.play("select");
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
    if (id !== appState.selectedAircraftId && id !== null) sfx.play("select");
    appState.selectedAircraftId = id;
    if (id) clickMenu.showFor(id);
    else clickMenu.hide();
  },
});

const settingsModal = new SettingsModal({
  toggle: getElement<HTMLButtonElement>("settings-toggle"),
  root: getElement("settings-modal"),
  sfx: getElement<HTMLInputElement>("setting-sfx"),
  tts: getElement<HTMLInputElement>("setting-tts"),
  volume: getElement<HTMLInputElement>("setting-volume"),
  volumeDisplay: getElement("setting-volume-display"),
  voice: getElement<HTMLSelectElement>("setting-voice"),
  close: getElement<HTMLButtonElement>("settings-close"),
  store: settingsStore,
  listVoices: () =>
    typeof speechSynthesis !== "undefined" ? speechSynthesis.getVoices() : [],
});
if (typeof speechSynthesis !== "undefined") {
  speechSynthesis.addEventListener?.("voiceschanged", () => settingsModal.refreshVoices());
}

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

(window as unknown as {
  world: World;
  appState: typeof appState;
  settingsStore: SettingsStore;
  settingsModal: SettingsModal;
}).world = world;
(window as unknown as {
  world: World;
  appState: typeof appState;
  settingsStore: SettingsStore;
  settingsModal: SettingsModal;
}).appState = appState;
(window as unknown as {
  world: World;
  appState: typeof appState;
  settingsStore: SettingsStore;
  settingsModal: SettingsModal;
}).settingsStore = settingsStore;
(window as unknown as {
  world: World;
  appState: typeof appState;
  settingsStore: SettingsStore;
  settingsModal: SettingsModal;
}).settingsModal = settingsModal;
