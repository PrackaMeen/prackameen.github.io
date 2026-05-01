import { DEFAULT_LOCAL_API_BASE_URL, DEFAULT_REMOTE_API_BASE_URL } from "../../session/ApiConfig.js";
import { createDefaultRoomApiClient, normalizeApiBaseUrl } from "../../session/RoomApiClient.js";

export function mountPage(context) {
  const state = {
    installPromptEvent: null,
    installSupported: false,
    swRegistration: null,
    latestAvailableVersion: null,
    latestAvailableCommit: null,
    isReloadingForUpdate: false
  };

  const SEE_GAMES_BUTTON = document.querySelector("#seeGamesBtn");
  const CLEAN_INACTIVE_BUTTON = document.querySelector("#cleanInactiveBtn");
  const CHECK_LATEST_BUTTON = document.querySelector("#checkLatestBtn");
  const BACKEND_OPTION_LIST = document.querySelector("#backendOptionList");
  const BACKEND_STATE = document.querySelector("#backendState");
  const NETWORK_MODE = document.querySelector("#networkMode");
  const INSTALL_STATE = document.querySelector("#installState");
  const APP_VERSION_PILL = document.querySelector("#appVersion");
  const UPDATE_BUTTON = document.querySelector("#updateBtn");
  const LAST_UPDATED = document.querySelector("#lastUpdated");
  const CLEANUP_STATUS = document.querySelector("#cleanupStatus");
  const GAMES_TABLE_BODY = document.querySelector("#gamesTableBody");
  const GAMES_EMPTY_STATE = document.querySelector("#gamesEmptyState");

  const roomApi = createDefaultRoomApiClient();
  const apiBases = {
    local: normalizeApiBaseUrl(DEFAULT_LOCAL_API_BASE_URL),
    live: normalizeApiBaseUrl(DEFAULT_REMOTE_API_BASE_URL)
  };
  const isLocalRuntime = isLocalOrigin();
  const backendVersions = {
    local: null,
    live: null
  };
  let currentBackendKey = "live";

  ensureAllowedBackendBaseUrl();

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

    const url = new URL(window.location.href);
    url.searchParams.set("__update", context.appBuildId);
    url.searchParams.set("__reload", Date.now().toString());
    window.location.replace(url.toString());
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
    const version = backendVersions[currentBackendKey];
    const label = currentBackendKey === "local" ? "Local" : "Live";
    NETWORK_MODE.textContent = version ? `API: ${label} (${version})` : `API: ${label}`;
    BACKEND_STATE.textContent = version ? `${label} backend ready (${version})` : `${label} backend ready`;
  }

  function getAvailableBackendOptions() {
    const options = [
      { key: "live", label: "Live", baseUrl: apiBases.live, alwaysAvailable: true }
    ];

    if (isLocalRuntime) {
      options.unshift({ key: "local", label: "Local", baseUrl: apiBases.local, alwaysAvailable: false });
    }

    return options;
  }

  function isLocalOrigin() {
    if (typeof window === "undefined") {
      return false;
    }

    const hostname = String(window.location.hostname || "").toLowerCase();
    const protocol = String(window.location.protocol || "").toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || protocol === "file:";
  }

  function ensureAllowedBackendBaseUrl() {
    const currentBaseUrl = normalizeApiBaseUrl(roomApi.apiBaseUrl);
    if (currentBaseUrl === apiBases.local) {
      currentBackendKey = "local";
      return;
    }

    if (currentBaseUrl === apiBases.live) {
      currentBackendKey = "live";
      return;
    }

    selectBackend(isLocalRuntime ? "local" : "live", false);
  }

  function getBackendVersionLabel(version) {
    return version ? `version: ${version}` : "version: loading...";
  }

  function renderBackendOptions() {
    const options = getAvailableBackendOptions();
    BACKEND_OPTION_LIST.textContent = "";

    for (const option of options) {
      const button = document.createElement("button");
      const version = backendVersions[option.key];
      button.type = "button";
      button.className = "backend-option";
      button.dataset.backendKey = option.key;
      button.textContent = `${option.label} (${getBackendVersionLabel(version)})`;
      button.classList.toggle("backend-option--selected", currentBackendKey === option.key);
      button.setAttribute("aria-pressed", currentBackendKey === option.key ? "true" : "false");
      button.disabled = options.length === 1;
      BACKEND_OPTION_LIST.appendChild(button);
    }

    NETWORK_MODE.textContent = currentBackendKey === "local" ? "API: Local" : "API: Live";
  }

  async function fetchBackendVersion(apiBaseUrl) {
    const versionUrl = `${normalizeApiBaseUrl(apiBaseUrl)}/version`;
    const response = await fetch(versionUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }

    const payload = await response.json();
    return String(payload?.version || "unknown");
  }

  async function refreshBackendVersions() {
    const jobs = [
      fetchBackendVersion(apiBases.live).then((version) => {
        backendVersions.live = version;
      }).catch(() => {
        backendVersions.live = "unavailable";
      })
    ];

    if (isLocalRuntime) {
      jobs.push(
        fetchBackendVersion(apiBases.local).then((version) => {
          backendVersions.local = version;
        }).catch(() => {
          backendVersions.local = "unavailable";
        })
      );
    }

    renderBackendOptions();
    BACKEND_STATE.textContent = "Refreshing backend versions...";

    await Promise.allSettled(jobs);

    const availableKeys = new Set(getAvailableBackendOptions().map((option) => option.key));
    if (!availableKeys.has(currentBackendKey)) {
      selectBackend(availableKeys.has("local") ? "local" : "live", false);
    } else {
      renderBackendOptions();
    }

    BACKEND_STATE.textContent = "Choose where Admin talks to for rooms.";
  }

  function selectBackend(backendKey, shouldReload = true) {
    const availableKeys = new Set(getAvailableBackendOptions().map((option) => option.key));
    if (!availableKeys.has(backendKey)) {
      return;
    }

    const normalizedKey = backendKey;
    const nextBaseUrl = apiBases[normalizedKey];

    if (roomApi.apiBaseUrl !== nextBaseUrl) {
      roomApi.setApiBaseUrl(nextBaseUrl);
    }

    currentBackendKey = normalizedKey;
    renderBackendOptions();
    setNetworkStatus();

    if (shouldReload) {
      loadGames();
    }
  }

  const backendOptionClickHandler = (event) => {
    const button = event.target.closest("[data-backend-key]");
    if (!button || !BACKEND_OPTION_LIST.contains(button)) {
      return;
    }

    selectBackend(button.dataset.backendKey);
  };

  function renderGames(rooms) {
    GAMES_TABLE_BODY.textContent = "";

    if (!rooms.length) {
      GAMES_EMPTY_STATE.hidden = false;
      CLEANUP_STATUS.textContent = "No games found.";
      return;
    }

    GAMES_EMPTY_STATE.hidden = true;

    for (const room of rooms) {
      const row = document.createElement("tr");
      const roomIdCell = document.createElement("td");
      roomIdCell.textContent = room.roomId || "-";

      const nameCell = document.createElement("td");
      nameCell.textContent = room.hostName || "Unnamed";

      const playersCell = document.createElement("td");
      playersCell.textContent = String(Array.isArray(room.players) ? room.players.length : 0);

      const statusCell = document.createElement("td");
      const statusPill = document.createElement("span");
      statusPill.className = `status-pill status-pill--${normalizeStatusClass(room.status)}`;
      statusPill.textContent = room.status || "unknown";
      statusCell.appendChild(statusPill);

      row.append(roomIdCell, nameCell, playersCell, statusCell);
      GAMES_TABLE_BODY.appendChild(row);
    }
  }

  function normalizeStatusClass(status) {
    const normalized = String(status || "unknown").toLowerCase();
    if (normalized.includes("active")) {
      return "active";
    }
    if (normalized.includes("inactive")) {
      return "inactive";
    }
    return "waiting";
  }

  function stampLastUpdated(message) {
    LAST_UPDATED.textContent = message || `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  async function loadGames() {
    SEE_GAMES_BUTTON.disabled = true;
    SEE_GAMES_BUTTON.textContent = "Loading...";
    CLEANUP_STATUS.textContent = "Loading games...";

    try {
      const rooms = await roomApi.listRooms();
      renderGames(Array.isArray(rooms) ? rooms : []);
      stampLastUpdated(`${Array.isArray(rooms) ? rooms.length : 0} games loaded`);
    } catch (error) {
      GAMES_TABLE_BODY.textContent = "";
      GAMES_EMPTY_STATE.hidden = false;
      CLEANUP_STATUS.textContent = `Load failed: ${error.message}`;
      stampLastUpdated(`Load failed: ${error.message}`);
    } finally {
      SEE_GAMES_BUTTON.disabled = false;
      SEE_GAMES_BUTTON.textContent = "See All Games";
    }
  }

  async function cleanupInactiveGames() {
    CLEAN_INACTIVE_BUTTON.disabled = true;
    CLEAN_INACTIVE_BUTTON.textContent = "Cleaning...";
    CLEANUP_STATUS.textContent = "Cleaning inactive games...";

    try {
      const result = await roomApi.cleanupInactiveRooms();
      const deletedCount = Number(result?.deletedCount || 0);
      const deletedRoomIds = Array.isArray(result?.deletedRoomIds) ? result.deletedRoomIds : [];
      const cleanupSummary = deletedCount > 0
        ? `Deleted ${deletedCount} inactive games${deletedRoomIds.length ? `: ${deletedRoomIds.join(", ")}` : "."}`
        : "No inactive games were found.";
      await loadGames();
      CLEANUP_STATUS.textContent = cleanupSummary;
    } catch (error) {
      CLEANUP_STATUS.textContent = `Cleanup failed: ${error.message}`;
      stampLastUpdated(`Cleanup failed: ${error.message}`);
    } finally {
      CLEAN_INACTIVE_BUTTON.disabled = false;
      CLEAN_INACTIVE_BUTTON.textContent = "Clean Inactive Games";
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
    SEE_GAMES_BUTTON.addEventListener("click", loadGames);
    CLEAN_INACTIVE_BUTTON.addEventListener("click", cleanupInactiveGames);
    CHECK_LATEST_BUTTON.addEventListener("click", forceCheckLatestVersion);
    BACKEND_OPTION_LIST.addEventListener("click", backendOptionClickHandler);
    INSTALL_STATE.addEventListener("click", installApp);
    UPDATE_BUTTON.addEventListener("click", activateWaitingUpdate);
    window.addEventListener("beforeinstallprompt", beforeInstallPromptHandler);
    window.addEventListener("appinstalled", appInstalledHandler);
    navigator.serviceWorker?.addEventListener("controllerchange", controllerChangeHandler);
  }

  function init() {
    context.setTitle("Admin");
    setAppVersion();
    renderBackendOptions();
    setNetworkStatus();
    setInstallStatus("unavailable");
    hideUpdateButton();
    wireEvents();
    registerServiceWorker();
    refreshBackendVersions();
    loadGames();
  }

  init();

  return {
    dispose() {
      SEE_GAMES_BUTTON.removeEventListener("click", loadGames);
      CLEAN_INACTIVE_BUTTON.removeEventListener("click", cleanupInactiveGames);
      CHECK_LATEST_BUTTON.removeEventListener("click", forceCheckLatestVersion);
      BACKEND_OPTION_LIST.removeEventListener("click", backendOptionClickHandler);
      INSTALL_STATE.removeEventListener("click", installApp);
      UPDATE_BUTTON.removeEventListener("click", activateWaitingUpdate);
      window.removeEventListener("beforeinstallprompt", beforeInstallPromptHandler);
      window.removeEventListener("appinstalled", appInstalledHandler);
      navigator.serviceWorker?.removeEventListener("controllerchange", controllerChangeHandler);
    }
  };
}
