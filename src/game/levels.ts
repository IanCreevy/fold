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

/** Training ramps: 0–2 easy with guides; 3+ introduce bumps / longer runs. */
function makeRamp(id: number, index: number): LevelDef {
  const rnd = mulberry32(1000 + index * 17);
  const baseY = 900 + Math.floor(rnd() * 40);
  const xs = [40, 120, 200, 280, 360, 460, 560, 680];
  const terrain = densify(xs, baseY);

  if (index >= 3) {
    // Real training challenge: dips and rises that need deliberate creases
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
    // Second notch near the far bank
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

/** Difficulty 0..1 across the long mix campaign. */
function mixDifficulty(index: number): number {
  return Math.min(1, index / (MIXED_COUNT - 1));
}

function makeMixed(id: number, index: number): LevelDef {
  const rnd = mulberry32(9000 + index * 97);
  const d = mixDifficulty(index);
  const roll = rnd();

  // Late mix leans harder toward bridges + tramp combos
  let kind: "ramp" | "bridge" | "tramp" | "combo";
  if (d < 0.15) {
    kind = roll < 0.5 ? "ramp" : roll < 0.8 ? "bridge" : "tramp";
  } else if (d < 0.4) {
    kind = roll < 0.3 ? "ramp" : roll < 0.65 ? "bridge" : roll < 0.9 ? "tramp" : "combo";
  } else {
    kind = roll < 0.15 ? "ramp" : roll < 0.45 ? "bridge" : roll < 0.7 ? "tramp" : "combo";
  }

  if (kind === "ramp") {
    const baseY = 880 + Math.floor(rnd() * 40);
    const terrain = densify([40, 120, 200, 300, 400, 500, 600, 680], baseY);
    const bumps = 1 + Math.floor(d * 4);
    for (let b = 0; b < bumps; b++) {
      const at = 1 + Math.floor(rnd() * 6);
      terrain[at].y += (rnd() > 0.45 ? 1 : -1) * (40 + d * 100 + rnd() * 50);
    }
    return {
      id,
      name: `Mix ${index + 1} · Ramp`,
      hint: d < 0.3 ? "Chapter 4 — the real game. Clear the door." : "Harder postcard — plan every crease.",
      section: "mixed",
      sky: skyFor("mixed", index),
      terrain,
      spawn: { x: 110, y: baseY - 40 },
      goal: { x: 600, y: baseY - 40 },
      scrap: { x: 360, y: baseY - 180 - d * 80 },
      foldRadius: Math.max(100, 160 - d * 50),
    };
  }

  if (kind === "bridge" || kind === "combo") {
    const leftY = 780 + Math.floor(rnd() * 40);
    const gapDepth = 240 + d * 220 + rnd() * 60;
    const gapWidth = Math.max(90, 210 - d * 110 - rnd() * 30);
    const gapL = 200 + rnd() * 60;
    const gapR = gapL + gapWidth;
    const farY = leftY - d * 80 + (rnd() - 0.5) * 50;
    const terrain: Vec[] = [
      { x: 40, y: leftY },
      { x: gapL - 20, y: leftY + d * 40 },
      { x: gapL, y: leftY + gapDepth },
      { x: gapR, y: leftY + gapDepth },
      { x: gapR + 20, y: farY },
      { x: 680, y: farY },
    ];
    const bands =
      kind === "combo"
        ? [{ x0: gapL + 10, x1: Math.min(gapR - 10, gapL + 80 + (1 - d) * 40) }]
        : undefined;
    if (kind === "combo" && bands) {
      // Soft spring at canyon floor for clutch bounce clears
      terrain[2].y = leftY + gapDepth;
      terrain[3].y = leftY + gapDepth;
    }
    return {
      id,
      name: kind === "combo" ? `Mix ${index + 1} · Canyon Spring` : `Mix ${index + 1} · Bridge`,
      hint:
        kind === "combo"
          ? "Bridge or bounce — coral at the bottom can launch you out."
          : "Chapter 4 canyon. Fold a bridge or earn a winged flutter.",
      section: "mixed",
      sky: skyFor("mixed", index),
      terrain,
      spawn: { x: 100, y: leftY - 40 },
      goal: { x: 610, y: farY - 40 },
      scrap: { x: (gapL + gapR) / 2, y: leftY + gapDepth - 60 },
      foldRadius: Math.max(110, 170 - d * 40),
      trampolineBands: bands,
    };
  }

  // tramp
  const baseY = 840;
  const pitY = 980 + d * 120 + rnd() * 40;
  const width = Math.max(80, 190 - d * 90);
  const x0 = 200 + rnd() * 80;
  const x1 = x0 + width;
  const farY = baseY - d * 100;
  const bands = [{ x0, x1 }];
  if (d > 0.35) bands.push({ x0: 470, x1: 470 + Math.max(60, 110 - d * 40) });
  return {
    id,
    name: `Mix ${index + 1} · Spring`,
    hint: "Use the coral trampoline bounce — tap Flutter mid-air if you have wings.",
    section: "mixed",
    sky: skyFor("mixed", index),
    terrain: [
      { x: 40, y: baseY },
      { x: x0 - 40, y: baseY },
      { x: x0, y: pitY },
      { x: (x0 + x1) / 2, y: pitY + 15 },
      { x: x1, y: pitY },
      { x: x1 + 40, y: farY },
      { x: 680, y: farY },
    ],
    spawn: { x: 100, y: baseY - 40 },
    goal: { x: 610, y: farY - 40 },
    scrap: { x: (x0 + x1) / 2, y: pitY - 100 },
    foldRadius: Math.max(110, 155 - d * 35),
    trampolineBands: bands,
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
  const casualHours = Math.round((levels * 3.2) / 60); // harder late levels
  const skilledHours = Math.round((levels * 1.4) / 60);
  const monthsAt15m = Math.max(1, Math.round((casualHours * 60) / (15 * 30)));
  return {
    levels,
    casualHours,
    skilledHours,
    monthsHint: `~${monthsAt15m} month${monthsAt15m > 1 ? "s" : ""} at 15 min/day (casual)`,
  };
}
