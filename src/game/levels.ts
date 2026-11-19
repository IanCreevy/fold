import type { LevelDef, LevelSection, SkyMood, Vec } from "./types";

/** World is 720x1280 logical pixels — phone portrait. */
export const WORLD = { w: 720, h: 1280 };

/** Training = chapters 1–3 (30 levels). Real campaign = chapter 4 mix. */
export const TRAINING_COUNT = 30;
export const MIXED_COUNT = 500;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function densify(xs: number[], y: number): Vec[] {
  return xs.map((x) => ({ x, y }));
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

function makeRamp(id: number, index: number): LevelDef {
  const rnd = mulberry32(1000 + index * 17);
  const baseY = 900 + Math.floor(rnd() * 40);
  const xs = [40, 120, 200, 280, 360, 460, 560, 680];
  const terrain = densify(xs, baseY);

  if (index >= 3) {
    const hard = (index - 2) / 7;
    terrain[2].y += 30 + hard * 70 + rnd() * 40;
    terrain[4].y -= 20 + hard * 50 + rnd() * 30;
    if (index >= 6) terrain[5].y += 40 + rnd() * 60;
  }

  const guide =
    index < 2 ? [{ x: 150, deltaY: -140 - index * 10 }] : undefined;

  return {
    id,
    name: RAMP_NAMES[index] ?? `Ramp ${index + 1}`,
    hint:
      index === 0
        ? "Drag UP at the red mark to raise the left — then Go and roll downhill past the door."
        : index === 1
          ? "Raise the left gently. Match the red guide, then Go."
          : index < 3
            ? "Training: build a clean downhill. Cross the door at any height."
            : "Training gets sharper — fix dips and rises, then clear the door.",
    section: "ramps",
    sky: skyFor("ramps", index),
    terrain,
    spawn: { x: 160 + Math.floor(rnd() * 40), y: baseY - 40 },
    goal: { x: 580 + Math.floor(rnd() * 30), y: baseY - 40 },
    scrap: index > 1 ? { x: 360, y: baseY - 160 - index * 8 } : undefined,
    foldRadius: 150 - Math.min(30, index * 2),
    guideFolds: guide,
  };
}

function makeBridge(id: number, index: number): LevelDef {
  const rnd = mulberry32(2000 + index * 31);
  const leftY = 800 + Math.floor(rnd() * 40);
  const hard = Math.max(0, index - 1) / 9;
  const gapDepth = 220 + hard * 160 + Math.floor(rnd() * 80);
  const gapWidth = Math.max(120, 220 - hard * 90 - Math.floor(rnd() * 40));
  const gapL = 210 + Math.floor(rnd() * 50);
  const gapR = gapL + gapWidth;
  const farY = leftY + Math.floor((rnd() - 0.4) * (40 + hard * 80));
  const terrain: Vec[] = [
    { x: 40, y: leftY },
    { x: gapL - 25, y: leftY },
    { x: gapL, y: leftY + gapDepth },
    { x: gapR, y: leftY + gapDepth },
    { x: gapR + 25, y: farY },
    { x: 680, y: farY + Math.floor(rnd() * 20) - 10 },
  ];
  if (index >= 4) {
    terrain.splice(5, 0, {
      x: gapR + 90,
      y: farY + 50 + hard * 40,
    });
  }
  return {
    id,
    name: BRIDGE_NAMES[index] ?? `Bridge ${index + 1}`,
    hint:
      index < 2
        ? "Training bridge — fold a path across the canyon."
        : "Wider / deeper canyon. One careful bridge crease… or a bold launch.",
    section: "bridges",
    sky: skyFor("bridges", index),
    terrain,
    spawn: { x: 100, y: leftY - 40 },
    goal: { x: 610, y: farY - 40 },
    scrap: { x: (gapL + gapR) / 2, y: leftY + gapDepth - 70 },
    foldRadius: 165 + Math.floor(rnd() * 30),
  };
}

function makeTrampoline(id: number, index: number): LevelDef {
  const rnd = mulberry32(3000 + index * 43);
  const baseY = 850;
  const hard = index / 9;
  const pitY = 1000 + Math.floor(hard * 80) + Math.floor(rnd() * 40);
  const width = Math.max(100, 200 - hard * 70);
  const x0 = 220 + Math.floor(rnd() * 50);
  const x1 = x0 + width;
  const farY = baseY - Math.floor(hard * 60) - Math.floor(rnd() * 30);
  const terrain: Vec[] = [
    { x: 40, y: baseY },
    { x: Math.max(80, x0 - 50), y: baseY },
    { x: x0, y: pitY },
    { x: (x0 + x1) / 2, y: pitY + 20 },
    { x: x1, y: pitY },
    { x: Math.min(640, x1 + 50), y: farY },
    { x: 680, y: farY },
  ];
  const bands = [{ x0, x1 }];
  if (index >= 5) {
    const x2 = 480;
    const x3 = x2 + 90;
    bands.push({ x0: x2, x1: x3 });
    terrain.splice(5, 0, { x: x2, y: pitY - 20 }, { x: x3, y: pitY - 20 });
  }
  return {
    id,
    name: TRAMP_NAMES[index] ?? `Spring ${index + 1}`,
    hint:
      "Coral paper is a trampoline — hit it from above for a real bounce, then clear the door.",
    section: "trampolines",
    sky: skyFor("trampolines", index),
    terrain,
    spawn: { x: 100, y: baseY - 40 },
    goal: { x: 610, y: farY - 40 },
    scrap: { x: (x0 + x1) / 2, y: pitY - 120 },
    foldRadius: 150,
    trampolineBands: bands,
  };
}

/**
 * Steep curve: mix postcard ~50 (world ~80) already feels serious.
 * “Raise left and coast” should stop working early in Chapter 4.
 */
function mixDifficulty(index: number): number {
  const early = Math.min(1, index / 55);
  const late = Math.min(1, index / 220);
  return Math.min(1, 0.22 + 0.58 * early + 0.2 * late);
}

type MixKind = "doubleGap" | "walled" | "trapmouth" | "springRun" | "triple";

function pickKind(d: number, rnd: () => number): MixKind {
  // Almost no free “flat ramp” postcards — those were cheese heaven.
  if (d < 0.35) {
    const r = rnd();
    if (r < 0.35) return "doubleGap";
    if (r < 0.6) return "trapmouth";
    if (r < 0.8) return "springRun";
    return "walled";
  }
  if (d < 0.65) {
    const r = rnd();
    if (r < 0.3) return "doubleGap";
    if (r < 0.5) return "walled";
    if (r < 0.7) return "trapmouth";
    if (r < 0.88) return "springRun";
    return "triple";
  }
  const r = rnd();
  if (r < 0.25) return "walled";
  if (r < 0.5) return "triple";
  if (r < 0.72) return "doubleGap";
  if (r < 0.88) return "trapmouth";
  return "springRun";
}

function makeMixed(id: number, index: number): LevelDef {
  const rnd = mulberry32(12000 + index * 131);
  const d = mixDifficulty(index);
  const kind = pickKind(d, rnd);
  const foldRadius = Math.max(85, 145 - d * 55);
  const sky = skyFor("mixed", index);
  const hint =
    d < 0.4
      ? "One tall left ramp won’t cut it — plan the whole path."
      : "Chapter 4 bite: walls, gaps, and springs. Cheese ramps fail here.";

  if (kind === "doubleGap") {
    // Two canyons — a single ballistic arc from a left ramp can't clear both.
    const leftY = 800 + rnd() * 30;
    const midY = leftY - 10 + rnd() * 40;
    const farY = leftY + (rnd() - 0.5) * 50 - d * 40;
    const depth = 280 + d * 180;
    const g1 = 180 + rnd() * 30;
    const g1w = 110 + d * 50 + rnd() * 30;
    const midW = Math.max(36, 70 - d * 30);
    const g2 = g1 + g1w + midW;
    const g2w = 120 + d * 70 + rnd() * 40;
    const terrain: Vec[] = [
      { x: 40, y: leftY },
      { x: g1 - 15, y: leftY },
      { x: g1, y: leftY + depth },
      { x: g1 + g1w, y: leftY + depth },
      { x: g1 + g1w + 8, y: midY },
      { x: g2 - 8, y: midY },
      { x: g2, y: leftY + depth + 20 },
      { x: g2 + g2w, y: leftY + depth + 20 },
      { x: g2 + g2w + 15, y: farY },
      { x: 680, y: farY },
    ];
    const blockers =
      d > 0.4
        ? [{ x: g2 + g2w + 55, y: farY - 120, w: 28, h: 220 + d * 80 }]
        : undefined;
    return {
      id,
      name: `Mix ${index + 1} · Twin Gap`,
      hint,
      section: "mixed",
      sky,
      terrain,
      spawn: { x: 100, y: leftY - 40 },
      goal: { x: 620, y: farY - 40 },
      scrap: { x: g1 + g1w / 2, y: leftY + depth - 70 },
      foldRadius,
      blockers,
    };
  }

  if (kind === "walled") {
    // Tall ink wall blocks high arcs; must tunnel under or bridge precisely.
    const baseY = 860;
    const pitY = 1040 + d * 100;
    const gapL = 240 + rnd() * 40;
    const gapR = gapL + 140 + d * 80;
    const farY = baseY - d * 70;
    const wallX = gapR + 50 + rnd() * 30;
    const terrain: Vec[] = [
      { x: 40, y: baseY },
      { x: gapL - 20, y: baseY + d * 50 },
      { x: gapL, y: pitY },
      { x: gapR, y: pitY },
      { x: gapR + 20, y: farY },
      { x: 680, y: farY },
    ];
    return {
      id,
      name: `Mix ${index + 1} · Ink Wall`,
      hint: "The tall wall eats high launches — fold a low bridge or bounce under it.",
      section: "mixed",
      sky,
      terrain,
      spawn: { x: 100, y: baseY - 40 },
      goal: { x: 630, y: farY - 40 },
      scrap: { x: (gapL + gapR) / 2, y: pitY - 80 },
      foldRadius,
      trampolineBands: d > 0.35 ? [{ x0: gapL + 20, x1: gapL + 90 }] : undefined,
      blockers: [
        {
          x: wallX,
          y: 520,
          w: 32 + d * 10,
          h: 420 + d * 120,
        },
      ],
    };
  }

  if (kind === "trapmouth") {
    // Pit immediately after spawn — raising the left dumps you in.
    const shelfY = 820;
    const pitY = 1100 + d * 60;
    const islandY = 860 + rnd() * 40;
    const farY = 800 - d * 50;
    const pit1 = 160;
    const island0 = 250 + rnd() * 30;
    const island1 = island0 + Math.max(40, 85 - d * 35);
    const pit2 = island1 + 10;
    const pit2R = pit2 + 130 + d * 90;
    const terrain: Vec[] = [
      { x: 40, y: shelfY },
      { x: pit1 - 10, y: shelfY },
      { x: pit1, y: pitY },
      { x: island0 - 5, y: pitY },
      { x: island0, y: islandY },
      { x: island1, y: islandY },
      { x: pit2, y: pitY + 10 },
      { x: pit2R, y: pitY + 10 },
      // Reverse lip before door — downhill cheese rolls back / stalls
      { x: pit2R + 30, y: farY + 70 + d * 40 },
      { x: 560, y: farY },
      { x: 680, y: farY },
    ];
    return {
      id,
      name: `Mix ${index + 1} · Trapmouth`,
      hint: "Don’t raise the spawn shelf — you’ll fall in. Island hop, then beat the reverse lip.",
      section: "mixed",
      sky,
      terrain,
      spawn: { x: 90, y: shelfY - 40 },
      goal: { x: 620, y: farY - 40 },
      scrap: { x: (island0 + island1) / 2, y: islandY - 90 },
      foldRadius: Math.max(80, foldRadius - 10),
      trampolineBands:
        d > 0.45 ? [{ x0: pit2 + 20, x1: pit2 + 80 }] : undefined,
      blockers:
        d > 0.5
          ? [{ x: 540, y: farY - 160, w: 26, h: 200 }]
          : undefined,
    };
  }

  if (kind === "triple") {
    const y0 = 790;
    const depth = 300 + d * 160;
    const a = 150;
    const aw = 95 + d * 40;
    const b = a + aw + 48;
    const bw = 100 + d * 50;
    const c = b + bw + 48;
    const cw = 110 + d * 55;
    const farY = y0 - d * 60;
    const terrain: Vec[] = [
      { x: 40, y: y0 },
      { x: a - 10, y: y0 },
      { x: a, y: y0 + depth },
      { x: a + aw, y: y0 + depth },
      { x: a + aw + 8, y: y0 + 20 },
      { x: b - 8, y: y0 + 30 },
      { x: b, y: y0 + depth + 15 },
      { x: b + bw, y: y0 + depth + 15 },
      { x: b + bw + 8, y: y0 + 10 },
      { x: c - 8, y: y0 + 25 },
      { x: c, y: y0 + depth },
      { x: c + cw, y: y0 + depth },
      { x: c + cw + 15, y: farY },
      { x: 680, y: farY },
    ];
    return {
      id,
      name: `Mix ${index + 1} · Triple`,
      hint: "Three gaps. One ramp will not save you.",
      section: "mixed",
      sky,
      terrain,
      spawn: { x: 95, y: y0 - 40 },
      goal: { x: 630, y: farY - 40 },
      scrap: { x: b + bw / 2, y: y0 + depth - 60 },
      foldRadius: Math.max(80, foldRadius - 15),
      trampolineBands: [{ x0: b + 15, x1: b + 70 }],
      blockers: [
        { x: c + cw + 40, y: 480, w: 30, h: 380 + d * 100 },
      ],
    };
  }

  // springRun — must bounce; wall blocks flyover
  const baseY = 850;
  const pitY = 1020 + d * 110;
  const x0 = 200 + rnd() * 40;
  const x1 = x0 + Math.max(70, 150 - d * 60);
  const farY = baseY - 40 - d * 80;
  const wallX = x1 + 70;
  return {
    id,
    name: `Mix ${index + 1} · Spring Gate`,
    hint: "Bounce the coral — the wall stops sky cheese.",
    section: "mixed",
    sky,
    terrain: [
      { x: 40, y: baseY },
      { x: x0 - 30, y: baseY },
      { x: x0, y: pitY },
      { x: (x0 + x1) / 2, y: pitY + 18 },
      { x: x1, y: pitY },
      { x: x1 + 35, y: farY + 40 },
      { x: 680, y: farY },
    ],
    spawn: { x: 100, y: baseY - 40 },
    goal: { x: 630, y: farY - 40 },
    scrap: { x: (x0 + x1) / 2, y: pitY - 100 },
    foldRadius,
    trampolineBands: [{ x0, x1 }],
    blockers: [
      { x: wallX, y: 500, w: 34, h: 400 + d * 140 },
    ],
  };
}

function buildCampaign(): LevelDef[] {
  const levels: LevelDef[] = [];
  let id = 1;
  for (let i = 0; i < 10; i++) levels.push(makeRamp(id++, i));
  for (let i = 0; i < 10; i++) levels.push(makeBridge(id++, i));
  for (let i = 0; i < 10; i++) levels.push(makeTrampoline(id++, i));
  for (let i = 0; i < MIXED_COUNT; i++) levels.push(makeMixed(id++, i));
  return levels;
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
