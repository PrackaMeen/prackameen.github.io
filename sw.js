const APP_VERSION = "1.0.3";
const APP_COMMIT_SHORT = "4f7e9a2";
const CACHE_NAME = `game-mobile-lab-v${APP_VERSION}-${APP_COMMIT_SHORT}`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./pages/lab/index.html",
  "./pages/lab/styles.css",
  "./pages/lab/page.js",
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