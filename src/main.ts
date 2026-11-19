import "./style.css";
import { FoldGame } from "./game/FoldGame";
import { getSkin, loadSave, recordClear, SKINS, writeSave } from "./game/cosmetics";
import { LEVELS } from "./game/levels";
import { unlockAudio } from "./game/audio";
import type { SaveData } from "./game/types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app missing");

let save: SaveData = loadSave();
let currentLevelIndex = 0;

app.innerHTML = `
  <div class="shell">
    <canvas id="game"></canvas>
    <div class="hint hidden" id="hint"></div>
    <div class="overlay" id="hud">
      <div class="top-bar">
        <div>
          <div class="brand">Fold</div>
          <div class="meta" id="levelMeta">1. Crease</div>
        </div>
        <div class="meta" id="foldMeta">Folds 0</div>
      </div>
      <div class="bottom-bar">
        <button class="btn secondary" id="btnUndo" type="button">Undo</button>
        <button class="btn secondary" id="btnReset" type="button">Reset</button>
        <button class="btn accent" id="btnGo" type="button">Go</button>
        <button class="btn secondary" id="btnShop" type="button">Skins</button>
        <button class="btn secondary" id="btnLevels" type="button">Levels</button>
      </div>
    </div>

    <div class="screen" id="titleScreen">
      <h1>Fold</h1>
      <p>Pinch the world into shape. Crease ramps, bridges, and trampolines — then send your traveler home.</p>
      <div class="actions">
        <button class="btn accent" id="btnPlay" type="button">Play</button>
        <button class="btn secondary" id="btnTitleShop" type="button">Skins</button>
      </div>
    </div>

    <div class="panel hidden" id="levelPanel">
      <div class="panel-card">
        <h2>Postcards</h2>
        <p class="sub">Finish freely. Skins are optional flair — never power.</p>
        <div class="level-list" id="levelList"></div>
        <button class="btn secondary" id="btnCloseLevels" type="button">Close</button>
      </div>
    </div>

    <div class="panel hidden" id="shopPanel">
      <div class="panel-card">
        <h2>Traveler skins</h2>
        <p class="sub">Complete everything free. Cosmetics are optional — all skins unlocked in this prototype.</p>
        <div class="skin-grid" id="skinGrid"></div>
        <button class="btn secondary" id="btnCloseShop" type="button">Close</button>
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
const foldMeta = document.querySelector<HTMLDivElement>("#foldMeta")!;
const btnUndo = document.querySelector<HTMLButtonElement>("#btnUndo")!;
const btnGo = document.querySelector<HTMLButtonElement>("#btnGo")!;
const titleScreen = document.querySelector<HTMLDivElement>("#titleScreen")!;
const levelPanel = document.querySelector<HTMLDivElement>("#levelPanel")!;
const shopPanel = document.querySelector<HTMLDivElement>("#shopPanel")!;
const winPanel = document.querySelector<HTMLDivElement>("#winPanel")!;
const levelList = document.querySelector<HTMLDivElement>("#levelList")!;
const skinGrid = document.querySelector<HTMLDivElement>("#skinGrid")!;
const winStars = document.querySelector<HTMLDivElement>("#winStars")!;
const winBlurb = document.querySelector<HTMLParagraphElement>("#winBlurb")!;
const hud = document.querySelector<HTMLDivElement>("#hud")!;

const game = new FoldGame(canvas, {
  onHud: ({ levelName, folds, running, canUndo }) => {
    levelMeta.textContent = levelName;
    foldMeta.textContent = `Folds ${folds}`;
    btnUndo.disabled = !canUndo;
    btnGo.disabled = running;
    btnGo.textContent = running ? "Running…" : "Go";
  },
  onWin: (stars, folds, scraped) => {
    const level = LEVELS[currentLevelIndex];
    save = recordClear(save, level.id, stars);
    winStars.textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
    if (stars === 3) {
      winBlurb.textContent = `Perfect paper — ${folds} fold${folds === 1 ? "" : "s"}.`;
    } else if (stars === 2) {
      winBlurb.textContent = scraped
        ? `Clean route in ${folds} folds.`
        : `Clean route in ${folds} folds. Grab the scrap for ★★★.`;
    } else {
      winBlurb.textContent = `Made it in ${folds} folds. Fewer creases earn more stars.`;
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

function showTitle(show: boolean) {
  titleScreen.classList.toggle("hidden", !show);
  hud.style.visibility = show ? "hidden" : "visible";
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
  levelList.innerHTML = LEVELS.map((lvl, i) => {
    const locked = lvl.id > save.unlocked;
    const stars = save.stars[lvl.id] ?? 0;
    const starTxt = stars ? "★".repeat(stars) : "—";
    return `<button class="level-btn" data-i="${i}" ${locked ? "disabled" : ""} type="button">
      <span>${lvl.id}. ${lvl.name}</span>
      <span class="stars">${locked ? "Locked" : starTxt}</span>
    </button>`;
  }).join("");
  levelList.querySelectorAll<HTMLButtonElement>(".level-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      startLevel(Number(btn.dataset.i));
    });
  });
}

function renderShop() {
  skinGrid.innerHTML = SKINS.map((skin) => {
    const active = skin.id === save.skinId;
    return `<button class="skin-card ${active ? "active" : ""}" data-id="${skin.id}" type="button">
      <strong>${skin.name}</strong>
      <span>${skin.blurb}</span>
    </button>`;
  }).join("");
  skinGrid.querySelectorAll<HTMLButtonElement>(".skin-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      save = { ...save, skinId: btn.dataset.id! };
      writeSave(save);
      game.setSkin(getSkin(save.skinId));
      renderShop();
    });
  });
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
document.querySelector("#btnUndo")!.addEventListener("click", () => game.undo());
document.querySelector("#btnReset")!.addEventListener("click", () => game.resetLevel());
document.querySelector("#btnGo")!.addEventListener("click", () => {
  unlockAudio();
  game.startRun();
});
document.querySelector("#btnReplay")!.addEventListener("click", () => startLevel(currentLevelIndex));
document.querySelector("#btnNext")!.addEventListener("click", () => {
  startLevel(Math.min(LEVELS.length - 1, currentLevelIndex + 1));
});

showTitle(true);
hud.style.visibility = "hidden";
renderLevels();
renderShop();
game.loadLevel(0);
