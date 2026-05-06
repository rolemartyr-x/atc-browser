import type { HighScore } from "../storage/Storage";

export interface GameOverScreenElements {
  root: HTMLElement;
  reason: HTMLElement;
  score: HTMLElement;
  duration: HTMLElement;
  highScores: HTMLOListElement;
  restart: HTMLButtonElement;
  onRestart: () => void;
}

export interface GameOverPayload {
  reason: "separation_loss" | "lost_aircraft" | string;
  score: number;
  duration_sec: number;
  highScores: HighScore[];
  // Used to highlight the just-finished run in the high-score list.
  currentEndedAt: string | null;
}

const REASON_TEXT: Record<string, string> = {
  separation_loss: "Loss of separation — two aircraft came within 3 nm and 1000 ft.",
  lost_aircraft: "Aircraft exited the sector boundary uncleared.",
};

export class GameOverScreen {
  constructor(private el: GameOverScreenElements) {
    el.restart.addEventListener("click", () => el.onRestart());
  }

  show(payload: GameOverPayload): void {
    this.el.reason.textContent = REASON_TEXT[payload.reason] ?? payload.reason;
    this.el.score.textContent = payload.score.toString();
    this.el.duration.textContent = formatDuration(payload.duration_sec);
    this.renderHighScores(payload.highScores, payload.currentEndedAt);
    this.el.root.removeAttribute("hidden");
  }

  hide(): void {
    this.el.root.setAttribute("hidden", "");
  }

  private renderHighScores(list: HighScore[], currentEndedAt: string | null): void {
    this.el.highScores.innerHTML = "";
    if (list.length === 0) {
      const li = document.createElement("li");
      li.classList.add("empty");
      li.textContent = "No high scores yet.";
      this.el.highScores.appendChild(li);
      return;
    }
    for (const h of list) {
      const li = document.createElement("li");
      if (currentEndedAt && h.ended_at === currentEndedAt) {
        li.classList.add("current");
      }
      const left = document.createElement("span");
      left.textContent = `${h.score} pts`;
      const right = document.createElement("span");
      right.textContent = formatDuration(h.duration_sec);
      li.appendChild(left);
      li.appendChild(right);
      this.el.highScores.appendChild(li);
    }
  }
}

function formatDuration(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const mm = Math.floor(total / 60);
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}
