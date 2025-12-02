// ====== 暇つぶしランゲーム game.js ======
"use strict";

// キャンバスとUI要素
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const currentTimeEl = document.getElementById("current-time");
const bestTimeEl = document.getElementById("best-time");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restart-btn");

// ログイン用要素
const loginArea = document.getElementById("login-area");
const nameInput = document.getElementById("player-name-input");
const loginBtn = document.getElementById("login-btn");
const userInfo = document.getElementById("user-info");
const userNameLabel = document.getElementById("user-name-label");
const logoutBtn = document.getElementById("logout-btn");

// ★ 社長イラスト障害物
const obstacleCustomImg = new Image();
obstacleCustomImg.src = "obstacle_custom.png";

// ★ 火の玉画像
const fireballImg = new Image();
fireballImg.src = "fireball.png";

// ★ 消防士プレイヤー画像（右向きPNG）
const playerImg = new Image();
playerImg.src = "firefighter.png";

// ====== ゲーム状態（先に宣言しておく） ======
let player;
let obstacles = [];

let bgFarBlocks = [];
let bgNearBlocks = [];

let gameStarted = false;
let gameOver = false;

let startTime = 0;
let currentTime = 0;
let bestTime = parseFloat(localStorage.getItem("bestTime_runGame") || "0");

let spawnTimer = 0;
let nextSpawnInterval = 0;

let difficulty = 1;
let lastTime = 0;

// ログイン状態
let playerName = localStorage.getItem("playerName") || "";

// ----- ログインUI更新 -----
function updateLoginUI() {
  if (playerName) {
    loginArea.hidden = true;
    userInfo.hidden = false;
    userNameLabel.textContent = playerName;
    // ログイン済みメッセージ
    if (!gameStarted && !gameOver) {
      messageEl.textContent = `${playerName} さん、画面タップ or スペースキーでスタート＆ジャンプ！`;
    }
  } else {
    loginArea.hidden = false;
    userInfo.hidden = true;
    if (!gameStarted && !gameOver) {
      messageEl.textContent = "まず名前を入力してログインしてね";
    }
  }
}

// ----- キャンバスサイズ調整（縦画面・シンプル版） -----
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ----- ランダム -----
function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

// 地面
function getGroundY() {
  return canvas.height - 10;
}

// ====== プレイヤー（消防士）初期化 ======
function initPlayer() {
  const size = Math.min(canvas.width, canvas.height) * 0.4;

  player = {
    x: canvas.width * 0.2,
    y: getGroundY() - size,
    width: size,
    height: size,
    vy: 0,
    gravity: 1600,
    jumpPower: -600,
    onGround: true,
    maxJumps: 3,
    jumpCount: 0
  };
}

// ====== 背景初期化 ======
function initBackground() {
  bgFarBlocks = [];
  bgNearBlocks = [];

  const groundY = getGroundY();

  // 遠景
  for (let i = 0; i < 10; i++) {
    const w = 180;
    const h = canvas.height * randRange(0.15, 0.28);
    const x = i * 180;
    const y = groundY - canvas.height * 0.55 - h;

    bgFarBlocks.push({ x, y, width: w, height: h, speed: 40 });
  }

  // 近景
  for (let i = 0; i < 10; i++) {
    const w = 120;
    const h = canvas.height * randRange(0.18, 0.25);
    const x = i * 160 + 40;
    const y = groundY - canvas.height * 0.35 - h;

    bgNearBlocks.push({ x, y, width: w, height: h, speed: 100 });
  }
}

// ====== 当たり判定用ヒットボックス ======
function getPlayerHitbox() {
  const hitWidth = player.width * 0.45;
  const hitHeight = player.height * 0.75;

  const offsetX = (player.width - hitWidth) / 2;
  const offsetY = (player.height - hitHeight) / 2;

  return {
    x: player.x + offsetX,
    y: player.y + offsetY,
    width: hitWidth,
    height: hitHeight
  };
}

function getObstacleHitbox(obs) {
  const marginX = obs.width * 0.18;
  const marginY = obs.height * 0.10;

  return {
    x: obs.x + marginX,
    y: obs.y + marginY,
    width: obs.width - marginX * 2,
    height: obs.height - marginY * 2
  };
}

// ====== 障害物生成 ======
function resetSpawnTimer() {
  nextSpawnInterval = randRange(900, 1600);
  spawnTimer = 0;
}

function spawnObstacle() {
  const baseSize = player.height;

  const rawWidth = randRange(baseSize * 0.7, baseSize * 1.4);
  const rawHeight = randRange(baseSize * 0.9, baseSize * 1.8);

  const baseWidth = rawWidth * 0.8;
  const baseHeight = rawHeight * 0.8;

  let obsWidth = baseWidth * 0.5;
  let obsHeight = baseHeight * 0.5;

  // ★ 全部地面に接地（火の玉以外）
  let obsY = getGroundY() - obsHeight;

  const baseSpeed = randRange(260, 360);
  let obsSpeed = baseSpeed * difficulty;

  const shapeTypes = ["rect", "stair", "triangle", "dome", "pole", "image", "fireball"];
  const shape = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

  if (shape === "fireball") {
    const fireBase = baseSize * 1.8;
    obsWidth = fireBase * 1.3;
    obsHeight = fireBase * 0.9;
    obsY = getGroundY() - fireBase * 1.5; // 空中を飛ぶ
    obsSpeed = obsSpeed * 1.3;
  }

  obstacles.push({
    x: canvas.width + 20,
    y: obsY,
    width: obsWidth,
    height: obsHeight,
    speed: obsSpeed,
    shape
  });

  resetSpawnTimer();
}

// ====== ゲームリセット ======
function resetGame() {
  resizeCanvas();
  initPlayer();
  initBackground();
  obstacles = [];

  gameStarted = false;
  gameOver = false;
  currentTime = 0;

  spawnTimer = 0;
  resetSpawnTimer();

  difficulty = 1;

  currentTimeEl.textContent = "0.00";
  bestTimeEl.textContent = bestTime.toFixed(2);

  updateLoginUI();
}

// 初期化
resetGame();

// ====== ログイン処理 ======
loginBtn.addEventListener("click", () => {
  const name = nameInput.value.trim();
  if (!name) {
    alert("なまえを入力してね！");
    return;
  }
  playerName = name;
  localStorage.setItem("playerName", playerName);
  updateLoginUI();
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("playerName");
  playerName = "";
  resetGame();
});

// ====== 入力 ======
function handleJump() {
  // ログインしていないときはゲーム開始させない
  if (!playerName) {
    messageEl.textContent = "まず名前を入力してログインしてね";
    return;
  }

  if (!gameStarted) {
    gameStarted = true;
    startTime = performance.now();
    messageEl.textContent = "";
  }

  if (gameOver) return;

  if (player.jumpCount < player.maxJumps) {
    player.vy = player.jumpPower;
    player.onGround = false;
    player.jumpCount++;
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    handleJump();
  }
});

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  handleJump();
});

// ====== 更新処理 ======
function update(delta) {
  if (!gameStarted || gameOver) return;

  const now = performance.now();
  currentTime = (now - startTime) / 1000;
  currentTimeEl.textContent = currentTime.toFixed(2);

  difficulty = 1 + currentTime * 0.03;

  // プレイヤー
  player.vy += player.gravity * delta;
  player.y += player.vy * delta;

  const groundY = getGroundY() - player.height;

  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    if (!player.onGround) {
      player.onGround = true;
      player.jumpCount = 0;
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

  obstacles = obstacles.filter((obs) => obs.x + obs.width > 0);

  // 当たり判定
  const p = getPlayerHitbox();

  for (const obs of obstacles) {
    const o = getObstacleHitbox(obs);
    if (
      p.x < o.x + o.width &&
      p.x + p.width > o.x &&
      p.y < o.y + o.height &&
      p.y + p.height > o.y
    ) {
      endGame();
      break;
    }
  }
}

// ====== 障害物描画 ======
function drawObstacle(obs) {
  if (obs.shape === "fireball" && fireballImg.complete && fireballImg.naturalWidth > 0) {
    ctx.save();
    ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
    ctx.rotate((-15 * Math.PI) / 180);
    ctx.drawImage(fireballImg, -obs.width / 2, -obs.height / 2, obs.width, obs.height);
    ctx.restore();
    return;
  }

  if (obs.shape === "image" && obstacleCustomImg.complete && obstacleCustomImg.naturalWidth > 0) {
    ctx.drawImage(obstacleCustomImg, obs.x, obs.y, obs.width, obs.height);
    return;
  }

  ctx.fillStyle = "#555";

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

// ====== 描画 ======
function draw() {
  ctx.fillStyle = "#6ec9ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  bgFarBlocks.forEach((b) => ctx.fillRect(b.x, b.y, b.width, b.height));

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  bgNearBlocks.forEach((b) => ctx.fillRect(b.x, b.y, b.width, b.height));

  const groundY = getGroundY();
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();

  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fillRect(0, groundY, canvas.width, 40);

  if (playerImg.complete && playerImg.naturalWidth > 0) {
    ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
  } else {
    ctx.fillStyle = "#ffd400";
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }

  obstacles.forEach(drawObstacle);

  if (gameOver) {
    ctx.save();

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = Math.min(canvas.width, canvas.height) * 0.22;

    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ff5252";
    ctx.lineWidth = r * 0.12;
    ctx.stroke();

    ctx.fillStyle = "#ff5252";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${r * 0.45}px "Segoe UI", sans-serif`;
    ctx.fillText("GAME", cx, cy - r * 0.25);
    ctx.fillText("OVER!!", cx, cy + r * 0.15);

    ctx.restore();
  }
}

// ====== ループ開始 ======
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
restartBtn.addEventListener("click", resetGame);

// 初期のログインUI反映
updateLoginUI();
