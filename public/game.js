const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const timeSpan = document.getElementById("time");
const bestSpan = document.getElementById("best");
const statusDiv = document.getElementById("status");
const restartBtn = document.getElementById("restart-btn");

// === ここがポイント：先に groundY を宣言だけしておく ===
let groundY;

// キャンバスのサイズを画面に合わせて調整
function resizeCanvas() {
  const width = Math.min(640, window.innerWidth - 32);
  const height = Math.round(width * 0.6);
  canvas.width = width;
  canvas.height = height;
  groundY = canvas.height * 0.8; // ← ここで代入してもOKになる
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// プレイヤー画像
const playerImg = new Image();
// ★あとで public に player.png を置くと、この画像がキャラになる
playerImg.src = "player.png";

// ゲーム状態
let player;
let obstacles;
let lastTime = null;
let running = false;
let gameOver = false;
let deathAnimating = false;
let startTime = 0;
let elapsed = 0;
let bestTime =
  Number(localStorage.getItem("runGameBestTime") || "0") || 0;

bestSpan.textContent = bestTime.toFixed(2);

const gravity = 0.6;
const jumpVelocity = -12;
const speed = 4; // 横スクロール速度
let spawnTimer = 0;
let spawnInterval = 1200; // ms

function resetGame() {
  player = {
    x: canvas.width * 0.2,
    y: groundY - 50,
    w: 50,
    h: 50,
    vy: 0,
    onGround: true,
    opacity: 1
  };
  obstacles = [];
  lastTime = null;
  running = false;
  gameOver = false;
  deathAnimating = false;
  elapsed = 0;
  timeSpan.textContent = "0.00";
  statusDiv.textContent = "タップ / スペースキーでスタート＆ジャンプ！";
  restartBtn.hidden = true;
}
resetGame();

function spawnObstacle() {
  const height = 20 + Math.random() * 40;
  const width = 20 + Math.random() * 60;
  const y = groundY - height;
  obstacles.push({
    x: canvas.width + width,
    y,
    w: width,
    h: height
  });
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.w < b.x ||
    a.x > b.x + b.w ||
    a.y + a.h < b.y ||
    a.y > b.y + b.h
  );
}

function update(delta) {
  if (!running && !deathAnimating) return;

  const deltaSec = delta / 16.67; // 60fps換算

  if (running) {
    const now = performance.now();
    elapsed = (now - startTime) / 1000;
    timeSpan.textContent = elapsed.toFixed(2);
  }

  // プレイヤー物理
  if (running || deathAnimating) {
    if (!player.onGround) {
      player.vy += gravity * deltaSec;
      player.y += player.vy * deltaSec;
      if (player.y + player.h >= groundY) {
        player.y = groundY - player.h;
        player.vy = 0;
        player.onGround = true;
      }
    }
  }

  // 障害物の移動 & 生成（死亡中は停止）
  if (running) {
    spawnTimer += delta;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnInterval = 900 + Math.random() * 900;
      spawnObstacle();
    }

    obstacles.forEach((o) => {
      o.x -= speed * deltaSec * 10;
    });
    obstacles = obstacles.filter((o) => o.x + o.w > -50);
  }

  // 衝突判定（走行中のみ）
  if (running) {
    for (const o of obstacles) {
      if (rectsOverlap(player, o)) {
        running = false;
        deathAnimating = true;
        statusDiv.textContent = "つまずいちゃった… 引きずられてく〜💦";
        break;
      }
    }
  }

  // 死亡アニメーション：左に引きずられつつフェードアウト
  if (deathAnimating) {
    player.x -= 3 * deltaSec * 10;
    player.opacity -= 0.02 * deltaSec * 3;
    if (player.opacity < 0) player.opacity = 0;

    if (player.x + player.w < 0 || player.opacity <= 0.05) {
      deathAnimating = false;
      gameOver = true;

      const finalTime = elapsed;
      if (finalTime > bestTime) {
        bestTime = finalTime;
        localStorage.setItem("runGameBestTime", String(bestTime));
      }
      bestSpan.textContent = bestTime.toFixed(2);
      statusDiv.textContent = `ゲームオーバー！走行タイム：${finalTime.toFixed(
        2
      )} 秒`;
      restartBtn.hidden = false;
    }
  }
}

function drawGround() {
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 0.5);
  ctx.lineTo(canvas.width, groundY + 0.5);
  ctx.stroke();
}

function drawPlayer() {
  ctx.save();
  ctx.globalAlpha = player.opacity;

  if (playerImg.complete && playerImg.naturalWidth > 0) {
    ctx.drawImage(playerImg, player.x, player.y, player.w, player.h);
  } else {
    ctx.fillStyle = "#ffcc00";
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }

  ctx.restore();
}

function drawObstacles() {
  ctx.fillStyle = "#555";
  obstacles.forEach((o) => {
    ctx.fillRect(o.x, o.y, o.w, o.h);
  });
}

function loop(timestamp) {
  if (lastTime == null) lastTime = timestamp;
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  update(delta);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGround();
  drawObstacles();
  drawPlayer();

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 入力（クリック / タップ / スペースキー）
function handleJump() {
  if (gameOver) return;
  if (!running && !deathAnimating) {
    running = true;
    startTime = performance.now();
    statusDiv.textContent = "走行中！段差に注意して〜！";
  }
  if (player.onGround && !deathAnimating) {
    player.vy = jumpVelocity;
    player.onGround = false;
  }
}

canvas.addEventListener("click", handleJump);
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    handleJump();
  }
});

restartBtn.addEventListener("click", () => {
  resetGame();
});

// 初期メッセージ
statusDiv.textContent = "タップ / スペースキーでスタート＆ジャンプ！";
