// ====== Poop Runner (settings: name + country, global ranking) ======
"use strict";

window.addEventListener("DOMContentLoaded", () => {
  // ---------- constants ----------
  const BASE_JUMP_POWER = -520;

  const MAX_FIREBALLS = 2;
  const MAX_POOP = 6;

  const TERRAIN_BASE_SPEED = 140;

  const BASE_GAP_PROB = 0.3;
  const MAX_EXTRA_GAP_PROB = 0.3;
  const GAP_RAMP_SECONDS = 40;

  const BONUS_SEGMENT_PROB = 0.15;

  const ENABLE_BGM = true;
  const ENABLE_SE = true;

  // 音量設定
  const VOLUME = {
    // BGM
    bgmHome: 0.4, // タイトル
    bgmGame: 0.4, // プレイ中
    bgmResult: 0.4, // 結果画面

    // SE
    seJump: 0.7,
    seGameover: 0.8,
    seReverse: 0.9
  };

  const CANVAS_SCALE = 0.85;

  const BG_FAR_SPEED = TERRAIN_BASE_SPEED * 0.15;
  const BG_NEAR_SPEED = TERRAIN_BASE_SPEED * 0.4;

  const SPEED_LINE_COUNT = 8;
  const MAX_PARTICLES = 40;

  const FIRE_SWAY_SPEED = 4.0;
  const FIRE_SWAY_AMPLITUDE_RATIO = 0.15;

  const BEST_RUNS_KEY = "poopRunnerBestRuns";
  const BEST_RUNS_LIMIT = 10;

  const PROFILE_KEY = "poopRunnerProfileV2"; // V2: name + country だけ

  // 偽うんち・デバフ関連
  const FAKE_DEBUFF_DURATION = 2.5; // 偽うんち効果の継続秒数
  const FAKE_POOP_PROB = 0.2; // 偽うんち出現確率（20%）

  // リバースアイテム関連
  const REVERSE_ITEM_PROB = 0.15; // うんちとは別に一定確率で流す
  const REVERSE_DURATION = 5.0; // 逆さま時間
  const REVERSE_FLASH_TIME = 0.18; // 白フラッシュの時間

  // 地面を少し上げるオフセット（px）
  const GROUND_OFFSET = 60;

  // 主要な国リスト（value = 表示名）
  const COUNTRY_LIST = [
    "Japan",
    "United States",
    "United Kingdom",
    "Canada",
    "Australia",
    "New Zealand",

    "China",
    "Korea",
    "Taiwan",
    "Hong Kong",
    "Singapore",
    "Thailand",
    "Vietnam",
    "Philippines",
    "Indonesia",
    "Malaysia",
    "India",

    "Germany",
    "France",
    "Italy",
    "Spain",
    "Netherlands",
    "Sweden",
    "Norway",
    "Finland",
    "Denmark",
    "Poland",
    "Russia",

    "Brazil",
    "Mexico",
    "Argentina",
    "Chile",
    "Colombia",

    "Turkey",
    "Israel",
    "Saudi Arabia",
    "United Arab Emirates",
    "Egypt",
    "South Africa",
    "Nigeria",

    "Other"
  ];

  // サーバー API エンドポイント
  const POOP_API_SCORE = "/api/poop-score";
  const POOP_API_RANKING = "/api/poop-ranking";

  // ---------- canvas ----------
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width * CANVAS_SCALE;
    canvas.height = r.height * CANVAS_SCALE;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function getGroundY() {
    return canvas.height - 12 - GROUND_OFFSET;
  }

  // ---------- UI ----------
  const viewSelect = document.getElementById("view-select");
  const viewGame = document.getElementById("view-game");
  const viewResult = document.getElementById("view-result");

  const centerMessageEl = document.getElementById("center-message");
  const topLeftStatusEl = document.getElementById("top-left-status");

  const startBtn = document.getElementById("start-btn");
  const backToSelectBtn = document.getElementById("back-to-select");
  const backToSelectResultBtn = document.getElementById(
    "back-to-select-result"
  );
  const resultRestartBtn = document.getElementById("result-restart-btn");

  // result elements
  const resultRankEl = document.getElementById("result-rank");
  const resultLabelEl = document.getElementById("result-label");
  const resultScoreEl = document.getElementById("result-score");
  const resultBestListEl = document.getElementById("result-best-list");

  // settings modal
  const settingsBtn = document.getElementById("settings-btn");
  const settingsModal = document.getElementById("settings-modal");
  const settingsSaveBtn = document.getElementById("settings-save");
  const settingsCancelBtn = document.getElementById("settings-cancel");
  const settingNameInput = document.getElementById("setting-name");
  const settingCountrySelect = document.getElementById("setting-country");

  const transitionOverlay = document.getElementById("transition-overlay");

  // ---------- images ----------
  const playerImg = new Image();
  playerImg.src = "cleaner.png";

  const poopImg = new Image();
  poopImg.src = "poop.png";

  const fireballImg = new Image();
  fireballImg.src = "fireball.png";

  // ---------- audio ----------
  const bgmHome = document.getElementById("bgm-home");
  const bgmGame = document.getElementById("bgm-game");
  const bgmResult = document.getElementById("bgm-result");
  const seJump = document.getElementById("se-jump");
  const seGameover = document.getElementById("se-gameover");
  const seReverse = document.getElementById("se-reverse");

  // 初期ボリューム
  if (bgmHome) bgmHome.volume = VOLUME.bgmHome;
  if (bgmGame) bgmGame.volume = VOLUME.bgmGame;
  if (bgmResult) bgmResult.volume = VOLUME.bgmResult;
  if (seJump) seJump.volume = VOLUME.seJump;
  if (seGameover) seGameover.volume = VOLUME.seGameover;
  if (seReverse) seReverse.volume = VOLUME.seReverse;

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

  function stopAudio(a) {
    if (!a) return;
    try {
      a.pause();
      a.currentTime = 0;
    } catch {}
  }

  // ---------- utils ----------
  const rand = (a, b) => Math.random() * (b - a) + a;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const rectOverlap = (a, b) =>
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;

  function loadBestRuns() {
    try {
      const raw = localStorage.getItem(BEST_RUNS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveBestRuns(list) {
    try {
      localStorage.setItem(BEST_RUNS_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return null;
      return obj;
    } catch {
      return null;
    }
  }

  function saveProfile(profile) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {}
  }

  // プロフィールから「表示名」を作る: "name#country"
  function getDisplayNameFromProfile(p) {
    const name =
      typeof p?.name === "string" && p.name.trim()
        ? p.name.trim()
        : "Player";
    const country =
      typeof p?.country === "string" && p.country.trim()
        ? p.country.trim()
        : "";
    return country ? `${name}#${country}` : name;
  }

  // HTML エスケープ（ユーザー名表示用）
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return ch;
      }
    });
  }

  // ---------- state ----------
  let player;
  let fireballs = [];
  let poopItems = []; // 通常 / 偽 / リバースの3種類を含む
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

  let bgFarOffset = 0;
  let bgNearOffset = 0;

  let speedLines = [];
  let particles = [];

  // 偽うんちの画面デバフ用
  let fakeDebuffTimer = 0;

  // リバース状態
  // phase: "off" | "flashIn" | "active" | "flashOut"
  let reversePhase = "off";
  let reverseTimer = 0; // active の残り時間
  let reverseFlashTimer = 0; // flash の残り時間

  // うんち取得時のフローティングテキスト
  let floatingTexts = [];

  let profile = loadProfile() || { name: "Player", country: "" };

  // 国セレクトボックスの初期化
  function initCountryOptions() {
    if (!settingCountrySelect) return;

    // 一旦クリア
    settingCountrySelect.innerHTML = "";

    // プレースホルダー
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select your country";
    settingCountrySelect.appendChild(placeholder);

    // 定義済みリストから追加
    COUNTRY_LIST.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      settingCountrySelect.appendChild(opt);
    });

    // 既に保存されている国がリスト外だった場合も選択できるようにする
    if (profile?.country && !COUNTRY_LIST.includes(profile.country)) {
      const opt = document.createElement("option");
      opt.value = profile.country;
      opt.textContent = profile.country;
      settingCountrySelect.appendChild(opt);
    }
  }

  initCountryOptions();

  // ====== サーバー通信（世界ランキング） ======

  async function sendScoreToServer(run, displayName) {
    try {
      await fetch(POOP_API_SCORE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: run.score,
          rank: run.rank,
          label: run.label,
          name: displayName // "yuto#Japan"
        })
      });
    } catch (err) {
      console.error("Failed to send score:", err);
    }
  }

  async function fetchLeaderboardFromServer() {
    try {
      const res = await fetch(`${POOP_API_RANKING}?limit=${BEST_RUNS_LIMIT}`);
      if (!res.ok) throw new Error("bad status");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
      return loadBestRuns().slice(0, BEST_RUNS_LIMIT);
    }
  }

  // ---------- player ----------
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

  // ---------- terrain ----------
  function createTerrainSegment(startX, offset, lastType) {
    const base = player ? player.height : 50;
    const slopeMax = base * 0.6;

    const widthFlat = rand(base * 1.0, base * 1.4);
    const widthSlope = rand(base * 0.7, base * 1.0);
    const widthGap = rand(base * 0.8, base * 1.3);

    let type = "ground";
    let width = widthFlat;
    let startOffset = offset;
    let endOffset = offset;
    let bonus = false;

    const gapProb = currentGapProb;
    const flatProb = 0.05;
    const slopeProb = 1 - flatProb - gapProb;
    const upProb = slopeProb / 2;
    const downProb = slopeProb - upProb;

    const r = Math.random();

    if (r < flatProb) {
      width = widthFlat;
    } else if (r < flatProb + upProb) {
      width = widthSlope;
      endOffset = clamp(offset - rand(base * 0.3, base * 0.6), -slopeMax, 0);
    } else if (r < flatProb + upProb + downProb) {
      width = widthSlope;
      endOffset = clamp(offset + rand(base * 0.3, base * 0.6), -slopeMax, 0);
    } else {
      type = "gap";
      width = widthGap;
    }

    if (lastType === "gap" && type === "gap") {
      type = "ground";
      width = widthFlat;
      startOffset = offset;
      endOffset = offset;
    }

    if (type !== "gap" && Math.random() < BONUS_SEGMENT_PROB) {
      bonus = true;
    }

    return { x: startX, width, type, startOffset, endOffset, bonus };
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
          return { isGap: true, y: baseY + 9999, bonus: false };
        }
        const t = (x - seg.x) / seg.width;
        const yOffset = seg.startOffset + (seg.endOffset - seg.startOffset) * t;
        return { isGap: false, y: baseY + yOffset, bonus: !!seg.bonus };
      }
    }
    return { isGap: false, y: baseY, bonus: false };
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

  // ---------- fireballs ----------
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
    let baseY = ground.y - height;

    if (Math.random() < 0.35) {
      baseY -= base * 1.2;
    }

    const speed = rand(220, 300) * 0.9;
    const amplitude = height * FIRE_SWAY_AMPLITUDE_RATIO;

    fireballs.push({
      x: spawnX,
      y: baseY,
      baseY,
      width,
      height,
      speed,
      phase: Math.random() * Math.PI * 2,
      amplitude
    });
    resetFireTimer();
  }

  // ---------- poops & reverse items ----------
  function resetPoopTimer() {
    nextPoopInterval = rand(1500, 2600);
    spawnPoopTimer = 0;
  }

  function spawnPoopOrReverse() {
    if (poopItems.length >= MAX_POOP) return;

    const size = player.height * 1.0;
    const spawnX = canvas.width + 20;
    const ground = getGroundInfoAtX(spawnX);

    // ベースは「通常うんち」または「偽うんち」
    const isFake = Math.random() < FAKE_POOP_PROB;
    let isReverse = false;

    // 別枠でリバースアイテムを稀に出す
    if (Math.random() < REVERSE_ITEM_PROB) {
      isReverse = true;
    }

    poopItems.push({
      x: spawnX,
      y: ground.y - size,
      width: size,
      height: size,
      speed: 200 * 0.8,
      isBonus: ground.bonus,
      isFake,
      isReverse
    });

    resetPoopTimer();
  }

  // ---------- speed lines ----------
  function initSpeedLines() {
    speedLines = [];
    for (let i = 0; i < SPEED_LINE_COUNT; i++) {
      const len = rand(canvas.height * 0.05, canvas.height * 0.15);
      speedLines.push({
        x: rand(0, canvas.width),
        y: rand(0, canvas.height),
        length: len,
        speed: rand(300, 600)
      });
    }
  }

  function updateSpeedLines(delta) {
    speedLines.forEach((l) => {
      l.x -= l.speed * delta;
      if (l.x + 2 < 0) {
        l.x = canvas.width + rand(0, canvas.width * 0.3);
        l.y = rand(0, canvas.height);
        l.length = rand(canvas.height * 0.05, canvas.height * 0.15);
      }
    });
  }

  function drawSpeedLines() {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const l of speedLines) {
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x, l.y + l.length);
    }
    ctx.stroke();
  }

  // ---------- particles ----------
  function spawnParticles(type) {
    if (!player) return;
    const count = 5;
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_PARTICLES) break;

      const baseX =
        player.x + player.width * 0.3 + Math.random() * player.width * 0.4;
      const baseY = player.y + player.height;

      let vyBase;
      if (type === "jump") {
        vyBase = rand(10, 40);
      } else {
        vyBase = rand(-80, -30);
      }

      particles.push({
        x: baseX,
        y: baseY,
        vx: rand(-40, 40),
        vy: vyBase,
        life: 0,
        maxLife: rand(0.25, 0.45),
        size: rand(2, 4),
        bad: false
      });
    }
  }

  function updateParticles(delta) {
    const gravity = 300;
    particles.forEach((p) => {
      p.life += delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += gravity * delta;
    });
    particles = particles.filter((p) => p.life < p.maxLife);
  }

  function drawParticles() {
    ctx.save();
    particles.forEach((p) => {
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      if (p.bad) {
        ctx.fillStyle = "rgba(120,80,0,0.9)";
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
      }
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.restore();
  }

  // ---------- poop collect effect ----------
  function spawnPoopCollectEffect(x, y, addScore) {
    const count = 7;
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_PARTICLES) break;
      particles.push({
        x: x + rand(-5, 5),
        y: y + rand(-5, 5),
        vx: rand(-60, 60),
        vy: rand(-120, -40),
        life: 0,
        maxLife: rand(0.25, 0.4),
        size: rand(2, 4),
        bad: false
      });
    }

    floatingTexts.push({
      x,
      y,
      text: `+${addScore}`,
      life: 0,
      maxLife: 0.6
    });

    if (topLeftStatusEl) {
      topLeftStatusEl.classList.remove("hud-pop");
      void topLeftStatusEl.offsetWidth;
      topLeftStatusEl.classList.add("hud-pop");
    }
  }

  function updateFloatingTexts(delta) {
    floatingTexts.forEach((f) => {
      f.life += delta;
      f.y -= 40 * delta;
    });
    floatingTexts = floatingTexts.filter((f) => f.life < f.maxLife);
  }

  function drawFloatingTexts() {
    if (!floatingTexts.length) return;
    ctx.save();
    ctx.font = `${Math.max(16, canvas.height * 0.035)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    floatingTexts.forEach((f) => {
      const t = f.life / f.maxLife;
      const alpha = 1 - t;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.restore();
  }

  // ---------- background (parallax) ----------
  function updateBackground(delta) {
    bgFarOffset -= BG_FAR_SPEED * delta;
    bgNearOffset -= BG_NEAR_SPEED * delta;
  }

  function drawBackgroundLayers() {
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "#8fd4ff";
    ctx.fillRect(0, 0, w, h);

    const stepFar = 260;
    const baseYFar = h * 0.55;
    const offsetFar = ((bgFarOffset % stepFar) + stepFar) % stepFar;
    ctx.fillStyle = "#c5e1ff";
    const peakH = 60;

    for (let x = -stepFar + offsetFar; x < w + stepFar; x += stepFar) {
      ctx.beginPath();
      ctx.moveTo(x, baseYFar);
      ctx.lineTo(x + stepFar * 0.5, baseYFar - peakH);
      ctx.lineTo(x + stepFar, baseYFar);
      ctx.closePath();
      ctx.fill();
    }

    const stepNear = 180;
    const baseYNear = h * 0.7;
    const offsetNear = ((bgNearOffset % stepNear) + stepNear) % stepNear;
    const patternHeights = [60, 80, 50, 90];

    ctx.fillStyle = "#b39ddb";
    let idx = 0;
    for (let x = -stepNear + offsetNear; x < w + stepNear; x += stepNear) {
      const bw = stepNear * 0.6;
      const bh = patternHeights[idx % patternHeights.length];
      ctx.fillRect(x, baseYNear - bh, bw, bh);
      idx++;
    }
  }

  // ---------- messages ----------
  function showMessage(text) {
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
  }

  // ---------- result view ----------
  function updateResultView(rank, label, score, topRuns) {
    resultRankEl.textContent = rank;
    resultLabelEl.textContent = label;
    resultScoreEl.textContent = `Poops collected: ${score}`;

    if (!topRuns || topRuns.length === 0) {
      resultBestListEl.innerHTML =
        '<li class="best-empty">No best runs yet. Try again!</li>';
      return;
    }

    const nameFallback = "Anonymous";
    const myDisplayName = getDisplayNameFromProfile(profile);

    const sliced = topRuns.slice(0, 3);

    resultBestListEl.innerHTML = sliced
      .map((r, i) => {
        const rawName = r.name || nameFallback;
        const displayName = escapeHtml(rawName);
        const displayScore = r.score ?? 0;
        const displayRank = r.rank || "?";

        const isSelf = rawName === myDisplayName;

        return `
        <li class="best-item${isSelf ? " best-item-self" : ""}">
          <span class="best-rank-badge">#${i + 1}</span>
          <div class="best-name">${displayName}</div>
          <div class="best-score-wrap">
            <span class="best-score">${displayScore}</span>
            <span class="best-rank-text">${displayRank}</span>
          </div>
        </li>
      `;
      })
      .join("");
  }

  function showOnlyView(targetView) {
    [viewSelect, viewGame, viewResult].forEach((v) =>
      v.classList.remove("active")
    );
    targetView.classList.add("active");
  }

  // 紙吹雪
  function spawnConfetti(count = 60) {
    const colors = [
      "#ff5252",
      "#ffb300",
      "#ffd740",
      "#69f0ae",
      "#40c4ff",
      "#e040fb"
    ];
    for (let i = 0; i < count; i++) {
      const div = document.createElement("div");
      div.className = "confetti";
      div.style.left = Math.random() * 100 + "vw";
      div.style.backgroundColor =
        colors[Math.floor(Math.random() * colors.length)];
      div.style.animationDelay = Math.random() * 0.4 + "s";
      div.style.transform = `translateY(0) rotateZ(${Math.random() * 360}deg)`;
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 2000);
    }
  }

  // ゲーム終了 → 結果画面へのトランジション
  function playTransitionToResult(callback) {
    transitionOverlay.classList.remove("hidden");
    transitionOverlay.classList.add("show");

    setTimeout(() => {
      transitionOverlay.classList.add("hidden");
      transitionOverlay.classList.remove("show");
      callback();
    }, 650);
  }

  // ---------- reset / start ----------
  function resetGame() {
    resizeCanvas();
    initPlayer();
    initTerrain();

    fireballs = [];
    poopItems = [];
    particles = [];
    speedLines = [];
    floatingTexts = [];
    poopCount = 0;

    gameStarted = false;
    gameOver = false;

    elapsedTime = 0;
    currentGapProb = BASE_GAP_PROB;

    bgFarOffset = 0;
    bgNearOffset = 0;

    fakeDebuffTimer = 0;
    reversePhase = "off";
    reverseTimer = 0;
    reverseFlashTimer = 0;

    resetFireTimer();
    resetPoopTimer();
    initSpeedLines();

    topLeftStatusEl.textContent = "Poops: 0";
    showMessage("Dash through the city and collect poop!");
  }

  function startGame() {
    gameStarted = true;
    startTime = performance.now();
    showMessage("");
  }

  // ---------- input ----------
  function jump() {
    if (gameOver) return;
    if (!gameStarted) startGame();

    if (player && player.jumpCount < player.maxJumps) {
      player.vy = player.jumpPower;
      const wasOnGround = player.onGround;
      player.onGround = false;
      player.jumpCount++;
      playAudio(seJump, "se");
      if (wasOnGround) spawnParticles("jump");
    }
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      jump();
    }
  });
  canvas.addEventListener("pointerdown", jump);

  // ---------- update ----------
  function updateReverseState(delta) {
    if (reversePhase === "flashIn" || reversePhase === "flashOut") {
      reverseFlashTimer = Math.max(0, reverseFlashTimer - delta);
      if (reverseFlashTimer <= 0) {
        if (reversePhase === "flashIn") {
          // フラッシュ終了 → 画面反転スタート
          reversePhase = "active";
          reverseTimer = REVERSE_DURATION;
          showMessage("Everything feels upside down...");
          setTimeout(() => {
            if (!gameOver && reversePhase === "active") {
              showMessage("");
            }
          }, 800);
        } else if (reversePhase === "flashOut") {
          // フラッシュ終了 → 完全終了
          reversePhase = "off";
        }
      }
    } else if (reversePhase === "active") {
      reverseTimer = Math.max(0, reverseTimer - delta);
      if (reverseTimer <= 0) {
        // 反転終了 → 戻る前のフラッシュ
        reversePhase = "flashOut";
        reverseFlashTimer = REVERSE_FLASH_TIME;
        playAudio(seReverse, "se");
      }
    }
  }

  function update(delta) {
    if (!gameStarted || gameOver) return;

    elapsedTime = (performance.now() - startTime) / 1000;

    const rate = Math.min(elapsedTime / GAP_RAMP_SECONDS, 1);
    currentGapProb = BASE_GAP_PROB + MAX_EXTRA_GAP_PROB * rate;

    updateTerrain(delta);
    updateBackground(delta);
    updateSpeedLines(delta);
    updateParticles(delta);
    updateFloatingTexts(delta);
    updateReverseState(delta);

    if (fakeDebuffTimer > 0) {
      fakeDebuffTimer = Math.max(0, fakeDebuffTimer - delta);
    }

    if (player) {
      const wasOnGround = player.onGround;

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
          if (!wasOnGround) spawnParticles("land");
        }
      } else {
        player.onGround = false;
        if (player.y > canvas.height) return endGame();
      }
    }

    spawnFireTimer += delta * 1000;
    if (spawnFireTimer >= nextFireInterval) spawnFireball();

    spawnPoopTimer += delta * 1000;
    if (spawnPoopTimer >= nextPoopInterval) spawnPoopOrReverse();

    fireballs.forEach((f) => {
      f.x -= f.speed * delta;
      f.phase += FIRE_SWAY_SPEED * delta;
      f.y = f.baseY + Math.sin(f.phase) * f.amplitude;
    });

    poopItems.forEach((p) => {
      p.x -= p.speed * delta;
    });

    if (player) {
      const hit = getPlayerHitbox();

      // ファイアボール衝突
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

      // Poop / 偽うんち / リバース衝突
      for (let i = poopItems.length - 1; i >= 0; i--) {
        if (rectOverlap(hit, poopItems[i])) {
          const item = poopItems[i];
          poopItems.splice(i, 1);

          const cx = item.x + item.width / 2;
          const cy = item.y + item.height / 2;

          if (item.isReverse) {
            // すでにリバース中なら無視（延長しない）
            if (reversePhase === "off") {
              reversePhase = "flashIn";
              reverseFlashTimer = REVERSE_FLASH_TIME;
              playAudio(seReverse, "se");
            }
          } else if (item.isFake) {
            // 偽うんち：スコアは増えず画面デバフ
            fakeDebuffTimer = FAKE_DEBUFF_DURATION;

            for (let j = 0; j < 10; j++) {
              if (particles.length >= MAX_PARTICLES) break;
              particles.push({
                x: cx,
                y: cy,
                vx: rand(-80, 80),
                vy: rand(-40, -10),
                life: 0,
                maxLife: rand(0.3, 0.5),
                size: rand(3, 5),
                bad: true
              });
            }

            showMessage("Eww... That was a fake poop!");
            setTimeout(() => {
              if (!gameOver && fakeDebuffTimer > 0) {
                showMessage("");
              }
            }, 600);
          } else {
            // 通常 / ボーナスうんち
            const add = item.isBonus ? 2 : 1;
            poopCount += add;

            topLeftStatusEl.textContent = `Poops: ${poopCount}`;

            spawnPoopCollectEffect(cx, cy, add);
          }
        }
      }
    }

    fireballs = fireballs.filter((f) => f.x + f.width > -80);
    poopItems = poopItems.filter((p) => p.x + p.width > -80);
  }

  // ---------- draw ----------
  function draw() {
    ctx.save();

    const isReversed = reversePhase === "active";

    if (isReversed) {
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
    }

    drawBackgroundLayers();

    const baseY = getGroundY();

    const grad = ctx.createLinearGradient(0, baseY - 40, 0, canvas.height);
    grad.addColorStop(0, "#ffe0b2");
    grad.addColorStop(1, "#ffb74d");
    ctx.fillStyle = grad;
    ctx.fillRect(0, baseY - 40, canvas.width, canvas.height - (baseY - 40));

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#666";
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

    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (const seg of terrain) {
      if (seg.type !== "gap") continue;
      const x1 = seg.x;
      const x2 = seg.x + seg.width;
      ctx.fillRect(x1, baseY, x2 - x1, canvas.height - baseY);
    }

    // Poop / 偽うんち / リバースアイテム
    poopItems.forEach((p) => {
      const cx = p.x + p.width / 2;
      const cy = p.y + p.height / 2;

      if (p.isReverse) {
        // リバースアイテム：白い丸に↻マーク
        const radius = (p.width * 0.6) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 8;
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = "#333";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.6, Math.PI * 0.1, Math.PI * 1.7);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + radius * 0.55, cy - radius * 0.1);
        ctx.lineTo(cx + radius * 0.9, cy - radius * 0.25);
        ctx.lineTo(cx + radius * 0.6, cy - radius * 0.4);
        ctx.closePath();
        ctx.fillStyle = "#333";
        ctx.fill();

        ctx.restore();
      } else if (p.isFake) {
        // 偽うんち：紫の丸だけ
        const radius = (p.width * 0.7) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = "rgba(150, 80, 200, 0.9)";
        ctx.shadowColor = "rgba(80,0,120,0.5)";
        ctx.shadowBlur = 10;
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // 通常うんち：従来どおり画像
        if (poopImg.complete && poopImg.naturalWidth > 0) {
          ctx.drawImage(poopImg, p.x, p.y, p.width, p.height);
        }
      }
    });

    fireballs.forEach((f) => {
      if (fireballImg.complete && fireballImg.naturalWidth > 0) {
        ctx.drawImage(fireballImg, f.x, f.y, f.width, f.height);
      }
    });

    drawParticles();
    drawSpeedLines();
    drawFloatingTexts();

    if (player && playerImg.complete && playerImg.naturalWidth > 0) {
      ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
    }

    // 偽うんちデバフ：画面をほとんど見えなくするオーバーレイ
    if (fakeDebuffTimer > 0) {
      const t = fakeDebuffTimer / FAKE_DEBUFF_DURATION;
      ctx.save();

      ctx.globalAlpha = 0.8 * t;
      ctx.fillStyle = "rgba(70, 40, 0, 0.98)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalAlpha = 0.18 * t;
      ctx.fillStyle = "#ffffff";
      const lineCount = 20;
      for (let i = 0; i < lineCount; i++) {
        const y = rand(0, canvas.height);
        const h = rand(2, 5);
        ctx.fillRect(0, y, canvas.width, h);
      }

      ctx.restore();
    }

    // リバースの白フラッシュ（反転の前後）
    if (reversePhase === "flashIn" || reversePhase === "flashOut") {
      const t = clamp(reverseFlashTimer / REVERSE_FLASH_TIME, 0, 1);
      ctx.save();
      ctx.globalAlpha = t;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    ctx.restore(); // 反転解除
  }

  // ---------- loop ----------
  let lastTime = 0;
  const FRAME = 1000 / 30;

  function loop(t) {
    if (!lastTime) lastTime = t;
    const elapsed = t - lastTime;

    if (elapsed >= FRAME) {
      const delta = Math.min(elapsed / 1000, 0.05);
      update(delta);
      draw();
      lastTime = t;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- rank evaluation ----------
  function evaluateRank(c) {
    let rank = "F";
    let label = "lolol";

    if (c <= 10) {
      rank = "F";
      label = "lolol";
    } else if (c <= 20) {
      rank = "D";
      label = "Clumsy Collector";
    } else if (c <= 30) {
      rank = "C";
      label = "Still Learning";
    } else if (c <= 40) {
      rank = "C+";
      label = "Not Bad";
    } else if (c <= 50) {
      rank = "B";
      label = "Pretty Good";
    } else if (c <= 60) {
      rank = "B+";
      label = "Poop Enthusiast";
    } else if (c <= 70) {
      rank = "A";
      label = "Nice Run!";
    } else if (c <= 80) {
      rank = "A+";
      label = "Professional Pooper";
    } else if (c <= 90) {
      rank = "S";
      label = "Legendary Poop";
    } else if (c <= 99) {
      rank = "S+";
      label = "Almost God";
    } else {
      rank = "SS";
      label = "Poop Overlord";
    }
    return { rank, label };
  }

  // ---------- end ----------
  async function endGame() {
    if (gameOver) return;
    gameOver = true;

    playAudio(seGameover, "se");
    stopAudio(bgmGame);

    const c = poopCount;
    const { rank, label } = evaluateRank(c);

    const playerDisplayName = getDisplayNameFromProfile(profile);

    const bestRuns = loadBestRuns();
    const newRun = { score: c, rank, label, name: playerDisplayName };
    bestRuns.push(newRun);
    bestRuns.sort((a, b) => b.score - a.score);
    const localTop = bestRuns.slice(0, BEST_RUNS_LIMIT);
    saveBestRuns(localTop);

    await sendScoreToServer(newRun, playerDisplayName);
    const topRuns = await fetchLeaderboardFromServer();

    updateResultView(rank, label, c, topRuns);

    playAudio(bgmResult, "bgm");

    // 演出付きで結果画面へ
    playTransitionToResult(() => {
      showOnlyView(viewResult);

      const resultFrame = document.querySelector(".result-frame");
      if (resultFrame) {
        resultFrame.classList.remove("pop-in");
        void resultFrame.offsetWidth;
        resultFrame.classList.add("pop-in");
      }

      spawnConfetti();
    });
  }

  // ---------- Settings ----------
  function openSettings() {
    settingNameInput.value = profile.name || "";
    settingCountrySelect.value = profile.country || "";
    settingsModal.classList.remove("hidden");
  }

  function closeSettings() {
    settingsModal.classList.add("hidden");
  }

  // ---------- view switch ----------
  startBtn.addEventListener("click", () => {
    showOnlyView(viewGame);
    stopAudio(bgmHome);
    stopAudio(bgmResult);
    playAudio(bgmGame, "bgm");
    resetGame();
  });

  backToSelectBtn.addEventListener("click", () => {
    showOnlyView(viewSelect);
    stopAudio(bgmGame);
    stopAudio(bgmResult);
    playAudio(bgmHome, "bgm");
  });

  backToSelectResultBtn.addEventListener("click", () => {
    showOnlyView(viewSelect);
    stopAudio(bgmResult);
    playAudio(bgmHome, "bgm");
  });

  resultRestartBtn.addEventListener("click", () => {
    showOnlyView(viewGame);
    stopAudio(bgmResult);
    playAudio(bgmGame, "bgm");
    resetGame();
  });

  // Settings button
  settingsBtn.addEventListener("click", openSettings);
  settingsCancelBtn.addEventListener("click", closeSettings);

  settingsSaveBtn.addEventListener("click", () => {
    const name = settingNameInput.value.trim();
    const country = settingCountrySelect.value.trim();
    profile = {
      name: name || "Player",
      country: country || ""
    };
    saveProfile(profile);
    closeSettings();
  });

  // ---------- initial ----------
  showOnlyView(viewSelect);
  playAudio(bgmHome, "bgm");
});
