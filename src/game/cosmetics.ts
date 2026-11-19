import type { SaveData, Skin } from "./types";
import { LEVELS } from "./levels";

export const SKINS: Skin[] = [
  {
    id: "moth",
    name: "Pulp Moth",
    blurb: "Your starter — patterned wings, curious eyes.",
    body: "#5c4a6e",
    accent: "#f7e8c9",
    ear: "#e8a87c",
    wing: "#c9a0dc",
    cost: 0,
    hasWings: false,
    flaps: 0,
  },
  {
    id: "fox",
    name: "Paper Fox",
    blurb: "Warm pulp and a sharp little snout.",
    body: "#d96c3f",
    accent: "#fff0dd",
    ear: "#2c3a4a",
    wing: "#f0a070",
    cost: 0,
    hasWings: false,
    flaps: 0,
  },
  {
    id: "glider",
    name: "Dawn Glider",
    blurb: "Buyable wings — flutter from height to cross canyons.",
    body: "#3d6b9a",
    accent: "#ffe6a8",
    ear: "#f0c14a",
    wing: "#7eb8e8",
    cost: 40,
    hasWings: true,
    flaps: 3,
  },
  {
    id: "stormwing",
    name: "Stormwing",
    blurb: "Four flaps and ink-dark sails for big gaps.",
    body: "#1f2a3a",
    accent: "#9fd3ff",
    ear: "#6ec6ff",
    wing: "#4a6fa5",
    cost: 80,
    hasWings: true,
    flaps: 4,
  },
  {
    id: "sunset",
    name: "Sunset Kite",
    blurb: "Coral wings that catch every downhill.",
    body: "#c45c6a",
    accent: "#ffe0c2",
    ear: "#ffb347",
    wing: "#ff8a65",
    cost: 60,
    hasWings: true,
    flaps: 3,
  },
  {
    id: "moss",
    name: "Moss Kit",
    blurb: "Leafy traveler for rainy postcards.",
    body: "#3d6b4f",
    accent: "#e5f2c9",
    ear: "#c45c26",
    wing: "#8fbc8f",
    cost: 25,
    hasWings: false,
    flaps: 0,
  },
];

const SAVE_KEY = "fold.save.v2";

export function defaultSave(): SaveData {
  return {
    unlocked: 1,
    stars: {},
    skinId: "moth",
    scraps: 0,
    ownedSkins: ["moth", "fox"],
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem("fold.save.v1");
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = defaultSave();
    return {
      ...base,
      ...parsed,
      stars: parsed.stars ?? {},
      scraps: parsed.scraps ?? 0,
      ownedSkins: parsed.ownedSkins?.length ? parsed.ownedSkins : base.ownedSkins,
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save: SaveData) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

export function getSkin(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export function ownsSkin(save: SaveData, id: string) {
  return save.ownedSkins.includes(id) || getSkin(id).cost === 0;
}

export function buySkin(save: SaveData, id: string): SaveData | null {
  const skin = getSkin(id);
  if (ownsSkin(save, id)) return save;
  if (save.scraps < skin.cost) return null;
  const next: SaveData = {
    ...save,
    scraps: save.scraps - skin.cost,
    ownedSkins: [...save.ownedSkins, id],
    skinId: id,
  };
  writeSave(next);
  return next;
}

/** Stars from attempts this level run: 1→★★★, 2–3→★★, 4+→★ */
export function starsFromAttempts(attempts: number): number {
  if (attempts <= 1) return 3;
  if (attempts <= 3) return 2;
  return 1;
}

export function recordClear(
  save: SaveData,
  levelId: number,
  stars: number,
): SaveData {
  const prev = save.stars[levelId] ?? 0;
  const nextStars = { ...save.stars, [levelId]: Math.max(prev, stars) };
  const scrapGain = 8 + stars * 4;
  const unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelId + 1));
  const next: SaveData = {
    ...save,
    stars: nextStars,
    unlocked,
    scraps: save.scraps + scrapGain,
  };
  writeSave(next);
  return next;
}

/** Rough playtime copy for the title/levels UI. */
export function campaignEstimate(): string {
  const n = LEVELS.length;
  const hoursCasual = Math.round((n * 3.2) / 60);
  const months = Math.max(1, Math.round((hoursCasual * 60) / (15 * 30)));
  return `${n} postcards · ~${hoursCasual}h casual (~${months} mo at 15 min/day) · training then the long climb`;
}
