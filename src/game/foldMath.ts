import type { Vec } from "./types";

export function clonePts(pts: Vec[]): Vec[] {
  return pts.map((p) => ({ x: p.x, y: p.y }));
}

/** Same crease math the live game uses. */
export function applyFold(
  pts: Vec[],
  creaseX: number,
  deltaY: number,
  radius: number,
): Vec[] {
  return pts.map((p) => {
    const d = Math.abs(p.x - creaseX);
    if (d >= radius) return { ...p };
    const t = 1 - d / radius;
    const influence = t * t * (3 - 2 * t);
    return { x: p.x, y: p.y + deltaY * influence };
  });
}

export function sampleTerrainY(pts: Vec[], x: number): number {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / Math.max(1, b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return pts[pts.length - 1]?.y ?? 1280;
}

/**
 * After applying solution folds, the path should be a continuous roll
 * from spawnX to goalX with no deadly cliffs and clearance under blockers.
 */
export function pathLooksWalkable(
  pts: Vec[],
  spawnX: number,
  goalX: number,
  blockers: Array<{ x: number; y: number; w: number; h: number }> = [],
): boolean {
  let prevY = sampleTerrainY(pts, spawnX);
  for (let x = spawnX; x <= goalX; x += 6) {
    const y = sampleTerrainY(pts, x);
    const drop = y - prevY; // +drop = downhill to the right (good)
    const climb = prevY - y; // +climb = uphill (moth struggles)
    if (climb > 18) return false; // too steep to roll up
    if (drop > 70) return false; // cliff plunge
    if (y > 1220) return false;
    for (const b of blockers) {
      if (Math.abs(x - b.x) <= b.w / 2 + 12) {
        const bottom = b.y + b.h / 2;
        // Traveler needs terrain below the wall bottom (larger Y = lower on screen)
        if (y < bottom + 28) return false;
      }
    }
    prevY = y;
  }
  return true;
}
