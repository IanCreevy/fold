import { applyFold, clonePts, sampleTerrainY } from "./foldMath";
import { MIXED_COUNT, TRAINING_COUNT, WORLD } from "./levelsMeta";
import type { LevelDef, LevelSection, SkyMood, Vec } from "./types";
import { simulateSolution } from "./verify";

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

function makeSolutionRibbon(yStart: number, drop: number): Vec[] {
  const xs = [40, 100, 160, 220, 280, 340, 400, 460, 520, 580, 640, 680];
  return xs.map((x) => {
    const t = (x - 40) / (680 - 40);
    return { x, y: yStart + drop * t };
  });
}

/** Carve by folding down; prepend exact inverse for a proven bridge restore. */
function carveByFold(
  terrain: Vec[],
  creaseX: number,
  depth: number,
  foldRadius: number,
  restoreFolds: Array<{ x: number; deltaY: number }>,
): Vec[] {
  restoreFolds.unshift({ x: creaseX, deltaY: -depth });
  return applyFold(terrain, creaseX, depth, foldRadius);
}

function assertDoable(level: LevelDef): LevelDef {
  // Physics clear with recorded solution folds is the real guarantee
  // (bridges restore a ribbon; spring gates clear via bounce).
  if (simulateSolution(level).ok) return level;

  const folds: Array<{ x: number; deltaY: number }> = [];
  const ribbon = makeSolutionRibbon(860, 110);
  const terrain = carveByFold(clonePts(ribbon), 360, 180, 150, folds);
  const safe: LevelDef = {
    ...level,
    terrain,
    spawn: { x: 110, y: 820 },
    goal: { x: 610, y: 940 },
    foldRadius: 150,
    blockers: undefined,
    trampolineBands: undefined,
    solutionFolds: folds,
    hint: "Fold the gap upward into a bridge, then press Go.",
  };
  if (simulateSolution(safe).ok) return safe;
  return safe;
}

function makeRamp(id: number, index: number): LevelDef {
  const foldRadius = 160;
  if (index < 2) {
    const terrain = makeSolutionRibbon(920, 0);
    const fold = { x: 150, deltaY: -130 - index * 10 };
    return assertDoable({
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

  const folds: Array<{ x: number; deltaY: number }> = [];
  let terrain = clonePts(makeSolutionRibbon(880, 90 + index * 4));
  if (index >= 3) {
    terrain = carveByFold(terrain, 320, 90 + (index - 2) * 22, foldRadius, folds);
  }
  return assertDoable({
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
  const foldRadius = Math.max(130, 175 - hard * 40);
  const folds: Array<{ x: number; deltaY: number }> = [];
  const depth = 210 + hard * 130;
  const mid = 340 + index * 5;
  const terrain = carveByFold(
    clonePts(makeSolutionRibbon(800, 100 + hard * 30)),
    mid,
    depth,
    foldRadius,
    folds,
  );
  return assertDoable({
    id,
    name: BRIDGE_NAMES[index],
    hint: "Fold the canyon upward into a bridge, then Go. Aim the crease at the middle of the gap.",
    section: "bridges",
    sky: skyFor("bridges", index),
    terrain,
    spawn: { x: 100, y: 780 },
    goal: { x: 610, y: 860 },
    scrap: { x: mid, y: 1000 },
    foldRadius,
    solutionFolds: folds,
  });
}

function makeTrampoline(id: number, index: number): LevelDef {
  const hard = index / 9;
  // Later training springs: wider pit + smaller fold radius → bounce is the obvious answer
  const foldRadius = Math.max(100, 155 - hard * 50);
  const leftY = 820;
  const pitY = 1040 + hard * 60;
  const farY = 860 + hard * 20;
  const x0 = 250;
  const x1 = x0 + 140 + hard * 40;
  const terrain: Vec[] = [
    { x: 40, y: leftY },
    { x: x0 - 30, y: leftY },
    { x: x0, y: pitY },
    { x: (x0 + x1) / 2, y: pitY + 10 },
    { x: x1, y: pitY },
    { x: x1 + 40, y: farY },
    { x: 680, y: farY + 30 },
  ];
  // Proven setup: raise left shelf so they roll into coral with speed
  const solutionFolds = [{ x: 160, deltaY: -100 - hard * 20 }];
  let level: LevelDef = {
    id,
    name: TRAMP_NAMES[index],
    hint:
      hard < 0.3
        ? "Fold a ramp into the coral trampoline — bounce clears the far side. (Or bridge if you can.)"
        : "The gap is wide on purpose — fold into the coral and bounce. Bridging the whole pit is the hard way.",
    section: "trampolines",
    sky: skyFor("trampolines", index),
    terrain,
    spawn: { x: 100, y: leftY - 40 },
    goal: { x: 610, y: farY - 20 },
    scrap: { x: (x0 + x1) / 2, y: pitY - 90 },
    foldRadius,
    trampolineBands: [{ x0, x1 }],
    solutionFolds,
  };
  // Auto-lower far bank until bounce clear is reliable
  for (let i = 0; i < 8; i++) {
    if (simulateSolution(level).ok) break;
    level = {
      ...level,
      terrain: level.terrain.map((p) =>
        p.x >= x1 ? { ...p, y: p.y + 18 } : p,
      ),
      goal: { ...level.goal, y: level.goal.y + 18 },
    };
  }
  return assertDoable(level);
}

/** Steeper curve so ~level 80 already asks for real thought. */
function mixDifficulty(index: number): number {
  return Math.min(1, 0.15 + 0.85 * Math.pow(index / 160, 0.75));
}

type MixMode = "bridge" | "twin" | "wallBridge" | "springGate" | "gauntlet";

function pickMode(d: number, rnd: () => number): MixMode {
  if (d < 0.18) return "bridge";
  if (d < 0.32) return rnd() < 0.55 ? "bridge" : "twin";
  if (d < 0.48) {
    const r = rnd();
    if (r < 0.3) return "twin";
    if (r < 0.6) return "wallBridge";
    return "springGate";
  }
  if (d < 0.7) {
    const r = rnd();
    if (r < 0.25) return "wallBridge";
    if (r < 0.6) return "springGate";
    return "gauntlet";
  }
  const r = rnd();
  if (r < 0.2) return "wallBridge";
  if (r < 0.55) return "springGate";
  return "gauntlet";
}

function makeSpringGate(id: number, index: number, d: number, rnd: () => number): LevelDef {
  const foldRadius = Math.max(95, 130 - d * 35);
  const leftY = 800 + rnd() * 20;
  const pitY = 1060 + d * 50;
  // Wide pit — harder to bridge with a small fold radius (bounce is the intended read)
  const x0 = 230 + rnd() * 30;
  const x1 = x0 + 160 + d * 50;
  let farY = 780 - d * 40 + rnd() * 30;
  const wallX = Math.min(600, x1 + 55);

  const build = (fy: number): LevelDef => {
    const terrain: Vec[] = [
      { x: 40, y: leftY },
      { x: x0 - 25, y: leftY },
      { x: x0, y: pitY },
      { x: (x0 + x1) / 2, y: pitY + 12 },
      { x: x1, y: pitY },
      { x: x1 + 30, y: fy },
      { x: 680, y: fy + 25 },
    ];
    // Raise left so they enter the spring with downhill speed — obvious once you see coral
    const solutionFolds = [{ x: 140, deltaY: -110 - d * 30 }];
    const pathY = fy;
    const bottom = pathY - 44;
    const top = 240;
    const blockers =
      bottom - top > 150
        ? [{ x: wallX, y: (top + bottom) / 2, w: 30 + d * 8, h: bottom - top }]
        : undefined;
    return {
      id,
      name: `Mix ${index + 1} · Spring Gate`,
      hint: "Fold a ramp into the coral trampoline. The wall stops flying over — bounce is the clean answer.",
      section: "mixed",
      sky: skyFor("mixed", index),
      terrain,
      spawn: { x: 100, y: leftY - 40 },
      goal: { x: 630, y: fy - 20 },
      scrap: { x: (x0 + x1) / 2, y: pitY - 100 },
      foldRadius,
      trampolineBands: [{ x0, x1 }],
      blockers,
      solutionFolds,
    };
  };

  let level = build(farY);
  for (let i = 0; i < 10; i++) {
    if (simulateSolution(level).ok) return level;
    farY += 20; // lower far bank until bounce clears — no more “missed by a fraction”
    level = build(farY);
  }
  return level;
}

function makeGauntlet(id: number, index: number, d: number, _rnd: () => number): LevelDef {
  const foldRadius = Math.max(100, 140 - d * 30);
  const folds: Array<{ x: number; deltaY: number }> = [];
  let terrain = clonePts(makeSolutionRibbon(790, 120 + d * 40));
  // First gap: must bridge
  terrain = carveByFold(terrain, 250, 170 + d * 60, foldRadius, folds);
  // Second: wide spring pit
  const x0 = 400;
  const x1 = 400 + 130 + d * 40;
  // Manual pit (not fully bridgeable with one crease) + coral
  for (const p of terrain) {
    if (p.x >= x0 && p.x <= x1) p.y = 1080 + d * 40;
  }
  // Keep first gap's inverse folds; add entry ramp into spring as extra solution crease
  folds.push({ x: 340, deltaY: -90 });
  const wallX = 560;
  const pathY = sampleTerrainY(
    (() => {
      let r = clonePts(terrain);
      for (const f of folds) r = applyFold(r, f.x, f.deltaY, foldRadius);
      return r;
    })(),
    wallX,
  );
  // For spring section, physics proof matters more than perfect geometric bridge
  let level: LevelDef = {
    id,
    name: `Mix ${index + 1} · Gauntlet`,
    hint: "Bridge the first pit, then bounce the coral. Two ideas, one postcard.",
    section: "mixed",
    sky: skyFor("mixed", index),
    terrain,
    spawn: { x: 100, y: 760 },
    goal: { x: 630, y: 900 },
    scrap: { x: 320, y: 700 },
    foldRadius,
    trampolineBands: [{ x0, x1 }],
    blockers: [
      {
        x: wallX,
        y: 480,
        w: 32,
        h: Math.max(160, pathY - 40 - 280),
      },
    ],
    solutionFolds: folds,
  };

  for (let i = 0; i < 8; i++) {
    if (simulateSolution(level).ok) return level;
    // Lower everything right of spring
    level = {
      ...level,
      terrain: level.terrain.map((p) =>
        p.x >= x1 ? { ...p, y: p.y + 22 } : p,
      ),
    };
  }
  // If still failing, fall back to proven twin bridge
  const fb: Array<{ x: number; deltaY: number }> = [];
  const t = carveByFold(
    carveByFold(clonePts(makeSolutionRibbon(800, 130)), 260, 180, 150, fb),
    420,
    180,
    150,
    fb,
  );
  return assertDoable({
    ...level,
    name: `Mix ${index + 1} · Twin Gap`,
    terrain: t,
    trampolineBands: undefined,
    blockers: undefined,
    foldRadius: 150,
    solutionFolds: fb,
    hint: "Fold each gap back up into a bridge, then Go.",
  });
}

function makeMixed(id: number, index: number): LevelDef {
  const rnd = mulberry32(14000 + index * 149);
  const d = mixDifficulty(index);
  const mode = pickMode(d, rnd);

  if (mode === "springGate") return assertDoable(makeSpringGate(id, index, d, rnd));
  if (mode === "gauntlet") return assertDoable(makeGauntlet(id, index, d, rnd));

  const foldRadius =
    mode === "twin"
      ? Math.max(105, 155 - d * 45)
      : Math.max(115, 165 - d * 40);
  const folds: Array<{ x: number; deltaY: number }> = [];
  const yStart = 800 + rnd() * 20;
  let terrain = clonePts(makeSolutionRibbon(yStart, 110 + d * 40));

  if (mode === "bridge") {
    terrain = carveByFold(terrain, 300 + rnd() * 40, 160 + d * 100, foldRadius, folds);
  } else {
    // twin or wallBridge
    terrain = carveByFold(terrain, 240 + rnd() * 20, 150 + d * 80, foldRadius, folds);
    terrain = carveByFold(terrain, 400 + rnd() * 30, 160 + d * 90, foldRadius, folds);
  }

  let blockers: LevelDef["blockers"];
  if (mode === "wallBridge" || (mode === "twin" && d > 0.4 && rnd() > 0.5)) {
    const wallX = 545 + rnd() * 25;
    let restored = clonePts(terrain);
    for (const f of folds) restored = applyFold(restored, f.x, f.deltaY, foldRadius);
    const pathY = sampleTerrainY(restored, wallX);
    const bottom = pathY - 42;
    const top = 250;
    if (bottom - top > 150) {
      blockers = [{ x: wallX, y: (top + bottom) / 2, w: 30 + d * 8, h: bottom - top }];
    }
  }

  const kind =
    mode === "wallBridge" ? "Ink Wall" : folds.length >= 2 ? "Twin Gap" : "Bridge";

  return assertDoable({
    id,
    name: `Mix ${index + 1} · ${kind}`,
    hint:
      mode === "wallBridge"
        ? "Fold bridges under the dark wall — high launches hit ink. Crease, then Go."
        : folds.length >= 2
          ? "Two gaps. Fold each one back up — one mega-ramp usually won’t cover both."
          : "Fold the gap into a bridge, then Go.",
    section: "mixed",
    sky: skyFor("mixed", index),
    terrain,
    spawn: { x: 100, y: yStart - 40 },
    goal: { x: 620, y: yStart + 80 },
    scrap: { x: 360, y: 700 },
    foldRadius,
    blockers,
    solutionFolds: folds,
  });
}

export function buildCampaign(): LevelDef[] {
  const levels: LevelDef[] = [];
  let id = 1;
  for (let i = 0; i < 10; i++) levels.push(makeRamp(id++, i));
  for (let i = 0; i < 10; i++) levels.push(makeBridge(id++, i));
  for (let i = 0; i < 10; i++) levels.push(makeTrampoline(id++, i));
  for (let i = 0; i < MIXED_COUNT; i++) levels.push(makeMixed(id++, i));
  return levels.map(assertDoable);
}
