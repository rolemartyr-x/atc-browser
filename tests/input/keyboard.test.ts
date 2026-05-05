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
