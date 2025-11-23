// ====== 暇つぶしランゲーム game.js ======
"use strict";

// キャンバスとUI要素
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const currentTimeEl = document.getElementById("current-time");
const bestTimeEl = document.getElementById("best-time");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restart-btn");

// ★ 社長のイラスト画像たち
// public フォルダに player.png / obstacle_custom.png を置いておく


const obstacleCustomImg = new Image();
obstacleCustomImg.src = "obstacle_custom.png";

// ----- キャンバスのサイズ調整 -----
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ----- 共通のランダム関数 -----
function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

// 地面の Y 座標（少し下げて空を広く）
function getGroundY() {
  const marginFromBottom = 10;
  return canvas.height - marginFromBottom;
}

// ====== ゲーム状態用の変数 ======
let player;
let obstacles = [];

let gameStarted = false;
let gameOver = false;

let startTime = 0;
let currentTime = 0;
let bestTime = parseFloat(localStorage.getItem("bestTime_runGame") || "0");

let spawnTimer = 0;
let nextSpawnInterval = 0;

let difficulty = 1; // 時間が経つほど上がる

// ====== プレイヤー初期化（サイズは前回のまま） ======
function initPlayer() {
  // 前回決めたサイズ：画面短辺の 22.5%（0.225）
  const size = Math.min(canvas.width, canvas.height) * 0.225;

  player = {
    x: canvas.width * 0.2,
    y: getGroundY() - size,
    width: size,
    height: size,
    vy: 0,
    gravity: 1600,
    jumpPower: -600,  // 調整済みジャンプ力（最高到達点はこのまま）
    onGround: true,
    maxJumps: 2,      // 二段ジャンプ
    jumpCount: 0
  };
}

// ====== 障害物生成 ======
function resetSpawnTimer() {
  // 出現間隔（0.7〜1.3秒）
  nextSpawnInterval = randRange(700, 1300);
  spawnTimer = 0;
}

function spawnObstacle() {
  const baseSize = player.height;

  // 元サイズ
  const rawWidth = randRange(baseSize * 0.7, baseSize * 1.4);
  const rawHeight = randRange(baseSize * 0.9, baseSize * 1.8);

  // 4/5 サイズに縮小
  const width = rawWidth * 0.8;
  const height = rawHeight * 0.8;

  // 上端は rawHeight のまま → 下だけ浮く
  const topY = getGroundY() - rawHeight;

  // 速度（難易度でだんだん速くなる）
  const baseSpeed = randRange(260, 360);
  const speed = baseSpeed * difficulty;

  // ★ 障害物のタイプをランダムに決定
  //   "image" が社長イラスト障害物
  const shapeTypes = ["rect", "stair", "triangle", "dome", "pole", "image"];
  const shape = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

  obstacles.push({
    x: canvas.width + 20,
    y: topY,
    width,
    height,
    speed,
    shape
  });

  resetSpawnTimer();
}

// ====== ゲームリセット ======
function resetGame() {
  resizeCanvas();
  initPlayer();
  obstacles = [];

  gameStarted = false;
  gameOver = false;
  currentTime = 0;

  spawnTimer = 0;
  resetSpawnTimer();

  difficulty = 1;

  currentTimeEl.textContent = "0.00";
  bestTimeEl.textContent = bestTime.toFixed(2);
  messageEl.textContent = "画面タップ or スペースキーでスタート＆ジャンプ！";
}

resetGame();

// ====== 入力処理（二段ジャンプ対応） ======
function handleJump() {
  if (!gameStarted) {
    gameStarted = true;
    startTime = performance.now();
    messageEl.textContent = "";
  }

  if (gameOver) return;

  // 2回までジャンプ可能
  if (player.jumpCount < player.maxJumps) {
    player.vy = player.jumpPower;
    player.onGround = false;
    player.jumpCount += 1;
  }
}

// キーボード
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    handleJump();
  }
});

// タップ
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  handleJump();
});

// ====== メインループ ======
let lastTime = 0;

function update(delta) {
  if (!gameStarted || gameOver) return;

  const now = performance.now();
  currentTime = (now - startTime) / 1000;
  currentTimeEl.textContent = currentTime.toFixed(2);

  // 時間経過で障害物スピードが上がる
  difficulty = 1 + currentTime * 0.03;

  // プレイヤー物理
  player.vy += player.gravity * delta;
  player.y += player.vy * delta;

  const groundY = getGroundY() - player.height;

  // 着地判定
  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;

    if (!player.onGround) {
      player.onGround = true;
      player.jumpCount = 0; // 着地したら二段ジャンプ回数リセット
    }
  }

  // 障害物生成
  spawnTimer += delta * 1000;
  if (spawnTimer >= nextSpawnInterval) {
    spawnObstacle();
  }

  // 障害物移動
  obstacles.forEach((obs) => {
    obs.x -= obs.speed * delta;
  });

  // 画面外削除
  obstacles = obstacles.filter((obs) => obs.x + obs.width > 0);

  // 当たり判定（見た目は色々でも、判定は矩形でそのまま）
  for (const obs of obstacles) {
    if (
      player.x < obs.x + obs.width &&
      player.x + player.width > obs.x &&
      player.y < obs.y + obs.height &&
      player.y + player.height > obs.y
    ) {
      endGame();
      break;
    }
  }
}

function draw() {
  // 背景
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, "#8ed6ff");
  grd.addColorStop(1, "#c2ecff");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 地面
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, getGroundY());
  ctx.lineTo(canvas.width, getGroundY());
  ctx.stroke();

// ★ プレイヤー（黄色い四角に固定）
ctx.fillStyle = "#ffd400";
ctx.fillRect(player.x, player.y, player.width, player.height);

  // ★ 障害物たち
  obstacles.forEach((obs) => {
    drawObstacle(obs);
  });
}

// ====== 障害物の描画 ======
function drawObstacle(obs) {
  // 社長イラスト障害物
  if (obs.shape === "image") {
    if (obstacleCustomImg.complete && obstacleCustomImg.naturalWidth > 0) {
      ctx.drawImage(
        obstacleCustomImg,
        obs.x,
        obs.y,
        obs.width,
        obs.height
      );
      return;
    }
    // まだ画像読み込み中なら、通常四角で代用
  }

  ctx.fillStyle = "#555";

  switch (obs.shape) {
    case "stair": {
      // 階段
      const steps = 3;
      const stepWidth = obs.width / steps;
      const stepHeight = obs.height / steps;

      for (let i = 0; i < steps; i++) {
        const w = stepWidth * (i + 1);
        const h = stepHeight * (i + 1);
        const x = obs.x + obs.width - w;
        const y = obs.y + obs.height - h;
        ctx.fillRect(x, y, w, h);
      }
      break;
    }
    case "triangle": {
      // 三角形（山・塔）
      ctx.beginPath();
      ctx.moveTo(obs.x, obs.y + obs.height);
      ctx.lineTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "dome": {
      // ドーム＋土台
      const baseHeight = obs.height * 0.35;
      const domeHeight = obs.height - baseHeight;

      // 土台
      ctx.fillRect(obs.x, obs.y + domeHeight, obs.width, baseHeight);

      // ドーム（半円）
      const cx = obs.x + obs.width / 2;
      const cy = obs.y + domeHeight;
      const radius = Math.min(obs.width, domeHeight * 2) / 2;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, Math.PI, 0, false);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "pole": {
      // 電柱っぽい柱
      const poleWidth = obs.width * 0.3;
      const x = obs.x + (obs.width - poleWidth) / 2;

      ctx.fillRect(x, obs.y, poleWidth, obs.height);

      const barHeight = obs.height * 0.1;
      ctx.fillRect(x - poleWidth, obs.y, poleWidth * 3, barHeight);
      break;
    }
    case "rect":
    default: {
      // 通常の四角
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      break;
    }
  }
}

function loop(timestamp) {
  const delta = (timestamp - lastTime) / 1000 || 0;
  lastTime = timestamp;

  update(delta);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// ====== ゲームオーバー ======
function endGame() {
  if (gameOver) return;
  gameOver = true;

  if (currentTime > bestTime) {
    bestTime = currentTime;
    localStorage.setItem("bestTime_runGame", String(bestTime));
  }

  bestTimeEl.textContent = bestTime.toFixed(2);
  messageEl.textContent = `ゲームオーバー！ 走行タイム：${currentTime.toFixed(2)} 秒`;
}

// ====== リスタート ======
restartBtn.addEventListener("click", () => {
  resetGame();
});
