import type { HighScore, PersistedBlob } from "./Storage";

export const MAX_HIGH_SCORES = 10;

export function recordHighScore(
  blob: PersistedBlob,
  icao: string,
  entry: HighScore,
): PersistedBlob {
  const key = icao.toLowerCase();
  const existing = blob.high_scores[key] ?? [];
  const merged = [...existing, entry].sort(compareScores).slice(0, MAX_HIGH_SCORES);
  return {
    ...blob,
    high_scores: { ...blob.high_scores, [key]: merged },
  };
}

export function getHighScores(blob: PersistedBlob, icao: string): HighScore[] {
  return blob.high_scores[icao.toLowerCase()] ?? [];
}

function compareScores(a: HighScore, b: HighScore): number {
  if (b.score !== a.score) return b.score - a.score;        // higher score first
  return a.duration_sec - b.duration_sec;                   // tie: faster first
}
