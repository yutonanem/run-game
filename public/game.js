// ====== 暇つぶしランゲーム game.js ======
"use strict";

// ---------- 定数 ----------
const STAGE_FIRE = 1; // 消防士
const STAGE_CLEAN = 2; // 清掃員
const CLEAR_TIME_STAGE1 = 100; // 100秒でクリア

// ジャンプ力（元の 4/5）
const BASE_JUMP_POWER = -520;

// ---------- 画面要素 ----------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const viewSelect = document.getElementById("view-select");
const viewGame = document.getElementById("view-game");

const stage1Btn = document.getElementById("stage1-btn");
const stage2Btn = document.getElementById("stage2-btn");
const backToSelectBtn = document.getElementById("back-to-select");

const stageLabelEl = document.getElementById("stage-label");
const restartBtn = document.getElementById("restart-btn");

const centerMessageEl = document.getElementById("center-message");
const topLeftStatusEl = document.getElementById("top-left-status");

const bottomLeftEl = document.getElementById("bottom-left");
const bottomCenterEl = document.getElementById("bottom-center");
const bottomRightEl = document.getElementById("bottom-right");

// ---------- 画像 ----------
const playerFireImg = new Image();
playerFireImg.src = "firefighter.png";

const fireballImg = new Image();
fireballImg.src = "fireball.png";

const obstacleCustomImg = new Image();
obstacleCustomImg.src = "obstacle_custom.png";

const rescueImg = new Image();
rescueImg.src = "rescue.png";

// ステージ2用
const playerCleanerImg = new Image();
playerCleanerImg.src = "cleaner.png";

const poopImg = new Image();
poopImg.src = "poop.png";

// ---------- BGM / SE ----------
const bgmHome = document.getElementById("bgm-home");
const bgmGame = document.getElementById("bgm-game");
const seJump = document.getElementById("se-jump");
const seGameover = document.getElementById("se-gameover");

// ---------- ヘルパー ----------
function isImageReady(img) {
  return !!(img && img.complete && img.naturalWidth > 0);
}

function playAudio(a) {
  if (!a) return;
  try {
    a.currentTime = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (_) {}
}

function stopAudio(a) {
  if (!a) return;
  try {
    a.pause();
  } catch (_) {}
}

function stopAllBgm() {
  stopAudio(bgmHome);
  stopAudio(bgmGame);
}

function playGameBgm() {
  stopAudio(bgmHome);
  if (!bgmGame) return;
  bgmGame.loop = true;
  playAudio(bgmGame);
}

function playJumpSe() {
  playAudio(seJump);
}

function playGameoverSe() {
  playAudio(seGameover);
}

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// 「基準」の地面ライン（スタート地点の高さ）
function getGroundY() {
  return canvas.height - 12;
}

// ---------- キャンバスサイズ ----------
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
resizeCanvas();
window.addEventListener("resize", () => {
  resizeCanvas();
  if (player) {
    player.y = getGroundY() - player.height;
  }
});

// ---------- ゲーム状態 ----------
let currentStage = STAGE_FIRE;
let stage1Cleared =
  localStorage.getItem("runGame_stage1Cleared") === "true" || false;

let player;
let obstacles = [];
let bgFarBlocks = [];
let bgNearBlocks = [];

// 地形（地面セグメント）
let terrainSegments = [];
const TERRAIN_BASE_SPEED = 200; // 地面スクロール速度

let rescues = []; // ステージ1：救助対象
let rescueCount = 0;

let poopItems = []; // ステージ2：うんち
let poopCount = 0;

let gameStarted = false;
let gameOver = false;

let startTime = 0;
let elapsedTime = 0; // 生の経過秒

let spawnTimer = 0;
let nextSpawnInterval = 0;

let rescueSpawnTimer = 0;
let nextRescueInterval = 0;

let poopSpawnTimer = 0;
let nextPoopInterval = 0;

let difficulty = 1;
let collidedObstacle = null;

let bestStage1Time =
  parseFloat(localStorage.getItem("runGame_bestStage1Time") || "0") || 0;

// ステージ1のパワーアップ
let powerupTimer = 0;
const POWERUP_DURATION = 5000; // ms

// UI更新間引き用
let uiUpdateTimer = 0;
const UI_UPDATE_INTERVAL = 0.1; // 0.1秒に1回だけDOMを書き換える

function createBasePlayerSize(stage) {
  const base = Math.min(canvas.width, canvas.height);

  // STAGE 1（消防士）
  const factorStage1 = 0.18;

  // STAGE 2（清掃員）は少しズームアップ
  const factorStage2 = 0.22;

  return stage === STAGE_CLEAN ? base * factorStage2 : base * factorStage1;
}

function initPlayer() {
  const size = createBasePlayerSize(currentStage);
  player = {
    x: canvas.width * 0.18,
    y: getGroundY() - size,
    width: size,
    height: size,
    vy: 0,
    gravity: 1600,
    jumpPower: BASE_JUMP_POWER,
    onGround: true,
    maxJumps: 3,
    jumpCount: 0,
    baseSize: size,
    baseJumpPower: BASE_JUMP_POWER
  };
}

// ヒットボックス用オブジェクト（毎フレーム再利用）
const playerHitbox = { x: 0, y: 0, width: 0, height: 0 };
const obstacleHitbox = { x: 0, y: 0, width: 0, height: 0 };

function fillPlayerHitbox() {
  const hitWidth = player.width * 0.45;
  const hitHeight = player.height * 0.75;
  const offsetX = (player.width - hitWidth) / 2;
  const offsetY = (player.height - hitHeight) / 2;

  playerHitbox.x = player.x + offsetX;
  playerHitbox.y = player.y + offsetY;
  playerHitbox.width = hitWidth;
  playerHitbox.height = hitHeight;
}

// ---------- 背景 ----------
function initBackground() {
  bgFarBlocks = [];
  bgNearBlocks = [];
  const groundY = getGroundY();

  for (let i = 0; i < 8; i++) {
    const w = 180;
    const h = canvas.height * randRange(0.15, 0.28);
    const x = i * 180;
    const y = groundY - canvas.height * 0.55 - h;
    bgFarBlocks.push({ x, y, width: w, height: h, speed: 40 });
  }

  for (let i = 0; i < 8; i++) {
    const w = 120;
    const h = canvas.height * randRange(0.18, 0.25);
    const x = i * 160 + 40;
    const y = groundY - canvas.height * 0.35 - h;
    bgNearBlocks.push({ x, y, width: w, height: h, speed: 100 });
  }
}

// ---------- 地形（地面セグメント） ----------
// type: "ground" or "gap"
// startOffset / endOffset: getGroundY() からの上下オフセット(px)
function createTerrainSegment(startX, currentOffset) {
  const baseSize = player ? player.height : 50;
  const slopeMax = baseSize * 0.6;

  // 最低高さ＝0（スタート位置）。オフセットは 0〜マイナスの範囲だけ。
  const minOffset = -slopeMax; // 少し上に上がる
  const maxOffset = 0; // これより下には行かない

  let type = "ground";
  let width;
  let startOffset = currentOffset;
  let endOffset = currentOffset;

  const r = Math.random();
  if (r < 0.55) {
    // フラット
    width = randRange(baseSize * 1.2, baseSize * 1.8);
  } else if (r < 0.75) {
    // 登り坂（上方向＝マイナス）
    width = randRange(baseSize * 1.8, baseSize * 2.4);
    const delta = -randRange(baseSize * 0.3, baseSize * 0.6);
    endOffset = clamp(currentOffset + delta, minOffset, maxOffset);
  } else if (r < 0.95) {
    // 下り坂（下方向＝プラスだが、0 を超えない）
    width = randRange(baseSize * 1.8, baseSize * 2.4);
    const delta = randRange(baseSize * 0.3, baseSize * 0.6);
    endOffset = clamp(currentOffset + delta, minOffset, maxOffset);
  } else {
    // 落とし穴
    type = "gap";
    width = randRange(baseSize * 0.9, baseSize * 1.5);
  }

  return { x: startX, width, type, startOffset, endOffset };
}

function initTerrain() {
  terrainSegments = [];
  let curOffset = 0;
  let x = -50;
  while (x < canvas.width + 200) {
    const seg = createTerrainSegment(x, curOffset);
    terrainSegments.push(seg);
    x += seg.width;
    if (seg.type !== "gap") curOffset = seg.endOffset;
  }
}

// プレイヤーの真下の地面情報を取得
function getGroundInfoAtX(x) {
  const baseY = getGroundY();
  for (const seg of terrainSegments) {
    if (x >= seg.x && x <= seg.x + seg.width) {
      if (seg.type === "gap") {
        return { isGap: true, y: baseY + 9999 };
      }
      const t = seg.width > 0 ? (x - seg.x) / seg.width : 0;
      const offset = seg.startOffset + (seg.endOffset - seg.startOffset) * t;
      return { isGap: false, y: baseY + offset };
    }
  }
  return { isGap: false, y: baseY };
}

function updateTerrain(delta) {
  const speed = TERRAIN_BASE_SPEED * difficulty;

  terrainSegments.forEach((seg) => {
    seg.x -= speed * delta;
  });

  // 左に流れ切ったセグメントを削除
  while (
    terrainSegments.length &&
    terrainSegments[0].x + terrainSegments[0].width < -200
  ) {
    terrainSegments.shift();
  }

  // 右端まで埋める
  let curOffset = 0;
  if (terrainSegments.length > 0) {
    const last = terrainSegments[terrainSegments.length - 1];
    curOffset = last.endOffset;
  }
  let x =
    terrainSegments.length > 0
      ? terrainSegments[terrainSegments.length - 1].x +
        terrainSegments[terrainSegments.length - 1].width
      : -50;

  while (x < canvas.width + 200) {
    const seg = createTerrainSegment(x, curOffset);
    terrainSegments.push(seg);
    x += seg.width;
    if (seg.type !== "gap") curOffset = seg.endOffset;
  }
}

function drawTerrain() {
  const baseY = getGroundY();
  const bottom = canvas.height;

  // 黒い線
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 2;
  ctx.beginPath();

  let started = false;
  terrainSegments.forEach((seg) => {
    if (seg.type === "gap") {
      started = false;
      return;
    }
    const x1 = seg.x;
    const x2 = seg.x + seg.width;
    const y1 = baseY + seg.startOffset;
    const y2 = baseY + seg.endOffset;

    if (!started) {
      ctx.moveTo(x1, y1);
      started = true;
    } else {
      ctx.lineTo(x1, y1);
    }
    ctx.lineTo(x2, y2);
  });
  ctx.stroke();

  // 地面の影
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  terrainSegments.forEach((seg) => {
    if (seg.type === "gap") return;
    const x1 = seg.x;
    const x2 = seg.x + seg.width;
    const y1 = baseY + seg.startOffset;
    const y2 = baseY + seg.endOffset;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2, bottom);
    ctx.lineTo(x1, bottom);
    ctx.closePath();
    ctx.fill();
  });
}

// ---------- 障害物 ----------
function fillObstacleHitbox(obs) {
  const marginX = obs.width * 0.18;
  const marginY = obs.height * 0.1;

  obstacleHitbox.x = obs.x + marginX;
  obstacleHitbox.y = obs.y + marginY;
  obstacleHitbox.width = obs.width - marginX * 2;
  obstacleHitbox.height = obs.height - marginY * 2;
}

function resetSpawnTimer() {
  nextSpawnInterval = randRange(900, 1600);
  spawnTimer = 0;
}

function spawnObstacle() {
  const baseSize = player.height;
  const rawWidth = randRange(baseSize * 0.7, baseSize * 1.4);
  const rawHeight = randRange(baseSize * 0.9, baseSize * 1.8);

  let obsWidth = rawWidth * 0.4;
  let obsHeight = rawHeight * 0.4;

  const spawnX = canvas.width + 20;
  const groundInfo = getGroundInfoAtX(spawnX);
  const groundYAtX = groundInfo.y;

  let obsY = groundYAtX - obsHeight;
  const baseSpeed = randRange(200, 280); // ちょい遅め
  let obsSpeed = baseSpeed * difficulty;

  const shapeTypes = [
    "rect",
    "stair",
    "triangle",
    "dome",
    "pole",
    "image",
    "fireball",
    "fireball"
  ];
  const shape = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

  if (shape === "fireball") {
    const fireBase = baseSize * 1.8;
    obsWidth = fireBase * 1.3;
    obsHeight = fireBase * 0.9;

    // 上段 or 下段（中段なし）※ 地面高さを基準
    const mode = Math.random() < 0.5 ? 0 : 2;
    if (mode === 0) {
      obsY = groundYAtX - obsHeight - 4;
    } else {
      obsY = groundYAtX - obsHeight - player.height * 1.2;
    }
    obsSpeed *= 1.3;
  }

  obstacles.push({
    x: spawnX,
    y: obsY,
    width: obsWidth,
    height: obsHeight,
    speed: obsSpeed,
    shape
  });

  resetSpawnTimer();
}

// ---------- 救助（ステージ1） ----------
function resetRescueTimer() {
  nextRescueInterval = randRange(6000, 12000);
  rescueSpawnTimer = 0;
}

function spawnRescue() {
  const size = player.height * 0.6;
  const spawnX = canvas.width + 40;
  const groundInfo = getGroundInfoAtX(spawnX);
  const groundYAtX = groundInfo.y;

  const x = spawnX;
  const y = groundYAtX - size - 4;
  const speed = 190 * difficulty; // ちょい遅く

  rescues.push({ x, y, width: size, height: size, speed });
  resetRescueTimer();
}

// ---------- うんこ（ステージ2） ----------
function resetPoopTimer() {
  nextPoopInterval = randRange(450, 900);
  poopSpawnTimer = 0;
}

function spawnPoop() {
  const size = player.height * 0.55;
  const spawnX = canvas.width + 40;
  const groundInfo = getGroundInfoAtX(spawnX);
  const groundYAtX = groundInfo.y;

  const x = spawnX;
  const y = groundYAtX - size;
  const speed = 210 * difficulty; // ちょい遅く

  poopItems.push({ x, y, width: size, height: size, speed });
  resetPoopTimer();
}

// ---------- 画面切り替え ----------
function showSelectView() {
  viewSelect.classList.add("active");
  viewGame.classList.remove("active");
  stopAllBgm();
}

function showGameView(stage) {
  viewSelect.classList.remove("active");
  viewGame.classList.add("active");
  currentStage = stage;

  if (stage === STAGE_FIRE) {
    stageLabelEl.textContent = "STAGE 1：消防士モード";
  } else {
    stageLabelEl.textContent = "STAGE 2：清掃員モード";
  }

  startStage();
}

// ---------- 中央メッセージ ----------
function setCenterMessage(text, mode) {
  if (!centerMessageEl) return;
  centerMessageEl.className = "center-message";

  if (!text) {
    centerMessageEl.classList.add("hidden");
    centerMessageEl.innerHTML = "";
    return;
  }

  const inner = document.createElement("div");
  inner.className = "center-message-inner";
  inner.innerHTML = text.replace(/\n/g, "<br>");
  centerMessageEl.innerHTML = "";
  centerMessageEl.appendChild(inner);

  if (mode === "fail") {
    centerMessageEl.classList.add("center-message--fail");
  } else if (mode === "grade") {
    centerMessageEl.classList.add("center-message--grade");
  }
}

function hideCenterMessage() {
  setCenterMessage("");
}

// ---------- ステージ開始＆リセット ----------
function resetCommonState() {
  resizeCanvas();
  initPlayer();
  initBackground();
  initTerrain();

  obstacles = [];
  rescues = [];
  poopItems = [];

  rescueCount = 0;
  poopCount = 0;

  gameStarted = false;
  gameOver = false;
  collidedObstacle = null;

  elapsedTime = 0;
  spawnTimer = 0;
  difficulty = 1;

  powerupTimer = 0;

  resetSpawnTimer();
  resetRescueTimer();
  resetPoopTimer();

  uiUpdateTimer = 0;

  bottomLeftEl.textContent = "";
  bottomCenterEl.textContent =
    "画面タップ or スペースキーでスタート＆ジャンプ！";
  bottomRightEl.textContent = "";
}

function startStage() {
  resetCommonState();

  if (currentStage === STAGE_FIRE) {
    bottomLeftEl.textContent = "";
    bottomRightEl.textContent = `救助人数：0人`;
    topLeftStatusEl.textContent = "00.00";

    setCenterMessage("100秒を目指そう！\n救助活動で +10秒！", null);
  } else {
    bottomLeftEl.textContent = "";
    bottomRightEl.textContent = "";
    topLeftStatusEl.textContent = "回収うんこ：0個";

    setCenterMessage("多くのうんこを集めよう！", null);
  }
}

// ---------- 入力 ----------
function handleJump() {
  if (!viewGame.classList.contains("active")) return;
  if (!player) return;

  if (!gameStarted && !gameOver) {
    gameStarted = true;
    startTime = performance.now();
    hideCenterMessage();
    playGameBgm();
  }

  if (gameOver) return;

  if (player.jumpCount < player.maxJumps) {
    player.vy = player.jumpPower;
    player.onGround = false;
    player.jumpCount++;
    playJumpSe();
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    handleJump();
  }
});

// pointer イベントは passive にしてレイアウトブロックを防ぐ
canvas.addEventListener(
  "pointerdown",
  () => {
    handleJump();
  },
  { passive: true }
);

// ---------- メインループ ----------
let lastTime = 0;

function update(delta) {
  if (!gameStarted || gameOver) return;

  const now = performance.now();
  elapsedTime = (now - startTime) / 1000;

  // UI更新タイマー
  uiUpdateTimer += delta;

  if (currentStage === STAGE_FIRE) {
    const scoreTime = elapsedTime + rescueCount * 10;
    difficulty = 1 + elapsedTime * 0.01;

    if (uiUpdateTimer >= UI_UPDATE_INTERVAL) {
      topLeftStatusEl.textContent = scoreTime.toFixed(2);
    }

    if (!stage1Cleared && scoreTime >= CLEAR_TIME_STAGE1) {
      stage1Cleared = true;
      localStorage.setItem("runGame_stage1Cleared", "true");
      stage2Btn.classList.remove("stage-btn-locked");
    }
  } else {
    difficulty = 1 + elapsedTime * 0.015;

    if (uiUpdateTimer >= UI_UPDATE_INTERVAL) {
      topLeftStatusEl.textContent = `回収うんこ：${poopCount}個`;
    }
  }

  if (uiUpdateTimer >= UI_UPDATE_INTERVAL) {
    uiUpdateTimer = 0;
  }

  // パワーアップ（ステージ1）
  if (currentStage === STAGE_FIRE && powerupTimer > 0) {
    powerupTimer -= delta * 1000;
    const t = Math.max(powerupTimer, 0) / POWERUP_DURATION;
    const scale = 1 + 0.5 * t;
    const jumpScale = 1 + 0.2 * t;

    player.width = player.baseSize * scale;
    player.height = player.baseSize * scale;
    player.jumpPower = player.baseJumpPower * jumpScale;
  } else if (currentStage === STAGE_FIRE && powerupTimer <= 0) {
    player.width = player.baseSize;
    player.height = player.baseSize;
    player.jumpPower = player.baseJumpPower;
  }

  // 重力
  player.vy += player.gravity * delta;
  player.y += player.vy * delta;

  // 地形更新
  updateTerrain(delta);

  // 足元の地面にスナップ or 穴なら落下
  const centerX = player.x + player.width / 2;
  const groundInfo = getGroundInfoAtX(centerX);

  if (!groundInfo.isGap) {
    const gy = groundInfo.y - player.height;
    if (player.y >= gy) {
      player.y = gy;
      player.vy = 0;
      if (!player.onGround) {
        player.onGround = true;
        player.jumpCount = 0;
      }
    }
  } else {
    // 穴の中を落下して画面外に出たらゲームオーバー
    if (player.y > canvas.height) {
      endGame(false);
      return;
    }
  }

  // 背景
  bgFarBlocks.forEach((b) => {
    b.x -= b.speed * delta * difficulty * 0.6;
    if (b.x + b.width < 0) b.x = canvas.width + randRange(20, 120);
  });

  bgNearBlocks.forEach((b) => {
    b.x -= b.speed * delta * difficulty;
    if (b.x + b.width < 0) b.x = canvas.width + randRange(40, 160);
  });

  // 障害物
  spawnTimer += delta * 1000;
  if (spawnTimer >= nextSpawnInterval) spawnObstacle();
  obstacles.forEach((obs) => {
    obs.x -= obs.speed * delta;
  });

  // 救助 / うんこ
  if (currentStage === STAGE_FIRE) {
    rescueSpawnTimer += delta * 1000;
    if (rescueSpawnTimer >= nextRescueInterval) spawnRescue();

    rescues.forEach((r) => {
      r.x -= r.speed * delta;
    });

    fillPlayerHitbox();
    for (let i = rescues.length - 1; i >= 0; i--) {
      const r = rescues[i];
      if (rectsOverlap(playerHitbox, r)) {
        rescues.splice(i, 1);
        rescueCount++;
        bottomRightEl.textContent = `救助人数：${rescueCount}人`;
        powerupTimer = POWERUP_DURATION;
      }
    }
  } else {
    poopSpawnTimer += delta * 1000;
    if (poopSpawnTimer >= nextPoopInterval) spawnPoop();

    poopItems.forEach((p) => {
      p.x -= p.speed * delta;
    });

    fillPlayerHitbox();
    for (let i = poopItems.length - 1; i >= 0; i--) {
      const p = poopItems[i];
      if (rectsOverlap(playerHitbox, p)) {
        poopItems.splice(i, 1);
        poopCount++;
        // ここはイベント発生時のみなのでそのままDOM更新
        topLeftStatusEl.textContent = `回収うんこ：${poopCount}個`;
      }
    }
  }

  // 障害物との押し込み衝突
  fillPlayerHitbox();
  if (!collidedObstacle) {
    for (const obs of obstacles) {
      fillObstacleHitbox(obs);
      if (rectsOverlap(playerHitbox, obstacleHitbox)) {
        collidedObstacle = obs;
        break;
      }
    }
  }

  if (collidedObstacle) {
    player.x = collidedObstacle.x - player.width + 4;
    if (player.x + player.width <= 0) {
      endGame(false);
    }
  }

  obstacles = obstacles.filter((obs) => obs.x + obs.width > -200);
  rescues = rescues.filter((r) => r.x + r.width > -200);
  poopItems = poopItems.filter((p) => p.x + p.width > -200);
}

// ---------- 描画 ----------
function drawObstacle(obs) {
  if (obs.shape === "fireball") {
    if (isImageReady(fireballImg)) {
      ctx.save();
      ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
      ctx.rotate((-15 * Math.PI) / 180);
      ctx.drawImage(
        fireballImg,
        -obs.width / 2,
        -obs.height / 2,
        obs.width,
        obs.height
      );
      ctx.restore();
    } else {
      ctx.fillStyle = "#ff7043";
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }
    return;
  }

  if (obs.shape === "image") {
    if (isImageReady(obstacleCustomImg)) {
      ctx.drawImage(obstacleCustomImg, obs.x, obs.y, obs.width, obs.height);
    } else {
      ctx.fillStyle = "#666";
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }
    return;
  }

  ctx.fillStyle = "#607d8b";

  switch (obs.shape) {
    case "stair": {
      const steps = 3;
      for (let i = 0; i < steps; i++) {
        const w = (obs.width / steps) * (i + 1);
        const h = (obs.height / steps) * (i + 1);
        const x = obs.x + obs.width - w;
        const y = obs.y + obs.height - h;
        ctx.fillRect(x, y, w, h);
      }
      break;
    }
    case "triangle": {
      ctx.beginPath();
      ctx.moveTo(obs.x, obs.y + obs.height);
      ctx.lineTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
      ctx.fill();
      break;
    }
    case "dome": {
      const baseH = obs.height * 0.35;
      const domeH = obs.height - baseH;
      ctx.fillRect(obs.x, obs.y + domeH, obs.width, baseH);

      const cx = obs.x + obs.width / 2;
      const cy = obs.y + domeH;
      const r = Math.min(obs.width, domeH * 2) / 2;

      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 0);
      ctx.fill();
      break;
    }
    case "pole": {
      const pw = obs.width * 0.3;
      const px = obs.x + (obs.width - pw) / 2;
      ctx.fillRect(px, obs.y, pw, obs.height);
      ctx.fillRect(px - pw, obs.y, pw * 3, obs.height * 0.1);
      break;
    }
    default:
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
  }
}

function draw() {
  if (!player) return;

  ctx.fillStyle = "#8fd4ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  bgFarBlocks.forEach((b) => ctx.fillRect(b.x, b.y, b.width, b.height));

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  bgNearBlocks.forEach((b) => ctx.fillRect(b.x, b.y, b.width, b.height));

  // 地形
  drawTerrain();

  // 救助 or うんこ
  if (currentStage === STAGE_FIRE) {
    rescues.forEach((r) => {
      if (isImageReady(rescueImg)) {
        ctx.drawImage(rescueImg, r.x, r.y, r.width, r.height);
      } else {
        ctx.fillStyle = "#ffccff";
        ctx.fillRect(r.x, r.y, r.width, r.height);
      }
    });
  } else {
    poopItems.forEach((p) => {
      if (isImageReady(poopImg)) {
        ctx.drawImage(poopImg, p.x, p.y, p.width, p.height);
      } else {
        ctx.fillStyle = "#8d6e63";
        ctx.fillRect(p.x, p.y, p.width, p.height);
      }
    });
  }

  // プレイヤー
  const img = currentStage === STAGE_FIRE ? playerFireImg : playerCleanerImg;
  if (isImageReady(img)) {
    ctx.drawImage(img, player.x, player.y, player.width, player.height);
  } else {
    ctx.fillStyle = "#ffd400";
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }

  // 障害物
  obstacles.forEach(drawObstacle);
}

// ---------- ループ ----------
function loop(timestamp) {
  const delta = (timestamp - lastTime) / 1000 || 0;
  lastTime = timestamp;

  update(delta);
  draw();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- ゲームオーバー ----------
function endGame(isClearStage2) {
  if (gameOver) return;
  gameOver = true;

  playGameoverSe();
  stopAllBgm();

  if (currentStage === STAGE_FIRE) {
    const scoreTime = elapsedTime + rescueCount * 10;
    if (scoreTime > bestStage1Time) {
      bestStage1Time = scoreTime;
      localStorage.setItem("runGame_bestStage1Time", String(bestStage1Time));
    }

    bottomLeftEl.textContent = `今回のタイム：${scoreTime.toFixed(2)} 秒`;
    bottomCenterEl.textContent = "";
    bottomRightEl.textContent = `救助人数：${rescueCount}人`;

    if (scoreTime >= CLEAR_TIME_STAGE1) {
      setCenterMessage("クリア！", "grade");
      stage1Cleared = true;
      localStorage.setItem("runGame_stage1Cleared", "true");
      stage2Btn.classList.remove("stage-btn-locked");
    } else {
      setCenterMessage("失敗！", "fail");
    }
  } else {
    let label = "";
    if (poopCount <= 20) label = "論外！";
    else if (poopCount <= 35) label = "出直してこい！";
    else if (poopCount <= 50) label = "平凡";
    else if (poopCount <= 65) label = "うんこ博士";
    else label = "天才なうんこ";

    bottomLeftEl.textContent = "";
    bottomCenterEl.textContent = "";
    bottomRightEl.textContent = `回収うんこ：${poopCount}個`;

    setCenterMessage(label, "grade");
  }
}

// ---------- ボタンイベント ----------
stage1Btn.addEventListener("click", () => {
  showGameView(STAGE_FIRE);
});

stage2Btn.addEventListener("click", () => {
  if (!stage1Cleared) return;
  showGameView(STAGE_CLEAN);
});

backToSelectBtn.addEventListener("click", () => {
  showSelectView();
});

restartBtn.addEventListener("click", () => {
  startStage();
});

// ---------- 初期化 ----------
if (stage1Cleared) {
  stage2Btn.classList.remove("stage-btn-locked");
}

showSelectView();
