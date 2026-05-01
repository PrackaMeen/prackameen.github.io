export function mountPage(context) {
  const state = {
    installPromptEvent: null,
    installSupported: false,
    swRegistration: null,
    latestAvailableVersion: null,
    latestAvailableCommit: null,
    isReloadingForUpdate: false
  };

  const REFRESH_BUTTON = document.querySelector("#refreshBtn");
  const CHECK_LATEST_BUTTON = document.querySelector("#checkLatestBtn");
  const ACTION_BUTTON = document.querySelector("#actionBtn");
  const NETWORK_MODE = document.querySelector("#networkMode");
  const INSTALL_STATE = document.querySelector("#installState");
  const APP_VERSION_PILL = document.querySelector("#appVersion");
  const UPDATE_BUTTON = document.querySelector("#updateBtn");
  const LAST_UPDATED = document.querySelector("#lastUpdated");
  const STATS_GRID = document.querySelector("#statsGrid");
  const EVENT_FEED = document.querySelector("#eventFeed");
  const CARD_TEMPLATE = document.querySelector("#statCardTemplate");

  const beforeInstallPromptHandler = (event) => {
    event.preventDefault();
    state.installPromptEvent = event;
    state.installSupported = true;
    setInstallStatus("ready");
  };

  const appInstalledHandler = () => {
    setInstallStatus("installed");
  };

  const controllerChangeHandler = () => {
    if (!state.isReloadingForUpdate) {
      return;
    }

    window.location.reload();
  };

  function setAppVersion() {
    APP_VERSION_PILL.textContent = `Version: ${context.appVersion} (${context.appCommitShort})`;
  }

  function parseVersion(version) {
    const parts = String(version || "")
      .replace(/^v/i, "")
      .split(".")
      .map((segment) => Number.parseInt(segment, 10));

    if (parts.some((part) => Number.isNaN(part))) {
      return [0, 0, 0];
    }

    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }

  function isVersionNewer(currentVersion, candidateVersion) {
    const current = parseVersion(currentVersion);
    const candidate = parseVersion(candidateVersion);

    for (let i = 0; i < 3; i += 1) {
      if (candidate[i] > current[i]) {
        return true;
      }
      if (candidate[i] < current[i]) {
        return false;
      }
    }

    return false;
  }

  function showUpdateButton(version, commitShort) {
    UPDATE_BUTTON.dataset.version = version;
    UPDATE_BUTTON.dataset.commit = commitShort;
    UPDATE_BUTTON.dataset.buildId = `${version}+${commitShort}`;
    UPDATE_BUTTON.textContent = `Update to v${version} (${commitShort})`;
    UPDATE_BUTTON.disabled = false;
    UPDATE_BUTTON.classList.remove("hidden");
  }

  function hideUpdateButton() {
    UPDATE_BUTTON.dataset.version = "";
    UPDATE_BUTTON.dataset.commit = "";
    UPDATE_BUTTON.dataset.buildId = "";
    UPDATE_BUTTON.textContent = "";
    UPDATE_BUTTON.disabled = false;
    UPDATE_BUTTON.classList.add("hidden");
  }

  function compareBuilds(currentBuild, candidateBuild) {
    if (!currentBuild || !candidateBuild) {
      return 0;
    }

    if (isVersionNewer(currentBuild.version, candidateBuild.version)) {
      return 1;
    }

    if (isVersionNewer(candidateBuild.version, currentBuild.version)) {
      return -1;
    }

    if (currentBuild.commit === candidateBuild.commit) {
      return 0;
    }

    return -1;
  }

  async function promptAndActivateUpdate(registration) {
    await evaluateAvailableUpdate(registration);
    const waitingWorker = registration?.waiting;

    if (!waitingWorker) {
      return false;
    }

    state.isReloadingForUpdate = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    return true;
  }

  function askWorkerBuildInfo(worker) {
    return new Promise((resolve) => {
      if (!worker) {
        resolve(null);
        return;
      }

      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => resolve(null), 1500);

      channel.port1.onmessage = (event) => {
        window.clearTimeout(timeout);
        const version = event.data?.version;
        const commit = event.data?.commit;
        if (!version || !commit) {
          resolve(null);
          return;
        }
        resolve({ version, commit });
      };

      worker.postMessage({ type: "GET_VERSION" }, [channel.port2]);
    });
  }

  async function getCurrentRunningBuild() {
    const controllerBuild = await askWorkerBuildInfo(navigator.serviceWorker?.controller);
    if (controllerBuild) {
      return controllerBuild;
    }

    return { version: context.appVersion, commit: context.appCommitShort };
  }

  async function evaluateAvailableUpdate(registration) {
    const runningBuild = await getCurrentRunningBuild();
    const waitingWorker = registration?.waiting;
    const waitingBuild = await askWorkerBuildInfo(waitingWorker);

    if (!waitingBuild || compareBuilds(runningBuild, waitingBuild) >= 0) {
      state.latestAvailableVersion = null;
      state.latestAvailableCommit = null;
      hideUpdateButton();
      return;
    }

    state.latestAvailableVersion = waitingBuild.version;
    state.latestAvailableCommit = waitingBuild.commit;
    showUpdateButton(waitingBuild.version, waitingBuild.commit);
  }

  async function forceCheckLatestVersion() {
    if (!state.swRegistration) {
      LAST_UPDATED.textContent = "Update check unavailable until the service worker is ready.";
      return;
    }

    CHECK_LATEST_BUTTON.disabled = true;
    CHECK_LATEST_BUTTON.textContent = "Checking...";

    try {
      state.promptedBuildIds.clear();
      await state.swRegistration.update();
      const activated = await promptAndActivateUpdate(state.swRegistration);

      if (activated) {
        LAST_UPDATED.textContent = "Update found. Reloading to the latest version...";
        return;
      }

      LAST_UPDATED.textContent = "No newer version was found yet. Try again in a moment.";
    } catch (error) {
      LAST_UPDATED.textContent = `Update check failed: ${error.message}`;
    } finally {
      CHECK_LATEST_BUTTON.disabled = false;
      CHECK_LATEST_BUTTON.textContent = "Check Latest Version";
    }
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

  async function activateWaitingUpdate() {
    if (!state.swRegistration) {
      return;
    }

    UPDATE_BUTTON.disabled = true;
    UPDATE_BUTTON.textContent = `Updating to v${UPDATE_BUTTON.dataset.version} (${UPDATE_BUTTON.dataset.commit})...`;

    await state.swRegistration.update().catch(() => {
      // Ignore transient update-check errors; we'll still try to activate if one is waiting.
    });

    await evaluateAvailableUpdate(state.swRegistration);
    const waitingWorker = state.swRegistration.waiting;

    if (!waitingWorker) {
      UPDATE_BUTTON.disabled = false;
      LAST_UPDATED.textContent = "No pending update is ready yet. Try again in a moment.";
      return;
    }

    state.isReloadingForUpdate = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("./sw.js").then(async (registration) => {
      state.swRegistration = registration;

      await evaluateAvailableUpdate(registration);

      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }

        installingWorker.addEventListener("statechange", async () => {
          if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
            await evaluateAvailableUpdate(registration);
          }
        });
      });

      registration.update().then(async () => {
        await evaluateAvailableUpdate(registration);
      }).catch(() => {
        // Ignore transient update-check errors; next refresh will retry.
      });
    }).catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  }

  function wireEvents() {
    REFRESH_BUTTON.addEventListener("click", refreshState);
    CHECK_LATEST_BUTTON.addEventListener("click", forceCheckLatestVersion);
    ACTION_BUTTON.addEventListener("click", performAction);
    INSTALL_STATE.addEventListener("click", installApp);
    UPDATE_BUTTON.addEventListener("click", activateWaitingUpdate);
    window.addEventListener("beforeinstallprompt", beforeInstallPromptHandler);
    window.addEventListener("appinstalled", appInstalledHandler);
    navigator.serviceWorker?.addEventListener("controllerchange", controllerChangeHandler);
  }

  function init() {
    context.setTitle("G.A.M.E Mobile Test Lab");
    setAppVersion();
    setNetworkStatus();
    setInstallStatus("unavailable");
    hideUpdateButton();
    wireEvents();
    registerServiceWorker();
    refreshState();
  }

  init();

  return {
    dispose() {
      REFRESH_BUTTON.removeEventListener("click", refreshState);
      CHECK_LATEST_BUTTON.removeEventListener("click", forceCheckLatestVersion);
      ACTION_BUTTON.removeEventListener("click", performAction);
      INSTALL_STATE.removeEventListener("click", installApp);
      UPDATE_BUTTON.removeEventListener("click", activateWaitingUpdate);
      window.removeEventListener("beforeinstallprompt", beforeInstallPromptHandler);
      window.removeEventListener("appinstalled", appInstalledHandler);
      navigator.serviceWorker?.removeEventListener("controllerchange", controllerChangeHandler);
    }
  };
}
