const APP_VERSION = "1.0.1";

const state = {
  installPromptEvent: null,
  installSupported: false
};

const REFRESH_BUTTON = document.querySelector("#refreshBtn");
const ACTION_BUTTON = document.querySelector("#actionBtn");
const NETWORK_MODE = document.querySelector("#networkMode");
const INSTALL_STATE = document.querySelector("#installState");
const APP_VERSION_PILL = document.querySelector("#appVersion");
const LAST_UPDATED = document.querySelector("#lastUpdated");
const STATS_GRID = document.querySelector("#statsGrid");
const EVENT_FEED = document.querySelector("#eventFeed");
const CARD_TEMPLATE = document.querySelector("#statCardTemplate");

function setAppVersion() {
  APP_VERSION_PILL.textContent = `Version: ${APP_VERSION}`;
}

function setInstallStatus(text) {
  INSTALL_STATE.textContent = `Install: ${text}`;
}

function setNetworkStatus() {
  const source = window.__GAME_API_MODE__ === "mock" ? "mocked (github)" : "live";
  NETWORK_MODE.textContent = `API: ${source}`;
}

async function callApi(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return response.json();
}

function renderStats(snapshot) {
  STATS_GRID.textContent = "";

  const cards = [
    {
      title: "Turn",
      value: String(snapshot.turn),
      caption: "Current turn number"
    },
    {
      title: "Players",
      value: `${snapshot.playersAlive}/${snapshot.playersTotal}`,
      caption: "Alive / total"
    },
    {
      title: "Energy Pool",
      value: String(snapshot.energyPool),
      caption: "Global available energy"
    },
    {
      title: "Map Zone",
      value: snapshot.zone,
      caption: "Current focus area"
    }
  ];

  for (const item of cards) {
    const fragment = CARD_TEMPLATE.content.cloneNode(true);
    fragment.querySelector("h3").textContent = item.title;
    fragment.querySelector(".value").textContent = item.value;
    fragment.querySelector(".caption").textContent = item.caption;
    STATS_GRID.appendChild(fragment);
  }
}

function renderEvents(events) {
  EVENT_FEED.textContent = "";

  for (const eventItem of events) {
    const row = document.createElement("li");
    const badgeClass = eventItem.type === "warning" ? "warn" : "ok";
    row.innerHTML = `<time>${eventItem.time}</time><span class="${badgeClass}">${eventItem.type.toUpperCase()}</span> ${eventItem.message}`;
    EVENT_FEED.appendChild(row);
  }
}

function stampLastUpdated() {
  LAST_UPDATED.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

async function refreshState() {
  REFRESH_BUTTON.disabled = true;
  REFRESH_BUTTON.textContent = "Refreshing...";

  try {
    const snapshot = await callApi("/api/game/state");
    const events = await callApi("/api/game/events");
    renderStats(snapshot);
    renderEvents(events.items);
    stampLastUpdated();
  } catch (error) {
    LAST_UPDATED.textContent = `Update failed: ${error.message}`;
  } finally {
    REFRESH_BUTTON.disabled = false;
    REFRESH_BUTTON.textContent = "Refresh State";
  }
}

async function performAction() {
  ACTION_BUTTON.disabled = true;
  ACTION_BUTTON.textContent = "Running...";

  try {
    const result = await callApi("/api/game/action", {
      method: "POST",
      body: JSON.stringify({ action: "test-strike", source: "mobile-pwa" })
    });

    const firstItem = EVENT_FEED.firstElementChild;
    const item = document.createElement("li");
    item.innerHTML = `<time>${result.time}</time><span class="ok">OK</span> ${result.message}`;

    if (firstItem) {
      EVENT_FEED.insertBefore(item, firstItem);
    } else {
      EVENT_FEED.appendChild(item);
    }
  } catch (error) {
    LAST_UPDATED.textContent = `Action failed: ${error.message}`;
  } finally {
    ACTION_BUTTON.disabled = false;
    ACTION_BUTTON.textContent = "Perform Sample Action";
  }
}

async function installApp() {
  if (!state.installPromptEvent) {
    setInstallStatus("not ready");
    return;
  }

  state.installPromptEvent.prompt();
  const choice = await state.installPromptEvent.userChoice;
  setInstallStatus(choice.outcome === "accepted" ? "accepted" : "dismissed");
  state.installPromptEvent = null;
}

function wireInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPromptEvent = event;
    state.installSupported = true;
    setInstallStatus("ready");
  });

  window.addEventListener("appinstalled", () => {
    setInstallStatus("installed");
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.warn("Service worker registration failed", error);
  });
}

function init() {
  setAppVersion();
  setNetworkStatus();
  setInstallStatus("unavailable");
  wireInstallPrompt();
  registerServiceWorker();

  REFRESH_BUTTON.addEventListener("click", refreshState);
  ACTION_BUTTON.addEventListener("click", performAction);
  INSTALL_STATE.addEventListener("click", installApp);

  refreshState();
}

init();