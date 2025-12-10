// server.js （run-game グローバルランキング + Poop Runner ランキング）

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// JSON を受け取る設定
app.use(express.json());

// public 配下の静的ファイルを配信
app.use(express.static("public"));

/* =====================================================
 *  もともとのランキングAPI（time ベース）
 *  ※既存の実装はそのまま温存
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
 *  Poop Runner 用 世界ランキングAPI
 *  （サーバーのメモリ上に保持・スコアが大きいほど上位）
 * ===================================================*/

// { score, rank, label, name, avatarDataUrl, createdAt } の配列
let poopRanking = [];

// Poop Runner のランキング取得
app.get("/api/poop-ranking", (req, res) => {
  const limitRaw = req.query.limit;
  const limit = Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 10;

  const top = poopRanking
    .slice() // 念のためコピー
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score; // スコア高い順
      return a.createdAt - b.createdAt; // 同点なら古い順
    })
    .slice(0, limit);

  res.json(top);
});

// Poop Runner のスコア送信
app.post("/api/poop-score", (req, res) => {
  const { score, rank, label, name, avatarDataUrl } = req.body || {};

  if (typeof score !== "number" || !Number.isFinite(score)) {
    return res.status(400).json({ error: "score must be number" });
  }

  // 名前は任意。未入力なら Anonymous にする
  const playerName =
    typeof name === "string" && name.trim() ? name.trim() : "Anonymous";

  // avatar は data:image 形式だけ受け付ける（変なURL対策 & サイズ制限）
  let safeAvatar = null;
  if (typeof avatarDataUrl === "string") {
    const trimmed = avatarDataUrl.trim();
    const MAX_LEN = 200000; // ざっくりサイズ上限（必要なら調整してOK）
    if (trimmed.startsWith("data:image/") && trimmed.length <= MAX_LEN) {
      safeAvatar = trimmed;
    }
  }

  const entry = {
    score,
    rank: typeof rank === "string" ? rank : "F",
    label: typeof label === "string" ? label : "",
    name: playerName,
    avatarDataUrl: safeAvatar,
    createdAt: Date.now()
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
