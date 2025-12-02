// ====== 暇つぶしランゲーム game.js ======
"use strict";

// キャンバスとUI要素
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const currentTimeEl = document.getElementById("current-time");
const bestTimeEl = document.getElementById("best-time");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restart-btn");

// ★ 社長イラスト障害物（obstacle_custom.png を public に置く）
const obstacleCustomImg = new Image();
obstacleCustomImg.src = "obstacle_custom.png";
// 火の玉画像
const fireballImg = new Image();
fireballImg.src = "fireball.png";


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

// 地面の Y 座標
function getGroundY() {
  const marginFromBottom = 10;
  return canvas.height - marginFromBottom;
}

// ====== ゲーム用の変数 ======
let player;
let obstacles = [];

// 背景ブロック
let bgFarBlocks = [];   // 遠景（大きめ・薄い）
let bgNearBlocks = [];  // 近景（少し濃い・小さめ）

let gameStarted = false;
let gameOver = false;

let startTime = 0;
let currentTime = 0;
let bestTime = parseFloat(localStorage.getItem("bestTime_runGame") || "0");

let spawnTimer = 0;
let nextSpawnInterval = 0;

let difficulty = 1; // 時間経過で上がる

// ====== プレイヤー初期化（黄色い四角） ======
function initPlayer() {
  const size = Math.min(canvas.width, canvas.height) * 0.2; // 前のまま

  player = {
    x: canvas.width * 0.2,
    y: getGroundY() - size,
    width: size,
    height: size,
    vy: 0,
    gravity: 1600,
    jumpPower: -600, // 調整済みジャンプ力
    onGround: true,
    maxJumps: 3,     // 3段ジャンプ
    jumpCount: 0
  };
}

// ====== 背景ブロック初期化 ======
function initBackground() {
  bgFarBlocks = [];
  bgNearBlocks = [];

  const groundY = getGroundY();

  // 遠景：大きめの薄い四角（山・ビルっぽい）
  const farCount = 10;
  const farWidth = 180;

  for (let i = 0; i < farCount; i++) {
    const w = farWidth;
    const h = canvas.height * randRange(0.15, 0.28);
    const x = i * farWidth;
    const y = groundY - canvas.height * 0.55 - h; // 上の方に配置

    bgFarBlocks.push({
      x,
      y,
      width: w,
      height: h,
      speed: 40       // ベース速度（あとで difficulty を掛ける）
    });
  }

  // 近景：少し小さい白ブロック
  const nearCount = 10;
  const nearWidth = 160;

  for (let i = 0; i < nearCount; i++) {
    const w = 120;
    const h = canvas.height * randRange(0.18, 0.25);
    const x = i * nearWidth + 40;
    const y = groundY - canvas.height * 0.35 - h;

    bgNearBlocks.push({
      x,
      y,
      width: w,
      height: h,
      speed: 100      // 近景の方が速くスクロール
    });
  }
}

// ====== 障害物生成 ======
function resetSpawnTimer() {
  // 出現間隔（0.9〜1.6秒）
  nextSpawnInterval = randRange(900, 1600);
  spawnTimer = 0;
}

function spawnObstacle() {
  const baseSize = player.height;

  // 元のサイズ
  const rawWidth = randRange(baseSize * 0.7, baseSize * 1.4);
  const rawHeight = randRange(baseSize * 0.9, baseSize * 1.8);

  // 4/5 に縮小（前の設定そのまま）
  const width = rawWidth * 0.8;
  const height = rawHeight * 0.8;

  // 上端は rawHeight のまま → 下だけ浮く
  const topY = getGroundY() - rawHeight;

  // 速度（難易度でだんだん速くなる）
  const baseSpeed = randRange(260, 360);
  const speed = baseSpeed * difficulty;

  // ★ 形の種類に fireball を追加
  //   火の玉は他より少し速め＆少し高い位置から飛んでくる
  const shapeTypes = ["rect", "stair", "triangle", "dome", "pole", "image", "fireball"];
  const shape = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

  let obsY = topY;
  let obsWidth = width;
  let obsHeight = height;
  let obsSpeed = speed;

  if (shape === "fireball") {
    // 火の玉用の調整
    obsHeight = baseSize * 0.9;
    obsWidth = baseSize * 1.2;
    obsY = getGroundY() - baseSize * 1.4; // 地面より少し高めを飛ぶ
    obsSpeed = speed * 1.3;               // 他よりちょっと速い
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
      player.jumpCount = 0;
    }
  }

  // 背景スクロール
  bgFarBlocks.forEach((b) => {
    b.x -= b.speed * delta * difficulty * 0.6; // ゆっくり
    if (b.x + b.width < 0) {
      b.x = canvas.width + randRange(20, 120);
    }
  });

  bgNearBlocks.forEach((b) => {
    b.x -= b.speed * delta * difficulty; // 近景は速め
    if (b.x + b.width < 0) {
      b.x = canvas.width + randRange(40, 160);
    }
  });

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

function drawObstacle(obs) {
  // 火の玉
  if (obs.shape === "fireball") {
    if (fireballImg.complete && fireballImg.naturalWidth > 0) {
      ctx.save();
      // 少し傾けて飛んでいる感じにする
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
      return;
    }
    // 読み込み前は普通の四角で代用
  }

  // 社長イラスト障害物（前のまま）
  if (
    obs.shape === "image" &&
    obstacleCustomImg.complete &&
    obstacleCustomImg.naturalWidth > 0
  ) {
    ctx.drawImage(obstacleCustomImg, obs.x, obs.y, obs.width, obs.height);
    return;
  }

  ctx.fillStyle = "#555";

  switch (obs.shape) {
    case "stair": {
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
      ctx.beginPath();
      ctx.moveTo(obs.x, obs.y + obs.height);
      ctx.lineTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "dome": {
      const baseHeight = obs.height * 0.35;
      const domeHeight = obs.height - baseHeight;

      ctx.fillRect(obs.x, obs.y + domeHeight, obs.width, baseHeight);

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


// ====== 描画処理 ======
function draw() {
  // 空
  ctx.fillStyle = "#6ec9ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 遠景
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  bgFarBlocks.forEach((b) => {
    ctx.fillRect(b.x, b.y, b.width, b.height);
  });

  // 近景
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  bgNearBlocks.forEach((b) => {
    ctx.fillRect(b.x, b.y, b.width, b.height);
  });

  // 地面
  const groundY = getGroundY();
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvas.width, groundY);
  ctx.stroke();

  ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
  ctx.fillRect(0, groundY, canvas.width, 40);

  // プレイヤー
  ctx.fillStyle = "#ffd400";
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // 障害物
  obstacles.forEach(drawObstacle);
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
  messageEl.textContent = `ゲームオーバー！ 走行タイム：${currentTime.toFixed(
    2
  )} 秒`;
}

// ====== リスタート ======
restartBtn.addEventListener("click", () => {
  resetGame();
});
