import type { LevelDef } from "./types";

/** World is 720x1280 logical pixels — phone portrait. */
export const WORLD = { w: 720, h: 1280 };

function groundLine(
  y: number,
  bumps: Array<{ x: number; y: number }> = [],
): LevelDef["terrain"] {
  const pts: LevelDef["terrain"] = [{ x: 40, y }];
  for (const b of bumps) pts.push(b);
  pts.push({ x: WORLD.w - 40, y });
  return pts;
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "Crease",
    hint: "Drag up on the paper to fold a ramp for the traveler.",
    terrain: groundLine(920, [
      { x: 220, y: 920 },
      { x: 360, y: 920 },
      { x: 500, y: 920 },
    ]),
    spawn: { x: 120, y: 880 },
    goal: { x: 600, y: 880 },
    foldRadius: 140,
    twoStarFolds: 2,
  },
  {
    id: 2,
    name: "Too Steep",
    hint: "A giant fold can bounce them off — try a gentler crease.",
    terrain: groundLine(940, [
      { x: 200, y: 940 },
      { x: 360, y: 940 },
      { x: 520, y: 940 },
    ]),
    spawn: { x: 110, y: 900 },
    goal: { x: 610, y: 900 },
    scrap: { x: 360, y: 700 },
    foldRadius: 150,
    twoStarFolds: 2,
  },
  {
    id: 3,
    name: "Soft Undo",
    hint: "Fold freely. Tap Undo if a crease goes wrong.",
    terrain: [
      { x: 40, y: 980 },
      { x: 180, y: 960 },
      { x: 300, y: 1000 },
      { x: 420, y: 960 },
      { x: 540, y: 1000 },
      { x: 680, y: 970 },
    ],
    spawn: { x: 100, y: 930 },
    goal: { x: 620, y: 930 },
    scrap: { x: 360, y: 780 },
    foldRadius: 130,
    twoStarFolds: 3,
  },
  {
    id: 4,
    name: "The Gap",
    hint: "Bridge the canyon with one careful fold.",
    terrain: [
      { x: 40, y: 860 },
      { x: 210, y: 860 },
      { x: 250, y: 1180 },
      { x: 470, y: 1180 },
      { x: 510, y: 860 },
      { x: 680, y: 860 },
    ],
    spawn: { x: 120, y: 820 },
    goal: { x: 600, y: 820 },
    scrap: { x: 360, y: 980 },
    foldRadius: 160,
    twoStarFolds: 2,
  },
  {
    id: 5,
    name: "Puddle Spring",
    hint: "Fold the low puddle upward into a soft trampoline.",
    terrain: [
      { x: 40, y: 880 },
      { x: 180, y: 880 },
      { x: 260, y: 1040 },
      { x: 360, y: 1080 },
      { x: 460, y: 1040 },
      { x: 540, y: 880 },
      { x: 680, y: 880 },
    ],
    spawn: { x: 110, y: 840 },
    goal: { x: 610, y: 840 },
    scrap: { x: 360, y: 860 },
    foldRadius: 150,
    twoStarFolds: 3,
  },
];
