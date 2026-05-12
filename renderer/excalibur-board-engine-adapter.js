const EXCALIBUR_CDN_URL = "https://cdn.jsdelivr.net/npm/excalibur@0.32.0/build/dist/excalibur.min.js";
const EXCALIBUR_SCRIPT_ID = "game-board-excalibur-runtime";

let excaliburLoadPromise = null;

export function createExcaliburBoardEngineAdapter({ mapEl, canvasEl }) {
  let disposed = false;

  return {
    async initialize() {
      if (disposed) {
        return false;
      }

      if (!mapEl || !canvasEl) {
        return false;
      }

      await loadExcaliburRuntime();
      if (disposed) {
        return false;
      }

      mapEl.dataset.rendererRuntime = "excalibur";
      mapEl.dataset.rendererRuntimeStatus = "ready";
      return true;
    },
    dispose() {
      disposed = true;
      if (mapEl) {
        delete mapEl.dataset.rendererRuntimeStatus;
      }
    }
  };
}

function loadExcaliburRuntime() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.ex) {
    return Promise.resolve();
  }

  if (excaliburLoadPromise) {
    return excaliburLoadPromise;
  }

  excaliburLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(EXCALIBUR_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Excalibur runtime.")), { once: true });
      return;
    }

    const scriptEl = document.createElement("script");
    scriptEl.id = EXCALIBUR_SCRIPT_ID;
    scriptEl.src = EXCALIBUR_CDN_URL;
    scriptEl.async = true;
    scriptEl.defer = true;
    scriptEl.crossOrigin = "anonymous";
    scriptEl.referrerPolicy = "no-referrer";
    scriptEl.addEventListener("load", () => resolve(), { once: true });
    scriptEl.addEventListener("error", () => reject(new Error("Failed to load Excalibur runtime.")), { once: true });
    document.head.appendChild(scriptEl);
  }).catch((error) => {
    excaliburLoadPromise = null;
    throw error;
  });

  return excaliburLoadPromise;
}
