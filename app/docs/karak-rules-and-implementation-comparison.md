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
- The app now has a temporary Karak hero roster with selectable heroes and hero-specific combat traits.
- The app now has a pure seeded combat resolver with hero bonuses and hero-specific rerolls.
- The app now has a pure 4-step turn budget helper, and the scene consumes one step per completed movement.
- The app already supports a 5-life health HUD and life loss / restore state in that scene.
- The app now has a pure Karak health flow helper for monster damage, unconscious state, revive, and fountain healing.
- The app already supports dungeon-tile placement, tile orientation, direct movement validation, and adjacent-tile discovery flow.
- The app already has chamber monster encounters and a treasure-drop state machine.
- The app now has a pure Karak inventory-capacity helper, and treasure pickup can store items until the inventory is full.
- The app now has a pure scoring helper for treasure-chest points and the dragon ruby value.
- The app already has an inventory scene and a controller that can move between demo, inventory, menu, and settings scenes.
- The app already persists demo state with local storage.

### Main gaps versus Karak

- The scene still follows the demo-style movement flow, with a real step budget layered on top.
- The movement loop still needs to become a proper Karak exploration loop instead of a debug/navigation flow.
- There is still no complete room-token system matching Karak's monster, treasure, key, spell, and chest progression.
- There is still no portal activation rule, cursed-coin rule, or full chest/key progression.
- There is still no dragon endgame or victory-point resolution loop.
- The current app is still centered on a single controllable player box rather than a full multiplayer hero board-game model.

### Practical takeaway

- The current GAME implementation now covers a useful slice of Karak rules in isolated helpers, but not the full play loop.
- The next work should keep the helper-first approach, then wire those helpers into the scene one rule boundary at a time.
- The safest integration path is movement rewrite first, then room tokens, then chest/key and portal logic, then endgame scoring.

## Progress Plan

### Done

- [x] Temporary hero roster with selectable Karak heroes.
- [x] Seeded combat helper with hero-specific bonuses.
- [x] Turn-step helper with 4-step budget tracking.
- [x] Health flow helper with unconscious, revive, and fountain healing.
- [x] Inventory-capacity helper for treasure pickup.
- [x] Scoring helper for treasure chests and the dragon ruby.

### In progress

- [ ] Replace demo-style movement with a Karak movement loop that consumes the turn-step budget.
- [ ] Turn discovered rooms into token-driven outcomes instead of demo encounters.
- [ ] Wire end-of-turn rules into the movement loop consistently, including fountain healing and revive timing.

### Still missing

- [ ] Dungeon tile draw and attachment logic that grows the map during exploration.
- [ ] Room token system for monsters, treasure, keys, spells, portals, chests, and curses.
- [ ] Portal activation after both portal tiles are discovered.
- [ ] Chest/key progression and treasure collection rules.
- [ ] Dragon endgame trigger and treasure-based scoring.
- [ ] Multiplayer hero board-game model rather than a single demo player box.

## Implementation gap checklist

### Must-have for a faithful Karak implementation

- [x] Hero roster with five selectable heroes and two abilities each. (Temporary selector is in place.)
- [~] Turn-based engine with exactly 4 movement steps per turn. (Helper exists; scene rewrite is still partial.)
- [~] Dungeon tile draw and attachment logic that grows the map during exploration. (Tile placement exists, but not the full Karak expansion loop.)
- [ ] Room token system for monsters, treasure, keys, spells, portals, chests, and curses.
- [~] Dice combat resolution with hero bonuses, monster values, tie handling, and loss handling. (Core combat helper exists; full rule flow is not yet wired everywhere.)
- [~] Inventory rules for equipment, spells, keys, and dropping items when full. (Capacity and treasure pickup are wired; full item model is still missing.)
- [~] Healing fountain logic, unconscious state, and revive behavior. (Helper and end-of-turn fountain hook exist; full turn lifecycle still needs polish.)
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

- [ ] Finish the Karak movement rewrite so one turn = four actual exploration steps.
- [ ] Add a room-token helper for monster, treasure, key, spell, portal, and chest outcomes.
- [ ] Introduce a Karak-specific domain model for inventory items, portals, and scoring.
- [ ] Move the remaining rules out of the demo scene and into a dedicated game engine/state layer.
- [ ] Add tests for room tokens, portal activation, chest/key progression, and endgame scoring.
