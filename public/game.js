// ====== 暇つぶしランゲーム game.js ======
"use strict";

console.log("game.js v9 (5s buff & more zoom-out) loaded");

// ---------- 画面要素 ----------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const currentTimeEl = document.getElementById("current-time");
const bestTimeEl = document.getElementById("best-time");
const messageEl = document.getElementById("message");
const restartBtn = document.getElementById("restart-btn");

// ランキング画面まわり
const viewRanking = document.getElementById("view-ranking");
const viewGame = document.getElementById("view-game");
const rankingBody = document.getElementById("ranking-body");
const usernameInput = document.getElementById("username-input");
const startBtn = document.getElementById("start-btn");

// 救助ポイント表示
const rescueCountEl = document.getElementById("rescue-count");

// ---------- 画像 ----------
const obstacleCustomImg = new Image();
obstacleCustomImg.src = "obstacle_custom.png";

const fireballImg = new Image();
fireballImg.src = "fireball.png";

const playerImg = new Image();
playerImg.src = "firefighter.png";

// 救助対象
const rescueImg = new Image();
rescueImg.src = "rescue.png";

// ---------- BGM / SE ----------
const bgmHome = document.getElementById("bgm-home");
const bgmGame = document.getElementById("bgm-game");
const seJump = document.getElementById("se-jump");
const seGameover = document.getElementById("se-gameover");

// ---------- 共通ヘルパー ----------

// 画像が使える状態かチェック（broken 対策）
function isImageUsable(img) {
  return !!(img && img.complete && img.naturalWidth > 0);
}

// 音声再生
function playAudio(a) {
  if (!a) return;
  try {
    a.currentTime = 0;
    const p = a.play();
    if (p && p.catch) {
      p.catch((err) => console.log("audio play error:", err));
    }
  } catch (e) {
    console.log("audio error:", e);
  }
}
function stopAudio(a) {
  if (!a) return;
  try {
    a.pause();
  } catch (_) {}
}

function playGameBgm() {
  stopAudio(bgmHome);
  if (!bgmGame) return;
  bgmGame.loop = true;
  playAudio(bgmGame);
}
function stopAllBgm() {
  stopAudio(bgmHome);
  stopAudio(bgmGame);
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
function getGroundY() {
  return canvas.height - 10;
}
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
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
let player;
let obstacles = [];
let bgFarBlocks = [];
let bgNearBlocks = [];

let rescues = [];
let rescueSpawnTimer = 0;
let nextRescueInterval = 0;
let rescueCount = 0;

let gameStarted = false;
let gameOver = false;

let startTime = 0;
let currentTime = 0;
let bestTime = parseFloat(localStorage.getItem("bestTime_runGame") || "0");

let spawnTimer = 0;
let nextSpawnInterval = 0;

let difficulty = 1;
let currentUsername = "";

// 押されている障害物
let collidedObstacle = null;

// ★ 救助による一時的なパワーアップ（ミリ秒の期限）
let sizeBoostUntil = 0; // プレイヤーが大きくなる期間
let jumpBoostUntil = 0; // ジャンプが高くなる期間
const BUFF_DURATION_MS = 5000; // ★ 5秒に変更

// ---------- プレイヤー ----------
function initPlayer() {
  // ★ さらに引きの画角に：0.25 → 0.20 に縮小
  const size = Math.min(canvas.width, canvas.height) * 0.20;

  player = {
    x: canvas.width * 0.18,
    y: getGroundY() - size,
    width: size,
    height: size,
    // ベースサイズを保持（障害物サイズ計算用 & バフの基準）
    baseWidth: size,
    baseHeight: size,

    vy: 0,
    gravity: 1600,
    baseJumpPower: -600, // 基本ジャンプ力
    maxJumps: 3,
    jumpCount: 0,
    onGround: true
  };
}

// プレイヤーのヒットボックス（胴体中心だけ）
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

// ---------- 背景 ----------
function initBackground() {
  bgFarBlocks = [];
  bgNearBlocks = [];

  const groundY = getGroundY();

  for (let i = 0; i < 10; i++) {
    const w = 180;
    const h = canvas.height * randRange(0.12, 0.22);
    const x = i * 180;
    const y = groundY - canvas.height * 0.55 - h;
    bgFarBlocks.push({ x, y, width: w, height: h, speed: 40 });
  }

  for (let i = 0; i < 10; i++) {
    const w = 120;
    const h = canvas.height * randRange(0.16, 0.23);
    const x = i * 160 + 40;
    const y = groundY - canvas.height * 0.35 - h;
    bgNearBlocks.push({ x, y, width: w, height: h, speed: 100 });
  }
}

// ---------- 障害物 ----------
function getObstacleHitbox(obs) {
  const marginX = obs.width * 0.18;
  const marginY = obs.height * 0.1;

  return {
    x: obs.x + marginX,
    y: obs.y + marginY,
    width: obs.width - marginX * 2,
    height: obs.height - marginY * 2
  };
}

function resetSpawnTimer() {
  nextSpawnInterval = randRange(900, 1600);
  spawnTimer = 0;
}

function spawnObstacle() {
  // ★ 障害物サイズは「ベースのプレイヤーサイズ」を基準にする
  const baseSize = player?.baseHeight || player?.height || 80;

  const rawWidth = randRange(baseSize * 0.7, baseSize * 1.4);
  const rawHeight = randRange(baseSize * 0.9, baseSize * 1.8);

  let obsWidth = rawWidth * 0.4;
  let obsHeight = rawHeight * 0.4;

  let obsY = getGroundY() - obsHeight;
  const baseSpeed = randRange(260, 360);
  let obsSpeed = baseSpeed * difficulty;

  // 炎の頻度アップ（2つ入れて重みづけ）、中段は無し
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

    // 0: 下段, 2: 上段（中段は使わない）
    const mode = Math.random() < 0.5 ? 0 : 2;
    if (mode === 0) {
      obsY = getGroundY() - obsHeight - 4;
    } else {
      obsY = getGroundY() - obsHeight - player.baseHeight * 1.2;
    }

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

// ---------- 救助 ----------
function resetRescueTimer() {
  nextRescueInterval = randRange(6000, 12000);
  rescueSpawnTimer = 0;
}

function spawnRescue() {
  const baseSize = player?.baseHeight || player?.height || 80;
  const size = baseSize * 0.6;
  const x = canvas.width + 40;
  const y = getGroundY() - size - 4;
  const speed = 240 * difficulty;

  rescues.push({ x, y, width: size, height: size, speed });
  resetRescueTimer();
}

// ★ 救助時のバフ付与（サイズ1.5倍 & ジャンプ1.2倍 を5秒）
function applyRescueBuff(nowMs) {
  const dur = BUFF_DURATION_MS;

  // すでにバフ中なら時間を加算、切れていたら今から5秒
  sizeBoostUntil = nowMs < sizeBoostUntil ? sizeBoostUntil + dur : nowMs + dur;
  jumpBoostUntil = nowMs < jumpBoostUntil ? jumpBoostUntil + dur : nowMs + dur;
}

// ---------- ゲームリセット ----------
function resetGame() {
  resizeCanvas();
  initPlayer();
  initBackground();
  obstacles = [];
  rescues = [];

  gameStarted = false;
  gameOver = false;
  collidedObstacle = null;

  currentTime = 0;
  spawnTimer = 0;
  difficulty = 1;

  resetSpawnTimer();
  resetRescueTimer();

  rescueCount = 0;
  if (rescueCountEl) rescueCountEl.textContent = "0";

  sizeBoostUntil = 0;
  jumpBoostUntil = 0;

  currentTimeEl.textContent = "0.00";
  bestTimeEl.textContent = bestTime.toFixed(2);
  messageEl.textContent = "画面タップ or スペースキーでスタート＆ジャンプ！";
}

// ---------- 入力 ----------
function handleJump() {
  if (!gameStarted) {
    gameStarted = true;
    startTime = performance.now();
    messageEl.textContent = "";
    playGameBgm();
  }

  if (gameOver) return;

  if (player.jumpCount < player.maxJumps) {
    const now = performance.now();
    const jumpBuffActive = now < jumpBoostUntil;
    const jumpMul = jumpBuffActive ? 1.2 : 1.0;

    player.vy = player.baseJumpPower * jumpMul;
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

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  handleJump();
});

// ---------- メインループ ----------
let lastTime = 0;

function update(delta) {
  if (!gameStarted || gameOver) return;

  const now = performance.now();
  currentTime = (now - startTime) / 1000;

  const scoreTime = currentTime + rescueCount * 10;
  currentTimeEl.textContent = scoreTime.toFixed(2);

  difficulty = 1 + currentTime * 0.03;

  // ★ バフによるサイズ変更
  const sizeBuffActive = now < sizeBoostUntil;
  const sizeMul = sizeBuffActive ? 1.5 : 1.0;
  player.width = player.baseWidth * sizeMul;
  player.height = player.baseHeight * sizeMul;

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

  // 救助
  rescueSpawnTimer += delta * 1000;
  if (rescueSpawnTimer >= nextRescueInterval) spawnRescue();
  rescues.forEach((r) => {
    r.x -= r.speed * delta;
  });

  // 救助判定
  const pHit = getPlayerHitbox();
  for (let i = rescues.length - 1; i >= 0; i--) {
    const r = rescues[i];
    if (rectsOverlap(pHit, r)) {
      rescues.splice(i, 1);
      rescueCount++;
      if (rescueCountEl) rescueCountEl.textContent = String(rescueCount);
      applyRescueBuff(now); // ★バフ付与
    }
  }

  // 衝突判定
  if (!collidedObstacle) {
    const p = pHit;
    for (const obs of obstacles) {
      const o = getObstacleHitbox(obs);
      if (rectsOverlap(p, o)) {
        collidedObstacle = obs;
        break;
      }
    }
  }

  // 押される処理
  if (collidedObstacle) {
    player.x = collidedObstacle.x - player.width + 4;
    if (player.x + player.width <= 0) {
      endGame();
    }
  }

  // クリーンアップ
  obstacles = obstacles.filter((obs) => obs.x + obs.width > -200);
  rescues = rescues.filter((r) => r.x + r.width > -200);
}

// ---------- 障害物描画 ----------
function drawObstacle(obs) {
  try {
    if (obs.shape === "fireball") {
      if (isImageUsable(fireballImg)) {
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
        ctx.fillStyle = "#ff6600";
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      }
      return;
    }

    if (obs.shape === "image") {
      if (isImageUsable(obstacleCustomImg)) {
        ctx.drawImage(obstacleCustomImg, obs.x, obs.y, obs.width, obs.height);
      } else {
        ctx.fillStyle = "#666";
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      }
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
  } catch (e) {
    console.log("drawObstacle error:", e);
  }
}

// ---------- 描画 ----------
function draw() {
  // 空
  ctx.fillStyle = "#6ec9ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 遠景
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  bgFarBlocks.forEach((b) => ctx.fillRect(b.x, b.y, b.width, b.height));

  // 近景
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

  // 救助キャラ
  rescues.forEach((r) => {
    try {
      if (isImageUsable(rescueImg)) {
        ctx.drawImage(rescueImg, r.x, r.y, r.width, r.height);
      } else {
        ctx.fillStyle = "#ffccff";
        ctx.fillRect(r.x, r.y, r.width, r.height);
      }
    } catch (e) {
      console.log("draw rescue error:", e);
    }
  });

  // プレイヤー
  try {
    if (isImageUsable(playerImg)) {
      ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
    } else {
      ctx.fillStyle = "#ffd400";
      ctx.fillRect(player.x, player.y, player.width, player.height);
    }
  } catch (e) {
    console.log("draw player error:", e);
  }

  // 障害物
  obstacles.forEach(drawObstacle);

  // GAME OVER
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

function loop(timestamp) {
  const delta = (timestamp - lastTime) / 1000 || 0;
  lastTime = timestamp;

  update(delta);
  draw();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- ランキング ----------
async function loadRanking() {
  try {
    const res = await fetch("/api/ranking");
    if (!res.ok) throw new Error("failed to fetch ranking");
    const data = await res.json();

    rankingBody.innerHTML = "";
    const list = data.ranking || [];

    if (list.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 3;
      td.textContent = "まだ記録がありません";
      tr.appendChild(td);
      rankingBody.appendChild(tr);
      return;
    }

    list.slice(0, 3).forEach((item, index) => {
      const tr = document.createElement("tr");

      const rankTd = document.createElement("td");
      rankTd.textContent = index + 1;

      const nameTd = document.createElement("td");
      nameTd.textContent = item.username;

      const timeTd = document.createElement("td");
      timeTd.textContent = item.time.toFixed(2);

      tr.appendChild(rankTd);
      tr.appendChild(nameTd);
      tr.appendChild(timeTd);
      rankingBody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
    rankingBody.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = "ランキング読み込みに失敗しました";
    tr.appendChild(td);
    rankingBody.appendChild(tr);
  }
}

async function submitScore(timeSec) {
  if (!currentUsername) return;
  try {
    await fetch("/api/ranking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUsername, time: timeSec })
    });
    await loadRanking();
  } catch (e) {
    console.error("submitScore error", e);
  }
}

// ---------- 画面切り替え ----------
function showRankingView() {
  viewRanking.classList.add("active");
  viewGame.classList.remove("active");
}
function showGameView() {
  viewRanking.classList.remove("active");
  viewGame.classList.add("active");
}

startBtn.addEventListener("click", () => {
  const name = usernameInput.value.trim();
  if (!name) {
    alert("ユーザー名を入力してください");
    return;
  }
  currentUsername = name;
  showGameView();
  resetGame();
});

restartBtn.addEventListener("click", () => {
  resetGame();
});

// ---------- ゲームオーバー ----------
function endGame() {
  if (gameOver) return;

  gameOver = true;
  playGameoverSe();
  stopAllBgm();

  const finalScoreTime = currentTime + rescueCount * 10;

  if (finalScoreTime > bestTime) {
    bestTime = finalScoreTime;
    localStorage.setItem("bestTime_runGame", String(bestTime));
  }
  bestTimeEl.textContent = bestTime.toFixed(2);

  messageEl.textContent =
    `ゲームオーバー！ 走行タイム：${finalScoreTime.toFixed(2)} 秒 ` +
    `(救助 ${rescueCount} 人)`;

  submitScore(finalScoreTime);
}

// ---------- 初期化 ----------
loadRanking();
showRankingView();
resetGame();
