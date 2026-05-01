const APP_VERSION = "1.0.44";
const APP_COMMIT_SHORT = "3660ec6";
const APP_BUILD_ID = `${APP_VERSION}+${APP_COMMIT_SHORT}`;
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_ROUTE = "menu";

const PAGES = {
  menu: {
    title: "Menu",
    basePath: "./pages/menu/"
  },
  "single-player": {
    title: "Single Player",
    basePath: "./pages/single-player/"
  },
  "single-player-game-settings": {
    title: "Single Player / Game Settings",
    basePath: "./pages/single-player-game-settings/"
  },
  "single-player-game": {
    title: "Single Player / Game",
    basePath: "./pages/single-player-game/"
  },
  multiplayer: {
    title: "Multiplayer",
    basePath: "./pages/multiplayer/"
  },
  "multiplayer-lobby": {
    title: "Multiplayer / Lobby",
    basePath: "./pages/multiplayer-lobby/"
  },
  "multiplayer-lobby-joined-game-settings": {
    title: "Multiplayer / Lobby / Joined Game Settings",
    basePath: "./pages/multiplayer-lobby-joined-game-settings/"
  },
  "multiplayer-host": {
    title: "Multiplayer / Host",
    basePath: "./pages/multiplayer-host/"
  },
  "multiplayer-host-game-settings": {
    title: "Multiplayer / Host / Game Settings",
    basePath: "./pages/multiplayer-host-game-settings/"
  },
  "multiplayer-chat": {
    title: "Multiplayer / Chat",
    basePath: "./pages/multiplayer-chat/"
  },
  "multiplayer-host-network": {
    title: "Multiplayer / Network Host",
    basePath: "./pages/multiplayer-host-network/"
  },
  "multiplayer-lobby-network": {
    title: "Multiplayer / Network Join",
    basePath: "./pages/multiplayer-lobby-network/"
  },
  settings: {
    title: "Settings",
    basePath: "./pages/settings/"
  },
  "release-notes": {
    title: "Release Notes",
    basePath: "./pages/release-notes/"
  },
  lab: {
    title: "Lab",
    basePath: "./pages/lab/"
  }
};

const NAV_TREE = [
  {
    id: "menu",
    label: "Menu",
    route: "menu",
    children: [
      {
        id: "single-player",
        label: "Single Player",
        route: "single-player",
        children: [
          {
            id: "single-player-game-settings",
            label: "Game Settings",
            route: "single-player-game-settings"
          },
          {
            id: "single-player-game",
            label: "Game",
            route: "single-player-game"
          }
        ]
      },
      {
        id: "multiplayer",
        label: "Multiplayer",
        route: "multiplayer",
        children: [
          {
            id: "multiplayer-lobby",
            label: "Lobby",
            route: "multiplayer-lobby",
            children: [
              {
                id: "multiplayer-lobby-joined-game-settings",
                label: "Joined Game Settings",
                route: "multiplayer-lobby-joined-game-settings"
              }
            ]
          },
          {
            id: "multiplayer-host",
            label: "Host",
            route: "multiplayer-host",
            children: [
              {
                id: "multiplayer-host-game-settings",
                label: "Game Settings",
                route: "multiplayer-host-game-settings"
              }
            ]
          },
          {
            id: "multiplayer-host-network",
            label: "Host (Network)",
            route: "multiplayer-host-network"
          },
          {
            id: "multiplayer-lobby-network",
            label: "Join (Network)",
            route: "multiplayer-lobby-network"
          },
          {
            id: "multiplayer-chat",
            label: "Chat (Dev)",
            route: "multiplayer-chat"
          }
        ]
      },
      {
        id: "settings",
        label: "Settings",
        route: "settings"
      },
      {
        id: "release-notes",
        label: "Release Notes",
        route: "release-notes"
      },
      {
        id: "lab",
        label: "Lab",
        route: "lab"
      }
    ]
  }
];

const APP_ROOT = document.querySelector("#appRoot");
const NAV_ROOT = document.querySelector("#navRoot");
const PAGE_STYLESHEET = document.querySelector("#pageStylesheet");

const updateState = {
  swRegistration: null,
  isReloadingForUpdate: false,
  hasReloadedForControllerChange: false,
  promptedBuildIds: new Set(),
  isCheckingForUpdates: false,
  lastHiddenAt: null
};

let mountedPage = null;

function getRouteName() {
  const hash = window.location.hash.replace(/^#\/?/, "").trim();
  return PAGES[hash] ? hash : DEFAULT_ROUTE;
}

function setRoute(routeName) {
  if (window.location.hash.replace(/^#/, "") === `/${routeName}`) {
    return;
  }

  window.location.hash = `/${routeName}`;
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
      resolve({ version, commit, buildId: `${version}+${commit}` });
    };

    worker.postMessage({ type: "GET_VERSION" }, [channel.port2]);
  });
}

async function evaluateWaitingWorker(registration) {
  const waitingWorker = registration?.waiting;
  if (!waitingWorker) {
    return;
  }

  const waitingBuild = await askWorkerBuildInfo(waitingWorker);
  if (!waitingBuild) {
    return;
  }

  const isSameVersionDifferentCommit = waitingBuild.version === APP_VERSION && waitingBuild.commit !== APP_COMMIT_SHORT;
  const hasNewerBuild = isVersionNewer(APP_VERSION, waitingBuild.version) || isSameVersionDifferentCommit;
  if (!hasNewerBuild) {
    return;
  }

  if (updateState.promptedBuildIds.has(waitingBuild.buildId)) {
    return;
  }

  updateState.promptedBuildIds.add(waitingBuild.buildId);
  const shouldUpdate = window.confirm(
    `Update available: v${waitingBuild.version} (${waitingBuild.commit}). Load it now?`
  );

  if (!shouldUpdate) {
    return;
  }

  updateState.isReloadingForUpdate = true;
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
}

async function checkForAppUpdate() {
  const registration = updateState.swRegistration;
  if (!registration || updateState.isCheckingForUpdates || !navigator.onLine) {
    return;
  }

  updateState.isCheckingForUpdates = true;

  try {
    await registration.update();
    await evaluateWaitingWorker(registration);
  } catch {
    // Ignore transient connectivity/update-check failures; scheduled checks will retry.
  } finally {
    updateState.isCheckingForUpdates = false;
  }
}

function startUpdateChecks() {
  window.setInterval(() => {
    if (document.visibilityState !== "visible") {
      return;
    }

    void checkForAppUpdate();
  }, UPDATE_CHECK_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      updateState.lastHiddenAt = Date.now();
      return;
    }

    if (updateState.lastHiddenAt === null) {
      return;
    }

    updateState.lastHiddenAt = null;
    void checkForAppUpdate();
  });

  window.addEventListener("online", () => {
    if (document.visibilityState !== "visible") {
      return;
    }

    void checkForAppUpdate();
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.register("./sw.js").then(async (registration) => {
    updateState.swRegistration = registration;
    await evaluateWaitingWorker(registration);

    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) {
        return;
      }

      installingWorker.addEventListener("statechange", async () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          await evaluateWaitingWorker(registration);
        }
      });
    });

    startUpdateChecks();
    void checkForAppUpdate();
  }).catch((error) => {
    console.warn("Service worker registration failed", error);
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!updateState.isReloadingForUpdate || updateState.hasReloadedForControllerChange) {
      return;
    }
    updateState.hasReloadedForControllerChange = true;
    window.location.reload();
  });
}

function getFirstLeafRoute(node) {
  if (!node) {
    return null;
  }
  if (node.route) {
    return node.route;
  }
  if (!node.children || node.children.length === 0) {
    return null;
  }
  return getFirstLeafRoute(node.children[0]);
}

function findPathByRoute(nodes, routeName, path = []) {
  for (const node of nodes) {
    const nextPath = [...path, node];

    if (node.route === routeName) {
      return nextPath;
    }

    if (node.children?.length) {
      const childPath = findPathByRoute(node.children, routeName, nextPath);
      if (childPath.length) {
        return childPath;
      }
    }
  }

  return [];
}

function renderBreadcrumb(path) {
  if (!path.length) {
    return "";
  }

  return path.map((node) => {
    const route = node.route || getFirstLeafRoute(node);
    return `<a class="crumb-link" href="#/${route}">${node.label}</a>`;
  }).join('<span class="crumb-sep">&gt;</span>');
}

function syncNavVersionVisibility() {
  const breadcrumb = NAV_ROOT.querySelector(".breadcrumb");
  const versionEl = NAV_ROOT.querySelector(".nav-version");
  if (!breadcrumb || !versionEl) return;

  // Restore display so we measure the natural layout with version present.
  versionEl.style.display = "";

  // getBoundingClientRect() forces a synchronous layout (no visual flash).
  // If the breadcrumb's bottom edge drops below the version's, items have wrapped.
  const wraps = breadcrumb.getBoundingClientRect().bottom > versionEl.getBoundingClientRect().bottom + 4;

  // Hiding with display:none frees the reserved space so the breadcrumb
  // can expand to full width and fit on one line again.
  versionEl.style.display = wraps ? "none" : "";
}

window.addEventListener("resize", syncNavVersionVisibility);

function renderNavigation(activeRoute) {
  const activePath = findPathByRoute(NAV_TREE, activeRoute);

  NAV_ROOT.innerHTML = `
    <div class="nav-inner">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        ${renderBreadcrumb(activePath)}
      </nav>
      <span class="nav-version" title="Build ${APP_VERSION} (${APP_COMMIT_SHORT})">v${APP_VERSION}</span>
    </div>
  `;

  syncNavVersionVisibility();
}

async function loadPage(pageName) {
  const page = PAGES[pageName];
  if (!page) {
    throw new Error(`Unknown page: ${pageName}`);
  }

  APP_ROOT.innerHTML = "<p class=\"boot-message\">Loading page...</p>";

  const htmlResponse = await fetch(`${page.basePath}index.html`);
  if (!htmlResponse.ok) {
    throw new Error(`Failed to load ${pageName} page HTML`);
  }

  const pageMarkup = await htmlResponse.text();
  APP_ROOT.innerHTML = pageMarkup;
  PAGE_STYLESHEET.href = `${page.basePath}styles.css`;

  const module = await import(`${page.basePath}page.js`);
  if (typeof mountedPage?.dispose === "function") {
    mountedPage.dispose();
  }

  document.documentElement.dataset.page = pageName;
  document.body.dataset.page = pageName;

  mountedPage = module.mountPage({
    appVersion: APP_VERSION,
    appCommitShort: APP_COMMIT_SHORT,
    appBuildId: APP_BUILD_ID,
    route: pageName,
    setRoute,
    setTitle: (title) => {
      document.title = title;
    }
  }) || null;
  document.title = page.title;
}

function renderLoadError(error) {
  APP_ROOT.innerHTML = `
    <section class="boot-error" role="alert">
      <h1>Page failed to load</h1>
      <p>${error.message}</p>
    </section>
  `;
}

async function bootCurrentRoute() {
  const pageName = getRouteName();
  renderNavigation(pageName);

  try {
    await loadPage(pageName);
  } catch (error) {
    renderLoadError(error);
    console.error("Page bootstrap failed", error);
  }
}

window.addEventListener("hashchange", bootCurrentRoute);
registerServiceWorker();

if (!window.location.hash) {
  setRoute(DEFAULT_ROUTE);
} else {
  bootCurrentRoute();
}
