export function mountPage(context) {
  context.setTitle("Single Player");

  const listEl = document.getElementById("playerList");
  const addBtn = document.getElementById("addPlayerBtn");

  const players = [{ id: 1, name: "You", type: "human", removable: false }];
  let nextId = 2;

  function renderPlayers() {
    listEl.innerHTML = "";
    players.forEach((player) => {
      const li = document.createElement("li");
      li.className = "player-item";
      li.dataset.playerId = player.id;

      const badge = `<span class="player-badge player-badge--${player.type}">${player.type === "human" ? "Human" : "Bot"}</span>`;
      const removeBtn = player.removable
        ? `<button class="player-remove-btn" data-id="${player.id}" type="button" aria-label="Remove ${player.name}">✕</button>`
        : "";

      li.innerHTML = `
        <span class="player-name">${player.name}</span>
        ${badge}
        ${removeBtn}
      `;
      listEl.appendChild(li);
    });

    listEl.querySelectorAll(".player-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const idx = players.findIndex((p) => p.id === id);
        if (idx !== -1) {
          players.splice(idx, 1);
          reNumberPlayers();
          renderPlayers();
        }
      });
    });
  }

  function reNumberPlayers() {
    players.forEach((p, i) => {
      if (p.removable) {
        p.name = `Player ${i + 1}`;
      }
    });
  }

  function addPlayer() {
    players.push({ id: nextId, name: `Player ${players.length + 1}`, type: "bot", removable: true });
    nextId += 1;
    renderPlayers();
  }

  addBtn.addEventListener("click", addPlayer);
  renderPlayers();

  return {
    dispose() {
      addBtn.removeEventListener("click", addPlayer);
    }
  };
}
