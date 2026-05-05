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
