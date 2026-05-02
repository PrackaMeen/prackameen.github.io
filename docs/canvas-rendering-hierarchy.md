# Canvas Rendering Hierarchy

## Purpose

This document describes the high-level hierarchy for the G.A.M.E mobile test lab when the application shell stays in HTML + CSS, while the map viewport is rendered on a single `<canvas>` surface.

The design keeps the game rules and state management in the .NET-based WASM layer, and uses JavaScript canvas code only for visual rendering, sprite-sheet loading, and animation playback.

## Core Principle

- .NET WASM owns game logic, state transitions, validation, and turn processing.
- JavaScript owns the canvas renderer, sprite-sheet decoding, and frame-by-frame drawing.
- HTML + CSS owns page layout, HUD panels, buttons, and accessibility-friendly text.
- The map viewport is the only part that moves from DOM-based tiles to canvas-based drawing.

## High-Level Hierarchy

```text
Application Shell
├── HTML layout
│   ├── Header / navigation
│   ├── HUD panels
│   ├── Event feed
│   └── Controls
├── CSS layout
│   ├── Responsive page structure
│   ├── Panel styling
│   └── Canvas positioning and sizing
├── .NET WASM game logic
│   ├── World state
│   ├── Tile rules
│   ├── Entity rules
│   ├── Animation state
│   └── Turn resolution
├── JavaScript canvas renderer
│   ├── Render loop
│   ├── Sprite-sheet asset loader
│   ├── Tile drawing
│   ├── Animation drawing
│   ├── Effect drawing
│   └── Pointer-to-tile input mapping
└── Asset pipeline
    ├── PixelStudio sprite-sheet PNG
    ├── PixelStudio JSON frame metadata
    ├── Offline cache / service worker
    └── Versioned asset delivery
```

## Runtime Flow

1. The page loads the HTML shell and CSS layout.
2. The WASM module boots and loads initial game state.
3. JavaScript initializes the canvas viewport and loads the sprite sheet metadata.
4. The game logic produces a render snapshot for the current map state.
5. The canvas renderer draws tiles, animated tiles, entities, and effects.
6. User input on the canvas is translated into tile coordinates and sent back to game logic.
7. Game logic updates state and requests another render when needed.

## Sprite-Sheet Reading Flow

PixelStudio exports the map art as a PNG sprite sheet plus a JSON metadata file. The renderer reads both parts and turns them into drawable frames.

```text
PixelStudio export
├── tiles.png
└── tiles.json
        ↓
Asset loader
├── fetch JSON metadata
├── load PNG image
├── create bitmap or image object
└── cache frames by name
        ↓
Canvas renderer
├── resolve frame name
├── read frame rectangle
└── draw frame with drawImage()
```

### Frame Lookup

Each frame name in the JSON becomes a lookup key in the renderer.

Example:

```json
{
  "grass_0": { "x": 0, "y": 0, "w": 16, "h": 16 },
  "grass_1": { "x": 16, "y": 0, "w": 16, "h": 16 },
  "water_0": { "x": 0, "y": 16, "w": 16, "h": 16 }
}
```

The renderer uses the frame rectangle to call `drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)`.

## Animation Hierarchy

Animation should be driven by game state, not by the DOM.

```text
Game state
├── Static tiles
├── Animated tiles
├── Entities
└── Effects
        ↓
Animation model
├── Current frame index
├── Frame duration
├── Loop or one-shot behavior
└── State-driven transitions
        ↓
Canvas render pass
├── Draw base map
├── Draw animated tile frames
├── Draw entities
└── Draw visual effects
```

### Animation Rules

- Static tiles are drawn once unless the viewport changes.
- Animated tiles advance by frame index or elapsed time.
- Entities use the same animation model as tiles, but are layered above the map.
- Effects are drawn last so they appear on top of everything else.
- The canvas renderer should only read the animation state; it should not own the rules that advance it.

## Responsibility Split

### .NET WASM

- Maintains the authoritative game state.
- Decides tile types, entity positions, and animation triggers.
- Applies turn-based logic and game rules.
- Produces the state snapshot consumed by the renderer.

### JavaScript Canvas Layer

- Loads sprite-sheet assets.
- Maps frame names to source rectangles.
- Draws the map viewport on a canvas.
- Converts pointer input into tile coordinates.
- Schedules redraws when state changes.

### HTML + CSS Layer

- Preserves the application layout.
- Hosts HUD, stats, and event feed.
- Keeps text accessible and responsive.
- Does not render map tiles directly.

## Suggested Module Structure

```text
prackameen.github.io/
├── app.js
├── flags.js
├── index.html
├── styles.css
├── sw.js
├── renderer/
│   ├── assets.js
│   ├── draw.js
│   ├── input.js
│   ├── loop.js
│   └── viewport.js
└── assets/
    └── sprites/
        ├── tiles.png
        └── tiles.json
```

## Summary

The target architecture is a hybrid model:

- HTML + CSS for structure and UI.
- .NET WASM for game state and rules.
- Canvas for map rendering and animation.
- PixelStudio sprite sheets as the source of visual assets.

This keeps the application maintainable while allowing the map renderer to scale beyond DOM-based tiles.
