// ====== 暇つぶしランゲーム game.js ======
"use strict";

// ====== 画面の要素 ======
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const usernameInput = document.getElementById("username-input");
const rankingBody = document.getElementById("ranking-body");
const hud = document.getElementById("hud");

const currentTimeEl = document.getElementById("current-time");
const bestTimeEl = document.getElementById("best-time");
const messageEl = document.getElementById("message");

// ====== 音 ======
const bgmHome = document.getElementById("bgm-home");
const bgmGame = document.getElementById("bgm-game");
const seJump = document.getElementById("se-jump");
const seGameover = document.getElementById("se-gameover");
const bgmToggleBtn = document.getElementById("bgm-toggle");

let bgmEnabled = true;

// ====== プレイヤー画像 ======
const playerImg = new Image();
playerImg.src = "firefighter.png";

// 障害物用
const obstacleCustomImg = new Image();
obstacleCustomImg.src = "obstacle_custom.png";

const fireballImg = new Image();
fireballImg.src = "fireball.png";

// ====== キャンバス調整（縦画面固定） ======
function resizeCanvas() {
  canvas.width = window.innerWidth * 0.95;
  canvas.height = window.innerHeight * 0.55;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ====== ランダム ======
function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

// ====== ゲーム変数 ======
let player;
let obstacles = [];
let bgFar = [];
let bgNear = [];

let gameStarted = false;
let gameOver = false;

let startTime = 0;
let currentTime = 0;
let bestTime = 0;

let difficulty = 1;

let spawnTimer = 0;
let nextSpawn = 0;

// ====== 音制御 ======
function stopAllBgm() {
  bgmHome.pause();
  bgmGame.pause();
}
function playHomeBgm() {
  if (!bgmEnabled) return;
  stopAllBgm();
  bgmHome.currentTime = 0;
  bgmHome.play().catch(() => {});
}
function playGameBgm() {
  if (!bgmEnabled) return;
  stopAllBgm();
  bgmGame.currentTime = 0;
  bgmGame.play().catch(() => {});
}

// ====== プレイヤー作成 ======
function initPlayer() {
  const size = Math.min(canvas.width, canvas.height) * 0.35;
  player = {
    x: canvas.width * 0.15,
    y: getGroundY() - size,
    width: size,
    height: size,
    vy: 0,
    gravity: 1600,
    jumpPower: -600,
    onGround: true,
    jumpCount: 0,
    maxJumps: 3
  };
}

// ====== 地面位置 ======
function getGroundY() {
  return canvas.height - 12;
}

// ====== 背景生成 ======
function initBackground() {
  bgFar = [];
  bgNear = [];
  const g = getGroundY();

  for (let i = 0; i < 10; i++) {
    bgFar.push({
      x: i * 200,
      y: g - 200,
      width: 160,
      height: 100,
      speed: 40
    });
    bgNear.push({
      x: i * 150,
      y: g - 120,
      width: 120,
      height: 70,
      speed: 80
    });
  }
}

// ====== 当たり判定ヒットボックス ======
function getPlayerHitbox() {
  return {
    x: player.x + player.width * 0.25,
    y: player.y + player.height * 0.18,
    width: player.width * 0.5,
    height: player.height * 0.65
  };
}
function getObstacleHitbox(o) {
  return {
    x: o.x + o.width * 0.15,
    y: o.y + o.height * 0.15,
    width: o.width * 0.7,
    height: o.height * 0.7
  };
}

// ====== 障害物生成 ======
function resetSpawn() {
  nextSpawn = randRange(800, 1500);
  spawnTimer = 0;
}

function spawnObstacle() {
  const base = player.height;

  const rawW = randRange(base * 0.6, base * 1.2);
  const rawH = randRange(base * 0.7, base * 1.5);

  // ★ 通常障害物は 1/2 サイズ（浮かない）
  let w = rawW * 0.5;
  let h = rawH * 0.5;
  let y = getGroundY() - h;

  let s = randRange(260, 360) * difficulty;

  const shapes = ["rect", "stair", "triangle", "dome", "pole", "image", "fireball"];
  const shape = shapes[(Math.random() * shapes.length) | 0];

  if (shape === "fireball") {
    const f = base * 1.6;
    w = f * 1.2;
    h = f * 0.8;
    y = getGroundY() - h * 1.3;
    s *= 1.3;
  }

  obstacles.push({
    x: canvas.width + 20,
    y,
    width: w,
    height: h,
    speed: s,
    shape
  });

  resetSpawn();
}

// ====== ゲームリセット ======
function resetGame() {
  canvas.style.display = "block";
  hud.style.display = "flex";

  initPlayer();
  initBackground();
  obstacles = [];

  gameStarted = false;
  gameOver = false;
  currentTime = 0;
  difficulty = 1;

  resetSpawn();

  currentTimeEl.textContent = "0.00";

  playGameBgm();
}

// ====== 入力 ======
function handleJump() {
  if (!gameStarted) {
    gameStarted = true;
    startTime = performance.now();
  }

  if (gameOver) return;
  if (player.jumpCount < player.maxJumps) {
    player.vy = player.jumpPower;
    player.onGround = false;
    player.jumpCount++;
    seJump.currentTime = 0;
    seJump.play().catch(() => {});
  }
}

window.addEventListener("keydown", e => {
  if (e.code === "Space") {
    e.preventDefault();
    handleJump();
  }
});
canvas.addEventListener("pointerdown", handleJump);

// ====== メインループ ======
let last = 0;
function update(dt) {
  if (!gameStarted || gameOver) return;

  currentTime = (performance.now() - startTime) / 1000;
  currentTimeEl.textContent = currentTime.toFixed(2);
  difficulty = 1 + currentTime * 0.03;

  // プレイヤー物理
  player.vy += player.gravity * dt;
  player.y += player.vy * dt;

  const g = getGroundY() - player.height;
  if (player.y >= g) {
    player.y = g;
    player.vy = 0;
    player.onGround = true;
    player.jumpCount = 0;
  }

  // 背景
  bgFar.forEach(b => {
    b.x -= b.speed * dt * difficulty * 0.5;
    if (b.x + b.width < 0) b.x = canvas.width;
  });
  bgNear.forEach(b => {
    b.x -= b.speed * dt * difficulty;
    if (b.x + b.width < 0) b.x = canvas.width;
  });

  // 障害物
  spawnTimer += dt * 1000;
  if (spawnTimer >= nextSpawn) spawnObstacle();

  obstacles.forEach(o => (o.x -= o.speed * dt));
  obstacles = obstacles.filter(o => o.x + o.width > 0);

  // 判定
  const p = getPlayerHitbox();
  for (const o of obstacles) {
    const h = getObstacleHitbox(o);
    if (
      p.x < h.x + h.width &&
      p.x + p.width > h.x &&
      p.y < h.y + h.height &&
      p.y + p.height > h.y
    ) {
      return endGame();
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 空
  ctx.fillStyle = "#6ec9ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 背景
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  bgFar.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  bgNear.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));

  // 地面
  const gy = getGroundY();
  ctx.fillStyle = "#666";
  ctx.fillRect(0, gy, canvas.width, 2);

  // プレイヤー
  if (playerImg.complete) {
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
  } else {
    ctx.fillStyle = "yellow";
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }

  // 障害物
  obstacles.forEach(o => {
    if (o.shape === "fireball" && fireballImg.complete) {
      ctx.save();
      ctx.translate(o.x + o.width / 2, o.y + o.height / 2);
      ctx.rotate(-0.25);
      ctx.drawImage(fireballImg, -o.width / 2, -o.height / 2, o.width, o.height);
      ctx.restore();
      return;
    }

    if (o.shape === "image" && obstacleCustomImg.complete) {
      ctx.drawImage(obstacleCustomImg, o.x, o.y, o.width, o.height);
      return;
    }

    ctx.fillStyle = "#444";
    ctx.fillRect(o.x, o.y, o.width, o.height);
  });

  // GAME OVER
  if (gameOver) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#fff";
    ctx.font = "40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
  }
}

function loop(t) {
  const dt = (t - last) / 1000;
  last = t;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ====== GAME OVER ======
function endGame() {
  if (gameOver) return;
  gameOver = true;

  seGameover.currentTime = 0;
  seGameover.play().catch(() => {});
  stopAllBgm();

  // スコア送信
  submitScore();
}

// ====== ランキング関連 ======
async function loadRanking() {
  const res = await fetch("/api/ranking");
  const data = await res.json();

  rankingBody.innerHTML = "";

  data.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${r.username}</td>
      <td>${r.score.toFixed(2)}s</td>
    `;
    rankingBody.appendChild(tr);
  });
}

async function submitScore() {
  const username = usernameInput.value || "名無し";

  await fetch("/api/submitScore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      score: currentTime
    })
  });

  loadRanking();
  restartBtn.style.display = "block";
}

// ====== BGM トグル ======
bgmToggleBtn.addEventListener("click", () => {
  bgmEnabled = !bgmEnabled;
  if (!bgmEnabled) {
    stopAllBgm();
    bgmToggleBtn.textContent = "♪ BGM OFF";
  } else {
    bgmToggleBtn.textContent = "♪ BGM ON";
    if (!gameStarted || gameOver) playHomeBgm();
    else playGameBgm();
  }
});

// ====== ゲーム開始 ======
startBtn.addEventListener("click", () => {
  if (!usernameInput.value.trim()) {
    alert("ユーザー名を入力してください！");
    return;
  }

  playGameBgm();
  document.getElementById("ranking-table").style.display = "none";
  startBtn.style.display = "none";
  usernameInput.style.display = "none";

  resetGame();
});

// 再スタート
restartBtn.addEventListener("click", () => {
  restartBtn.style.display = "none";
  playGameBgm();
  resetGame();
});

// 初期ロード
loadRanking();
playHomeBgm();
