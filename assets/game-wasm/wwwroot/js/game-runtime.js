const assemblyName = "GameWasm";
const runtimeQuery = new URL(import.meta.url).search;

function setDebugState(state) {
  window.__GAME_WASM_DEBUG__ = {
    ...(window.__GAME_WASM_DEBUG__ || {}),
    ...state
  };
}

const runtimeHostUrl = `/assets/game-wasm/wwwroot/index.html${runtimeQuery}`;

function createParentBridge() {
  let iframe = null;
  let iframeReady = null;

  setDebugState({ mode: "parent", phase: "initializing" });

  const ensureIframe = () => {
    if (iframeReady) {
      return iframeReady;
    }

    setDebugState({ phase: "creating-iframe" });
    iframeReady = new Promise((resolve, reject) => {
      iframe = document.createElement("iframe");
      iframe.src = runtimeHostUrl;
      iframe.hidden = true;
      iframe.setAttribute("aria-hidden", "true");
      iframe.setAttribute("tabindex", "-1");

      iframe.addEventListener("load", () => {
        setDebugState({ phase: "iframe-loaded" });
        if (!iframe?.contentWindow?.GameWasm?.ready) {
          setDebugState({ phase: "iframe-missing-bridge" });
          reject(new Error("GameWasm iframe did not initialize."));
          return;
        }

        setDebugState({ phase: "waiting-child-ready" });
        iframe.contentWindow.GameWasm.ready.then(() => resolve(iframe.contentWindow.GameWasm)).catch(reject);
      }, { once: true });

      iframe.addEventListener("error", () => reject(new Error("Failed to load GameWasm iframe.")), { once: true });

      const mountIframe = () => {
        const mountTarget = document.body || document.documentElement;
        if (!mountTarget) {
          setDebugState({ phase: "no-mount-target" });
          reject(new Error("GameWasm host document is not ready."));
          return;
        }

        setDebugState({ phase: `appending-iframe-to-${mountTarget.tagName.toLowerCase()}` });
        mountTarget.appendChild(iframe);
      };

      if (document.body || document.documentElement) {
        mountIframe();
        return;
      }

      document.addEventListener("DOMContentLoaded", mountIframe, { once: true });
    });

    return iframeReady;
  };

  return {
    ready: ensureIframe(),
    async hydrate(session) {
      const runtime = await ensureIframe();
      return runtime.hydrate(session);
    },
    async getState() {
      const runtime = await ensureIframe();
      return runtime.getState();
    },
    async reset() {
      const runtime = await ensureIframe();
      return runtime.reset();
    },
    async applyAction(request) {
      const runtime = await ensureIframe();
      return runtime.applyAction(request);
    }
  };
}

function createHostedBridge() {
  setDebugState({ mode: "hosted", phase: "initializing" });
  const runtimeReady = (async () => {
    if (typeof Blazor === "undefined") {
      setDebugState({ phase: "missing-blazor" });
      throw new Error("Blazor runtime is not available.");
    }

    setDebugState({ phase: "starting-blazor" });
    await Blazor.start();
    setDebugState({ phase: "blazor-started" });
    return true;
  })();

  async function invoke(methodName, ...args) {
    await runtimeReady;
    return DotNet.invokeMethodAsync(assemblyName, methodName, ...args);
  }

  return {
    ready: runtimeReady,
    hydrate: async (session) => JSON.parse(await invoke("HydrateSessionJson", JSON.stringify(session ?? {}))),
    getState: async () => JSON.parse(await invoke("GetStateJson")),
    reset: async () => JSON.parse(await invoke("ResetSessionJson")),
    applyAction: async (request) => JSON.parse(await invoke("ApplyActionJson", JSON.stringify(request ?? {})))
  };
}

window.GameWasm = window.top === window
  ? createParentBridge()
  : createHostedBridge();
