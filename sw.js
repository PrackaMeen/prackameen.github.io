const APP_VERSION = "1.0.33";
const APP_COMMIT_SHORT = "ccae28c";
const CACHE_NAME = `game-mobile-lab-v${APP_VERSION}-${APP_COMMIT_SHORT}`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
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
  "./session/SessionManager.js",
  "./session/transport/BroadcastChannelTransport.js",
    "./session/SignalingClient.js",
    "./session/transport/WebRtcTransport.js",
    "./pages/multiplayer-host-network/index.html",
    "./pages/multiplayer-host-network/styles.css",
    "./pages/multiplayer-host-network/page.js",
    "./pages/multiplayer-lobby-network/index.html",
    "./pages/multiplayer-lobby-network/styles.css",
    "./pages/multiplayer-lobby-network/page.js",
  "./pages/settings/index.html",
  "./pages/settings/styles.css",
  "./pages/settings/page.js",
  "./pages/release-notes/index.html",
  "./pages/release-notes/styles.css",
  "./pages/release-notes/page.js",
  "./release-notes.json",
  "./mock-api.js",
  "./manifest.webmanifest",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
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
