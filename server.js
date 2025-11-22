import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// __dirname 相当
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// public フォルダを静的ファイルとして配信
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Render 用: 環境変数 PORT があればそれを使う
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Run game server listening on port ${PORT}`);
});
