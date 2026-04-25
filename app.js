const APP_VERSION = "1.0.3";
const APP_COMMIT_SHORT = "4f7e9a2";
const APP_BUILD_ID = `${APP_VERSION}+${APP_COMMIT_SHORT}`;

const PAGES = {
  lab: {
    title: "G.A.M.E Mobile Test Lab",
    basePath: "./pages/lab/"
  }
};

const APP_ROOT = document.querySelector("#appRoot");
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