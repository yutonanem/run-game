// server.js （run-game グローバルランキング用・ESM版）
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// ESM で __dirname を使えるようにするおまじない
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON を受け取る設定
app.use(express.json());

// public 配下の静的ファイルを配信
app.use(express.static("public"));

// ====== グローバルランキング（サーバーのメモリに保持） ======
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

// それ以外のリクエストは index.html を返す（SPA / PWA 用）
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
