export type Vec = { x: number; y: number };

export type LevelDef = {
  id: number;
  name: string;
  hint: string;
  terrain: Vec[];
  spawn: Vec;
  /** Door landmark X; win by crossing this X at any height. */
  goal: Vec;
  scrap?: Vec;
  foldRadius: number;
  twoStarFolds: number;
  /** Ghost crease targets shown on early tutorial levels. */
  guideFolds?: Array<{ x: number; deltaY: number }>;
  cameraPadding?: number;
};

export type Skin = {
  id: string;
  name: string;
  blurb: string;
  body: string;
  accent: string;
  ear: string;
};

export type SaveData = {
  unlocked: number;
  stars: Record<number, number>;
  skinId: string;
};

export type GameMode = "title" | "levels" | "playing" | "won" | "shop";
