import { describe, it, expect } from "vitest";
import { recordHighScore, getHighScores, MAX_HIGH_SCORES } from "../../src/storage/highScores";
import type { PersistedBlob } from "../../src/storage/Storage";
import { defaultBlob } from "../../src/storage/Storage";

describe("highScores", () => {
  it("MAX_HIGH_SCORES is 10 (per spec)", () => {
    expect(MAX_HIGH_SCORES).toBe(10);
  });

  it("recordHighScore inserts into an empty list", () => {
    const blob = defaultBlob();
    const next = recordHighScore(blob, "kdlh", { score: 5, duration_sec: 200, ended_at: "2026-05-05T12:00:00.000Z" });
    expect(getHighScores(next, "kdlh")).toEqual([
      { score: 5, duration_sec: 200, ended_at: "2026-05-05T12:00:00.000Z" },
    ]);
    // Original blob is not mutated
    expect(getHighScores(blob, "kdlh")).toEqual([]);
  });

  it("sorts by score descending, ties broken by shorter duration", () => {
    let blob: PersistedBlob = defaultBlob();
    blob = recordHighScore(blob, "kdlh", { score: 5, duration_sec: 300, ended_at: "a" });
    blob = recordHighScore(blob, "kdlh", { score: 9, duration_sec: 500, ended_at: "b" });
    blob = recordHighScore(blob, "kdlh", { score: 5, duration_sec: 200, ended_at: "c" });
    blob = recordHighScore(blob, "kdlh", { score: 9, duration_sec: 400, ended_at: "d" });
    expect(getHighScores(blob, "kdlh").map((h) => h.ended_at)).toEqual(["d", "b", "c", "a"]);
  });

  it("trims to MAX_HIGH_SCORES (10)", () => {
    let blob = defaultBlob();
    for (let i = 0; i < 15; i++) {
      blob = recordHighScore(blob, "kdlh", { score: i, duration_sec: 100, ended_at: `t${i}` });
    }
    const list = getHighScores(blob, "kdlh");
    expect(list).toHaveLength(10);
    // Top entry should be the largest score (14)
    expect(list[0]!.score).toBe(14);
    // Lowest kept score should be 5 (we kept the top 10)
    expect(list[9]!.score).toBe(5);
  });

  it("getHighScores returns [] for unknown airport", () => {
    expect(getHighScores(defaultBlob(), "nope")).toEqual([]);
  });

  it("airport key is lowercased so callers don't have to think about case", () => {
    let blob = defaultBlob();
    blob = recordHighScore(blob, "KDLH", { score: 7, duration_sec: 100, ended_at: "x" });
    expect(getHighScores(blob, "kdlh")).toHaveLength(1);
    expect(getHighScores(blob, "KDLH")).toHaveLength(1);
  });
});
