# Karak rules extracted from Zatrolené hry

Source: https://www.zatrolene-hry.cz/spolecenska-hra/karak-7162/

## Game overview

- Family fantasy board game.
- 2-5 players.
- Recommended age: 7+.
- Play time: about 30 minutes.
- Players explore and build a dungeon labyrinth while fighting monsters and collecting treasure.
- The game ends when a dragon is defeated.
- The winner is the player with the highest total treasure value at that moment.

## Core rules extracted from the description

### Setup

- Each player chooses one of five heroes.
- Each hero has two unique abilities.
- Each hero starts with 5 lives.
- All players begin on the start tile with a healing fountain.

### Turn structure and movement

- A turn provides 4 movement steps.
- Movement can continue through explored corridors and rooms up to the movement limit.
- Entering an unexplored area requires drawing a random dungeon tile and connecting it to the map so the hero can enter it.
- Empty corridor tiles let the hero move onto them and continue the turn.
- Entering a room usually triggers a random monster or treasure token.

### Combat

- If a room reveals a monster, combat starts immediately.
- Combat uses two dice plus any bonuses from equipment, spells, or hero abilities.
- The hero must beat the monster's attack value to win.
- On victory, the monster is defeated and the hero may take any equipment present there.
- On a tie, the monster remains and the hero moves back 1 tile.
- On a loss, the monster remains, the hero loses 1 life, and the hero moves back 1 tile.

### Items, chests, and inventory

- Found equipment, keys, and spells go into the inventory.
- The inventory has limited space.
- If the inventory is full, the player may drop an item on the current tile.
- Treasure chests can only be opened after the key is found.

### Map features and special rules

- Portals become usable only after both portal tiles are discovered.
- Portals behave like corridors and cost 1 movement to use.
- Healing fountains fully heal a hero if the turn ends there.
- If a hero loses their last life, they become unconscious and skip actions until their next turn, when they regain 1 life.
- Spells are one-use items.
- One spell gives +1 attack.
- Another spell teleports the hero to the nearest healing fountain and fully heals them.
- Defeating a mummy gives a cursed coin that disables special hero abilities until removed at a healing fountain, or passed on by defeating another mummy.

### Heroes described on the page

- Wizard: can keep magic scrolls after using a magic shot and can move through walls along already discovered corridors.
- Warrior: can reroll both dice in combat and respawns at the nearest healing fountain if he loses his last life.
- Warlock: can sacrifice a life once per turn for +1 attack and can swap places with any other hero.
- Thief: wins monster ties; may choose to fight or ignore a monster when entering its tile.
- Swordsman: can reroll a die on a 1 and may act again on a 6 even after losing or drawing a fight.
- Seer: gets +1 attack if the first move causes combat and may draw two monster/treasure tokens when entering a new room, then choose one.

### Scoring

- Each opened treasure chest is worth 1 victory point.
- The ruby guarded by the dragon is worth 1.5 points.
- Final score is the total treasure value.

## Comparison with the current GAME implementation

### What is already implemented in the app

- A separate demo scene exists in [app/src/scenes/game-scene.ts](../src/scenes/game-scene.ts).
- The app already supports a 5-life health HUD and life loss / restore state in that scene.
- The app already supports dungeon-tile placement, tile orientation, direct movement validation, and adjacent-tile discovery flow.
- The app already has chamber monster encounters and a treasure-drop state machine.
- The app already has an inventory scene and a controller that can move between demo, inventory, menu, and settings scenes.
- The app already persists demo state with local storage.

### Main gaps versus Karak

- There is no hero selection system with five Karak heroes and their special abilities.
- There is no 4-step turn system; the current scene is a demo/navigation flow rather than a full round-based board-game turn engine.
- There is no complete room token system matching Karak's monster, treasure, key, spell, and chest progression.
- There is no dragon endgame or victory-point scoring loop.
- There is no implemented portal, fountain-healing, curse, or unconscious-state rule set matching the Karak description.
- The combat flow in the current app is a debug/demo encounter system, not the full Karak dice-combat rules.
- The current app is centered on a single controllable player box rather than a full multiplayer hero board-game model.

### Practical takeaway

- The current GAME implementation contains reusable building blocks for map discovery, orientation validation, inventory navigation, health display, and encounter state.
- It does not yet implement Karak as a complete ruleset; it only covers a small subset of the movement and encounter surface.
- If the goal is to build Karak faithfully, the next step should be a dedicated game model for heroes, turns, encounters, inventory items, and scoring rather than extending the demo scene directly.

## Implementation gap checklist

### Must-have for a faithful Karak implementation

- [ ] Hero roster with five selectable heroes and two abilities each.
- [ ] Turn-based engine with exactly 4 movement steps per turn.
- [ ] Dungeon tile draw and attachment logic that grows the map during exploration.
- [ ] Room token system for monsters, treasure, keys, spells, portals, chests, and curses.
- [ ] Dice combat resolution with hero bonuses, monster values, tie handling, and loss handling.
- [ ] Inventory rules for equipment, spells, keys, and dropping items when full.
- [ ] Healing fountain logic, unconscious state, and revive behavior.
- [ ] Portal activation after both portal tiles are discovered.
- [ ] Chest/key progression and treasure collection rules.
- [ ] Dragon endgame trigger and treasure-based scoring.

### Already partially covered by the current app

- [x] Health display with 5 life slots.
- [x] Tile placement and orientation-aware movement validation.
- [x] Discovery flow for unexplored tiles.
- [x] Monster encounter state and treasure-drop mapping.
- [x] Inventory scene navigation.
- [x] Demo-state persistence.

### Recommended next implementation layer

- [ ] Introduce a Karak-specific domain model for heroes, turns, items, and scoring.
- [ ] Move rules out of the demo scene and into a dedicated game engine/state layer.
- [ ] Add tests for hero abilities, combat outcomes, and endgame scoring.
