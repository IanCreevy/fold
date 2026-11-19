import Matter from "matter-js";
import { applyFold, clonePts, pathLooksWalkable, sampleTerrainY } from "./foldMath";
import { WORLD } from "./levelsMeta";
import type { LevelDef, Vec } from "./types";

const { Engine, World, Bodies, Body } = Matter;

function inBand(x: number, bands?: LevelDef["trampolineBands"]) {
  if (!bands) return false;
  return bands.some((b) => x >= b.x0 && x <= b.x1);
}

function buildTerrain(points: Vec[], level: LevelDef) {
  const bodies: Matter.Body[] = [];
  // Continuous chain of thick segments — slightly oversized to reduce tunneling
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.max(8, Math.hypot(b.x - a.x, b.y - a.y));
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const springy = inBand(mid.x, level.trampolineBands);
    const body = Bodies.rectangle(mid.x, mid.y + 14, len + 8, 36, {
      isStatic: true,
      friction: springy ? 0.04 : 0.15,
      restitution: springy ? 1.2 : 0.05,
      label: springy ? "trampoline" : "terrain",
    });
    Body.setAngle(body, angle);
    bodies.push(body);
  }
  for (const b of level.blockers ?? []) {
    bodies.push(
      Bodies.rectangle(b.x, b.y, b.w, b.h, {
        isStatic: true,
        label: "blocker",
      }),
    );
  }
  bodies.push(
    Bodies.rectangle(WORLD.w / 2, WORLD.h + 40, WORLD.w * 2, 80, {
      isStatic: true,
      label: "void",
    }),
  );
  return bodies;
}

export function geometricProof(level: LevelDef): boolean {
  const folds = level.solutionFolds ?? [];
  let pts = clonePts(level.terrain);
  for (const f of folds) pts = applyFold(pts, f.x, f.deltaY, level.foldRadius);
  return pathLooksWalkable(pts, level.spawn.x, level.goal.x, level.blockers ?? []);
}

export function simulateSolution(level: LevelDef): { ok: boolean; x: number; y: number } {
  const folds = level.solutionFolds ?? [];
  let points = clonePts(level.terrain);
  for (const f of folds) {
    points = applyFold(points, f.x, f.deltaY, level.foldRadius);
  }

  const engine = Engine.create({ gravity: { x: 0, y: 1.05 } });
  engine.positionIterations = 8;
  engine.velocityIterations = 6;
  const terrain = buildTerrain(points, level);
  World.add(engine.world, terrain);

  const ground = sampleTerrainY(points, level.spawn.x);
  const traveler = Bodies.circle(level.spawn.x, ground - 30, 16, {
    friction: 0.05,
    frictionAir: 0.008,
    restitution: 0.05,
    density: 0.002,
  });
  World.add(engine.world, traveler);
  Body.setVelocity(traveler, { x: 4.0, y: -0.2 });

  let lastBounce = 0;
  for (let step = 0; step < 1200; step++) {
    Engine.update(engine, 1000 / 60);

    // Slope assist (mirrors live game lightly)
    const x = traveler.position.x;
    const yL = sampleTerrainY(points, x - 12);
    const yR = sampleTerrainY(points, x + 12);
    const slope = (yR - yL) / 24;
    if (slope > 0.1) {
      Body.applyForce(traveler, traveler.position, { x: Math.min(0.08, slope * 0.15), y: 0 });
    }

    for (const body of terrain) {
      if (body.label !== "trampoline") continue;
      const dx = Math.abs(traveler.position.x - body.position.x);
      const dy = traveler.position.y - body.position.y;
      if (dx < 50 && dy > -15 && dy < 50 && traveler.velocity.y > 0.35) {
        if (step - lastBounce > 12) {
          lastBounce = step;
          const boost = Math.min(24, 11 + traveler.velocity.y * 1.85);
          Body.setVelocity(traveler, {
            x: Math.min(9.5, Math.max(traveler.velocity.x, 2.0) + 2.4),
            y: -boost,
          });
        }
      }
    }

    if (traveler.position.x >= level.goal.x) {
      const result = { ok: true, x: traveler.position.x, y: traveler.position.y };
      Engine.clear(engine);
      return result;
    }
    if (traveler.position.y > WORLD.h - 5) break;
  }
  const result = { ok: false, x: traveler.position.x, y: traveler.position.y };
  Engine.clear(engine);
  return result;
}

export function levelIsDoable(level: LevelDef): boolean {
  if (!geometricProof(level)) return false;
  return simulateSolution(level).ok;
}
