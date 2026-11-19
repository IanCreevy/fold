export type Vec = { x: number; y: number };

export type LevelSection = "ramps" | "bridges" | "trampolines" | "mixed";
export type SkyMood = "sunny" | "golden" | "storm" | "rain";

export type LevelDef = {
  id: number;
  name: string;
  hint: string;
  section: LevelSection;
  sky: SkyMood;
  terrain: Vec[];
  spawn: Vec;
  /** Door landmark X; win by crossing this X at any height. */
  goal: Vec;
  scrap?: Vec;
  foldRadius: number;
  /** X-ranges of springy trampoline paper. */
  trampolineBands?: Array<{ x0: number; x1: number }>;
  /** Ghost crease targets shown on early tutorial levels. */
  guideFolds?: Array<{ x: number; deltaY: number }>;
};

export type Skin = {
  id: string;
  name: string;
  blurb: string;
  body: string;
  accent: string;
  ear: string;
  wing?: string;
  /** Soft currency cost; 0 = free starter. */
  cost: number;
  /** Can flutter while airborne to cross gaps. */
  hasWings: boolean;
  flaps: number;
};

export type SaveData = {
  unlocked: number;
  stars: Record<number, number>;
  skinId: string;
  scraps: number;
  ownedSkins: string[];
};

export type GameMode = "title" | "levels" | "playing" | "won" | "shop";

export const SECTION_LABEL: Record<LevelSection, string> = {
  ramps: "Chapter 1 — Ramps",
  bridges: "Chapter 2 — Bridges",
  trampolines: "Chapter 3 — Trampolines",
  mixed: "Chapter 4 — Endless Mix",
};
