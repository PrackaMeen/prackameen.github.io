export function mountPage(context) {
  context.setTitle("Single Player / Game");

  const listEl = document.getElementById("gamePlayerList");

  const session = window.__GAME_SESSION__;
  if (!session || !Array.isArray(session.players) || session.players.length === 0) {
    listEl.innerHTML = "<li class=\"game-player-item game-player-item--empty\">No player data available.</li>";
    return { dispose() {} };
  }

  session.players.forEach((player) => {
    const li = document.createElement("li");
    li.className = "game-player-item";

    const colorDot = document.createElement("span");
    colorDot.className = "game-player-color";
    if (player.colorHex) {
      colorDot.style.setProperty("--player-color", player.colorHex);
    } else {
      colorDot.classList.add("game-player-color--random");
    }
    colorDot.setAttribute("aria-hidden", "true");

    const icon = document.createElement("span");
    icon.className = "game-player-icon";
    icon.textContent = player.characterIcon;
    icon.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "game-player-name";
    name.textContent = player.name;

    const badge = document.createElement("span");
    badge.className = `game-player-badge game-player-badge--${player.type}`;
    badge.textContent = player.type === "human" ? "Human" : "Bot";

    li.appendChild(colorDot);
    li.appendChild(icon);
    li.appendChild(name);
    li.appendChild(badge);
    listEl.appendChild(li);
  });

  return { dispose() {} };
}
