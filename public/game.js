// ====== 暇つぶしランゲーム game.js ======
"use strict";

// キャンバスとUI要素
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const currentTimeEl = document.getElementById("current-time");
const bestTimeEl = document.getElementById("best-time");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restart-btn");

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

// ====== 地面の Y 座標 ======
// ※ この値を変更すると、プレイ画面（上の空部分・下の地面の位置）が変わります
function getGroundY() {
  const marginFromBottom = 10; 
  // ← 画面下から地面までの距離(px)
  //    この数字を小さくするほど地面が下に移動し、空が広くなる！

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

let difficulty = 1;

// ====== プレイヤー初期化 ======
function initPlayer() {
  // プレイヤーのサイズ（大きめ）
  const size = Math.min(canvas.width, canvas.height) * 0.225;

  player = {
    x: canvas.width * 0.2,
    y: getGroundY() - size,
    width: size,
    height: size,
    vy: 0,
    gravity: 1600,

    // ★ ジャンプ力（高さ維持）
    jumpPower: -600,

    // ★ 二段ジャンプ設定
    maxJumps: 2,
    jumpCount: 0,
    onGround: true
  };
}

// ====== 障害物生成 ======
function resetSpawnTimer() {
  // 出現間隔（増量）
  nextSpawnInterval = randRange(700, 1300);
  spawnTimer = 0;
}

function spawnObstacle() {
  const baseSize = player.height;

  // 元サイズ
  const rawWidth = randRange(baseSize * 0.7, baseSize * 1.4);
  const rawHeight = randRange(baseSize * 0.9, baseSize * 1.8);

  // ★ 4/5 サイズに縮小
  const width = rawWidth * 0.8;
  const height = rawHeight * 0.8;

  // ★ 上端は rawHeight のまま → 下だけ浮く
  const topY = getGroundY() - rawHeight;

  const baseSpeed = randRange(260, 360);
  const speed = baseSpeed * difficulty;

  obstacles.push({
    x: canvas.width + 20,
    y: topY,
    width,
    height,
    speed
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

// ====== 入力処理（二段ジャンプ対応版） ======
function handleJump() {
  if (!gameStarted) {
    gameStarted = true;
    startTime = performance.now();
    messageEl.textContent = "";
  }

  if (gameOver) return;

  // ★ 二段ジャンプOK
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

  // ★ 経過時間で障害物スピードが上昇
  difficulty = 1 + currentTime * 0.03;

  // プレイヤー物理
  player.vy += player.gravity * delta;
  player.y += player.vy * delta;

  const groundY = getGroundY() - player.height;

  // ★ 着地判定（ジャンプ回数リセット）
  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;

    if (!player.onGround) {
      player.onGround = true;
      player.jumpCount = 0; // ← 二段ジャンプリセット
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
}

function draw() {
  // 背景
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, "#bde5ff");
  grd.addColorStop(1, "#e5f7ff");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 地面
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, getGroundY());
  ctx.lineTo(canvas.width, getGroundY());
  ctx.stroke();

  // プレイヤー（黄色）
  ctx.fillStyle = "#ffd400";
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // 障害物（灰色）
  ctx.fillStyle = "#555";
  obstacles.forEach((obs) => {
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
  });
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
