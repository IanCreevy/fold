import "./style.css";
import { FoldGame } from "./game/FoldGame";
import {
  formatPrice,
  getSkin,
  loadSave,
  ownsSkin,
  recordClear,
  SKINS,
  writeSave,
} from "./game/cosmetics";
import { estimatePlaytimeHours, LEVELS } from "./game/levels";
import { unlockAudio } from "./game/audio";
import { restorePurchases } from "./game/purchases";
import { SECTION_LABEL, type SaveData } from "./game/types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app missing");

let save: SaveData = loadSave();
let currentLevelIndex = 0;
const playtime = estimatePlaytimeHours();

const DIRECTOR_KEY = "fold.director.v1";

function isDirector(): boolean {
  return import.meta.env.DEV && localStorage.getItem(DIRECTOR_KEY) === "1";
}

function enableDirectorFromUrl() {
  if (!import.meta.env.DEV) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("director") === "pulp-attic") {
    localStorage.setItem(DIRECTOR_KEY, "1");
    params.delete("director");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }
}
enableDirectorFromUrl();

app.innerHTML = `
  <div class="shell">
    <div class="stage">
      <canvas id="game"></canvas>
      <div class="hint hidden" id="hint"></div>
      <div class="overlay" id="hud">
        <div class="top-bar">
          <div>
            <div class="brand">Fold</div>
            <div class="meta" id="levelMeta">1. Crease</div>
            <div class="meta" id="sectionMeta"></div>
          </div>
          <div class="top-right">
            <div class="meta" id="foldMeta">Attempts 0</div>
          </div>
        </div>
      </div>
    </div>
    <div class="bottom-bar" id="bottomBar">
      <button class="btn secondary" id="btnUndo" type="button">Undo</button>
      <button class="btn secondary" id="btnReset" type="button">Reset</button>
      <button class="btn accent" id="btnGo" type="button">Go</button>
      <button class="btn secondary hidden" id="btnFlutter" type="button">Flutter</button>
      <button class="btn secondary" id="btnShop" type="button">Skins</button>
      <button class="btn secondary" id="btnLevels" type="button">Levels</button>
    </div>

    <div class="screen" id="titleScreen">
      <h1>Fold</h1>
      <p>Thirty training postcards — then Chapter 4, the long climb. Clear at your pace; the mix gets tougher as you go.</p>
      <p class="sub-line">${playtime.levels} postcards · ~${playtime.casualHours}h casual · ${playtime.monthsHint}</p>
      <div class="actions">
        <button class="btn accent" id="btnPlay" type="button">Play</button>
        <button class="btn secondary" id="btnTitleShop" type="button">Skins</button>
      </div>
      <p class="legal">
        <button type="button" id="btnRestoreTitle">Restore purchases</button>
        <a href="privacy.html">Privacy</a>
        <a href="eula.html">EULA</a>
        <a href="support.html">Support</a>
      </p>
    </div>

    <div class="panel hidden" id="levelPanel">
      <div class="panel-card">
        <h2>Postcards</h2>
        <p class="sub">${playtime.levels} levels · casual ~${playtime.casualHours}h · ${playtime.monthsHint}. Stars = attempts (1 = ★★★).</p>
        <div id="directorBar" class="director-bar hidden">
          <span class="director-badge">Director</span>
          <input id="jumpLevel" type="number" min="1" max="${LEVELS.length}" placeholder="Level #" />
          <button class="btn accent" id="btnJump" type="button">Jump</button>
        </div>
        <div class="level-list" id="levelList"></div>
        <button class="btn secondary" id="btnCloseLevels" type="button">Close</button>
      </div>
    </div>

    <div class="panel hidden" id="shopPanel">
      <div class="panel-card">
        <h2>Traveler skins</h2>
        <p class="sub" id="shopSub">The whole campaign is free. Premium skins are App Store and Google Play purchases.</p>
        <div class="skin-grid" id="skinGrid"></div>
        <div class="actions">
          <button class="btn secondary" id="btnRestore" type="button">Restore purchases</button>
          <button class="btn secondary" id="btnCloseShop" type="button">Close</button>
        </div>
        <p class="legal">
          <a href="privacy.html">Privacy</a>
          <a href="eula.html">EULA</a>
          <a href="support.html">Support</a>
        </p>
      </div>
    </div>

    <div class="panel hidden" id="winPanel">
      <div class="panel-card">
        <h2 id="winTitle">Clear!</h2>
        <div class="win-stars" id="winStars">★★★</div>
        <p class="sub" id="winBlurb">Beautiful crease work.</p>
        <div class="actions">
          <button class="btn accent" id="btnNext" type="button">Next</button>
          <button class="btn secondary" id="btnReplay" type="button">Replay</button>
        </div>
      </div>
    </div>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const hintEl = document.querySelector<HTMLDivElement>("#hint")!;
const levelMeta = document.querySelector<HTMLDivElement>("#levelMeta")!;
const sectionMeta = document.querySelector<HTMLDivElement>("#sectionMeta")!;
const foldMeta = document.querySelector<HTMLDivElement>("#foldMeta")!;
const btnUndo = document.querySelector<HTMLButtonElement>("#btnUndo")!;
const btnGo = document.querySelector<HTMLButtonElement>("#btnGo")!;
const btnFlutter = document.querySelector<HTMLButtonElement>("#btnFlutter")!;
const titleScreen = document.querySelector<HTMLDivElement>("#titleScreen")!;
const levelPanel = document.querySelector<HTMLDivElement>("#levelPanel")!;
const shopPanel = document.querySelector<HTMLDivElement>("#shopPanel")!;
const winPanel = document.querySelector<HTMLDivElement>("#winPanel")!;
const levelList = document.querySelector<HTMLDivElement>("#levelList")!;
const skinGrid = document.querySelector<HTMLDivElement>("#skinGrid")!;
const winStars = document.querySelector<HTMLDivElement>("#winStars")!;
const winBlurb = document.querySelector<HTMLParagraphElement>("#winBlurb")!;
const hud = document.querySelector<HTMLDivElement>("#hud")!;
const shopSub = document.querySelector<HTMLParagraphElement>("#shopSub")!;

const game = new FoldGame(canvas, {
  onHud: ({ levelName, attempts, running, canUndo, flapsLeft, hasWings }) => {
    levelMeta.textContent = levelName;
    const lvl = LEVELS[currentLevelIndex];
    sectionMeta.textContent = lvl ? SECTION_LABEL[lvl.section] : "";
    foldMeta.textContent = `Attempts ${attempts}`;
    btnUndo.disabled = !canUndo;
    btnGo.disabled = running;
    btnGo.textContent = running ? "Running…" : "Go";
    btnFlutter.classList.toggle("hidden", !hasWings);
    btnFlutter.disabled = !running || flapsLeft <= 0;
    btnFlutter.textContent = hasWings ? `Flutter (${flapsLeft})` : "Flutter";
  },
  onWin: (stars, attempts) => {
    const level = LEVELS[currentLevelIndex];
    save = recordClear(save, level.id, stars);
    winStars.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
    if (stars === 3) {
      winBlurb.textContent = `First-try clear in ${attempts} attempt.`;
    } else if (stars === 2) {
      winBlurb.textContent = `Cleared in ${attempts} attempts. Beat it in 1 try for ★★★.`;
    } else {
      winBlurb.textContent = `Cleared in ${attempts} attempts. Fewer tries = more stars.`;
    }
    winPanel.classList.remove("hidden");
    renderLevels();
  },
  onHint: (text) => {
    if (!text) {
      hintEl.classList.add("hidden");
      hintEl.textContent = "";
      return;
    }
    hintEl.textContent = text;
    hintEl.classList.remove("hidden");
  },
});

game.setSkin(getSkin(save.skinId));
game.start();

const shell = document.querySelector<HTMLDivElement>(".shell")!;

function showTitle(show: boolean) {
  titleScreen.classList.toggle("hidden", !show);
  hud.style.visibility = show ? "hidden" : "visible";
  shell.classList.toggle("title-mode", show);
}

function openLevels(open: boolean) {
  levelPanel.classList.toggle("hidden", !open);
  if (open) renderLevels();
}

function openShop(open: boolean) {
  shopPanel.classList.toggle("hidden", !open);
  if (open) renderShop();
}

function startLevel(index: number) {
  currentLevelIndex = index;
  winPanel.classList.add("hidden");
  openLevels(false);
  showTitle(false);
  game.setSkin(getSkin(save.skinId));
  game.loadLevel(index);
}

function renderLevels() {
  const director = isDirector();
  const directorBar = document.querySelector<HTMLDivElement>("#directorBar")!;
  directorBar.classList.toggle("hidden", !director);

  let lastSection = "";
  const chunks: string[] = [];
  // Normal players: unlocked window. Director: jump anywhere + wider list around jump target.
  const maxShow = director
    ? Math.min(LEVELS.length, Math.max(save.unlocked + 40, 80))
    : Math.min(LEVELS.length, Math.max(save.unlocked + 8, 40));
  for (let i = 0; i < maxShow; i++) {
    const lvl = LEVELS[i];
    if (lvl.section !== lastSection) {
      lastSection = lvl.section;
      chunks.push(`<div class="section-head">${SECTION_LABEL[lvl.section]}</div>`);
    }
    const locked = !director && lvl.id > save.unlocked;
    const stars = save.stars[lvl.id] ?? 0;
    const starTxt = stars ? "★".repeat(stars) : "—";
    chunks.push(`<button class="level-btn" data-i="${i}" ${locked ? "disabled" : ""} type="button">
      <span>${lvl.id}. ${lvl.name}</span>
      <span class="stars">${locked ? "Locked" : starTxt}</span>
    </button>`);
  }
  if (maxShow < LEVELS.length) {
    chunks.push(
      `<p class="sub" style="margin-top:0.5rem">${LEVELS.length - maxShow} more postcards unlock as you go${director ? " — or Jump by number" : ""}…</p>`,
    );
  }
  levelList.innerHTML = chunks.join("");
  levelList.querySelectorAll<HTMLButtonElement>(".level-btn").forEach((btn) => {
    btn.addEventListener("click", () => startLevel(Number(btn.dataset.i)));
  });
}

function jumpToLevelNumber(raw: string) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return;
  const idx = Math.max(1, Math.min(LEVELS.length, Math.floor(n))) - 1;
  startLevel(idx);
}

function renderShop() {
  shopSub.textContent =
    "The campaign stays free. Pulp Moth and Paper Fox are included. Other skins are bought with Apple or Google billing in the store apps.";
  skinGrid.innerHTML = SKINS.map((skin) => {
    const active = skin.id === save.skinId;
    const owned = ownsSkin(save, skin.id);
    const price = skin.priceCents === 0 ? "Free" : owned ? "Owned" : formatPrice(skin.priceCents);
    const wing = skin.hasWings ? ` · ${skin.flaps} flaps` : "";
    return `<button class="skin-card ${active ? "active" : ""}" data-id="${skin.id}" type="button">
      <strong>${skin.name}</strong>
      <span>${skin.blurb}${wing}</span>
      <span class="price">${price}</span>
    </button>`;
  }).join("");
  skinGrid.querySelectorAll<HTMLButtonElement>(".skin-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      void selectSkin(btn.dataset.id!);
    });
  });
}

function selectSkin(id: string) {
  if (ownsSkin(save, id)) {
    save = { ...save, skinId: id };
    writeSave(save);
    game.setSkin(getSkin(id));
    renderShop();
    return;
  }
  const skin = getSkin(id);
  shopSub.textContent = `${skin.name} is ${formatPrice(skin.priceCents)} in the App Store and Google Play apps. This web build doesn’t charge.`;
}

document.querySelector("#btnPlay")!.addEventListener("click", () => {
  unlockAudio();
  startLevel(Math.max(0, save.unlocked - 1));
});
document.querySelector("#btnTitleShop")!.addEventListener("click", () => {
  unlockAudio();
  openShop(true);
});
document.querySelector("#btnShop")!.addEventListener("click", () => openShop(true));
document.querySelector("#btnLevels")!.addEventListener("click", () => openLevels(true));
document.querySelector("#btnCloseLevels")!.addEventListener("click", () => openLevels(false));
document.querySelector("#btnCloseShop")!.addEventListener("click", () => openShop(false));
async function onRestore() {
  openShop(true);
  shopSub.textContent = await restorePurchases();
}
document.querySelector("#btnRestore")!.addEventListener("click", () => {
  void onRestore();
});
document.querySelector("#btnRestoreTitle")!.addEventListener("click", () => {
  void onRestore();
});
document.querySelector("#btnJump")?.addEventListener("click", () => {
  if (!isDirector()) return;
  const input = document.querySelector<HTMLInputElement>("#jumpLevel");
  jumpToLevelNumber(input?.value ?? "");
});
document.querySelector("#jumpLevel")?.addEventListener("keydown", (e) => {
  if (!isDirector()) return;
  if ((e as KeyboardEvent).key === "Enter") {
    const input = e.target as HTMLInputElement;
    jumpToLevelNumber(input.value);
  }
});
document.querySelector("#btnUndo")!.addEventListener("click", () => game.undo());
document.querySelector("#btnReset")!.addEventListener("click", () => game.resetLevel());
document.querySelector("#btnGo")!.addEventListener("click", () => {
  unlockAudio();
  game.startRun();
});
btnFlutter.addEventListener("click", () => game.flutter());
document.querySelector("#btnReplay")!.addEventListener("click", () => startLevel(currentLevelIndex));
document.querySelector("#btnNext")!.addEventListener("click", () => {
  startLevel(Math.min(LEVELS.length - 1, currentLevelIndex + 1));
});

showTitle(true);
renderLevels();
renderShop();
game.loadLevel(0);
