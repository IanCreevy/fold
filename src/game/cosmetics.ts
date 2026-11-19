import type { SaveData, Skin } from "./types";
import { LEVELS } from "./levels";

export const SKINS: Skin[] = [
  {
    id: "moth",
    name: "Pulp Moth",
    blurb: "Default traveler. Soft wings, brave heart.",
    body: "#2c3a4a",
    accent: "#f4ebe0",
    ear: "#c45c26",
  },
  {
    id: "fox",
    name: "Paper Fox",
    blurb: "A little sharper around the creases.",
    body: "#c45c26",
    accent: "#f7f1e6",
    ear: "#2c3a4a",
  },
  {
    id: "ink",
    name: "Ink Drop",
    blurb: "Midnight traveler for quiet desks.",
    body: "#1b2430",
    accent: "#7eb0c9",
    ear: "#e8dcc8",
  },
  {
    id: "moss",
    name: "Moss Kit",
    blurb: "Smells like attic rain and string.",
    body: "#3d6b4f",
    accent: "#dfe8c9",
    ear: "#c45c26",
  },
];

const SAVE_KEY = "fold.save.v1";

export function defaultSave(): SaveData {
  return {
    unlocked: 1,
    stars: {},
    skinId: "moth",
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as SaveData;
    return {
      ...defaultSave(),
      ...parsed,
      stars: parsed.stars ?? {},
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

export function recordClear(save: SaveData, levelId: number, stars: number): SaveData {
  const prev = save.stars[levelId] ?? 0;
  const nextStars = { ...save.stars, [levelId]: Math.max(prev, stars) };
  const unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelId + 1));
  const next = { ...save, stars: nextStars, unlocked };
  writeSave(next);
  return next;
}
