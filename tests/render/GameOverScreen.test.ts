// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { GameOverScreen } from "../../src/render/GameOverScreen";
import type { HighScore } from "../../src/storage/Storage";

function setup() {
  document.body.innerHTML = `
    <div id="game-over" hidden>
      <div class="modal-card">
        <div id="game-over-reason"></div>
        <span id="game-over-score"></span>
        <span id="game-over-duration"></span>
        <ol id="game-over-highscores"></ol>
        <button id="game-over-restart"></button>
      </div>
    </div>
  `;
  const onRestart = vi.fn();
  const screen = new GameOverScreen({
    root: document.getElementById("game-over") as HTMLElement,
    reason: document.getElementById("game-over-reason") as HTMLElement,
    score: document.getElementById("game-over-score") as HTMLElement,
    duration: document.getElementById("game-over-duration") as HTMLElement,
    highScores: document.getElementById("game-over-highscores") as HTMLOListElement,
    restart: document.getElementById("game-over-restart") as HTMLButtonElement,
    onRestart,
  });
  return { screen, onRestart };
}

describe("GameOverScreen", () => {
  it("show populates the overlay and removes the hidden attribute", () => {
    const { screen } = setup();
    const high: HighScore[] = [
      { score: 12, duration_sec: 600, ended_at: "2026-05-05T00:00:00.000Z" },
      { score: 5, duration_sec: 200, ended_at: "2026-05-04T00:00:00.000Z" },
    ];
    screen.show({
      reason: "separation_loss",
      score: 5,
      duration_sec: 200,
      highScores: high,
      currentEndedAt: "2026-05-04T00:00:00.000Z",
    });
    const root = document.getElementById("game-over")!;
    expect(root.hasAttribute("hidden")).toBe(false);
    expect(document.getElementById("game-over-reason")!.textContent).toContain("separation");
    expect(document.getElementById("game-over-score")!.textContent).toBe("5");
    expect(document.getElementById("game-over-duration")!.textContent).toBe("3:20");
    const items = document.querySelectorAll<HTMLLIElement>("#game-over-highscores li");
    expect(items.length).toBe(2);
    // The current run's row should be marked
    const currentRows = [...items].filter((li) => li.classList.contains("current"));
    expect(currentRows).toHaveLength(1);
  });

  it("renders an empty placeholder when no scores yet", () => {
    const { screen } = setup();
    screen.show({
      reason: "lost_aircraft",
      score: 0,
      duration_sec: 30,
      highScores: [],
      currentEndedAt: null,
    });
    const items = document.querySelectorAll<HTMLLIElement>("#game-over-highscores li");
    expect(items.length).toBe(1);
    expect(items[0]!.classList.contains("empty")).toBe(true);
  });

  it("Play Again invokes the onRestart callback", () => {
    const { screen, onRestart } = setup();
    screen.show({
      reason: "separation_loss",
      score: 0,
      duration_sec: 0,
      highScores: [],
      currentEndedAt: null,
    });
    document.getElementById("game-over-restart")!.dispatchEvent(new MouseEvent("click"));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("hide adds the hidden attribute", () => {
    const { screen } = setup();
    screen.show({ reason: "separation_loss", score: 0, duration_sec: 0, highScores: [], currentEndedAt: null });
    screen.hide();
    expect(document.getElementById("game-over")!.hasAttribute("hidden")).toBe(true);
  });
});
