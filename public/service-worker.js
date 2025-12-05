// ====== service-worker.js（暇つぶしランゲーム）======

// ★ バージョンを上げて古いキャッシュを一掃
const CACHE_NAME = "run-game-v3";

// オフライン用にキャッシュするファイル
const URLS_TO_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/game.js",
  "/manifest.webmanifest",
  "/obstacle_custom.png",
  "/fireball.png",
  "/firefighter.png",
  "/icon-192.png",
  "/icon-512.png",
  "/bgm_home.mp3",
  "/bgm_game.mp3",
  "/se_jump.mp3",
  "/se_gameover.mp3"
];

// インストール時：キャッシュへ保存
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

// 古いキャッシュを消す
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// 通信：API はキャッシュしない／それ以外は cache-first
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // /api/ は常にネットワークへ（ランキングはリアルタイムに）
  if (url.pathname.startsWith("/api/")) {
    return; // ここでは respondWith しない → 通常のネットワーク処理
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
