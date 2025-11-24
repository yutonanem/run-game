// ====== 暇つぶしランゲーム game.js ======
"use strict";

// キャンバスとUI要素
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const currentTimeEl = document.getElementById("current-time");
const bestTimeEl = document.getElementById("best-time");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restart-btn");

// ★ 社長のイラスト画像（障害物の一つとして使う）
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

// 時間が経つほど上がる難易度係数
let difficulty = 1;

// 背景スクロール用（遠景と近景）
let bgFarOffset = 0;   // 遠くのビル・山
let bgNearOffset = 0;  // 近くの建物・木

// ====== プレイヤー初期化（サイズや数値は元のまま） ======
function initPlayer() {
  const size = Math.min(canvas.width, canvas.height) * 0.200;

  player = {
    x: canvas.width * 0.2,
    y: getGroundY() - size,
    width: size,
    height: size,
    vy: 0,
    gravity: 1600,
    jumpPower: -600,  // 調整済みジャンプ力
    onGround: true,
    maxJumps: 3,      // 3段ジャンプ
    jumpCount: 0
  };
}

// ====== 障害物生成 ======
function resetSpawnTimer() {
  // 出現間隔（0.9〜1.6秒）※元のまま
  nextSpawnInterval = randRange(900, 1600);
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

  // 速度（難易度でだんだん速くなる）※元の考え方のまま
  const baseSpeed = randRange(260, 360);
  const speed = baseSpeed * difficulty;

  // 障害物のタイプをランダムに決定
  // "image" が社長イラスト障害物
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
  bgFarOffset = 0;
  bgNearOffset = 0;

  currentTimeEl.textContent = "0.00";
  bestTimeEl.textContent = bestTime.toFixed(2);
  messageEl.textContent = "画面タップ or スペースキーでスタート＆ジャンプ！";
}

resetGame();

// ====== 入力処理（3段ジャンプ） ======
function handleJump() {
  if (!gameStarted) {
    gameStarted = true;
    startTime = performance.now();
    messageEl.textContent = "";
  }

  if (gameOver) return;

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

  // 時間経過で障害物スピードが上がる（元の式）
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
      player.jumpCount = 0; // 着地したらジャンプ回数リセット
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

  // 当たり判定
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

  // ★ 背景スクロール（障害物と一緒に少しずつ速くなる）
  bgFarOffset = (bgFarOffset + 40 * delta * difficulty) % canvas.width;
  bgNearOffset = (bgNearOffset + 120 * delta * difficulty) % canvas.width;
}

// ====== 背景の描画（パララックス） ======
function drawBackground() {
  // 空
  ctx.fillStyle = "#6ec9ff"; // 明るい青空
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const groundY = getGroundY();

  // 遠景（ビルのシルエット）
  ctx.save();
  ctx.translate(-bgFarOffset, 0);
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  const farBaseY = groundY - canvas.height * 0.35;

  for (let x = -canvas.width; x < canvas.width * 2; x += 140) {
    const w = 90;
    const h = canvas.height * (0.2 + Math.random() * 0.2);
    ctx.fillRect(x, farBaseY + (canvas.height * 0.15 - h), w, h);
  }
  ctx.restore();

  // 近景（建物＋木みたいなもの）
  ctx.save();
  ctx.translate(-bgNearOffset, 0);
  const nearBaseY = groundY - 60;

  for (let x = -canvas.width; x < canvas.width * 2; x += 160) {
    // 建物
    ctx.fillStyle = "#ffffff";
    const bw = 60;
    const bh = 40 + Math.random() * 30;
    ctx.fillRect(x, nearBaseY - bh, bw, bh);

    // 木の柱っぽい
    ctx.fillStyle = "#cce8ff";
    ctx.fillRect(x + bw + 10, nearBaseY - 30, 18, 30);
  }
  ctx.restore();

  // 地面ライン
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();

  // 地面の影/帯
  ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
  ctx.fillRect(0, groundY, canvas.width, 40);
}

// ====== 障害物の描画 ======
function drawObstacle(obs) {
  // 社長イラスト障害物
  if (obs.shape === "image") {
    if (obstacleCustomImg.complete && obstacleCustomImg.naturalWidth > 0) {
      ctx.drawImage(obstacleCustomImg, obs.x, obs.y, obs.width, obs.height);
      return;
    }
    // まだ画像読み込み中なら下の矩形にフォールバック
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
      // 三角形
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
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      break;
    }
  }
}

// ====== 描画全体 ======
function draw() {
  drawBackground();

  // プレイヤー（黄色い四角）
  ctx.fillStyle = "#ffd400";
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // 障害物
  obstacles.forEach((obs) => drawObstacle(obs));
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
