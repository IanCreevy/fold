import campaign from "./campaign.json" with { type: "json" };
import type { LevelDef } from "./types";

export { MIXED_COUNT, TRAINING_COUNT, WORLD } from "./levelsMeta";

export const LEVELS = campaign as LevelDef[];

export function estimatePlaytimeHours(): {
  levels: number;
  casualHours: number;
  skilledHours: number;
  monthsHint: string;
} {
  const levels = LEVELS.length;
  const casualHours = Math.round((levels * 4.2) / 60);
  const skilledHours = Math.round((levels * 1.9) / 60);
  const monthsAt15m = Math.max(1, Math.round((casualHours * 60) / (15 * 30)));
  return {
    levels,
    casualHours,
    skilledHours,
    monthsHint: `~${monthsAt15m} month${monthsAt15m > 1 ? "s" : ""} at 15 min/day (casual)`,
  };
}
