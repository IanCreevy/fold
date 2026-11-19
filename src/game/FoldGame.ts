import Matter from "matter-js";
import { getSkin } from "./cosmetics";
import { LEVELS, WORLD } from "./levels";
import type { LevelDef, Skin, Vec } from "./types";
import { sfxFold, sfxGo, sfxScrap, sfxWin } from "./audio";

const { Engine, World, Bodies, Body, Events } = Matter;

type Snapshot = Vec[];

export type FoldGameCallbacks = {
  onHud: (info: {
    levelName: string;
    folds: number;
    running: boolean;
    canUndo: boolean;
  }) => void;
  onWin: (stars: number, folds: number, scraped: boolean) => void;
  onHint: (text: string | null) => void;
};

function clonePts(pts: Vec[]): Vec[] {
  return pts.map((p) => ({ x: p.x, y: p.y }));
}

function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function sampleTerrainY(pts: Vec[], x: number): number {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / Math.max(1, b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return pts[pts.length - 1]?.y ?? WORLD.h;
}

export class FoldGame {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine = Engine.create({ gravity: { x: 0, y: 1.05 } });
  private terrainBodies: Matter.Body[] = [];
  private traveler!: Matter.Body;
  private goal!: Matter.Body;
  private scrap: Matter.Body | null = null;
  private level!: LevelDef;
  private points: Vec[] = [];
  private undoStack: Snapshot[] = [];
  private folds = 0;
  private running = false;
  private won = false;
  private scraped = false;
  private folding = false;
  private creaseX = 0;
  private foldStart: Snapshot | null = null;
  private pointerId: number | null = null;
  private skin: Skin = getSkin("moth");
  private raf = 0;
  private lastTs = 0;
  private callbacks: FoldGameCallbacks;
  private paperOffset = Math.random() * 1000;
  private settledFrames = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: FoldGameCallbacks) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    this.ctx = ctx;
    this.callbacks = callbacks;

    canvas.width = WORLD.w;
    canvas.height = WORLD.h;

    this.bindInput();
    Events.on(this.engine, "collisionStart", (e) => {
      for (const pair of e.pairs) {
        const bodies = [pair.bodyA, pair.bodyB];
        if (this.scrap && bodies.includes(this.traveler) && bodies.includes(this.scrap)) {
          this.collectScrap();
        }
        if (bodies.includes(this.traveler) && bodies.includes(this.goal) && this.running && !this.won) {
          this.finishLevel();
        }
      }
    });
  }

  setSkin(skin: Skin) {
    this.skin = skin;
  }

  loadLevel(index: number) {
    const level = LEVELS[index];
    if (!level) return;
    this.clearWorld();
    this.level = level;
    this.points = clonePts(level.terrain);
    this.undoStack = [];
    this.folds = 0;
    this.running = false;
    this.won = false;
    this.scraped = false;
    this.folding = false;
    this.settledFrames = 0;

    this.rebuildTerrain();

    this.traveler = Bodies.circle(level.spawn.x, level.spawn.y, 18, {
      label: "traveler",
      friction: 0.05,
      frictionAir: 0.004,
      restitution: 0.15,
      density: 0.0035,
      sleepThreshold: 60,
    });
    Body.setStatic(this.traveler, true);

    // Tall finish plane: cross the door's X at any height to win.
    this.goal = Bodies.rectangle(level.goal.x, WORLD.h / 2, 28, WORLD.h, {
      isStatic: true,
      isSensor: true,
      label: "goal",
    });

    this.scrap = null;
    if (level.scrap) {
      this.scrap = Bodies.circle(level.scrap.x, level.scrap.y, 12, {
        isStatic: true,
        isSensor: true,
        label: "scrap",
      });
      World.add(this.engine.world, this.scrap);
    }

    World.add(this.engine.world, [this.traveler, this.goal]);
    this.callbacks.onHint(level.hint);
    this.emitHud();
  }

  private clearWorld() {
    World.clear(this.engine.world, false);
    Engine.clear(this.engine);
    this.engine = Engine.create({ gravity: { x: 0, y: 1.05 } });
    this.terrainBodies = [];
    Events.on(this.engine, "collisionStart", (e) => {
      for (const pair of e.pairs) {
        const bodies = [pair.bodyA, pair.bodyB];
        if (this.scrap && bodies.includes(this.traveler) && bodies.includes(this.scrap)) {
          this.collectScrap();
        }
        if (
          this.traveler &&
          this.goal &&
          bodies.includes(this.traveler) &&
          bodies.includes(this.goal) &&
          this.running &&
          !this.won
        ) {
          this.finishLevel();
        }
      }
    });
  }

  private rebuildTerrain() {
    if (this.terrainBodies.length) {
      World.remove(this.engine.world, this.terrainBodies);
      this.terrainBodies = [];
    }

    const thickness = 28;
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const len = Math.max(8, dist(a, b));
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const body = Bodies.rectangle(mid.x, mid.y + thickness * 0.35, len + 4, thickness, {
        isStatic: true,
        friction: 0.12,
        restitution: 0.02,
        label: "terrain",
        chamfer: { radius: 4 },
      });
      Body.setAngle(body, angle);
      this.terrainBodies.push(body);
    }

    // Invisible floor catch so traveler never falls forever
    this.terrainBodies.push(
      Bodies.rectangle(WORLD.w / 2, WORLD.h + 40, WORLD.w * 2, 80, {
        isStatic: true,
        label: "void",
      }),
    );
    World.add(this.engine.world, this.terrainBodies);
  }

  private applyFoldFromGesture(creaseX: number, deltaY: number) {
    if (!this.foldStart) return;
    const radius = this.level.foldRadius;
    this.points = this.foldStart.map((p) => {
      const d = Math.abs(p.x - creaseX);
      if (d >= radius) return { ...p };
      const t = 1 - d / radius;
      const influence = t * t * (3 - 2 * t);
      return { x: p.x, y: p.y + deltaY * influence };
    });
    this.rebuildTerrain();
    this.nudgeTravelerAboveGround();
  }

  private nudgeTravelerAboveGround() {
    if (!this.traveler || this.running) return;
    const y = sampleTerrainY(this.points, this.traveler.position.x);
    if (this.traveler.position.y > y - 28) {
      Body.setPosition(this.traveler, {
        x: this.traveler.position.x,
        y: y - 28,
      });
    }
  }

  startRun() {
    if (this.running || this.won) return;
    Body.setStatic(this.traveler, false);
    // Stronger push so a downhill fold can carry them up the far side.
    Body.setVelocity(this.traveler, { x: 4.2, y: -0.8 });
    this.running = true;
    this.callbacks.onHint(null);
    sfxGo();
    this.emitHud();
  }

  /** Extra roll help on downward slopes — builds momentum for climbs. */
  private applySlopeMomentum() {
    if (!this.running || this.won || !this.traveler) return;
    const x = this.traveler.position.x;
    const yLeft = sampleTerrainY(this.points, x - 12);
    const yRight = sampleTerrainY(this.points, x + 12);
    const slope = (yRight - yLeft) / 24; // +slope = downhill to the right
    if (slope > 0.08) {
      const boost = Math.min(0.22, slope * 0.35);
      Body.applyForce(this.traveler, this.traveler.position, { x: boost, y: 0 });
    }
    // Soft cap so they don't go rocket-speed
    const vx = this.traveler.velocity.x;
    if (vx > 14) Body.setVelocity(this.traveler, { x: 14, y: this.traveler.velocity.y });
  }

  undo() {
    if (this.running || this.won || this.undoStack.length === 0) return;
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.points = clonePts(prev);
    this.folds = Math.max(0, this.folds - 1);
    this.rebuildTerrain();
    this.resetTravelerPose(false);
    this.emitHud();
  }

  resetLevel() {
    const idx = LEVELS.findIndex((l) => l.id === this.level.id);
    this.loadLevel(idx);
  }

  private resetTravelerPose(keepFolds: boolean) {
    Body.setStatic(this.traveler, true);
    Body.setVelocity(this.traveler, { x: 0, y: 0 });
    Body.setAngularVelocity(this.traveler, 0);
    const y = sampleTerrainY(this.points, this.level.spawn.x);
    Body.setPosition(this.traveler, {
      x: this.level.spawn.x,
      y: Math.min(this.level.spawn.y, y - 28),
    });
    Body.setAngle(this.traveler, 0);
    this.running = false;
    if (!keepFolds) {
      /* folds already managed */
    }
    this.emitHud();
  }

  private collectScrap() {
    if (!this.scrap || this.scraped) return;
    this.scraped = true;
    World.remove(this.engine.world, this.scrap);
    this.scrap = null;
    sfxScrap();
  }

  private finishLevel() {
    if (this.won) return;
    this.won = true;
    this.running = false;
    Body.setStatic(this.traveler, true);
    Body.setVelocity(this.traveler, { x: 0, y: 0 });

    let stars = 1;
    if (this.folds <= this.level.twoStarFolds) stars = 2;
    if (stars === 2 && (this.scraped || !this.level.scrap)) stars = 3;
    // Level 1 has no scrap — 3★ if folds <= twoStarFolds
    if (!this.level.scrap && this.folds <= this.level.twoStarFolds) stars = 3;

    sfxWin(stars);
    this.callbacks.onWin(stars, this.folds, this.scraped);
    this.emitHud();
  }

  private emitHud() {
    this.callbacks.onHud({
      levelName: `${this.level.id}. ${this.level.name}`,
      folds: this.folds,
      running: this.running,
      canUndo: !this.running && this.undoStack.length > 0,
    });
  }

  private bindInput() {
    const el = this.canvas;

    const pos = (e: PointerEvent): Vec => {
      const rect = el.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * WORLD.w,
        y: ((e.clientY - rect.top) / rect.height) * WORLD.h,
      };
    };

    el.addEventListener("pointerdown", (e) => {
      if (this.running || this.won) return;
      const p = pos(e);
      // Only start fold if near the paper terrain
      const groundY = sampleTerrainY(this.points, p.x);
      if (p.y < groundY - 220 || p.y > groundY + 160) return;
      this.pointerId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      this.folding = true;
      this.creaseX = p.x;
      this.foldStart = clonePts(this.points);
      this.callbacks.onHint("Drag up or down to crease…");
    });

    el.addEventListener("pointermove", (e) => {
      if (!this.folding || e.pointerId !== this.pointerId || !this.foldStart) return;
      const p = pos(e);
      const startY = sampleTerrainY(this.foldStart, this.creaseX);
      const deltaY = Math.max(-220, Math.min(220, p.y - startY));
      this.applyFoldFromGesture(this.creaseX, deltaY);
    });

    const endFold = (e: PointerEvent) => {
      if (!this.folding || e.pointerId !== this.pointerId) return;
      this.folding = false;
      this.pointerId = null;
      if (this.foldStart) {
        const changed = this.points.some(
          (p, i) => Math.abs(p.y - this.foldStart![i].y) > 2,
        );
        if (changed) {
          this.undoStack.push(clonePts(this.foldStart));
          this.folds += 1;
          sfxFold();
          this.callbacks.onHint("Nice crease. Press Go when ready.");
          this.emitHud();
        } else {
          this.points = clonePts(this.foldStart);
          this.rebuildTerrain();
          this.callbacks.onHint(this.level.hint);
        }
      }
      this.foldStart = null;
    };

    el.addEventListener("pointerup", endFold);
    el.addEventListener("pointercancel", endFold);
  }

  start() {
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(32, ts - this.lastTs);
      this.lastTs = ts;
      Engine.update(this.engine, dt);

      if (this.running && !this.won) {
        this.applySlopeMomentum();

        const speed = Math.hypot(this.traveler.velocity.x, this.traveler.velocity.y);
        if (speed < 0.15) this.settledFrames++;
        else this.settledFrames = 0;

        // Win by passing the door line — any height counts.
        if (this.traveler.position.x >= this.level.goal.x) {
          this.finishLevel();
        }

        if (this.traveler.position.y > WORLD.h - 20) {
          this.resetTravelerPose(true);
          this.callbacks.onHint("They slipped off the page. Fold again, then Go.");
        }
      }

      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  private draw() {
    const c = this.ctx;
    c.clearRect(0, 0, WORLD.w, WORLD.h);

    // Sky wash
    const sky = c.createLinearGradient(0, 0, 0, WORLD.h);
    sky.addColorStop(0, "#b7d2e3");
    sky.addColorStop(0.45, "#d9e6ef");
    sky.addColorStop(1, "#f0e6d4");
    c.fillStyle = sky;
    c.fillRect(0, 0, WORLD.w, WORLD.h);

    // Soft paper grain bands
    c.save();
    c.globalAlpha = 0.08;
    for (let i = 0; i < 40; i++) {
      const y = ((i * 73 + this.paperOffset) % WORLD.h);
      c.fillStyle = i % 2 ? "#2c3a4a" : "#ffffff";
      c.fillRect(0, y, WORLD.w, 2);
    }
    c.restore();

    // Distant folded hills
    c.fillStyle = "rgba(61, 107, 79, 0.12)";
    c.beginPath();
    c.moveTo(0, 760);
    c.quadraticCurveTo(180, 680, 360, 740);
    c.quadraticCurveTo(540, 800, 720, 720);
    c.lineTo(720, 1280);
    c.lineTo(0, 1280);
    c.fill();

    this.drawTerrain();
    this.drawGuideFolds();
    this.drawFinishLine();
    this.drawDoor();
    if (this.scrap) this.drawScrap();
    this.drawTraveler();
    this.drawFoldGuide();
  }

  private foldPreview(base: Vec[], creaseX: number, deltaY: number): Vec[] {
    const radius = this.level.foldRadius;
    return base.map((p) => {
      const d = Math.abs(p.x - creaseX);
      if (d >= radius) return { ...p };
      const t = 1 - d / radius;
      const influence = t * t * (3 - 2 * t);
      return { x: p.x, y: p.y + deltaY * influence };
    });
  }

  private drawGuideFolds() {
    const guides = this.level.guideFolds;
    if (!guides?.length || this.running || this.won) return;
    const c = this.ctx;
    for (const g of guides) {
      const ghost = this.foldPreview(this.points, g.x, g.deltaY);
      c.save();
      c.strokeStyle = "rgba(196, 70, 55, 0.45)";
      c.lineWidth = 3;
      c.setLineDash([10, 10]);
      c.lineJoin = "round";
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(ghost[0].x, ghost[0].y);
      for (let i = 1; i < ghost.length; i++) c.lineTo(ghost[i].x, ghost[i].y);
      c.stroke();
      c.setLineDash([]);

      // Small marker where to drag
      const gy = sampleTerrainY(this.points, g.x);
      c.fillStyle = "rgba(196, 70, 55, 0.35)";
      c.beginPath();
      c.arc(g.x, gy, 8, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(196, 70, 55, 0.55)";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(g.x, gy - 8);
      c.lineTo(g.x, gy + g.deltaY);
      c.stroke();
      c.restore();
    }
  }

  private drawFinishLine() {
    const c = this.ctx;
    const x = this.level.goal.x;
    c.save();
    c.strokeStyle = "rgba(61, 107, 79, 0.35)";
    c.lineWidth = 3;
    c.setLineDash([6, 8]);
    c.beginPath();
    c.moveTo(x, 120);
    c.lineTo(x, WORLD.h - 40);
    c.stroke();
    c.setLineDash([]);
    c.restore();
  }

  private drawTerrain() {
    const c = this.ctx;
    if (this.points.length < 2) return;

    // Paper body
    c.beginPath();
    c.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      c.lineTo(this.points[i].x, this.points[i].y);
    }
    c.lineTo(WORLD.w + 20, WORLD.h + 20);
    c.lineTo(-20, WORLD.h + 20);
    c.closePath();

    const pulp = c.createLinearGradient(0, 700, 0, WORLD.h);
    pulp.addColorStop(0, "#f7f1e6");
    pulp.addColorStop(1, "#e0d2bc");
    c.fillStyle = pulp;
    c.fill();

    // Crease edge
    c.strokeStyle = "#2c3a4a";
    c.lineWidth = 4;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      c.lineTo(this.points[i].x, this.points[i].y);
    }
    c.stroke();

    // Inner fold shadow line
    c.strokeStyle = "rgba(196, 92, 38, 0.35)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(this.points[0].x, this.points[0].y + 8);
    for (let i = 1; i < this.points.length; i++) {
      c.lineTo(this.points[i].x, this.points[i].y + 8);
    }
    c.stroke();
  }

  private drawDoor() {
    const c = this.ctx;
    const x = this.level.goal.x;
    const groundY = sampleTerrainY(this.points, x);
    const y = Math.min(this.level.goal.y, groundY - 36);
    c.save();
    c.translate(x, y);
    // Door sits on the finish line as a landmark — crossing the line anywhere wins.
    c.fillStyle = "#3d6b4f";
    c.strokeStyle = "#2c3a4a";
    c.lineWidth = 3;
    c.beginPath();
    c.roundRect(-18, -28, 36, 52, 8);
    c.fill();
    c.stroke();
    c.fillStyle = "#f4ebe0";
    c.beginPath();
    c.roundRect(-10, -18, 20, 28, 4);
    c.fill();
    c.fillStyle = "#c45c26";
    c.beginPath();
    c.arc(4, -4, 3, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  private drawScrap() {
    if (!this.scrap) return;
    const c = this.ctx;
    const { x, y } = this.scrap.position;
    const bob = Math.sin(performance.now() / 280) * 4;
    c.save();
    c.translate(x, y + bob);
    c.rotate(-0.2);
    c.fillStyle = "#f7f1e6";
    c.strokeStyle = "#c45c26";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-10, -8);
    c.lineTo(10, -10);
    c.lineTo(8, 10);
    c.lineTo(-8, 8);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }

  private drawTraveler() {
    const c = this.ctx;
    const { x, y } = this.traveler.position;
    const angle = this.traveler.angle;
    c.save();
    c.translate(x, y);
    c.rotate(angle);

    // Soft shadow
    c.fillStyle = "rgba(44, 58, 74, 0.18)";
    c.beginPath();
    c.ellipse(0, 16, 16, 6, 0, 0, Math.PI * 2);
    c.fill();

    // Body
    c.fillStyle = this.skin.body;
    c.beginPath();
    c.arc(0, 0, 16, 0, Math.PI * 2);
    c.fill();

    // Ears / wings
    c.fillStyle = this.skin.ear;
    c.beginPath();
    c.ellipse(-14, -6, 10, 6, -0.5, 0, Math.PI * 2);
    c.ellipse(14, -6, 10, 6, 0.5, 0, Math.PI * 2);
    c.fill();

    // Face
    c.fillStyle = this.skin.accent;
    c.beginPath();
    c.arc(0, 2, 8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = this.skin.body;
    c.beginPath();
    c.arc(-3, 1, 1.6, 0, Math.PI * 2);
    c.arc(3, 1, 1.6, 0, Math.PI * 2);
    c.fill();

    c.restore();
  }

  private drawFoldGuide() {
    if (!this.folding) return;
    const c = this.ctx;
    const y = sampleTerrainY(this.points, this.creaseX);
    c.strokeStyle = "rgba(196, 92, 38, 0.7)";
    c.lineWidth = 2;
    c.setLineDash([8, 8]);
    c.beginPath();
    c.moveTo(this.creaseX, y - this.level.foldRadius);
    c.lineTo(this.creaseX, y + this.level.foldRadius * 0.4);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = "#c45c26";
    c.beginPath();
    c.arc(this.creaseX, y, 6, 0, Math.PI * 2);
    c.fill();
  }
}
