// ====== 基本の要素取得 ======
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const currentTimeEl = document.getElementById("current-time");
const bestTimeEl = document.getElementById("best-time");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restart-btn");

// ====== サイズ調整（レスポンシブ） ======
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ====== ゲーム用変数 ======
let player;
let obstacles = [];
let gameStarted = false;
let gameOver = false;

let startTime = 0;
let currentTime = 0;
let bestTime = parseFloat(localStorage.getItem("bestTime_runGame") || "0");

// ランダムな出現テンポ用
let spawnTimer = 0;
let nextSpawnInterval = 0; // ms 単位

// 地面の高さ（キャンバス内のY位置）
function getGroundY() {
  return canvas.height - 40; // ちょっと余白
}

// ランダム関数
function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(randRange(min, max));
}

// ====== プレイヤー初期化 ======
function initPlayer() {
  const size = Math.min(canvas.width, canvas.height) * 0.06; // 画面に対しての割合
  player = {
    x: canvas.width * 0.2,
    y: getGroundY() - size,
    width: size,
    height: size,
    vy: 0,
    gravity: 1600, // 重力（大きいほど早く落ちる）
    jumpPower: -650,
    onGround: true
  };
}

// ====== 障害物生成（ランダムサイズ＋ランダム間隔） ======
function resetSpawnTimer() {
  // 障害物が来る間隔（ミリ秒）
  // → 1500〜2600ms の間でランダム（前よりゆっくり目）
  nextSpawnInterval = randRange(1500, 2600);
  spawnTimer = 0;
}

function spawnObstacle() {
  // プレイヤーサイズを基準に、ランダムな幅＆高さ
  const baseSize = player.height;

  const width = randRange(baseSize * 0.7, baseSize * 1.4);   // 幅：ちょい小さい〜大きめ
  const height = randRange(baseSize * 0.9, baseSize * 1.8);  // 高さ：低い段差〜高い壁

  const speed = randRange(260, 360); // 左に流れるスピード（少しだけランダム）

  obstacles.push({
    x: canvas.width + 20,
    y: getGroundY() - height,
    width,
    height,
    speed
  });

  resetSpawnTimer();
}

// ====== ゲーム初期化 ======
function resetGame() {
  resizeCanvas();
  initPlayer();
  obstacles = [];
  gameStarted = false;
  gameOver = false;
  currentTime = 0;
  startTime = 0;
  spawnTimer = 0;
  resetSpawnTimer();

  currentTimeEl.textContent = "0.00";
  bestTimeEl.textContent = bestTime.toFixed(2);
  messageEl.textContent = "画面タップ or スペースキーでスタート＆ジャンプ！";
}

resetGame();

// ====== 入力処理（スペース＆タップ） ======
function handleJump() {
  if (!gameStarted) {
    // スタート処理
    gameStarted = true;
    startTime = performance.now();
    messageEl.textContent = "";
  }

  if (gameOver) return;

  if (player.onGround) {
    player.vy = player.jumpPower;
    player.onGround = false;
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

// ====== ゲームループ ======
let lastTime = 0;

function update(delta) {
  if (!gameStarted || gameOver) return;

  // 時間更新
  const now = performance.now();
  currentTime = (now - startTime) / 1000;
  currentTimeEl.textContent = currentTime.toFixed(2);

  // プレイヤーの物理
  player.vy += player.gravity * delta;
  player.y += player.vy * delta;

  const groundY = getGroundY() - player.height;

  if (player.y >= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.onGround = true;
  }

  // 障害物の生成タイミング（ランダム）
  spawnTimer += delta * 1000; // ms に変換
  if (spawnTimer >= nextSpawnInterval) {
    spawnObstacle();
  }

  // 障害物の移動
  obstacles.forEach((obs) => {
    obs.x -= obs.speed * delta;
  });

  // 画面外を削除
  obstacles = obstacles.filter((obs) => obs.x + obs.width > 0);

  // 当たり判定
  for (const obs of obstacles) {
    if (
      player.x < obs.x + obs.width &&
      player.x + player.width > obs.x &&
      player.y < obs.y + obs.height &&
      player.y + player.height > obs.y
    ) {
      // 衝突！
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

  // 地面線
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, getGroundY());
  ctx.lineTo(canvas.width, getGroundY());
  ctx.stroke();

  // プレイヤー（四角）
  ctx.fillStyle = "#333";
  ctx.fillRect(player.x, player.y, player.width, player.height);

  // 障害物
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

// ====== ゲームオーバー処理 ======
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

// ====== リスタートボタン ======
restartBtn.addEventListener("click", () => {
    resetGame();
});
