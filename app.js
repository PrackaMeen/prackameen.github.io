const APP_VERSION = "1.0.5";
const APP_COMMIT_SHORT = "a61d2c9";
const APP_BUILD_ID = `${APP_VERSION}+${APP_COMMIT_SHORT}`;
const DEFAULT_ROUTE = "single-player-game-settings";

const PAGES = {
  "single-player-game-settings": {
    title: "Single Player / Game Settings",
    basePath: "./pages/single-player-game-settings/"
  },
  "multiplayer-lobby-joined-game-settings": {
    title: "Multiplayer / Lobby / Joined Game Settings",
    basePath: "./pages/multiplayer-lobby-joined-game-settings/"
  },
  "multiplayer-host-game-settings": {
    title: "Multiplayer / Host / Game Settings",
    basePath: "./pages/multiplayer-host-game-settings/"
  },
  settings: {
    title: "Settings",
    basePath: "./pages/settings/"
  },
  "release-notes": {
    title: "Release Notes",
    basePath: "./pages/release-notes/"
  }
};

const NAV_TREE = [
  {
    id: "single-player",
    label: "Single Player",
    children: [
      {
        id: "single-player-game-settings",
        label: "Game Settings",
        route: "single-player-game-settings"
      }
    ]
  },
  {
    id: "multiplayer",
    label: "Multiplayer",
    children: [
      {
        id: "multiplayer-lobby",
        label: "Lobby",
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
        children: [
          {
            id: "multiplayer-host-game-settings",
            label: "Game Settings",
            route: "multiplayer-host-game-settings"
          }
        ]
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
  }
];

const APP_ROOT = document.querySelector("#appRoot");
const NAV_ROOT = document.querySelector("#navRoot");
const PAGE_STYLESHEET = document.querySelector("#pageStylesheet");

const updateState = {
  swRegistration: null,
  isReloadingForUpdate: false,
  promptedBuildIds: new Set()
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

    registration.update().catch(() => {
      // Ignore transient update-check failures; next check will retry.
    });
  }).catch((error) => {
    console.warn("Service worker registration failed", error);
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!updateState.isReloadingForUpdate) {
      return;
    }
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

function renderLinkSet(nodes, activeNodeId) {
  if (!nodes || nodes.length === 0) {
    return "<span class=\"nav-empty\">No deeper level</span>";
  }

  return nodes.map((node) => {
    const route = getFirstLeafRoute(node);
    const activeClass = activeNodeId === node.id ? "active" : "";
    const currentAttr = activeNodeId === node.id ? 'aria-current="page"' : "";
    return `<a class="nav-link ${activeClass}" href="#/${route}" ${currentAttr}>${node.label}</a>`;
  }).join("");
}

function renderBreadcrumb(path) {
  if (!path.length) {
    return "";
  }

  return path.map((node) => {
    const route = getFirstLeafRoute(node);
    return `<a class="crumb-link" href="#/${route}">${node.label}</a>`;
  }).join('<span class="crumb-sep">&gt;</span>');
}

function renderNavigation(activeRoute) {
  const activePath = findPathByRoute(NAV_TREE, activeRoute);
  const menuNode = activePath[0] || null;
  const pageNode = activePath[1] || null;
  const innerNode = activePath[2] || null;
  const pageLevelNodes = menuNode?.children || [];
  const innerLevelNodes = pageNode?.children || [];

  NAV_ROOT.innerHTML = `
    <div class="nav-inner">
      <a class="brand" href="#/${DEFAULT_ROUTE}" aria-label="Go to default page">G.A.M.E</a>
      <p class="nav-hint">menu &gt; page &gt; inner page</p>
      <div class="breadcrumb" aria-label="Breadcrumb">
        ${renderBreadcrumb(activePath)}
      </div>
      <div class="nav-levels">
        <section class="nav-level" aria-label="Menu level">
          <p class="nav-level-label">Menu</p>
          <div class="nav-links">${renderLinkSet(NAV_TREE, menuNode?.id)}</div>
        </section>
        <section class="nav-level" aria-label="Page level">
          <p class="nav-level-label">Page</p>
          <div class="nav-links">${renderLinkSet(pageLevelNodes, pageNode?.id)}</div>
        </section>
        <section class="nav-level" aria-label="Inner page level">
          <p class="nav-level-label">Inner Page</p>
          <div class="nav-links">${renderLinkSet(innerLevelNodes, innerNode?.id)}</div>
        </section>
      </div>
    </div>
  `;
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

  document.documentElement.dataset.page = pageName;
  document.body.dataset.page = pageName;
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