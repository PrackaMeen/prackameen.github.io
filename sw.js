const APP_VERSION = "1.1.7";
const APP_COMMIT_SHORT = "3660ec6";
const CACHE_NAME = `game-mobile-admin-v${APP_VERSION}-${APP_COMMIT_SHORT}`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=1.1.7",
  "./app.js?v=1.1.7",
  "./player-preferences.js",
  "./pages/menu/index.html",
  "./pages/menu/styles.css",
  "./pages/menu/page.js",
  "./pages/single-player/index.html",
  "./pages/single-player/styles.css",
  "./pages/single-player/page.js",
  "./pages/single-player-game-settings/index.html",
  "./pages/single-player-game-settings/styles.css",
  "./pages/single-player-game-settings/page.js",
  "./pages/single-player-game/index.html",
  "./pages/single-player-game/styles.css",
  "./pages/single-player-game/page.js",
  "./pages/game-board/index.html",
  "./pages/game-board/styles.css",
  "./pages/game-board/page.js",
  "./assets/game-wasm/wwwroot/index.html",
  "./assets/game-wasm/wwwroot/js/game-runtime.js",
  "./pages/multiplayer/index.html",
  "./pages/multiplayer/styles.css",
  "./pages/multiplayer/page.js",
  "./pages/multiplayer-lobby/index.html",
  "./pages/multiplayer-lobby/styles.css",
  "./pages/multiplayer-lobby/page.js",
  "./pages/multiplayer-lobby-joined-game-settings/index.html",
  "./pages/multiplayer-lobby-joined-game-settings/styles.css",
  "./pages/multiplayer-lobby-joined-game-settings/page.js",
  "./pages/multiplayer-host/index.html",
  "./pages/multiplayer-host/styles.css",
  "./pages/multiplayer-host/page.js",
  "./pages/multiplayer-host-game-settings/index.html",
  "./pages/multiplayer-host-game-settings/styles.css",
  "./pages/multiplayer-host-game-settings/page.js",
  "./pages/multiplayer-chat/index.html",
  "./pages/multiplayer-chat/styles.css",
  "./pages/multiplayer-chat/page.js",
  "./session/ITransport.js",
  "./session/MessageStore.js",
  "./session/MessageBus.js",
  "./session/PeerRegistry.js",
  "./session/ApiConfig.js",
  "./session/SessionManager.js",
  "./session/SessionChat.js",
  "./session/RoomApiClient.js",
  "./session/transport/BroadcastChannelTransport.js",
    "./session/SignalingClient.js",
    "./session/transport/WebRtcTransport.js",
    "./pages/admin/index.html",
    "./pages/admin/styles.css",
    "./pages/admin/page.js",
    "./pages/multiplayer-host-network/index.html",
    "./pages/multiplayer-host-network/styles.css",
    "./pages/multiplayer-host-network/page.js",
    "./pages/multiplayer-lobby-network/index.html",
    "./pages/multiplayer-lobby-network/styles.css",
    "./pages/multiplayer-lobby-network/page.js",
    "./pages/tile-set-demo/index.html",
    "./pages/tile-set-demo/styles.css",
    "./pages/tile-set-demo/page.js",
  "./pages/settings/index.html",
  "./pages/settings/styles.css",
  "./pages/settings/page.js",
  "./pages/release-notes/index.html",
  "./pages/release-notes/styles.css",
  "./pages/release-notes/page.js",
  "./lib/game-assets.js",
  "./assets/game/tile-definitions.json",
  "./release-notes.json",
  "./mock-api.js",
  "./manifest.webmanifest",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
  "./assets/game/tiles/Road0/Road0_0.png",
  "./assets/game/tiles/Road0/Road0_1.png",
  "./assets/game/tiles/Road0/Road0_2.png",
  "./assets/game/tiles/Road0/Road0_3.png",
  "./assets/game/tiles/Road1/Road1_0.png",
  "./assets/game/tiles/Road1/Road1_1.png",
  "./assets/game/tiles/Road1/Road1_2.png",
  "./assets/game/tiles/Road1/Road1_3.png",
  "./assets/game/tiles/Road2/Road2_0.png",
  "./assets/game/tiles/Road2/Road2_1.png",
  "./assets/game/tiles/Road2/Road2_2.png",
  "./assets/game/tiles/Road2/Road2_3.png",
  "./assets/game/tiles/Road3/Road3_0.png",
  "./assets/game/tiles/Road3/Road3_1.png",
  "./assets/game/tiles/Road3/Road3_2.png",
  "./assets/game/tiles/Road3/Road3_3.png",
  "./assets/game/tiles/Road4/Road4_0.png",
  "./assets/game/tiles/Road4/Road4_1.png",
  "./assets/game/tiles/Road4/Road4_2.png",
  "./assets/game/tiles/Road4/Road4_3.png",
  "./assets/game/tiles/Chamber0/Chamber0_0.png",
  "./assets/game/tiles/Chamber0/Chamber0_1.png",
  "./assets/game/tiles/Chamber0/Chamber0_2.png",
  "./assets/game/tiles/Chamber0/Chamber0_3.png",
  "./assets/game/tiles/Chamber1/Chamber1_0.png",
  "./assets/game/tiles/Chamber1/Chamber1_1.png",
  "./assets/game/tiles/Chamber1/Chamber1_2.png",
  "./assets/game/tiles/Chamber1/Chamber1_3.png",
  "./assets/game/tiles/Chamber2/Chamber2_0.png",
  "./assets/game/tiles/Chamber2/Chamber2_1.png",
  "./assets/game/tiles/Chamber2/Chamber2_2.png",
  "./assets/game/tiles/Chamber2/Chamber2_3.png",
  "./assets/game/tiles/Chamber3/Chamber3_0.png",
  "./assets/game/tiles/Chamber3/Chamber3_1.png",
  "./assets/game/tiles/Chamber3/Chamber3_2.png",
  "./assets/game/tiles/Chamber3/Chamber3_3.png",
  "./assets/game/tiles/Chamber4/Chamber4_0.png",
  "./assets/game/tiles/Chamber4/Chamber4_1.png",
  "./assets/game/tiles/Chamber4/Chamber4_2.png",
  "./assets/game/tiles/Chamber4/Chamber4_3.png",
  "./assets/game/entities/player.png",
  "./assets/game/entities/monster.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (requestUrl.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => {
        return new Response("Offline", { status: 503, statusText: "Offline" });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          const isHttp = event.request.url.startsWith("http");
          if (isHttp && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        });
    })
  );
});

self.addEventListener("message", (event) => {
  const messageType = event.data?.type;

  if (messageType === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (messageType === "GET_VERSION") {
    event.ports?.[0]?.postMessage({ version: APP_VERSION, commit: APP_COMMIT_SHORT });
  }
});
