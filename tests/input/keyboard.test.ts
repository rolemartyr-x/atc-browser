// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { CommandLineController, completeCallsign, navigateHistory } from "../../src/input/keyboard";
import { HotkeyHandler } from "../../src/input/keyboard";

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
      t.input.blur();
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
