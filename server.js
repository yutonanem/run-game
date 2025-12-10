// server.js （run-game グローバルランキング + Poop Runner ランキング）

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// JSON を受け取る設定（少し大きめにしておく）
app.use(express.json({ limit: "1mb" }));

// public 配下の静的ファイルを配信
app.use(express.static(path.join(__dirname, "public")));

/* =====================================================
 *  もともとのランキングAPI（time ベース）
 * ===================================================*/

let ranking = []; // { name: string, time: number } の配列

// ランキング取得（全ユーザー共通）
app.get("/api/ranking", (req, res) => {
  const top = ranking
    .slice()
    .sort((a, b) => b.time - a.time)
    .slice(0, 3); // TOP3だけ返す

  res.json(top);
});

// スコア送信
app.post("/api/score", (req, res) => {
  const { name, time } = req.body || {};

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof time !== "number" ||
    !Number.isFinite(time)
  ) {
    return res.status(400).json({ error: "invalid payload" });
  }

  const trimmedName = name.trim();

  // 既にその名前の記録があれば、ベストタイムを更新
  const existing = ranking.find((r) => r.name === trimmedName);
  if (existing) {
    if (time > existing.time) {
      existing.time = time;
    }
  } else {
    ranking.push({ name: trimmedName, time });
  }

  // 高いタイム順にソートして上位だけ残す
  ranking.sort((a, b) => b.time - a.time);
  ranking = ranking.slice(0, 50); // 保持するのは50人分くらいに制限

  const top = ranking.slice(0, 3);
  res.json(top);
});

/* =====================================================
 *  Poop Runner 用：プロフィール（アバター）API
 * ===================================================*/

// { [name: string]: { avatarDataUrl: string | null } }
const poopProfiles = Object.create(null);

// プロフィール保存
app.post("/api/profile", (req, res) => {
  const { name, avatarDataUrl } = req.body || {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }

  const trimmedName = name.trim();

  let storedAvatar = null;

  if (typeof avatarDataUrl === "string" && avatarDataUrl) {
    // 画像っぽい dataURL だけ許可
    if (!avatarDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "avatar must be image data URL" });
    }

    // サイズ制限（長すぎる場合は 413）
    const MAX_LEN = 200000; // ざっくり 200KB まで
    if (avatarDataUrl.length > MAX_LEN) {
      return res.status(413).json({ error: "avatar too large" });
    }

    storedAvatar = avatarDataUrl;
  }

  poopProfiles[trimmedName] = { avatarDataUrl: storedAvatar };

  res.json({ ok: true });
});

/* =====================================================
 *  Poop Runner 用 世界ランキングAPI
 * ===================================================*/

// { score, rank, label, name, avatarDataUrl, createdAt } の配列
let poopRanking = [];

// ランキング取得
app.get("/api/poop-ranking", (req, res) => {
  const limitRaw = req.query.limit;
  const limit = Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 10;

  const top = poopRanking
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score; // スコア高い順
      return a.createdAt - b.createdAt; // 同点なら古い順
    })
    .slice(0, limit);

  res.json(top);
});

// スコア送信
app.post("/api/poop-score", (req, res) => {
  const { score, rank, label, name } = req.body || {};

  if (typeof score !== "number" || !Number.isFinite(score)) {
    return res.status(400).json({ error: "score must be number" });
  }

  // 名前は任意。未入力なら Anonymous にする
  const playerName =
    typeof name === "string" && name.trim() ? name.trim() : "Anonymous";

  // もしプロフィールがあれば紐づけ
  const profile = poopProfiles[playerName] || null;
  const avatarDataUrl = profile ? profile.avatarDataUrl || null : null;

  const entry = {
    score,
    rank: typeof rank === "string" ? rank : "F",
    label: typeof label === "string" ? label : "",
    name: playerName,
    avatarDataUrl,
    createdAt: Date.now(),
  };

  poopRanking.push(entry);

  // スコア順でソートして、上位だけ残す
  poopRanking.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.createdAt - b.createdAt;
  });
  poopRanking = poopRanking.slice(0, 100); // 最大100件だけ保持

  // ついでにTOP10を返してあげる
  const top = poopRanking.slice(0, 10);
  res.json(top);
});

/* =====================================================
 *  それ以外のリクエストは index.html を返す
 * ===================================================*/

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
