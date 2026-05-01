export function mountPage(context) {
  context.setTitle("Tile Set Demo");

  const gridEl = document.getElementById("tileSetGrid");
  const versionedAssetUrl = typeof window.__GAME_VERSIONED_ASSET_URL__ === "function"
    ? window.__GAME_VERSIONED_ASSET_URL__
    : (assetPath) => assetPath;

  const orderedKinds = ["road0", "road1", "road2", "road3", "road4", "chamber0", "chamber1", "chamber2", "chamber3", "chamber4"];

  void renderTileSet();

  return { dispose() {} };

  async function renderTileSet() {
    if (!gridEl) {
      return;
    }

    const definitions = await loadTileDefinitions();
    const tileKinds = orderedKinds.filter((kind) => Array.isArray(definitions?.tileKinds?.[kind]));

    gridEl.innerHTML = "";

    for (const kind of tileKinds) {
      const entries = [...definitions.tileKinds[kind]].sort((left, right) => Number(left.orientation ?? 0) - Number(right.orientation ?? 0));
      for (const entry of entries) {
        const cell = document.createElement("div");
        cell.className = "tile-set-cell";

        const image = document.createElement("span");
        image.className = `tile-set-cell__image tile-set-cell__image--${kind.startsWith("road") ? "road" : "chamber"}`;
        image.style.backgroundImage = `url(${versionedAssetUrl(entry.sprite)})`;

        cell.appendChild(image);
        gridEl.appendChild(cell);
      }
    }
  }

  async function loadTileDefinitions() {
    const response = await fetch(versionedAssetUrl("./assets/game/tile-definitions.json"));
    if (!response.ok) {
      return { tileKinds: {} };
    }

    return response.json();
  }
}
