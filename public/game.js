// ====== うんこランゲーム（炎のみ・坂多め＆落とし穴は必ず落ちるサイズ＋3段で越えられる・軽量版） ======
"use strict";

window.addEventListener("DOMContentLoaded", () => {
  // ---------- 定数 ----------
  const BASE_JUMP_POWER = -520;

  const MAX_FIREBALLS = 2;
  const MAX_POOP = 6;

  const TERRAIN_BASE_SPEED = 140;

  // 落とし穴確率（時間でアップ / 速度は変えない）
  const BASE_GAP_PROB = 0.3;      // 最初は30%
  const MAX_EXTRA_GAP_PROB = 0.3; // 最大 +30% → 60%
  const GAP_RAMP_SECONDS = 40;

  // ---------- オーディオ設定 ----------
  const ENABLE_BGM = true;
  const ENABLE_SE = true;

  // ---------- キャンバス ----------
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const CANVAS_SCALE = 0.85;

  function resizeCanvas() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width * CANVAS_SCALE;
    canvas.height = r.height * CANVAS_SCALE;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function getGroundY() {
    return canvas.height - 12;
  }

  // ---------- UI ----------
  const viewSelect = document.getElementById("view-select");
  const viewGame = document.getElementById("view-game");
  const restartBtn = document.getElementById("restart-btn");
  const centerMessageEl = document.getElementById("center-message");
  const topLeftStatusEl = document.getElementById("top-left-status");

  // ---------- 画像 ----------
  const playerImg = new Image();
  playerImg.src = "cleaner.png";

  const poopImg = new Image();
  poopImg.src = "poop.png";

  const fireballImg = new Image();
  fireballImg.src = "fireball.png";

  // ---------- サウンド ----------
  const bgmGame = document.getElementById("bgm-game");
  const seJump = document.getElementById("se-jump");
  const seGameover = document.getElementById("se-gameover");

  function playAudio(a, type) {
    if (!a) return;
    if (type === "bgm" && !ENABLE_BGM) return;
    if (type === "se" && !ENABLE_SE) return;
    try {
      if (type === "se") a.currentTime = 0;
      const p = a.play();
      if (p?.catch) p.catch(() => {});
    } catch {}
  }

  // ---------- util ----------
  const rand = (a, b) => Math.random() * (b - a) + a;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const rectOverlap = (a, b) =>
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;

  // ---------- ゲーム状態 ----------
  let player;
  let fireballs = [];
  let poopItems = [];
  let terrain = [];

  let poopCount = 0;

  let gameStarted = false;
  let gameOver = false;

  let startTime = 0;
  let elapsedTime = 0;

  let currentGapProb = BASE_GAP_PROB;

  let spawnFireTimer = 0;
  let nextFireInterval = 0;

  let spawnPoopTimer = 0;
  let nextPoopInterval = 0;

  // ---------- プレイヤー ----------
  function initPlayer() {
    const size = Math.min(canvas.width, canvas.height) * 0.22;

    player = {
      x: canvas.width * 0.18,
      y: getGroundY() - size,
      width: size,
      height: size,
      vy: 0,
      gravity: 1600,
      jumpPower: BASE_JUMP_POWER,
      maxJumps: 3,
      jumpCount: 0,
      onGround: true
    };
  }

  function getPlayerHitbox() {
    const w = player.width * 0.5;
    const h = player.height * 0.7;
    return {
      x: player.x + (player.width - w) / 2,
      y: player.y + (player.height - h) / 2,
      width: w,
      height: h
    };
  }

  // ---------- 地形（坂多め＆穴／穴サイズは3段ジャンプ圏内 ＋ 連続穴禁止） ----------
  function createTerrainSegment(startX, offset, lastType) {
    const base = player ? player.height : 50;
    const slopeMax = base * 0.6;

    // 坂は短め → 本数が増えて体感2倍
    const widthFlat = rand(base * 1.0, base * 1.4);
    const widthSlope = rand(base * 0.7, base * 1.0);

    // ★ 落とし穴の幅：
    //    最小 = 0.8 * プレイヤー高さ
    //    最大 = 1.3 * プレイヤー高さ
    //    → 何もしないと落ちるが、3段ジャンプなら十分越えられる想定
    const widthGap = rand(base * 0.8, base * 1.3);

    let type = "ground";
    let width = widthFlat;
    let startOffset = offset;
    let endOffset = offset;

    // 時間経過に応じて 0.3 → 0.6 まで増える
    const gapProb = currentGapProb;
    const flatProb = 0.05;
    const slopeProb = 1 - flatProb - gapProb;
    const upProb = slopeProb / 2;
    const downProb = slopeProb - upProb;

    const r = Math.random();

    if (r < flatProb) {
      width = widthFlat;
    } else if (r < flatProb + upProb) {
      // 登り坂
      width = widthSlope;
      endOffset = clamp(offset - rand(base * 0.3, base * 0.6), -slopeMax, 0);
    } else if (r < flatProb + upProb + downProb) {
      // 下り坂
      width = widthSlope;
      endOffset = clamp(offset + rand(base * 0.3, base * 0.6), -slopeMax, 0);
    } else {
      // 落とし穴
      type = "gap";
      width = widthGap;
    }

    // ★ 直前も gap だったら今回の gap は禁止（巨大穴防止）
    if (lastType === "gap" && type === "gap") {
      type = "ground";
      width = widthFlat;
      startOffset = offset;
      endOffset = offset;
    }

    return { x: startX, width, type, startOffset, endOffset };
  }

  function initTerrain() {
    terrain = [];
    let offset = 0;
    let x = -50;
    let lastType = "ground";

    while (x < canvas.width + 200) {
      const seg = createTerrainSegment(x, offset, lastType);
      terrain.push(seg);
      x += seg.width;
      if (seg.type !== "gap") offset = seg.endOffset;
      lastType = seg.type;
    }
  }

  function getGroundInfoAtX(x) {
    const baseY = getGroundY();
    for (const seg of terrain) {
      if (x >= seg.x && x <= seg.x + seg.width) {
        if (seg.type === "gap") {
          return { isGap: true, y: baseY + 9999 };
        }
        const t = (x - seg.x) / seg.width;
        const yOffset = seg.startOffset + (seg.endOffset - seg.startOffset) * t;
        return { isGap: false, y: baseY + yOffset };
      }
    }
    return { isGap: false, y: baseY };
  }

  function updateTerrain(delta) {
    const speed = TERRAIN_BASE_SPEED;

    terrain.forEach((seg) => (seg.x -= speed * delta));

    while (terrain.length && terrain[0].x + terrain[0].width < -200) {
      terrain.shift();
    }

    let offset = terrain.length ? terrain[terrain.length - 1].endOffset : 0;
    let x =
      terrain.length > 0
        ? terrain[terrain.length - 1].x + terrain[terrain.length - 1].width
        : -50;
    let lastType = terrain.length ? terrain[terrain.length - 1].type : "ground";

    while (x < canvas.width + 200) {
      const seg = createTerrainSegment(x, offset, lastType);
      terrain.push(seg);
      x += seg.width;
      if (seg.type !== "gap") offset = seg.endOffset;
      lastType = seg.type;
    }
  }

  // ---------- 炎 ----------
  function resetFireTimer() {
    nextFireInterval = rand(2200, 3800);
    spawnFireTimer = 0;
  }

  function spawnFireball() {
    if (fireballs.length >= MAX_FIREBALLS) return;

    const base = player.height;
    const width = base * rand(1.0, 1.4);
    const height = base * rand(0.6, 0.9);

    const spawnX = canvas.width + 20;

    const ground = getGroundInfoAtX(spawnX);
    let y = ground.y - height;

    if (Math.random() < 0.35) {
      y -= base * 1.2;
    }

    const speed = rand(220, 300) * 0.9;

    fireballs.push({ x: spawnX, y, width, height, speed });
    resetFireTimer();
  }

  // ---------- うんこ ----------
  function resetPoopTimer() {
    nextPoopInterval = rand(1500, 2600);
    spawnPoopTimer = 0;
  }

  function spawnPoop() {
    if (poopItems.length >= MAX_POOP) return;

    // うんちサイズ2倍
    const size = player.height * 1.0;
    const spawnX = canvas.width + 20;
    const ground = getGroundInfoAtX(spawnX);

    poopItems.push({
      x: spawnX,
      y: ground.y - size,
      width: size,
      height: size,
      speed: 200 * 0.8
    });

    resetPoopTimer();
  }

  // ---------- メッセージ ----------
  function showMessage(text, mode) {
    centerMessageEl.className = "center-message";
    if (!text) {
      centerMessageEl.classList.add("hidden");
      centerMessageEl.innerHTML = "";
      return;
    }
    const div = document.createElement("div");
    div.className = "center-message-inner";
    div.innerHTML = text.replace(/\n/g, "<br>");
    centerMessageEl.innerHTML = "";
    centerMessageEl.appendChild(div);

    if (mode === "grade") centerMessageEl.classList.add("center-message--grade");
  }

  // ---------- ゲーム初期化 ----------
  function resetGame() {
    resizeCanvas();
    initPlayer();
    initTerrain();

    fireballs = [];
    poopItems = [];
    poopCount = 0;

    gameStarted = false;
    gameOver = false;

    elapsedTime = 0;
    currentGapProb = BASE_GAP_PROB;

    resetFireTimer();
    resetPoopTimer();

    topLeftStatusEl.textContent = "回収うんこ：0個";
    showMessage("うんこを拾いながら街を爆走！", null);
  }

  function startGame() {
    gameStarted = true;
    startTime = performance.now();
    playAudio(bgmGame, "bgm");
    showMessage("");
  }

  // ---------- 入力 ----------
  function jump() {
    if (gameOver) return;

    if (!gameStarted) startGame();

    if (player && player.jumpCount < player.maxJumps) {
      player.vy = player.jumpPower;
      player.onGround = false;
      player.jumpCount++;
      playAudio(seJump, "se");
    }
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") jump();
  });
  canvas.addEventListener("pointerdown", jump);

  // ---------- update ----------
  function update(delta) {
    if (!gameStarted || gameOver) return;

    elapsedTime = (performance.now() - startTime) / 1000;

    const rate = Math.min(elapsedTime / GAP_RAMP_SECONDS, 1);
    currentGapProb = BASE_GAP_PROB + MAX_EXTRA_GAP_PROB * rate;

    updateTerrain(delta);

    if (player) {
      player.vy += player.gravity * delta;
      player.y += player.vy * delta;

      const centerX = player.x + player.width / 2;
      const g = getGroundInfoAtX(centerX);

      if (!g.isGap) {
        const gy = g.y - player.height;
        if (player.y >= gy) {
          player.y = gy;
          player.vy = 0;
          player.jumpCount = 0;
          player.onGround = true;
        }
      } else {
        if (player.y > canvas.height) return endGame();
      }
    }

    // spawn
    spawnFireTimer += delta * 1000;
    if (spawnFireTimer >= nextFireInterval) spawnFireball();

    spawnPoopTimer += delta * 1000;
    if (spawnPoopTimer >= nextPoopInterval) spawnPoop();

    // move
    fireballs.forEach((f) => (f.x -= f.speed * delta));
    poopItems.forEach((p) => (p.x -= p.speed * delta));

    // collision
    if (player) {
      const hit = getPlayerHitbox();

      for (const f of fireballs) {
        const w = f.width * 0.45;
        const h = f.height * 0.45;

      const fb = {
          x: f.x + w / 2,
          y: f.y + h / 2,
          width: f.width - w,
          height: f.height - h
        };

        if (rectOverlap(hit, fb)) return endGame();
      }

      for (let i = poopItems.length - 1; i >= 0; i--) {
        if (rectOverlap(hit, poopItems[i])) {
          poopItems.splice(i, 1);
          poopCount++;
          topLeftStatusEl.textContent = `回収うんこ：${poopCount}個`;
        }
      }
    }

    fireballs = fireballs.filter((f) => f.x + f.width > -80);
    poopItems = poopItems.filter((p) => p.x + p.width > -80);
  }

  // ---------- draw ----------
  function draw() {
    ctx.fillStyle = "#8fd4ff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const baseY = getGroundY();
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;

    for (const seg of terrain) {
      if (seg.type === "gap") {
        started = false;
        continue;
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
    }
    ctx.stroke();

    poopItems.forEach((p) => {
      if (poopImg.complete && poopImg.naturalWidth > 0) {
        ctx.drawImage(poopImg, p.x, p.y, p.width, p.height);
      }
    });

    fireballs.forEach((f) => {
      if (fireballImg.complete && fireballImg.naturalWidth > 0) {
        ctx.drawImage(fireballImg, f.x, f.y, f.width, f.height);
      }
    });

    if (player && playerImg.complete && playerImg.naturalWidth > 0) {
      ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
    }
  }

  // ---------- 30fps loop ----------
  let lastTime = 0;
  const FRAME = 1000 / 30;

  function loop(t) {
    if (!lastTime) lastTime = t;
    const elapsed = t - lastTime;

    if (elapsed >= FRAME) {
      update(Math.min(elapsed / 1000, 0.05));
      draw();
      lastTime = t;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- end ----------
  function endGame() {
    if (gameOver) return;
    gameOver = true;

    playAudio(seGameover, "se");

    let g = "";
    const c = poopCount;

    if (c <= 10) g = "wwww";
    else if (c <= 20) g = "称号「へたっぴ」";
    else if (c <= 30) g = "称号「まだまだへたっぴ」";
    else if (c <= 40) g = "称号「評価は普通」";
    else if (c <= 50) g = "称号「上手だ」";
    else if (c <= 60) g = "称号「うんこ収集家」";
    else if (c <= 70) g = "称号「やるやん」";
    else if (c <= 80) g = "称号「1人前なうんこ」";
    else if (c <= 90) g = "称号「立派なうんこ」";
    else if (c <= 99) g = "称号「あと一息」！";
    else g = "称号「うんこ大臣」";

    showMessage(g, "grade");
  }

  // ---------- 画面切り替え ----------
  document.getElementById("start-btn").addEventListener("click", () => {
    viewSelect.classList.remove("active");
    viewGame.classList.add("active");
    resetGame();
  });

  restartBtn.addEventListener("click", resetGame);
  document.getElementById("back-to-select").addEventListener("click", () => {
    viewSelect.classList.add("active");
    viewGame.classList.remove("active");
  });

  // 初期
  viewSelect.classList.add("active");
});
