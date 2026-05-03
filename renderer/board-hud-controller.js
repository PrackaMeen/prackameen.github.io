export function createBoardHudController({
  state,
  actionBarEl,
  setNavMessage,
  isTileRevealed,
  getTileAssetUrl,
  onPerformAction,
  onCancelSelection,
  onRotatePlacement
}) {
  return {
    syncHud
  };

  function syncHud() {
    const statusMessage = state.feedback
      || (!state.selectedSource
        ? state.pendingPlacement
          ? (state.pendingPlacement.canCommit
            ? `Tile aligned. Use the action bar to rotate or place & move.`
            : `Rotate the revealed tile using the action bar until it connects.`)
          : `Click ${state.activePlayerName} to select it.`
        : !state.pendingTarget
          ? `Selected ${state.activePlayerName}. Click a tile to preview movement.`
          : `Queued ${isTileRevealed(state.session, state.pendingTarget.x, state.pendingTarget.y) ? "move" : "tile placement"} to (${state.pendingTarget.x}, ${state.pendingTarget.y}). Backend validates on action.`);

    setNavMessage(statusMessage);

    if (actionBarEl) {
      const placement = state.pendingPlacement || state.session?.pendingPlacement || null;
      renderActionBar(actionBarEl, placement);
    }
  }

  function renderActionBar(container, placement) {
    const nodes = [];

    if (placement) {
      nodes.push(createPlacementPreview(placement));
    }

    const buttonConfig = placement
      ? [
          {
            label: "Rotate Left",
            className: "game-board-action-btn game-board-action-btn--ghost",
            disabled: state.isSubmitting,
            onClick: () => void onRotatePlacement(-1)
          },
          {
            label: state.isSubmitting ? "Placing..." : "Place & Move",
            className: "game-board-action-btn",
            disabled: state.isSubmitting || placement.canCommit === false,
            onClick: () => void onPerformAction()
          },
          {
            label: "Rotate Right",
            className: "game-board-action-btn game-board-action-btn--ghost",
            disabled: state.isSubmitting,
            onClick: () => void onRotatePlacement(1)
          }
        ]
      : [
          {
            label: "Cancel",
            className: "game-board-action-btn game-board-action-btn--ghost",
            disabled: !state.selectedSource && !state.pendingTarget,
            onClick: onCancelSelection
          },
          {
            label: state.isSubmitting
              ? "Sending..."
              : isTileRevealed(state.session, state.pendingTarget?.x, state.pendingTarget?.y)
                ? "Confirm Move"
                : "Place Tile",
            className: "game-board-action-btn",
            disabled: state.isSubmitting
              || (!state.selectedSource || !state.pendingTarget || state.selectionPreviewTone?.tone === "red"),
            onClick: () => void onPerformAction()
          }
        ];

    nodes.push(...buttonConfig.map(createActionButton));
    container.replaceChildren(...nodes);
  }

  function createActionButton(config) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = config.className;
    button.disabled = config.disabled;
    button.textContent = config.label;
    button.addEventListener("click", config.onClick);
    return button;
  }

  function createPlacementPreview(placement) {
    const card = document.createElement("div");
    card.className = "game-board-placement-preview";

    const tile = document.createElement("div");
    tile.className = "game-board-placement-preview__tile";
    tile.style.backgroundImage = `url(${getTileAssetUrl(placement.tileKind, placement.tileOrientation)})`;
    tile.setAttribute("aria-hidden", "true");

    const details = document.createElement("div");
    details.className = "game-board-placement-preview__details";

    const title = document.createElement("div");
    title.className = "game-board-placement-preview__title";
    title.textContent = `${placement.tileKind} · ${placement.tileOrientation}`;

    const subtitle = document.createElement("div");
    subtitle.className = "game-board-placement-preview__subtitle";
    subtitle.textContent = placement.canCommit
      ? "Tile ready to commit"
      : "Rotate the tile until it connects";

    details.appendChild(title);
    details.appendChild(subtitle);
    card.appendChild(tile);
    card.appendChild(details);
    return card;
  }
}