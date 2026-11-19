import Matter from "matter-js";
import { getSkin } from "./cosmetics";
import { LEVELS, WORLD } from "./levels";
import type { LevelDef, Skin, SkyMood, Vec } from "./types";
import { sfxFold, sfxGo, sfxScrap, sfxWin } from "./audio";

const { Engine, World, Bodies, Body, Events } = Matter;

type Snapshot = Vec[];

export type FoldGameCallbacks = {
  onHud: (info: {
    levelName: string;
    attempts: number;
    folds: number;
    running: boolean;
    canUndo: boolean;
    flapsLeft: number;
    hasWings: boolean;
    canFlutter: boolean;
  }) => void;
  onWin: (stars: number, attempts: number, scraped: boolean) => void;
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

function inBand(x: number, bands?: LevelDef["trampolineBands"]) {
  if (!bands) return false;
  return bands.some((b) => x >= b.x0 && x <= b.x1);
}

export class FoldGame {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine = Engine.create({ gravity: { x: 0, y: 1.0 } });
  private terrainBodies: Matter.Body[] = [];
  private blockerBodies: Matter.Body[] = [];
  private traveler!: Matter.Body;
  private goal!: Matter.Body;
  private scrap: Matter.Body | null = null;
  private level!: LevelDef;
  private points: Vec[] = [];
  private originalPoints: Vec[] = [];
  private undoStack: Snapshot[] = [];
  private folds = 0;
  private attempts = 0;
  private running = false;
  private won = false;
  private scraped = false;
  private folding = false;
  private creaseX = 0;
  private foldStart: Snapshot | null = null;
  private pointerId: number | null = null;
  private skin: Skin = getSkin("moth");
  private flapsLeft = 0;
  private canFlutterShown = false;
  private wingPhase = 0;
  private airborneFrames = 0;
  private raf = 0;
  private lastTs = 0;
  private callbacks: FoldGameCallbacks;
  private clouds: Array<{ x: number; y: number; w: number; speed: number }> = [];
  private rain: Array<{ x: number; y: number; v: number }> = [];
  private lastBounceAt = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: FoldGameCallbacks) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    this.ctx = ctx;
    this.callbacks = callbacks;
    canvas.width = WORLD.w;
    canvas.height = WORLD.h;
    this.seedDecor();
    this.bindInput();
    this.attachCollisions(this.engine);
  }

  private seedDecor() {
    this.clouds = Array.from({ length: 6 }, (_, i) => ({
      x: (i * 160 + Math.random() * 80) % WORLD.w,
      y: 120 + Math.random() * 220,
      w: 70 + Math.random() * 90,
      speed: 0.08 + Math.random() * 0.12,
    }));
    this.rain = Array.from({ length: 60 }, () => ({
      x: Math.random() * WORLD.w,
      y: Math.random() * WORLD.h,
      v: 6 + Math.random() * 5,
    }));
  }

  private attachCollisions(engine: Matter.Engine) {
    Events.on(engine, "collisionStart", (e) => {
      for (const pair of e.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        if (this.scrap && this.traveler && (a === this.traveler || b === this.traveler)) {
          const other = a === this.traveler ? b : a;
          if (other === this.scrap) this.collectScrap();
        }
        this.tryTrampolineBounce(a, b);
      }
    });
  }

  /** Matter restitution on static bodies is unreliable — punch an impulse instead. */
  private tryTrampolineBounce(a: Matter.Body, b: Matter.Body) {
    if (!this.traveler || !this.running || this.won) return;
    const other = a === this.traveler ? b : b === this.traveler ? a : null;
    if (!other || other.label !== "trampoline") return;
    const now = performance.now();
    if (now - this.lastBounceAt < 180) return;
    const vy = this.traveler.velocity.y;
    // Only spring when landing / pressing into the pad
    if (vy < 0.4) return;
    this.lastBounceAt = now;
    // Generous spring so a good setup clears — “missed by a fraction” should be rare
    const boost = Math.min(24, 11 + vy * 1.85);
    Body.setVelocity(this.traveler, {
      x: Math.min(9.5, Math.max(this.traveler.velocity.x, 2.0) + 2.4),
      y: -boost,
    });
  }

  setSkin(skin: Skin) {
    this.skin = skin;
    if (!this.running) this.flapsLeft = skin.flaps;
    this.emitHud();
  }

  loadLevel(index: number) {
    const level = LEVELS[index];
    if (!level) return;
    this.clearWorld();
    this.level = level;
    this.points = clonePts(level.terrain);
    this.originalPoints = clonePts(level.terrain);
    this.undoStack = [];
    this.folds = 0;
    this.attempts = 0;
    this.running = false;
    this.won = false;
    this.scraped = false;
    this.folding = false;
    this.airborneFrames = 0;
    this.flapsLeft = this.skin.flaps;

    this.rebuildTerrain();
    this.rebuildBlockers();

    this.traveler = Bodies.circle(level.spawn.x, level.spawn.y, 18, {
      label: "traveler",
      friction: 0.08,
      frictionAir: 0.012,
      restitution: 0.12,
      density: 0.0028,
      sleepThreshold: 50,
    });
    Body.setStatic(this.traveler, true);

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
    this.nudgeTravelerAboveGround();
    this.callbacks.onHint(level.hint);
    this.emitHud();
  }

  private clearWorld() {
    World.clear(this.engine.world, false);
    Engine.clear(this.engine);
    this.engine = Engine.create({ gravity: { x: 0, y: 1.0 } });
    this.terrainBodies = [];
    this.blockerBodies = [];
    this.attachCollisions(this.engine);
  }

  private rebuildBlockers() {
    if (this.blockerBodies.length) {
      World.remove(this.engine.world, this.blockerBodies);
      this.blockerBodies = [];
    }
    for (const b of this.level.blockers ?? []) {
      const body = Bodies.rectangle(b.x, b.y, b.w, b.h, {
        isStatic: true,
        friction: 0.4,
        restitution: 0.05,
        label: "blocker",
      });
      this.blockerBodies.push(body);
    }
    if (this.blockerBodies.length) World.add(this.engine.world, this.blockerBodies);
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
      const springy = inBand(mid.x, this.level.trampolineBands);
      const body = Bodies.rectangle(mid.x, mid.y + thickness * 0.35, len + 4, thickness, {
        isStatic: true,
        friction: springy ? 0.05 : 0.22,
        restitution: springy ? 1.35 : 0.02,
        label: springy ? "trampoline" : "terrain",
        chamfer: { radius: 4 },
      });
      Body.setAngle(body, angle);
      this.terrainBodies.push(body);
    }

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
    this.attempts += 1;
    this.flapsLeft = this.skin.flaps;
    Body.setStatic(this.traveler, false);
    Body.setVelocity(this.traveler, { x: 2.1, y: -0.3 });
    this.running = true;
    this.callbacks.onHint(null);
    sfxGo();
    this.emitHud();
  }

  private canFlutterNow() {
    return this.running && !this.won && this.skin.hasWings && this.flapsLeft > 0 && this.airborneFrames >= 4;
  }

  flutter() {
    if (!this.canFlutterNow()) return;
    this.flapsLeft -= 1;
    this.wingPhase = 1;
    Body.setVelocity(this.traveler, {
      x: Math.max(this.traveler.velocity.x, 2.4) + 1.2,
      y: Math.min(this.traveler.velocity.y, -5.5),
    });
    this.emitHud();
  }

  private applySlopeMomentum() {
    if (!this.running || this.won || !this.traveler) return;
    const x = this.traveler.position.x;
    const yLeft = sampleTerrainY(this.points, x - 12);
    const yRight = sampleTerrainY(this.points, x + 12);
    const slope = (yRight - yLeft) / 24;
    if (slope > 0.12) {
      const boost = Math.min(0.06, slope * 0.12);
      Body.applyForce(this.traveler, this.traveler.position, { x: boost, y: 0 });
    }
    const vx = this.traveler.velocity.x;
    if (vx > 6.5) Body.setVelocity(this.traveler, { x: 6.5, y: this.traveler.velocity.y });
  }

  undo() {
    if (this.running || this.won || this.undoStack.length === 0) return;
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.points = clonePts(prev);
    this.folds = Math.max(0, this.folds - 1);
    this.rebuildTerrain();
    this.resetTravelerPose();
    this.emitHud();
  }

  resetLevel() {
    const idx = LEVELS.findIndex((l) => l.id === this.level.id);
    const keptAttempts = this.attempts;
    this.loadLevel(idx);
    this.attempts = keptAttempts;
    this.emitHud();
  }

  private resetTravelerPose() {
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
    this.flapsLeft = this.skin.flaps;
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
    if (this.attempts <= 3) stars = 2;
    if (this.attempts <= 1) stars = 3;

    sfxWin(stars);
    this.callbacks.onWin(stars, this.attempts, this.scraped);
    this.emitHud();
  }

  private emitHud() {
    if (!this.level) return;
    this.canFlutterShown = this.canFlutterNow();
    this.callbacks.onHud({
      levelName: `${this.level.id}. ${this.level.name}`,
      attempts: this.attempts,
      folds: this.folds,
      running: this.running,
      canUndo: !this.running && this.undoStack.length > 0,
      flapsLeft: this.flapsLeft,
      hasWings: this.skin.hasWings,
      canFlutter: this.canFlutterShown,
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
      if (this.running && !this.won) {
        this.flutter();
        return;
      }
      if (this.running || this.won) return;
      const p = pos(e);
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
      this.wingPhase = Math.max(0, this.wingPhase - dt * 0.004);
      this.tickDecor(dt);

      if (this.running && !this.won) {
        this.applySlopeMomentum();

        const groundY = sampleTerrainY(this.points, this.traveler.position.x);
        const above = this.traveler.position.y < groundY - 34;
        this.airborneFrames = above ? this.airborneFrames + 1 : 0;
        const canFlutter = this.canFlutterNow();
        if (canFlutter !== this.canFlutterShown) {
          this.canFlutterShown = canFlutter;
          this.emitHud();
        }

        if (this.traveler.position.x >= this.level.goal.x) this.finishLevel();

        if (this.traveler.position.y > WORLD.h - 20) {
          this.resetTravelerPose();
          this.callbacks.onHint("Slipped off the page. Fold again, then Go. Attempts still count.");
        }
      }

      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  private tickDecor(dt: number) {
    for (const c of this.clouds) {
      c.x += c.speed * (dt / 16);
      if (c.x > WORLD.w + 100) c.x = -120;
    }
    if (this.level && (this.level.sky === "rain" || this.level.sky === "storm")) {
      for (const d of this.rain) {
        d.y += d.v * (dt / 16);
        d.x -= 0.8;
        if (d.y > WORLD.h) {
          d.y = -10;
          d.x = Math.random() * WORLD.w;
        }
      }
    }
  }

  private draw() {
    const c = this.ctx;
    c.clearRect(0, 0, WORLD.w, WORLD.h);
    this.drawSky();
    this.drawTerrain();
    this.drawBlockers();
    this.drawGuideFolds();
    this.drawFinishLine();
    this.drawDoor();
    if (this.scrap) this.drawScrap();
    this.drawTraveler();
    this.drawFoldGuide();
  }

  private drawBlockers() {
    if (!this.level.blockers?.length) return;
    const c = this.ctx;
    for (const b of this.level.blockers) {
      c.save();
      const grad = c.createLinearGradient(b.x - b.w / 2, b.y - b.h / 2, b.x + b.w / 2, b.y + b.h / 2);
      grad.addColorStop(0, "#3a4555");
      grad.addColorStop(0.5, "#1e2836");
      grad.addColorStop(1, "#4a5568");
      c.fillStyle = grad;
      c.strokeStyle = "#0f141c";
      c.lineWidth = 3;
      c.beginPath();
      c.roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 6);
      c.fill();
      c.stroke();
      // Paper band marks so it reads as an ink wall, not a bug
      c.strokeStyle = "rgba(255, 230, 200, 0.15)";
      c.lineWidth = 2;
      for (let y = b.y - b.h / 2 + 16; y < b.y + b.h / 2; y += 22) {
        c.beginPath();
        c.moveTo(b.x - b.w / 2 + 4, y);
        c.lineTo(b.x + b.w / 2 - 4, y);
        c.stroke();
      }
      c.restore();
    }
  }

  private skyPalette(mood: SkyMood) {
    switch (mood) {
      case "golden":
        return { top: "#f0b36a", mid: "#f7d9a8", bot: "#f3e2c8", sun: "#fff3a8", cloud: "rgba(255,250,240,0.75)" };
      case "storm":
        return { top: "#4a5568", mid: "#6b7c8f", bot: "#a8b4c0", sun: "#d9dde3", cloud: "rgba(70,80,95,0.55)" };
      case "rain":
        return { top: "#6a8499", mid: "#8fa9b8", bot: "#d4cfc0", sun: "#c5d0d8", cloud: "rgba(120,130,140,0.5)" };
      default:
        return { top: "#7ec8e8", mid: "#b7dff0", bot: "#f3e6c8", sun: "#ffe566", cloud: "rgba(255,255,255,0.82)" };
    }
  }

  private drawSky() {
    const c = this.ctx;
    const mood = this.level?.sky ?? "sunny";
    const p = this.skyPalette(mood);
    const sky = c.createLinearGradient(0, 0, 0, WORLD.h);
    sky.addColorStop(0, p.top);
    sky.addColorStop(0.4, p.mid);
    sky.addColorStop(1, p.bot);
    c.fillStyle = sky;
    c.fillRect(0, 0, WORLD.w, WORLD.h);

    // Sun / moon disc
    c.save();
    c.fillStyle = p.sun;
    c.beginPath();
    c.arc(mood === "storm" ? 560 : 560, mood === "storm" ? 160 : 150, mood === "storm" ? 28 : 42, 0, Math.PI * 2);
    c.fill();
    if (mood === "sunny" || mood === "golden") {
      c.globalAlpha = 0.25;
      c.beginPath();
      c.arc(560, 150, 70, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // Clouds
    for (const cloud of this.clouds) {
      this.drawCloud(cloud.x, cloud.y, cloud.w, p.cloud);
    }

    // Distant hills
    c.fillStyle = mood === "storm" || mood === "rain" ? "rgba(55,70,60,0.25)" : "rgba(70,130,90,0.22)";
    c.beginPath();
    c.moveTo(0, 780);
    c.quadraticCurveTo(180, 700, 360, 760);
    c.quadraticCurveTo(540, 820, 720, 740);
    c.lineTo(720, 1280);
    c.lineTo(0, 1280);
    c.fill();

    // Rain streaks
    if (mood === "rain" || mood === "storm") {
      c.strokeStyle = mood === "storm" ? "rgba(200,220,240,0.35)" : "rgba(220,235,245,0.4)";
      c.lineWidth = 1.5;
      for (const d of this.rain) {
        c.beginPath();
        c.moveTo(d.x, d.y);
        c.lineTo(d.x - 3, d.y + 14);
        c.stroke();
      }
    }
  }

  private drawCloud(x: number, y: number, w: number, color: string) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.ellipse(x, y, w * 0.5, w * 0.22, 0, 0, Math.PI * 2);
    c.ellipse(x - w * 0.28, y + 6, w * 0.28, w * 0.18, 0, 0, Math.PI * 2);
    c.ellipse(x + w * 0.3, y + 4, w * 0.32, w * 0.2, 0, 0, Math.PI * 2);
    c.fill();
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
    const guides = this.level?.guideFolds;
    if (!guides?.length || this.running || this.won) return;
    const c = this.ctx;
    for (const g of guides) {
      const ghost = this.foldPreview(this.originalPoints, g.x, g.deltaY);
      c.save();
      c.strokeStyle = "rgba(196, 70, 55, 0.5)";
      c.lineWidth = 3;
      c.setLineDash([10, 10]);
      c.beginPath();
      c.moveTo(ghost[0].x, ghost[0].y);
      for (let i = 1; i < ghost.length; i++) c.lineTo(ghost[i].x, ghost[i].y);
      c.stroke();
      c.setLineDash([]);
      const gy = sampleTerrainY(this.originalPoints, g.x);
      const targetY = gy + g.deltaY;
      c.fillStyle = "rgba(196, 70, 55, 0.4)";
      c.beginPath();
      c.arc(g.x, gy, 9, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(196, 70, 55, 0.65)";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(g.x, gy);
      c.lineTo(g.x, targetY);
      c.stroke();
      c.beginPath();
      c.moveTo(g.x, targetY);
      c.lineTo(g.x - 7, targetY + 12);
      c.lineTo(g.x + 7, targetY + 12);
      c.closePath();
      c.fillStyle = "rgba(196, 70, 55, 0.55)";
      c.fill();
      c.restore();
    }
  }

  private drawTerrain() {
    const c = this.ctx;
    if (this.points.length < 2) return;

    c.beginPath();
    c.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) c.lineTo(this.points[i].x, this.points[i].y);
    c.lineTo(WORLD.w + 20, WORLD.h + 20);
    c.lineTo(-20, WORLD.h + 20);
    c.closePath();

    const pulp = c.createLinearGradient(0, 700, 0, WORLD.h);
    pulp.addColorStop(0, "#fff6e8");
    pulp.addColorStop(0.5, "#f0dcc0");
    pulp.addColorStop(1, "#d9b896");
    c.fillStyle = pulp;
    c.fill();

    // Trampoline coral overlays
    if (this.level.trampolineBands) {
      for (const band of this.level.trampolineBands) {
        c.save();
        c.beginPath();
        let started = false;
        for (let i = 0; i < this.points.length; i++) {
          const p = this.points[i];
          if (p.x < band.x0 || p.x > band.x1) continue;
          if (!started) {
            c.moveTo(p.x, p.y);
            started = true;
          } else c.lineTo(p.x, p.y);
        }
        // Fill a ribbon under the band
        const y0 = sampleTerrainY(this.points, band.x0);
        const y1 = sampleTerrainY(this.points, band.x1);
        c.lineTo(band.x1, y1 + 36);
        c.lineTo(band.x0, y0 + 36);
        c.closePath();
        const spring = c.createLinearGradient(band.x0, 0, band.x1, 0);
        spring.addColorStop(0, "rgba(255, 120, 100, 0.55)");
        spring.addColorStop(0.5, "rgba(255, 180, 120, 0.7)");
        spring.addColorStop(1, "rgba(255, 110, 140, 0.55)");
        c.fillStyle = spring;
        c.fill();
        c.strokeStyle = "rgba(220, 70, 90, 0.7)";
        c.lineWidth = 3;
        c.setLineDash([6, 6]);
        c.beginPath();
        c.moveTo(band.x0, y0);
        const steps = 12;
        for (let s = 1; s <= steps; s++) {
          const x = band.x0 + ((band.x1 - band.x0) * s) / steps;
          c.lineTo(x, sampleTerrainY(this.points, x));
        }
        c.stroke();
        c.setLineDash([]);
        c.restore();
      }
    }

    c.strokeStyle = "#3a2f28";
    c.lineWidth = 4;
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) c.lineTo(this.points[i].x, this.points[i].y);
    c.stroke();

    c.strokeStyle = "rgba(196, 92, 38, 0.35)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(this.points[0].x, this.points[0].y + 8);
    for (let i = 1; i < this.points.length; i++) c.lineTo(this.points[i].x, this.points[i].y + 8);
    c.stroke();
  }

  private drawFinishLine() {
    const c = this.ctx;
    const x = this.level.goal.x;
    c.save();
    c.strokeStyle = "rgba(45, 120, 80, 0.4)";
    c.lineWidth = 3;
    c.setLineDash([6, 8]);
    c.beginPath();
    c.moveTo(x, 120);
    c.lineTo(x, WORLD.h - 40);
    c.stroke();
    c.setLineDash([]);
    c.restore();
  }

  private drawDoor() {
    const c = this.ctx;
    const x = this.level.goal.x;
    const groundY = sampleTerrainY(this.points, x);
    const y = Math.min(this.level.goal.y, groundY - 36);
    c.save();
    c.translate(x, y);
    c.fillStyle = "#2f8f5b";
    c.strokeStyle = "#1e3a2f";
    c.lineWidth = 3;
    c.beginPath();
    c.roundRect(-18, -28, 36, 52, 8);
    c.fill();
    c.stroke();
    c.fillStyle = "#fff4dc";
    c.beginPath();
    c.roundRect(-10, -18, 20, 28, 4);
    c.fill();
    c.fillStyle = "#e07a3a";
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
    c.fillStyle = "#fff8e7";
    c.strokeStyle = "#e07a3a";
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
    const flap = Math.sin(performance.now() / 120) * (0.15 + this.wingPhase * 0.5);
    c.save();
    c.translate(x, y);
    c.rotate(angle);

    c.fillStyle = "rgba(40, 30, 20, 0.18)";
    c.beginPath();
    c.ellipse(0, 17, 15, 6, 0, 0, Math.PI * 2);
    c.fill();

    // Wings (decorative always; bigger if hasWings)
    const wingColor = this.skin.wing ?? this.skin.ear;
    const wingSpan = this.skin.hasWings ? 20 : 14;
    c.save();
    c.fillStyle = wingColor;
    c.globalAlpha = 0.9;
    c.beginPath();
    c.ellipse(-wingSpan, -2, wingSpan * 0.85, 9, -0.55 - flap, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(wingSpan, -2, wingSpan * 0.85, 9, 0.55 + flap, 0, Math.PI * 2);
    c.fill();
    // Wing pattern dots
    c.fillStyle = this.skin.accent;
    c.globalAlpha = 0.55;
    c.beginPath();
    c.arc(-wingSpan - 2, -2, 3, 0, Math.PI * 2);
    c.arc(wingSpan + 2, -2, 3, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // Body
    c.fillStyle = this.skin.body;
    c.beginPath();
    c.ellipse(0, 2, 13, 15, 0, 0, Math.PI * 2);
    c.fill();

    // Belly
    c.fillStyle = this.skin.accent;
    c.beginPath();
    c.ellipse(0, 5, 8, 9, 0, 0, Math.PI * 2);
    c.fill();

    // Antennae / ears
    c.strokeStyle = this.skin.ear;
    c.lineWidth = 2.5;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-4, -12);
    c.quadraticCurveTo(-10, -22, -14, -18);
    c.moveTo(4, -12);
    c.quadraticCurveTo(10, -22, 14, -18);
    c.stroke();
    c.fillStyle = this.skin.ear;
    c.beginPath();
    c.arc(-14, -18, 3.2, 0, Math.PI * 2);
    c.arc(14, -18, 3.2, 0, Math.PI * 2);
    c.fill();

    // Eyes
    c.fillStyle = "#1a1520";
    c.beginPath();
    c.arc(-4, 0, 2.2, 0, Math.PI * 2);
    c.arc(4, 0, 2.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(-3.3, -0.7, 0.8, 0, Math.PI * 2);
    c.arc(4.7, -0.7, 0.8, 0, Math.PI * 2);
    c.fill();

    // Smile
    c.strokeStyle = "#1a1520";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(0, 4, 3.5, 0.15, Math.PI - 0.15);
    c.stroke();

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
