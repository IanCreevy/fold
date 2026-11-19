import { applyFold, clonePts, pathLooksWalkable } from "./foldMath";
import { MIXED_COUNT, TRAINING_COUNT, WORLD } from "./levelsMeta";
import type { LevelDef, LevelSection, SkyMood, Vec } from "./types";
import { geometricProof } from "./verify";

export { WORLD, TRAINING_COUNT, MIXED_COUNT };

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const RAMP_NAMES = [
  "Crease", "Soft Rise", "Morning Slope", "Paper Lean", "Gentle Roll",
  "Sunfold", "Attic Ramp", "Pulp Drift", "Warm Incline", "First Downhill",
];
const BRIDGE_NAMES = [
  "The Gap", "String Span", "Canyon Crease", "Narrow Cross", "Folded Arch",
  "Ravine", "Postcard Bridge", "Ink Crossing", "Thin Shelf", "Far Bank",
];
const TRAMP_NAMES = [
  "Puddle Spring", "Bounce Scrap", "Jelly Crease", "Spring Valley", "Hop Desk",
  "Rubber Fold", "Sky Bounce", "Trampoline Bay", "Rebound", "Double Spring",
];

function skyFor(section: LevelSection, i: number): SkyMood {
  if (section === "trampolines") return i % 3 === 2 ? "golden" : "sunny";
  if (section === "bridges") return i % 4 === 3 ? "storm" : i % 3 === 1 ? "rain" : "sunny";
  if (section === "mixed") {
    const m = i % 7;
    if (m === 2) return "rain";
    if (m === 4) return "storm";
    if (m === 6) return "golden";
    return "sunny";
  }
  return i % 5 === 4 ? "golden" : "sunny";
}

/** Gentle downhill ribbon — always rollable with Go. */
function makeSolutionRibbon(yStart: number, drop: number): Vec[] {
  const xs = [40, 100, 160, 220, 280, 340, 400, 460, 520, 580, 640, 680];
  return xs.map((x) => {
    const t = (x - 40) / (680 - 40);
    return { x, y: yStart + drop * t };
  });
}

/**
 * Carve by folding DOWN, record the exact inverse crease.
 * Applying solutionFolds in order restores the ribbon perfectly.
 */
function carveByFold(
  terrain: Vec[],
  creaseX: number,
  depth: number,
  foldRadius: number,
  restoreFolds: Array<{ x: number; deltaY: number }>,
): Vec[] {
  // New carve first in restore list? We prepend inverse so restore runs last-carve-first.
  restoreFolds.unshift({ x: creaseX, deltaY: -depth });
  return applyFold(terrain, creaseX, depth, foldRadius);
}

function assertRibbon(level: LevelDef): LevelDef {
  if (geometricProof(level)) return level;
  // Absolute fallback — tiny single invertible gap
  const ribbon = makeSolutionRibbon(880, 50);
  const folds: Array<{ x: number; deltaY: number }> = [];
  const terrain = carveByFold(clonePts(ribbon), 360, 160, 140, folds);
  return {
    ...level,
    terrain,
    spawn: { x: 110, y: 840 },
    goal: { x: 600, y: 900 },
    foldRadius: 140,
    blockers: undefined,
    trampolineBands: undefined,
    solutionFolds: folds,
    hint: "Fold the gap upward into a bridge, then press Go.",
  };
}

function makeRamp(id: number, index: number): LevelDef {
  const foldRadius = 160;
  if (index < 2) {
    // Flat start; intended solve is raise-left (recorded as solution)
    const terrain = makeSolutionRibbon(920, 0);
    const fold = { x: 150, deltaY: -130 - index * 10 };
    // Puzzle is flat; solution fold creates downhill from spawn on the right face
    return assertRibbon({
      id,
      name: RAMP_NAMES[index],
      hint:
        index === 0
          ? "Drag UP at the red mark to raise the left — then Go and roll downhill past the door."
          : "Raise the left gently. Match the red guide, then Go.",
      section: "ramps",
      sky: skyFor("ramps", index),
      terrain,
      spawn: { x: 210, y: 880 },
      goal: { x: 580, y: 900 },
      foldRadius: 170,
      guideFolds: [fold],
      solutionFolds: [fold],
    });
  }

  const ribbon = makeSolutionRibbon(880, 90 + index * 4);
  const folds: Array<{ x: number; deltaY: number }> = [];
  let terrain = clonePts(ribbon);
  if (index >= 3) {
    const depth = 90 + (index - 2) * 20;
    terrain = carveByFold(terrain, 320, depth, foldRadius, folds);
  }
  return assertRibbon({
    id,
    name: RAMP_NAMES[index],
    hint:
      index < 3
        ? "Training: build a clean downhill. Cross the door at any height."
        : "Fold the dip back up into a path, then Go.",
    section: "ramps",
    sky: skyFor("ramps", index),
    terrain,
    spawn: { x: 120, y: 860 },
    goal: { x: 600, y: 920 },
    scrap: index > 1 ? { x: 360, y: 760 } : undefined,
    foldRadius,
    solutionFolds: folds,
  });
}

function makeBridge(id: number, index: number): LevelDef {
  const hard = Math.max(0, index - 1) / 9;
  const foldRadius = 170;
  const ribbon = makeSolutionRibbon(800, 100);
  const folds: Array<{ x: number; deltaY: number }> = [];
  const depth = 200 + hard * 120;
  const mid = 340 + index * 4;
  const terrain = carveByFold(clonePts(ribbon), mid, depth, foldRadius, folds);
  return assertRibbon({
    id,
    name: BRIDGE_NAMES[index],
    hint: "Fold the canyon upward into a bridge, then press Go. You don’t steer the moth.",
    section: "bridges",
    sky: skyFor("bridges", index),
    terrain,
    spawn: { x: 100, y: 780 },
    goal: { x: 610, y: 840 },
    scrap: { x: mid, y: 980 },
    foldRadius,
    solutionFolds: folds,
  });
}

function makeTrampoline(id: number, index: number): LevelDef {
  const hard = index / 9;
  const foldRadius = 160;
  const ribbon = makeSolutionRibbon(820, 100 + hard * 40);
  const folds: Array<{ x: number; deltaY: number }> = [];
  const mid = 340;
  const depth = 170 + hard * 70;
  const terrain = carveByFold(clonePts(ribbon), mid, depth, foldRadius, folds);
  const x0 = mid - 55;
  const x1 = mid + 55;
  return assertRibbon({
    id,
    name: TRAMP_NAMES[index],
    hint:
      "Coral is a trampoline (optional). Or fold the pit back up into a bridge, then Go.",
    section: "trampolines",
    sky: skyFor("trampolines", index),
    terrain,
    spawn: { x: 100, y: 810 },
    goal: { x: 610, y: 870 },
    scrap: { x: mid, y: 900 },
    foldRadius,
    trampolineBands: [{ x0, x1 }],
    solutionFolds: folds,
  });
}

function mixDifficulty(index: number): number {
  const early = Math.min(1, index / 55);
  const late = Math.min(1, index / 220);
  return Math.min(1, 0.22 + 0.58 * early + 0.2 * late);
}

function makeMixed(id: number, index: number): LevelDef {
  const rnd = mulberry32(12000 + index * 131);
  const d = mixDifficulty(index);
  const foldRadius = Math.max(110, 165 - d * 40);
  const yStart = 820 + rnd() * 25;
  const ribbon = makeSolutionRibbon(yStart, 100 + d * 40);
  const folds: Array<{ x: number; deltaY: number }> = [];
  let terrain = clonePts(ribbon);

  const gapCount = d < 0.3 ? 1 : d < 0.55 ? 2 : rnd() > 0.35 ? 3 : 2;
  let cursor = 220 + rnd() * 40;
  for (let g = 0; g < gapCount; g++) {
    const depth = 150 + d * 110 + rnd() * 30;
    const cx = cursor;
    if (cx > 500) break;
    terrain = carveByFold(terrain, cx, depth, foldRadius, folds);
    cursor += 110 + rnd() * 50;
  }

  // Wall above the pristine ribbon path (exact restore clears under it)
  let blockers: LevelDef["blockers"];
  if (d > 0.3 && rnd() > 0.4) {
    const wallX = 540 + rnd() * 30;
    const pathY = yStart + (40 + d * 30) * ((wallX - 40) / 640);
    const bottom = pathY - 40;
    const top = 260;
    const h = bottom - top;
    if (h > 140) {
      blockers = [{ x: wallX, y: (top + bottom) / 2, w: 28 + d * 10, h }];
    }
  }

  let trampolineBands: LevelDef["trampolineBands"];
  if (folds.length && d > 0.35 && rnd() > 0.45) {
    const fx = folds[folds.length - 1]?.x ?? 340;
    trampolineBands = [{ x0: fx - 45, x1: fx + 45 }];
  }

  // Verify restore equals ribbon walkability under wall
  let restored = clonePts(terrain);
  for (const f of folds) restored = applyFold(restored, f.x, f.deltaY, foldRadius);
  if (!pathLooksWalkable(restored, 100, 620, blockers ?? [])) {
    blockers = undefined;
  }

  const kind =
    (folds.length >= 3 && "Triple") ||
    (blockers && "Ink Wall") ||
    (folds.length === 2 && "Twin Gap") ||
    (trampolineBands && "Spring") ||
    "Gap";

  return assertRibbon({
    id,
    name: `Mix ${index + 1} · ${kind}`,
    hint: blockers
      ? "Fold each gap back up so the path goes under the dark wall, then Go. You don’t steer the moth."
      : "Fold each pit upward into a bridge, then Go. One left ramp won’t fix every gap.",
    section: "mixed",
    sky: skyFor("mixed", index),
    terrain,
    spawn: { x: 100, y: yStart - 40 },
    goal: { x: 620, y: yStart + 50 },
    scrap: { x: 360, y: 720 },
    foldRadius,
    blockers,
    trampolineBands,
    solutionFolds: folds,
  });
}

function buildCampaign(): LevelDef[] {
  const levels: LevelDef[] = [];
  let id = 1;
  for (let i = 0; i < 10; i++) levels.push(makeRamp(id++, i));
  for (let i = 0; i < 10; i++) levels.push(makeBridge(id++, i));
  for (let i = 0; i < 10; i++) levels.push(makeTrampoline(id++, i));
  for (let i = 0; i < MIXED_COUNT; i++) levels.push(makeMixed(id++, i));
  return levels.map(assertRibbon);
}

export const LEVELS: LevelDef[] = buildCampaign();

export function estimatePlaytimeHours(): {
  levels: number;
  casualHours: number;
  skilledHours: number;
  monthsHint: string;
} {
  const levels = LEVELS.length;
  const casualHours = Math.round((levels * 4.0) / 60);
  const skilledHours = Math.round((levels * 1.8) / 60);
  const monthsAt15m = Math.max(1, Math.round((casualHours * 60) / (15 * 30)));
  return {
    levels,
    casualHours,
    skilledHours,
    monthsHint: `~${monthsAt15m} month${monthsAt15m > 1 ? "s" : ""} at 15 min/day (casual)`,
  };
}
