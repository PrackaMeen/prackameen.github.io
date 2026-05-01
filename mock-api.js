(function bootstrapMockApi() {
  const host = window.location.hostname.toLowerCase();
  const isGitHubPages = host.endsWith("github.io") || host.includes("githubpreview.dev");
  const isFileMode = window.location.protocol === "file:";
  const shouldMock = isGitHubPages || isFileMode;

  window.__GAME_API_MODE__ = shouldMock ? "mock" : "live";

  if (!shouldMock) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  const inMemory = {
    turn: 23,
    playersAlive: 3,
    playersTotal: 4,
    energyPool: 14,
    zone: "North Ridge",
    characterClasses: [
      { id: "vanguard", name: "Vanguard", icon: "🛡️" },
      { id: "ranger", name: "Ranger", icon: "🏹" },
      { id: "mystic", name: "Mystic", icon: "✨" },
      { id: "engineer", name: "Engineer", icon: "🔧" },
      { id: "shadow", name: "Shadow", icon: "🗡️" }
    ],
    events: [
      { time: "09:28", type: "ok", message: "Loot crate claimed by Ranger-2." },
      { time: "09:26", type: "warning", message: "Storm ring moved one sector inward." },
      { time: "09:24", type: "ok", message: "Medic restored 2 health to Scout-1." }
    ]
  };

  function jsonResponse(payload, status = 200) {
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
  }

  function handleRequest(url, init) {
    const requestUrl = new URL(url, window.location.origin);

    if (!requestUrl.pathname.startsWith("/api/")) {
      return null;
    }

    if (
      requestUrl.pathname.startsWith("/api/rooms")
      || requestUrl.pathname === "/api/version"
      || requestUrl.pathname === "/api/health"
      || requestUrl.pathname === "/api/openapi.json"
      || requestUrl.pathname.startsWith("/api/swagger/")
    ) {
      return null;
    }

    if (requestUrl.pathname === "/api/game/state") {
      return jsonResponse({
        turn: inMemory.turn,
        playersAlive: inMemory.playersAlive,
        playersTotal: inMemory.playersTotal,
        energyPool: inMemory.energyPool,
        zone: inMemory.zone
      });
    }

    if (requestUrl.pathname === "/api/game/events") {
      return jsonResponse({ items: inMemory.events });
    }

    if (requestUrl.pathname === "/api/game/action" && (init?.method || "GET").toUpperCase() === "POST") {
      inMemory.turn += 1;
      inMemory.energyPool = Math.max(0, inMemory.energyPool - 2);
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const event = {
        time,
        type: "ok",
        message: "Mock action resolved successfully for quick mobile verification."
      };

      inMemory.events.unshift(event);

      return jsonResponse({
        message: event.message,
        time
      });
    }

    if (requestUrl.pathname === "/api/characters/classes") {
      return jsonResponse({ items: inMemory.characterClasses });
    }

    if (requestUrl.pathname === "/api/characters/random-default") {
      const items = inMemory.characterClasses;
      const index = Math.floor(Math.random() * items.length);
      const picked = items[index];
      return jsonResponse({ characterId: picked.id });
    }

    return jsonResponse({ error: "Unknown mock endpoint" }, 404);
  }

  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const mocked = handleRequest(url, init);

    if (mocked) {
      return mocked;
    }

    return originalFetch(input, init);
  };
})();