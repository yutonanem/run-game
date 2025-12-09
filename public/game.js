// ====== うんこランゲーム（清掃員モードのみ・坂＆炎＆穴あり） ======
"use strict";

// ページの DOM が読み込まれてからゲームを初期化
window.addEventListener("DOMContentLoaded", () => {
  // ---------- 定数 ----------
  const BASE_JUMP_POWER = -520;
  const MAX_OBSTACLES = 6;
  const MAX_POOP = 12;
  const DIFFICULTY_MAX = 2.2;
  const TERRAIN_BASE_SPEED = 200; // 地面のスクロール速度

  // ---------- キャンバス ----------
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // 基準の地面ライン
  function getGroundY() {
    return canvas.height - 12;
  }

  // ---------- UI要素 ----------
  const viewSelect = document.getElementById("view-select");
  const viewGame = document.getElementById("view-game");
  const restartBtn = document.getElementById("restart-btn");
  const centerMessageEl = document.getElementById("center-message");
  const topLeftStatusEl = document.getElementById("top-left-status");

  const bottomLeftEl = document.getElementById("bottom-left");
  const bottomCenterEl = document.getElementById("bottom-center");
  const bottomRightEl = document.getElementById("bottom-right");

  // ---------- 画像 ----------
  const playerImg = new Image();
  playerImg.src = "cleaner.png";

  const poopImg = new Image();
  poopImg.src = "poop.png";

  const obstacleImg = new Image();
  obstacleImg.src = "obstacle_custom.png";

  const fireballImg = new Image();
  fireballImg.src = "fireball.png";

  // ---------- BGM / SE ----------
  const bgmGame = document.getElementById("bgm-game");
  const seJump = document.getElementById("se-jump");
  const seGameover = document.getElementById("se-gameover");

  function playAudio(a) {
    if (!a) return;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } catch (_) {}
  }

  // ---------- 汎用 ----------
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  function rectOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  // ---------- ゲーム状態 ----------
  let player;
  let obstacles = [];
  let poopItems = [];
  let terrainSegments = []; // 地面セグメント

  let difficulty = 1;
  let poopCount = 0;

  let gameStarted = false;
  let gameOver = false;

  let startTime = 0;
  let elapsedTime = 0;

  let spawnObstacleTimer = 0;
  let nextObstacleInterval = 0;

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

  // ---------- 地形（坂＆落とし穴） ----------
  function createTerrainSegment(startX, currentOffset) {
    const baseSize = player ? player.height : 50;
    const slopeMax = baseSize * 0.6;

    const minOffset = -slopeMax; // 少し上に上がる
    const maxOffset = 0; // これより下には行かない

    let type = "ground";
    let width;
    let startOffset = currentOffset;
    let endOffset = currentOffset;

    const r = Math.random();
    if (r < 0.46) {
      // フラット
      width = rand(baseSize * 1.2, baseSize * 1.8);
    } else if (r < 0.7) {
      // 登り坂
      width = rand(baseSize * 1.8, baseSize * 2.4);
      const delta = -rand(baseSize * 0.3, baseSize * 0.6);
      endOffset = clamp(currentOffset + delta, minOffset, maxOffset);
    } else if (r < 0.95) {
      // 下り坂
      width = rand(baseSize * 1.8, baseSize * 2.4);
      const delta = rand(baseSize * 0.3, baseSize * 0.6);
      endOffset = clamp(currentOffset + delta, minOffset, maxOffset);
    } else {
      // 落とし穴
      type = "gap";
      width = rand(baseSize * 0.9, baseSize * 1.5);
    }

    return { x: startX, width, type, startOffset, endOffset };
  }

  function initTerrain() {
    terrainSegments = [];
    let curOffset = 0;
    let x = -50;
    while (x < canvas.width + 200) {
      const seg = createTerrainSegment(x, curOffset);
      terrainSegments.push(seg);
      x += seg.width;
      if (seg.type !== "gap") curOffset = seg.endOffset;
    }
  }

  function getGroundInfoAtX(x) {
    const baseY = getGroundY();
    for (const seg of terrainSegments) {
      if (x >= seg.x && x <= seg.x + seg.width) {
        if (seg.type === "gap") {
          return { isGap: true, y: baseY + 9999 };
        }
        const t = seg.width > 0 ? (x - seg.x) / seg.width : 0;
        const offset = seg.startOffset + (seg.endOffset - seg.startOffset) * t;
        return { isGap: false, y: baseY + offset };
      }
    }
    return { isGap: false, y: baseY };
  }

  function updateTerrain(delta) {
    const speed = TERRAIN_BASE_SPEED * difficulty;

    terrainSegments.forEach((seg) => {
      seg.x -= speed * delta;
    });

    // 左に流れたものを捨てる
    while (
      terrainSegments.length &&
      terrainSegments[0].x + terrainSegments[0].width < -200
    ) {
      terrainSegments.shift();
    }

    // 右端を補充
    let curOffset = 0;
    if (terrainSegments.length > 0) {
      const last = terrainSegments[terrainSegments.length - 1];
      curOffset = last.endOffset;
    }
    let x =
      terrainSegments.length > 0
        ? terrainSegments[terrainSegments.length - 1].x +
          terrainSegments[terrainSegments.length - 1].width
        : -50;

    while (x < canvas.width + 200) {
      const seg = createTerrainSegment(x, curOffset);
      terrainSegments.push(seg);
      x += seg.width;
      if (seg.type !== "gap") curOffset = seg.endOffset;
    }
  }

  // 地面の影をなくして軽量化した描画
  function drawTerrain() {
    const baseY = getGroundY();

    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;
    ctx.beginPath();

    let started = false;
    terrainSegments.forEach((seg) => {
      if (seg.type === "gap") {
        started = false;
        return;
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
    });
    ctx.stroke();
  }

  // ---------- 障害物（ブロック＋炎） ----------
  function resetObstacleTimer() {
    nextObstacleInterval = rand(900, 1600);
    spawnObstacleTimer = 0;
  }

  function spawnObstacle() {
    if (obstacles.length >= MAX_OBSTACLES) return;

    const base = player.height;
    let width = base * rand(0.35, 0.5);
    let height = base * rand(0.35, 0.6);
    const spawnX = canvas.width + 20;

    const groundInfo = getGroundInfoAtX(spawnX);
    const groundYAtX = groundInfo.y;

    let y = groundYAtX - height;
    let speed = rand(180, 240) * difficulty;

    // 50% くらいで炎にする
    const isFireball = Math.random() < 0.5;
    if (isFireball) {
      const fireBase = base * 1.5;
      width = fireBase * 1.2;
      height = fireBase * 0.8;

      const mode = Math.random() < 0.5 ? 0 : 2; // 下段 or 上段
      if (mode === 0) {
        y = groundYAtX - height - 4;
      } else {
        y = groundYAtX - height - player.height * 1.1;
      }
      speed *= 1.25;
    }

    obstacles.push({
      x: spawnX,
      y,
      width,
      height,
      speed,
      type: isFireball ? "fireball" : "block"
    });

    resetObstacleTimer();
  }

  // ---------- うんこ ----------
  function resetPoopTimer() {
    // 出現頻度はやや控えめ
    nextPoopInterval = rand(675, 1200);
    spawnPoopTimer = 0;
  }

  function spawnPoop() {
    if (poopItems.length >= MAX_POOP) return;

    const size = player.height * 0.5;
    const spawnX = canvas.width + 20;
    const groundInfo = getGroundInfoAtX(spawnX);
    const groundYAtX = groundInfo.y;

    poopItems.push({
      x: spawnX,
      y: groundYAtX - size,
      width: size,
      height: size,
      speed: 200 * difficulty
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

    if (mode === "fail") centerMessageEl.classList.add("center-message--fail");
    if (mode === "grade") centerMessageEl.classList.add("center-message--grade");
  }

  function hideMessage() {
    showMessage("");
  }

  // ---------- ゲーム初期化 ----------
  function resetGame() {
    resizeCanvas();
    initPlayer();
    initTerrain();

    obstacles = [];
    poopItems = [];
    poopCount = 0;

    difficulty = 1;
    gameStarted = false;
    gameOver = false;

    elapsedTime = 0;
    spawnObstacleTimer = 0;
    spawnPoopTimer = 0;

    resetObstacleTimer();
    resetPoopTimer();

    topLeftStatusEl.textContent = "回収うんこ：0個";
    bottomLeftEl.textContent = "";
    bottomCenterEl.textContent = "";
    bottomRightEl.textContent = "";
    showMessage("うんこを拾いながら街を爆走！", null);
  }

  function startGame() {
    gameStarted = true;
    startTime = performance.now();
    playAudio(bgmGame);
    hideMessage();
  }

  // ---------- 入力 ----------
  function jump() {
    if (gameOver) return;

    if (!gameStarted) {
      startGame();
    }

    if (player && player.jumpCount < player.maxJumps) {
      player.vy = player.jumpPower;
      player.onGround = false;
      player.jumpCount++;
      playAudio(seJump);
    }
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      jump();
    }
  });

  canvas.addEventListener(
    "pointerdown",
    () => {
      jump();
    },
    { passive: true }
  );

  // ---------- 更新 ----------
  function update(delta) {
    if (!gameStarted || gameOver) return;

    const now = performance.now();
    elapsedTime = (now - startTime) / 1000;

    difficulty = Math.min(1 + elapsedTime * 0.012, DIFFICULTY_MAX);

    // 地形のスクロール
    updateTerrain(delta);

    // プレイヤー物理
    player.vy += player.gravity * delta;
    player.y += player.vy * delta;

    // 足元の地面 or 落とし穴
    const centerX = player.x + player.width / 2;
    const groundInfo = getGroundInfoAtX(centerX);

    if (!groundInfo.isGap) {
      const gy = groundInfo.y - player.height;
      if (player.y >= gy) {
        player.y = gy;
        player.vy = 0;
        if (!player.onGround) {
          player.onGround = true;
          player.jumpCount = 0;
        }
      }
    } else {
      // 穴の中に落ちて画面外に出たらゲームオーバー
      if (player.y > canvas.height) {
        endGame();
        return;
      }
    }

    // スポーン
    spawnObstacleTimer += delta * 1000;
    if (spawnObstacleTimer >= nextObstacleInterval) spawnObstacle();

    spawnPoopTimer += delta * 1000;
    if (spawnPoopTimer >= nextPoopInterval) spawnPoop();

    // 移動
    obstacles.forEach((o) => {
      o.x -= o.speed * delta;
    });
    poopItems.forEach((p) => {
      p.x -= p.speed * delta;
    });

    // 当たり判定
    const hit = getPlayerHitbox();

    for (const o of obstacles) {
      let obb = o;

      // 炎のときだけ当たり判定を小さくする
      if (o.type === "fireball") {
        const shrinkW = o.width * 0.45;
        const shrinkH = o.height * 0.45;

        obb = {
          x: o.x + shrinkW / 2,
          y: o.y + shrinkH / 2,
          width: o.width - shrinkW,
          height: o.height - shrinkH
        };
      }

      if (rectOverlap(hit, obb)) {
        endGame();
        return;
      }
    }

    for (let i = poopItems.length - 1; i >= 0; i--) {
      if (rectOverlap(hit, poopItems[i])) {
        poopItems.splice(i, 1);
        poopCount++;
        topLeftStatusEl.textContent = `回収うんこ：${poopCount}個`;
      }
    }

    // クリーンアップ
    obstacles = obstacles.filter((o) => o.x + o.width > -80);
    poopItems = poopItems.filter((p) => p.x + p.width > -80);
  }

  // ---------- 描画 ----------
  function draw() {
    ctx.fillStyle = "#8fd4ff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 地形
    drawTerrain();

    // うんこ
    poopItems.forEach((p) => {
      if (poopImg.complete && poopImg.naturalWidth > 0) {
        ctx.drawImage(poopImg, p.x, p.y, p.width, p.height);
      } else {
        ctx.fillStyle = "#8d6e63";
        ctx.fillRect(p.x, p.y, p.width, p.height);
      }
    });

    // 障害物（炎の回転はやめて軽量化）
    obstacles.forEach((o) => {
      if (
        o.type === "fireball" &&
        fireballImg.complete &&
        fireballImg.naturalWidth > 0
      ) {
        ctx.drawImage(fireballImg, o.x, o.y, o.width, o.height);
      } else if (obstacleImg.complete && obstacleImg.naturalWidth > 0) {
        ctx.drawImage(obstacleImg, o.x, o.y, o.width, o.height);
      } else {
        ctx.fillStyle = "#607d8b";
        ctx.fillRect(o.x, o.y, o.width, o.height);
      }
    });

    // プレイヤー
    if (player) {
      if (playerImg.complete && playerImg.naturalWidth > 0) {
        ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
      } else {
        ctx.fillStyle = "#ffd400";
        ctx.fillRect(player.x, player.y, player.width, player.height);
      }
    }
  }

  // ---------- ループ（30fpsに制限しつつスピード維持） ----------
  let lastFrameTime = 0;
  const FRAME_INTERVAL = 1000 / 30; // 30fps

  function loop(timestamp) {
    if (!lastFrameTime) {
      lastFrameTime = timestamp;
    }

    const elapsed = timestamp - lastFrameTime;

    if (elapsed >= FRAME_INTERVAL) {
      const delta = Math.min(elapsed / 1000, 0.05); // 最大0.05秒分まで
      update(delta);
      draw();
      lastFrameTime = timestamp;
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- ゲーム終了 ----------
  function endGame() {
    if (gameOver) return;
    gameOver = true;

    playAudio(seGameover);

    const count = poopCount;
    let grade = "";

    if (count <= 10) grade = "wwww";
    else if (count <= 20) grade = "へたっぴ";
    else if (count <= 30) grade = "まだまだへたっぴ";
    else if (count <= 40) grade = "評価は普通";
    else if (count <= 50) grade = "上手だ";
    else if (count <= 60) grade = "うんこ収集家";
    else if (count <= 70) grade = "やるやん";
    else if (count <= 80) grade = "1人前なうんこ";
    else if (count <= 90) grade = "立派なうんこ";
    else if (count <= 99) grade = "あと一息！";
    else grade = "うんこ大臣";

    showMessage(grade, "grade");

    bottomCenterEl.textContent = "";
    bottomRightEl.textContent = `回収うんこ：${poopCount}個`;
  }

  // ---------- 画面切り替え ----------
  function showSelect() {
    viewSelect.classList.add("active");
    viewGame.classList.remove("active");
  }

  function showGame() {
    viewSelect.classList.remove("active");
    viewGame.classList.add("active");
    resetGame();
  }

  // ボタン
  const startBtn = document.getElementById("start-btn");
  if (startBtn) {
    startBtn.addEventListener("click", showGame);
  }
  restartBtn.addEventListener("click", resetGame);
  document
    .getElementById("back-to-select")
    .addEventListener("click", showSelect);

  // 初期表示
  showSelect();
});
