import { buildGameStartSession } from "../../lib/game-start-session.js";

export function mountPage(context) {
  context.setTitle("Multiplayer / Host / Game Settings");

  const startBtn = document.getElementById("startGameBtn");
  const handleStartGame = () => {
    const mgr = window.__GAME_MULTIPLAYER_SESSION__;
    const peers = typeof mgr?.peers?.getAll === "function" ? mgr.peers.getAll() : [];

    window.__GAME_SESSION__ = buildGameStartSession(peers);
    context.setRoute("game-board");
  };

  startBtn.addEventListener("click", handleStartGame);

  return {
    dispose() {
      startBtn.removeEventListener("click", handleStartGame);
    }
  };
}
