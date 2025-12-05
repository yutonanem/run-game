// ====== service-worker.js（暇つぶしランゲーム）======

const CACHE_NAME = "run-game-v3";

// オフライン用にキャッシュするファイル
const URLS_TO_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/game.js",
  "/obstacle_custom.png",
  "/fireball.png",
  "/firefighter.png",
  "/rescue.png",
  "/bgm_home.mp3",
  "/bgm_game.mp3",
  "/se_jump.mp3",
  "/se_gameover.mp3",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest"
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
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

// 通信：まずキャッシュを見て、なければネットワーク
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
