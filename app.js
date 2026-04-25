const APP_VERSION = "1.0.4";
const APP_COMMIT_SHORT = "9ad31c8";
const APP_BUILD_ID = `${APP_VERSION}+${APP_COMMIT_SHORT}`;

const PAGES = {
  lab: {
    title: "G.A.M.E Mobile Test Lab",
    basePath: "./pages/lab/"
  },
  replays: {
    title: "Replay Explorer",
    basePath: "./pages/replays/"
  },
  loadout: {
    title: "Loadout Planner",
    basePath: "./pages/loadout/"
  },
  settings: {
    title: "Lab Settings",
    basePath: "./pages/settings/"
  }
};

const NAVIGATION_GROUPS = [
  {
    label: "Play",
    items: [
      { route: "lab", label: "Live Lab" },
      { route: "replays", label: "Replays" }
    ]
  },
  {
    label: "Configure",
    items: [
      { route: "loadout", label: "Loadout" },
      { route: "settings", label: "Settings" }
    ]
  }
];

const APP_ROOT = document.querySelector("#appRoot");
const NAV_ROOT = document.querySelector("#navRoot");
const PAGE_STYLESHEET = document.querySelector("#pageStylesheet");

let mountedPage = null;

function getRouteName() {
  const hash = window.location.hash.replace(/^#\/?/, "").trim();
  return PAGES[hash] ? hash : "lab";
}

function setRoute(routeName) {
  if (window.location.hash.replace(/^#/, "") === `/${routeName}`) {
    return;
  }

  window.location.hash = `/${routeName}`;
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

function renderNavigation(activePage) {
  NAV_ROOT.innerHTML = `
    <div class="nav-inner">
      <a class="brand" href="#/lab" aria-label="Go to lab">G.A.M.E</a>
      <nav class="hierarchy" aria-label="Application sections">
        ${NAVIGATION_GROUPS.map((group) => `
          <section class="nav-group" aria-label="${group.label}">
            <p class="nav-group-label">${group.label}</p>
            <div class="nav-links">
              ${group.items.map((item) => {
                const isActive = item.route === activePage;
                return `<a class="nav-link ${isActive ? "active" : ""}" href="#/${item.route}" ${isActive ? 'aria-current="page"' : ""}>${item.label}</a>`;
              }).join("")}
            </div>
          </section>
        `).join("")}
      </nav>
    </div>
  `;
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

if (!window.location.hash) {
  setRoute("lab");
} else {
  bootCurrentRoute();
}