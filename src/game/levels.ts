import type { LevelDef, LevelSection, SkyMood, Vec } from "./types";

/** World is 720x1280 logical pixels — phone portrait. */
export const WORLD = { w: 720, h: 1280 };

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function groundLine(y: number, xs: number[]): Vec[] {
  return xs.map((x) => ({ x, y }));
}

function densify(xs: number[], y: number): Vec[] {
  return groundLine(y, xs);
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
  const xs = [40, 140, 220, 300, 400, 520, 680];
  const terrain = densify(xs, baseY);
  // Mild pre-warps on later ramp levels
  if (index > 3) {
    const bump = 40 + rnd() * 50;
    const at = 2 + Math.floor(rnd() * 3);
    terrain[at].y += bump * (rnd() > 0.5 ? 1 : -0.4);
  }
  const guide =
    index < 2
      ? [{ x: 150, deltaY: -140 - index * 10 }]
      : undefined;
  return {
    id,
    name: RAMP_NAMES[index] ?? `Ramp ${index + 1}`,
    hint:
      index === 0
        ? "Drag UP at the red mark to raise the left — then Go and roll downhill past the door."
        : index === 1
          ? "Raise the left gently. Match the red guide, then Go."
          : "Build a downhill with one or two creases. Cross the door line at any height.",
    section: "ramps",
    sky: skyFor("ramps", index),
    terrain,
    spawn: { x: 200 + Math.floor(rnd() * 30), y: baseY - 40 },
    goal: { x: 560 + Math.floor(rnd() * 40), y: baseY - 40 },
    scrap: index > 1 ? { x: 360, y: baseY - 160 } : undefined,
    foldRadius: 160,
    guideFolds: guide,
  };
}

function makeBridge(id: number, index: number): LevelDef {
  const rnd = mulberry32(2000 + index * 31);
  const leftY = 820 + Math.floor(rnd() * 50);
  const gapDepth = 250 + Math.floor(rnd() * 120);
  const gapL = 230 + Math.floor(rnd() * 40);
  const gapR = gapL + 180 + Math.floor(rnd() * 80);
  const terrain: Vec[] = [
    { x: 40, y: leftY },
    { x: gapL - 20, y: leftY },
    { x: gapL, y: leftY + gapDepth },
    { x: gapR, y: leftY + gapDepth },
    { x: gapR + 20, y: leftY + Math.floor(rnd() * 40) - 10 },
    { x: 680, y: leftY + Math.floor(rnd() * 30) - 15 },
  ];
  return {
    id,
    name: BRIDGE_NAMES[index] ?? `Bridge ${index + 1}`,
    hint: "Fold a bridge across the canyon — then roll past the door.",
    section: "bridges",
    sky: skyFor("bridges", index),
    terrain,
    spawn: { x: 110, y: leftY - 40 },
    goal: { x: 600, y: leftY - 40 },
    scrap: { x: (gapL + gapR) / 2, y: leftY + gapDepth - 80 },
    foldRadius: 170 + Math.floor(rnd() * 40),
  };
}

function makeTrampoline(id: number, index: number): LevelDef {
  const rnd = mulberry32(3000 + index * 43);
  const baseY = 860;
  const pitY = 1040 + Math.floor(rnd() * 60);
  const x0 = 240 + Math.floor(rnd() * 40);
  const x1 = x0 + 160 + Math.floor(rnd() * 60);
  const terrain: Vec[] = [
    { x: 40, y: baseY },
    { x: x0 - 40, y: baseY },
    { x: x0, y: pitY },
    { x: (x0 + x1) / 2, y: pitY + 30 },
    { x: x1, y: pitY },
    { x: x1 + 40, y: baseY },
    { x: 680, y: baseY - Math.floor(rnd() * 20) },
  ];
  return {
    id,
    name: TRAMP_NAMES[index] ?? `Spring ${index + 1}`,
    hint: "The coral strip is a trampoline — fold into it, bounce high, clear the door.",
    section: "trampolines",
    sky: skyFor("trampolines", index),
    terrain,
    spawn: { x: 100, y: baseY - 40 },
    goal: { x: 600, y: baseY - 40 },
    scrap: { x: (x0 + x1) / 2, y: pitY - 100 },
    foldRadius: 150,
    trampolineBands: [{ x0, x1 }],
  };
}

function makeMixed(id: number, index: number): LevelDef {
  const rnd = mulberry32(9000 + index * 97);
  const roll = rnd();
  if (roll < 0.34) {
    const L = makeRamp(id, 5 + (index % 5));
    return {
      ...L,
      id,
      name: `Mix Ramp ${index + 1}`,
      section: "mixed",
      sky: skyFor("mixed", index),
      hint: "Mixed postcard — ramp craft. Cross the door line.",
      guideFolds: undefined,
    };
  }
  if (roll < 0.67) {
    const L = makeBridge(id, index % 10);
    return {
      ...L,
      id,
      name: `Mix Bridge ${index + 1}`,
      section: "mixed",
      sky: skyFor("mixed", index),
      hint: "Mixed postcard — bridge the gap any way you can.",
    };
  }
  const L = makeTrampoline(id, index % 10);
  // Sometimes add a second spring + a mini gap feel
  const bands = L.trampolineBands ? [...L.trampolineBands] : [];
  if (rnd() > 0.55) {
    bands.push({ x0: 480, x1: 560 });
  }
  return {
    ...L,
    id,
    name: `Mix Spring ${index + 1}`,
    section: "mixed",
    sky: skyFor("mixed", index),
    trampolineBands: bands,
    hint: "Mixed postcard — trampolines, ramps, chaos. Flutter helps if you bought wings.",
  };
}

function buildCampaign(): LevelDef[] {
  const levels: LevelDef[] = [];
  let id = 1;
  for (let i = 0; i < 10; i++) levels.push(makeRamp(id++, i));
  for (let i = 0; i < 10; i++) levels.push(makeBridge(id++, i));
  for (let i = 0; i < 10; i++) levels.push(makeTrampoline(id++, i));
  // Long "no end in sight" mix — ~200 postcards
  for (let i = 0; i < 200; i++) levels.push(makeMixed(id++, i));
  return levels;
}

export const LEVELS: LevelDef[] = buildCampaign();

export function sectionForIndex(index: number): LevelSection {
  return LEVELS[index]?.section ?? "mixed";
}

export function estimatePlaytimeHours(): { levels: number; casualHours: number; skilledHours: number } {
  const levels = LEVELS.length;
  // Casual: ~2.5 min effective / level (folds + retries). Skilled: ~1.1 min.
  return {
    levels,
    casualHours: Math.round((levels * 2.5) / 60),
    skilledHours: Math.round((levels * 1.1) / 60),
  };
}
