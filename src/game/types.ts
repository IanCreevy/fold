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
  /** Non-foldable walls that stop the “raise left and fly” cheese. */
  blockers?: Array<{ x: number; y: number; w: number; h: number }>;
  /** Ghost crease targets shown on early tutorial levels. */
  guideFolds?: Array<{ x: number; deltaY: number }>;
  /**
   * Proven crease list that restores a walkable path (not shown to players).
   * Used to guarantee every postcard is doable.
   */
  solutionFolds?: Array<{ x: number; deltaY: number }>;
};

export type Skin = {
  id: string;
  name: string;
  blurb: string;
  body: string;
  accent: string;
  ear: string;
  wing?: string;
  /** Real price in US cents. 0 = free starter skin. */
  priceCents: number;
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
  ramps: "Training · Ramps",
  bridges: "Training · Bridges",
  trampolines: "Training · Trampolines",
  mixed: "Chapter 4 — The Real Game",
};
