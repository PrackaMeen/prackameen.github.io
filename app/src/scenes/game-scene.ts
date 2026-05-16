import { Actor, Circle, Color, CoordPlane, Font, FontUnit, Label, PointerButton, Rectangle, Scene, TextAlign, type Graphic, type PointerEvent, type Vector, vec } from "excalibur";
import { CHAR_SIZE, GAME_HEIGHT, GAME_WIDTH, TILE_SIZE, gameSettings } from "../config";
import type { GameSprites, TrailTileOrientation, TrailTileWalls } from "../game-assets";
import type { GameController } from "../game-controller";
import { BoxActor } from "../actors/box-actor";
import { TileValidationStateMachine } from "../tile-validation-state-machine";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function snapToTileCenter(value: number): number {
  return Math.round((value - TILE_SIZE / 2) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
}

function tileKey(position: Vector): string {
  return `${Math.round(position.x / TILE_SIZE)}:${Math.round(position.y / TILE_SIZE)}`;
}

type DemoMode = "action" | "move" | "zoom";
type MovementPhase = "idle" | "movingToBorder" | "waitingForOrientation" | "movingToTarget" | "attackingMonster" | "turningAfterMonsterDefeat" | "returningAfterMonsterDefeat" | "movingBlockedToWall" | "turningBlocked" | "returningBlocked" | "returningToStart";

type TileActionType = "rotate" | "accept" | "reject";
type TileWallKey = keyof TrailTileWalls;

interface TrailTilePlacement {
  assetName: string;
  orientation: TrailTileOrientation;
  walls: TrailTileWalls;
}

interface ModeButtonControl {
  mode: DemoMode;
  button: Actor;
  label: Label;
  width: number;
  height: number;
}

interface SimpleButtonControl {
  button: Actor;
  label: Label;
  width: number;
  height: number;
}

interface TileActionButtonControl {
  action: TileActionType;
  button: Actor;
  label: Label;
  width: number;
  height: number;
}

interface MonsterDebugUnit {
  actor: Actor;
  label: Label;
  assetGraphic: Graphic;
  debugGraphic: Rectangle;
  colorHex: string;
  debugLabel: string;
  monsterIndex: number;
  tilePositionKey: string;
  offsetX: number;
  offsetY: number;
}

interface DemoSavedTrailTile {
  x: number;
  y: number;
  assetName: string;
  orientation: TrailTileOrientation;
}

interface DemoSavedMonster {
  x: number;
  y: number;
  monsterIndex: number;
}

interface HeartControl {
  actor: Actor;
  index: number;
  activeGraphic: Graphic;
  inactiveGraphic: Graphic;
}

interface DebugOverlayControl {
  actor: Actor;
}

interface DemoSavedStateV1 {
  version: 1;
  player: {
    x: number;
    y: number;
    rotation: number;
    selected: boolean;
  };
  playerHealth?: number;
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  nextTrailTileIndex: number;
  trailTiles: DemoSavedTrailTile[];
  monsters: DemoSavedMonster[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidTrailTileOrientation(value: unknown): value is TrailTileOrientation {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function isDemoSavedTrailTile(value: unknown): value is DemoSavedTrailTile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const tile = value as Partial<DemoSavedTrailTile>;
  return isFiniteNumber(tile.x)
    && isFiniteNumber(tile.y)
    && typeof tile.assetName === "string"
    && isValidTrailTileOrientation(tile.orientation);
}

function isDemoSavedMonster(value: unknown): value is DemoSavedMonster {
  if (!value || typeof value !== "object") {
    return false;
  }

  const monster = value as Partial<DemoSavedMonster>;
  const monsterIndex = monster.monsterIndex;
  return isFiniteNumber(monster.x)
    && isFiniteNumber(monster.y)
    && monsterIndex !== undefined
    && Number.isInteger(monsterIndex)
    && monsterIndex >= 0;
}

function isDemoSavedState(value: unknown): value is DemoSavedStateV1 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<DemoSavedStateV1>;
  const player = snapshot.player;
  const camera = snapshot.camera;
  const nextTrailTileIndex = snapshot.nextTrailTileIndex;

  return snapshot.version === 1
    && player !== null
    && player !== undefined
    && typeof player === "object"
    && isFiniteNumber(player.x)
    && isFiniteNumber(player.y)
    && isFiniteNumber(player.rotation)
    && typeof player.selected === "boolean"
    && (snapshot.playerHealth === undefined || isFiniteNumber(snapshot.playerHealth))
    && camera !== null
    && camera !== undefined
    && typeof camera === "object"
    && isFiniteNumber(camera.x)
    && isFiniteNumber(camera.y)
    && isFiniteNumber(camera.zoom)
    && nextTrailTileIndex !== undefined
    && Number.isInteger(nextTrailTileIndex)
    && nextTrailTileIndex >= 0
    && Array.isArray(snapshot.trailTiles)
    && snapshot.trailTiles.every((tile) => isDemoSavedTrailTile(tile))
    && Array.isArray(snapshot.monsters)
    && snapshot.monsters.every((monster) => isDemoSavedMonster(monster));
}

export class DemoScene extends Scene {
  private readonly controller: GameController;
  private readonly sprites: GameSprites;
  private readonly playerSize = CHAR_SIZE;
  private readonly player = new BoxActor({
    pos: vec(snapToTileCenter(GAME_WIDTH / 2), snapToTileCenter(GAME_HEIGHT / 2)),
    width: this.playerSize,
    height: this.playerSize,
    color: Color.fromHex("#6bf0ff"),
    z: 1
  });
  private readonly topBarHeight = clamp(GAME_HEIGHT * 0.08, 54, 72);
  private readonly topBarItemY = this.topBarHeight / 2;
  private readonly topInset = this.topBarHeight + clamp(GAME_HEIGHT * 0.02, 10, 16);
  private readonly sideInset = clamp(GAME_WIDTH * 0.025, 16, 32);
  private readonly scoreLabel = new Label({
    text: "Action mode: select the box, then tap a target.",
    pos: vec(this.sideInset, this.topInset),
    font: new Font({ family: "Inter", size: clamp(GAME_WIDTH * 0.022, 18, 24), unit: FontUnit.Px, bold: true }),
    color: Color.fromHex("#ffffff"),
    coordPlane: CoordPlane.Screen
  });
  private readonly hintLabel = new Label({
    text: "The camera follows the box in action mode.",
    pos: vec(this.sideInset, this.topInset + clamp(GAME_HEIGHT * 0.045, 26, 40)),
    font: new Font({ family: "Inter", size: clamp(GAME_WIDTH * 0.014, 14, 18), unit: FontUnit.Px }),
    color: Color.fromHex("#9db0d6"),
    coordPlane: CoordPlane.Screen
  });
  private readonly messageLabel = new Label({
    text: "Action mode active.",
    pos: vec(GAME_WIDTH / 2, this.topInset),
    font: new Font({ family: "Space Grotesk", size: clamp(GAME_WIDTH * 0.019, 18, 26), unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
    color: Color.fromHex("#7cf7a3"),
    coordPlane: CoordPlane.Screen
  });
  private readonly debugInfoLabel = new Label({
    text: "M[0,0]\nZ[1.00]",
    pos: vec(this.sideInset, this.topInset + clamp(GAME_HEIGHT * 0.11, 56, 92)),
    font: new Font({ family: "Space Grotesk", size: clamp(GAME_WIDTH * 0.012, 12, 16), unit: FontUnit.Px, bold: true }),
    color: Color.fromHex("#ff4d4d"),
    coordPlane: CoordPlane.Screen
  });
  private readonly maxPlayerHealth = 5;
  private playerHealth = this.maxPlayerHealth;
  private gameOver = false;
  private readonly heartControls: HeartControl[] = [];
  private moveTargetPosition: Vector | null = null;
  private pendingTrailTilePosition: Vector | null = null;
  private pendingTrailTileOrientation: TrailTileOrientation = 0;
  private movementPhase: MovementPhase = "idle";
  private movementStartPosition: Vector | null = null;
  private movementPausePosition: Vector | null = null;
  private previewTrailTile: Actor | null = null;
  private previewAnimationMode: "revealing" | "committing" | null = null;
  private previewOrientationAnimationDirection: 1 | -1 | null = null;
  private previewOrientationElapsed = 0;
  private previewCommitStartPosition: Vector | null = null;
  private previewCommitTargetPosition: Vector | null = null;
  private previewCommitStartScale = 1;
  private previewCommitTargetScale = 1;
  private previewCommitElapsed = 0;
  private readonly previewCommitDuration = 300;
  private readonly previewOrientationDuration = 180;
  private readonly previewIdleScale = 2;
  private readonly occupiedTrailTiles = new Set<string>();
  private readonly trailTilePlacements = new Map<string, TrailTilePlacement>();
  private readonly tileValidation = new TileValidationStateMachine();
  private readonly chamberMonsters = new Map<string, MonsterDebugUnit>();
  private readonly trailTileActors: Actor[] = [];
  private readonly modeButtons: ModeButtonControl[] = [];
  private readonly tileActionButtons: TileActionButtonControl[] = [];
  private readonly menuButton: SimpleButtonControl;
  private readonly inventoryButton: SimpleButtonControl;
  private readonly topBar: Actor;
  private readonly tapTraceLabel: Label;
  private readonly debugOverlayControls: DebugOverlayControl[] = [];
  private readonly showMenuButton = true;
  private readonly tileActionDeadZonePadding = clamp(GAME_HEIGHT * 0.03, 18, 28);
  private interactionMode: DemoMode = "action";
  private monsterVisualDebugMode = !gameSettings.debugInfoEnabled;
  private activeMonsterEncounter: MonsterDebugUnit | null = null;
  private pendingMonsterEncounter: MonsterDebugUnit | null = null;
  private lastMonsterEncounterWinner: "char" | "monster" | null = null;
  private monsterCombatElapsed = 0;
  private readonly monsterCombatDuration = 240;
  private monsterDefeatTurnElapsed = 0;
  private readonly monsterDefeatTurnDuration = 140;
  private monsterDefeatTurnStartRotation = 0;
  private monsterDefeatTurnTargetRotation = 0;
  private cameraDragLastScreenPos: Vector | null = null;
  private cameraZoomLevelIndex = 1;
  private cameraZoomSwipeDistance = 0;
  private cameraZoomSwipeConsumed = false;
  private tileRotationSwipeDistance = 0;
  private tileRotationSwipeConsumed = false;
  private blockedReturnPosition: Vector | null = null;
  private blockedTurnElapsed = 0;
  private readonly blockedTurnDuration = 140;
  private blockedTurnStartRotation = 0;
  private blockedTurnTargetRotation = 0;
  private nextTrailTileIndex = 0;
  private resetRequested = false;
  private readonly primaryPointerDownHandler = (event: PointerEvent): void => {
    if (event.button !== PointerButton.Left) {
      return;
    }

    this.logPointerClick("raw", event.screenPos, event.worldPos);
    this.updateTapTrace(event.screenPos, event.worldPos);

    if (this.handleMenuButtonPress(event.screenPos)) {
      return;
    }

    if (this.handleInventoryButtonPress(event.screenPos)) {
      return;
    }

    if (this.handleModeButtonPress(event.screenPos)) {
      return;
    }

    if (this.handleTileActionButtonPress(event.screenPos)) {
      return;
    }

    if (this.isMovementInputLocked()) {
      return;
    }

    if (this.movementPhase === "waitingForOrientation") {
      this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
      this.tileRotationSwipeDistance = 0;
      this.tileRotationSwipeConsumed = false;
      return;
    }

    if (this.interactionMode === "move" || this.interactionMode === "zoom") {
      this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
      this.cameraZoomSwipeDistance = 0;
      this.cameraZoomSwipeConsumed = false;
      return;
    }

    const boxLeft = this.player.pos.x - this.playerSize / 2;
    const boxRight = this.player.pos.x + this.playerSize / 2;
    const boxTop = this.player.pos.y - this.playerSize / 2;
    const boxBottom = this.player.pos.y + this.playerSize / 2;
    const clickedBox = event.worldPos.x >= boxLeft && event.worldPos.x <= boxRight && event.worldPos.y >= boxTop && event.worldPos.y <= boxBottom;

    if (!this.player.isSelected && clickedBox) {
      this.player.select();
      this.scoreLabel.text = "Box selected. Tap or click a target point.";
      this.messageLabel.text = "Selected box is red. Tap/click again to move it.";
      return;
    }

    if (this.player.isSelected) {
      const targetPosition = vec(
        snapToTileCenter(event.worldPos.x),
        snapToTileCenter(event.worldPos.y)
      );

      this.moveTargetPosition = targetPosition;
      this.beginTileDiscovery(targetPosition);
    }
  };

  constructor(controller: GameController, sprites: GameSprites) {
    super();
    this.controller = controller;
    this.sprites = sprites;
    const topBarButtonHeight = clamp(this.topBarHeight * 0.4, 24, 32);
    this.topBar = new Actor({
      pos: vec(GAME_WIDTH / 2, this.topBarHeight / 2),
      width: GAME_WIDTH,
      height: this.topBarHeight,
      color: Color.fromHex("#6a4322"),
      coordPlane: CoordPlane.Screen,
      z: 90
    });
    this.menuButton = this.createSimpleButton(clamp(GAME_WIDTH * 0.14, 80, 120), this.topBarItemY, clamp(GAME_WIDTH * 0.16, 96, 136), topBarButtonHeight, "go-to-menu");
    this.inventoryButton = this.createSimpleButton(GAME_WIDTH - clamp(GAME_WIDTH * 0.07, 24, 44), this.topBarItemY, clamp(GAME_WIDTH * 0.12, 84, 120), topBarButtonHeight, "Inventory");
    this.tapTraceLabel = new Label({
      text: "Tap trace: idle",
      pos: vec(GAME_WIDTH / 2, this.topBarHeight + 10),
      font: new Font({ family: "Space Grotesk", size: clamp(GAME_WIDTH * 0.012, 12, 16), unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#ffd166"),
      coordPlane: CoordPlane.Screen,
      z: 102
    });
  }

  public requestGameReset(): void {
    this.resetRequested = true;
  }

  override onActivate(): void {
    const pendingDemoState = this.controller.consumePendingDemoState();

    if (pendingDemoState) {
      this.restoreDemoState(pendingDemoState);
      return;
    }

    if (!this.resetRequested) {
      this.controller.saveDemoState();
      return;
    }

    this.performGameReset();
    this.resetRequested = false;
    this.controller.saveDemoState();
  }

  private performGameReset(): void {
    this.clearDynamicSceneState();

    this.moveTargetPosition = null;
    this.pendingTrailTilePosition = null;
    this.pendingTrailTileOrientation = 0;
    this.movementPhase = "idle";
    this.movementStartPosition = null;
    this.movementPausePosition = null;
    this.previewAnimationMode = null;
    this.previewOrientationAnimationDirection = null;
    this.previewOrientationElapsed = 0;
    this.previewCommitStartPosition = null;
    this.previewCommitTargetPosition = null;
    this.previewCommitStartScale = 1;
    this.previewCommitTargetScale = 1;
    this.previewCommitElapsed = 0;
    this.tileValidation.reset();
    this.playerHealth = this.maxPlayerHealth;
    this.activeMonsterEncounter = null;
    this.pendingMonsterEncounter = null;
    this.lastMonsterEncounterWinner = null;
    this.monsterCombatElapsed = 0;
    this.monsterDefeatTurnElapsed = 0;
    this.monsterDefeatTurnStartRotation = 0;
    this.monsterDefeatTurnTargetRotation = 0;
    this.cameraDragLastScreenPos = null;
    this.cameraZoomLevelIndex = 1;
    this.cameraZoomSwipeDistance = 0;
    this.cameraZoomSwipeConsumed = false;
    this.tileRotationSwipeDistance = 0;
    this.tileRotationSwipeConsumed = false;
    this.blockedReturnPosition = null;
    this.blockedTurnElapsed = 0;
    this.blockedTurnStartRotation = 0;
    this.blockedTurnTargetRotation = 0;
    this.nextTrailTileIndex = 0;

    this.player.pos = vec(snapToTileCenter(GAME_WIDTH / 2), snapToTileCenter(GAME_HEIGHT / 2));
    this.player.rotation = 0;
    this.player.clearTargetPosition();
    this.player.deselect();
    this.camera.clearAllStrategies();
    this.camera.strategy.lockToActor(this.player);
    this.camera.pos = vec(this.player.pos.x, this.player.pos.y);
    this.camera.zoom = 1;

    this.showTrailTile(this.player.pos, 0);
    this.setInteractionMode("action");
    this.updateModeButtonStyles();
    this.updateTileActionButtonStyles();
    this.updateDebugInfoLabel();
    this.updateHeartDisplay();
  }

  private clearDynamicSceneState(): void {
    for (const trailTile of this.trailTileActors) {
      trailTile.kill();
    }

    for (const monster of this.chamberMonsters.values()) {
      monster.actor.kill();
      monster.label.kill();
    }

    this.trailTileActors.length = 0;
    this.occupiedTrailTiles.clear();
    this.trailTilePlacements.clear();
    this.chamberMonsters.clear();
    this.clearPreviewTrailTile();

    this.moveTargetPosition = null;
    this.pendingTrailTilePosition = null;
    this.pendingTrailTileOrientation = 0;
    this.movementPhase = "idle";
    this.movementStartPosition = null;
    this.movementPausePosition = null;
    this.previewAnimationMode = null;
    this.previewOrientationAnimationDirection = null;
    this.previewOrientationElapsed = 0;
    this.previewCommitStartPosition = null;
    this.previewCommitTargetPosition = null;
    this.previewCommitStartScale = 1;
    this.previewCommitTargetScale = 1;
    this.previewCommitElapsed = 0;
    this.activeMonsterEncounter = null;
    this.pendingMonsterEncounter = null;
    this.lastMonsterEncounterWinner = null;
    this.monsterCombatElapsed = 0;
    this.monsterDefeatTurnElapsed = 0;
    this.monsterDefeatTurnStartRotation = 0;
    this.monsterDefeatTurnTargetRotation = 0;
    this.blockedReturnPosition = null;
    this.blockedTurnElapsed = 0;
    this.blockedTurnStartRotation = 0;
    this.blockedTurnTargetRotation = 0;
    this.nextTrailTileIndex = 0;
    this.gameOver = false;
  }

  private createHeartHud(): void {
    if (this.heartControls.length > 0) {
      return;
    }

    const heartSize = clamp(this.topBarHeight * 0.38, 14, 22);
    const heartGap = clamp(heartSize * 0.35, 4, 8);
    const totalWidth = this.maxPlayerHealth * heartSize + (this.maxPlayerHealth - 1) * heartGap;
    const startX = GAME_WIDTH / 2 - totalWidth / 2 + heartSize / 2;
    const heartY = this.topBarItemY;

    for (let index = 0; index < this.maxPlayerHealth; index += 1) {
      const heartActor = new Actor({
        pos: vec(startX + index * (heartSize + heartGap), heartY),
        width: heartSize,
        height: heartSize,
        coordPlane: CoordPlane.Screen,
        z: 101
      });

      this.heartControls.push({
        actor: heartActor,
        index,
        activeGraphic: this.sprites.heartActive,
        inactiveGraphic: this.sprites.heartInactive
      });
      this.add(heartActor);
    }
  }

  private layoutHeartHud(): void {
    if (this.heartControls.length === 0) {
      return;
    }

    const heartSize = this.heartControls[0].actor.width;
    const heartGap = clamp(heartSize * 0.35, 4, 8);
    const totalWidth = this.maxPlayerHealth * heartSize + (this.maxPlayerHealth - 1) * heartGap;
    const startX = GAME_WIDTH / 2 - totalWidth / 2 + heartSize / 2;
    const heartY = this.topBarItemY;

    for (const heart of this.heartControls) {
      heart.actor.pos = vec(startX + heart.index * (heartSize + heartGap), heartY);
    }
  }

  private updateHeartDisplay(): void {
    this.layoutHeartHud();
    const debugMode = gameSettings.debugInfoEnabled;

    for (const heart of this.heartControls) {
      const filled = heart.index < this.playerHealth;

      if (debugMode) {
        const colorHex = filled ? "#ff4d4d" : "#5b1f26";
        heart.actor.graphics.use(new Circle({ radius: heart.actor.width / 2, color: Color.fromHex(colorHex) }));
        heart.actor.graphics.opacity = filled ? 1 : 0.35;
        continue;
      }

      heart.actor.graphics.use(filled ? heart.activeGraphic : heart.inactiveGraphic);
      heart.actor.graphics.opacity = filled ? 1 : 0.9;
    }

    this.updateTopBarButtonState();
  }

  private updateTopBarButtonState(): void {
    const canContinue = this.gameOver && gameSettings.debugInfoEnabled;

    this.menuButton.button.color = Color.fromHex("#4c3220");
    this.menuButton.label.color = Color.fromHex("#f3e7d8");

    this.inventoryButton.label.text = canContinue ? "Continue" : "Inventory";
    this.inventoryButton.button.color = canContinue ? Color.fromHex("#7cf7a3") : Color.fromHex("#2c1d14");
    this.inventoryButton.label.color = canContinue ? Color.fromHex("#08121c") : Color.fromHex("#f3e7d8");
    this.inventoryButton.button.graphics.opacity = canContinue ? 1 : 0.92;
    this.inventoryButton.label.opacity = canContinue ? 1 : 0.92;
  }

  public exportDemoState(): string | null {
    if (this.movementPhase !== "idle" || this.activeMonsterEncounter || this.pendingMonsterEncounter) {
      return null;
    }

    const trailTiles: DemoSavedTrailTile[] = [];

    for (const trailTile of this.trailTileActors) {
      const placement = this.trailTilePlacements.get(tileKey(trailTile.pos));

      if (!placement) {
        continue;
      }

      trailTiles.push({
        x: trailTile.pos.x,
        y: trailTile.pos.y,
        assetName: placement.assetName,
        orientation: placement.orientation
      });
    }

    const monsters: DemoSavedMonster[] = [];

    for (const monster of this.chamberMonsters.values()) {
      monsters.push({
        x: monster.actor.pos.x,
        y: monster.actor.pos.y,
        monsterIndex: monster.monsterIndex
      });
    }

    const snapshot: DemoSavedStateV1 = {
      version: 1,
      player: {
        x: this.player.pos.x,
        y: this.player.pos.y,
        rotation: this.player.rotation,
        selected: this.player.isSelected
      },
      playerHealth: this.playerHealth,
      camera: {
        x: this.camera.pos.x,
        y: this.camera.pos.y,
        zoom: this.camera.zoom
      },
      nextTrailTileIndex: this.nextTrailTileIndex,
      trailTiles,
      monsters
    };

    return JSON.stringify(snapshot);
  }

  private restoreDemoState(serializedState: string): void {
    let snapshot: unknown;

    try {
      snapshot = JSON.parse(serializedState) as unknown;
    } catch {
      this.resetInvalidDemoState();
      return;
    }

    if (!isDemoSavedState(snapshot)) {
      this.resetInvalidDemoState();
      return;
    }

    this.clearDynamicSceneState();

    this.nextTrailTileIndex = snapshot.nextTrailTileIndex;

    for (const tile of snapshot.trailTiles) {
      const trailVariant = this.sprites.trailTiles.find((variant) => variant.assetName === tile.assetName);

      if (!trailVariant) {
        continue;
      }

      const key = tileKey(vec(tile.x, tile.y));
      const trailGraphic = trailVariant.orientations[tile.orientation].clone();
      const trailTile = new Actor({
        pos: vec(tile.x, tile.y),
        width: TILE_SIZE,
        height: TILE_SIZE,
        graphic: trailGraphic,
        z: 0,
        scale: vec(1, 1)
      });

      this.add(trailTile);
      this.occupiedTrailTiles.add(key);
      this.trailTilePlacements.set(key, {
        assetName: tile.assetName,
        orientation: tile.orientation,
        walls: trailVariant.collisionByOrientation[tile.orientation]
      });
      this.trailTileActors.push(trailTile);
    }

    const debugColors = ["#ff3b30", "#34c759", "#007aff", "#ffcc00", "#ff2d55", "#00c7be"];

    for (const monster of snapshot.monsters) {
      const monsterGraphic = this.sprites.monsters[monster.monsterIndex]?.graphic;

      if (!monsterGraphic) {
        continue;
      }

      const tilePosition = vec(monster.x, monster.y);
      const tilePositionKey = tileKey(tilePosition);
      const monsterUnit = this.createChamberMonsterUnit(monster.monsterIndex, tilePositionKey, tilePosition, monsterGraphic, debugColors[monster.monsterIndex] ?? "#00c7be");

      this.chamberMonsters.set(tilePositionKey, monsterUnit);
      this.add(monsterUnit.actor);
      this.add(monsterUnit.label);
      this.applyChamberMonsterVisualMode(monsterUnit, gameSettings.debugInfoEnabled);
    }

    this.player.pos = vec(snapshot.player.x, snapshot.player.y);
    this.player.rotation = snapshot.player.rotation;
    this.player.clearTargetPosition();
    this.playerHealth = clamp(snapshot.playerHealth ?? this.maxPlayerHealth, 0, this.maxPlayerHealth);
    this.gameOver = this.playerHealth <= 0;

    if (snapshot.player.selected) {
      this.player.select();
    } else {
      this.player.deselect();
    }

    this.camera.clearAllStrategies();
    this.camera.strategy.lockToActor(this.player);
    this.camera.pos = vec(snapshot.camera.x, snapshot.camera.y);
    this.camera.zoom = snapshot.camera.zoom;
    this.cameraZoomLevelIndex = this.getClosestAllowedZoomLevelIndex(this.camera.zoom);
    this.updateHeartDisplay();
    this.updateModeButtonStyles();
    this.updateTileActionButtonStyles();
    this.updateDebugInfoLabel();
    this.controller.setCanContinueDemo(true);
  }

  private resetInvalidDemoState(): void {
    this.performGameReset();
    this.controller.clearDemoState();
    this.controller.saveDemoState();
  }

  override onInitialize(): void {
    this.player.setStateGraphics(this.sprites.playerNormal, this.sprites.playerSelected);

    this.showTrailTile(this.player.pos, 0);
    this.add(this.player);

    this.add(this.topBar);
    this.add(this.menuButton.button);
    this.add(this.menuButton.label);
    this.add(this.tapTraceLabel);
    this.add(this.inventoryButton.button);
    this.add(this.inventoryButton.label);

    const bottomInset = clamp(GAME_HEIGHT * 0.03, 18, 28);
    const buttonWidth = clamp(GAME_WIDTH * 0.12, 72, 110);
    const buttonHeight = clamp(GAME_HEIGHT * 0.055, 40, 54);
    const buttonGap = clamp(GAME_WIDTH * 0.02, 12, 18);
    const totalWidth = buttonWidth * 3 + buttonGap * 2;
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT - bottomInset - buttonHeight / 2;

    const actionButton = this.createModeButton("action", "A", centerX - totalWidth / 2 + buttonWidth / 2, centerY, buttonWidth, buttonHeight);
    const moveButton = this.createModeButton("move", "M", centerX, centerY, buttonWidth, buttonHeight);
    const zoomButton = this.createModeButton("zoom", "Z", centerX + totalWidth / 2 - buttonWidth / 2, centerY, buttonWidth, buttonHeight);

    this.modeButtons.push(actionButton, moveButton, zoomButton);

    for (const modeButton of this.modeButtons) {
      this.add(modeButton.button);
      this.add(modeButton.label);
    }

    const tileActionButtonWidth = clamp(GAME_WIDTH * 0.11, 84, 120);
    const tileActionButtonHeight = clamp(GAME_HEIGHT * 0.05, 36, 48);
    const tileActionGap = clamp(GAME_WIDTH * 0.015, 10, 14);
    const tileActionTotalWidth = tileActionButtonWidth * 3 + tileActionGap * 2;
    const tileActionCenterX = GAME_WIDTH / 2;
    const tileActionCenterY = clamp(GAME_HEIGHT * 0.72, GAME_HEIGHT * 0.56, GAME_HEIGHT - bottomInset - tileActionButtonHeight / 2 - 12);

    const rotateButton = this.createTileActionButton("rotate", "Rotate", tileActionCenterX - tileActionTotalWidth / 2 + tileActionButtonWidth / 2, tileActionCenterY, tileActionButtonWidth, tileActionButtonHeight);
    const acceptButton = this.createTileActionButton("accept", "Accept", tileActionCenterX, tileActionCenterY, tileActionButtonWidth, tileActionButtonHeight);
    const rejectButton = this.createTileActionButton("reject", "Reject", tileActionCenterX + tileActionTotalWidth / 2 - tileActionButtonWidth / 2, tileActionCenterY, tileActionButtonWidth, tileActionButtonHeight);

    this.tileActionButtons.push(rotateButton, acceptButton, rejectButton);

    for (const actionButton of this.tileActionButtons) {
      this.add(actionButton.button);
      this.add(actionButton.label);
    }

    if (gameSettings.debugInfoEnabled) {
      this.createDebugOverlayControls();
    }

    this.add(this.debugInfoLabel);
    this.createHeartHud();

    this.setInteractionMode("action");
    this.updateTileActionButtonStyles();
    this.updateHeartDisplay();

    const primaryPointer = this.engine.input.pointers.primary;

    primaryPointer.on("down", (event: PointerEvent) => {
      if (event.button !== PointerButton.Left) {
        return;
      }

      this.logPointerClick("raw", event.screenPos, event.worldPos);
      this.updateTapTrace(event.screenPos, event.worldPos);

      if (this.handleMenuButtonPress(event.screenPos)) {
        return;
      }

      if (this.handleInventoryButtonPress(event.screenPos)) {
        return;
      }

      if (this.handleModeButtonPress(event.screenPos)) {
        return;
      }

      if (this.handleTileActionButtonPress(event.screenPos)) {
        return;
      }

      if (this.isMovementInputLocked()) {
        return;
      }

      if (this.movementPhase === "waitingForOrientation") {
        this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
        this.tileRotationSwipeDistance = 0;
        this.tileRotationSwipeConsumed = false;
        return;
      }

      if (this.interactionMode === "move" || this.interactionMode === "zoom") {
        this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
        this.cameraZoomSwipeDistance = 0;
        this.cameraZoomSwipeConsumed = false;
        return;
      }

      const boxLeft = this.player.pos.x - this.playerSize / 2;
      const boxRight = this.player.pos.x + this.playerSize / 2;
      const boxTop = this.player.pos.y - this.playerSize / 2;
      const boxBottom = this.player.pos.y + this.playerSize / 2;
      const clickedBox = event.worldPos.x >= boxLeft && event.worldPos.x <= boxRight && event.worldPos.y >= boxTop && event.worldPos.y <= boxBottom;

      if (!this.player.isSelected && clickedBox) {
        this.player.select();
        this.scoreLabel.text = "Box selected. Tap or click a target point.";
        this.messageLabel.text = "Selected box is red. Tap/click again to move it.";
        return;
      }

      if (this.player.isSelected) {
        const targetPosition = vec(
          snapToTileCenter(event.worldPos.x),
          snapToTileCenter(event.worldPos.y)
        );

        if (this.isOccupiedTrailTile(targetPosition)) {
          const wallKeys = this.getMoveWallKeys(this.player.pos, targetPosition);

          if (wallKeys && this.canMoveBetweenPositions(this.player.pos, targetPosition)) {
            const monster = this.chamberMonsters.get(tileKey(targetPosition));

            this.player.deselect();

            if (monster) {
              const startPosition = vec(this.player.pos.x, this.player.pos.y);
              const pausePosition = this.computeBorderPosition(startPosition, targetPosition);

              this.movementStartPosition = startPosition;
              this.moveTargetPosition = targetPosition;
              this.movementPausePosition = pausePosition;
              this.pendingMonsterEncounter = monster;
              this.movementPhase = "movingToBorder";
              this.player.setTargetPosition(pausePosition, false);
              this.scoreLabel.text = "Moving to the chamber border.";
              this.messageLabel.text = "The box advances before the fight starts.";
            } else {
              this.moveTargetPosition = targetPosition;
              this.movementPhase = "movingToTarget";
              this.player.setTargetPosition(targetPosition);
              this.scoreLabel.text = "Moving to the revealed tile.";
              this.messageLabel.text = "Revealed tiles move directly through open walls.";
            }
          } else if (wallKeys) {
            const returnPosition = vec(this.player.pos.x, this.player.pos.y);
            this.player.deselect();
            this.startBlockedMovement(targetPosition, returnPosition);
            this.scoreLabel.text = "Movement blocked by walls.";
            this.messageLabel.text = "The box turns back before the border.";
          } else {
            this.scoreLabel.text = "Choose an adjacent revealed tile.";
            this.messageLabel.text = "Wall-aware movement only works between neighboring tiles.";
          }
          return;
        }

        if (!this.getMoveWallKeys(this.player.pos, targetPosition)) {
          this.scoreLabel.text = "Choose a neighboring tile.";
          this.messageLabel.text = "Only tiles with a shared border can start the flow.";
          return;
        }

        this.beginTileDiscovery(targetPosition);
        this.player.deselect();
        this.scoreLabel.text = "Tile discovery started. Rotate, accept, or reject.";
        this.messageLabel.text = "The box moves to the tile border and waits.";
      }
    });

    primaryPointer.on("move", (event: PointerEvent) => {
      if (!this.cameraDragLastScreenPos) {
        return;
      }

      if (this.isMovementInputLocked()) {
        return;
      }

      if (this.movementPhase === "waitingForOrientation") {
        const deltaY = event.screenPos.y - this.cameraDragLastScreenPos.y;
        this.tileRotationSwipeDistance += deltaY;

        if (this.tileRotationSwipeConsumed || Math.abs(this.tileRotationSwipeDistance) < gameSettings.cameraZoomDragThreshold) {
          this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
          return;
        }

        this.rotatePreviewTrailTile(this.tileRotationSwipeDistance > 0 ? 1 : -1);
        this.tileRotationSwipeConsumed = true;
        this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
        return;
      }

      if (this.interactionMode === "move") {
        const previousWorld = this.engine.screen.screenToWorldCoordinates(this.cameraDragLastScreenPos);
        const currentWorld = this.engine.screen.screenToWorldCoordinates(event.screenPos);
        const deltaWorld = currentWorld.sub(previousWorld);
        this.camera.pos = this.camera.pos.sub(deltaWorld);
        this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
        return;
      }

      if (this.interactionMode === "zoom") {
        const deltaY = event.screenPos.y - this.cameraDragLastScreenPos.y;
        this.cameraZoomSwipeDistance += deltaY;

        if (this.cameraZoomSwipeConsumed || Math.abs(this.cameraZoomSwipeDistance) < gameSettings.cameraZoomDragThreshold) {
          this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
          return;
        }

        const zoomSteps = this.cameraZoomSwipeDistance > 0 ? 1 : -1;
        const nextZoomLevels = this.getAllowedZoomLevels();
        const nextIndex = clamp(this.cameraZoomLevelIndex + zoomSteps, 0, nextZoomLevels.length - 1);

        if (nextIndex !== this.cameraZoomLevelIndex) {
          this.cameraZoomLevelIndex = nextIndex;
          this.camera.zoom = nextZoomLevels[nextIndex];
        }

        this.cameraZoomSwipeConsumed = true;
        this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
      }
    });

    primaryPointer.on("up", () => {
      this.cameraDragLastScreenPos = null;
      this.cameraZoomSwipeDistance = 0;
      this.cameraZoomSwipeConsumed = false;
      this.tileRotationSwipeDistance = 0;
      this.tileRotationSwipeConsumed = false;
    });

    primaryPointer.on("cancel", () => {
      this.cameraDragLastScreenPos = null;
      this.cameraZoomSwipeDistance = 0;
      this.cameraZoomSwipeConsumed = false;
      this.tileRotationSwipeDistance = 0;
      this.tileRotationSwipeConsumed = false;
    });
  }

  override onPreUpdate(engine: import("excalibur").Engine, elapsed: number): void {
    this.updateDebugInfoLabel();
    this.syncChamberMonsterVisualMode();
    this.updatePreviewCommitAnimation(elapsed);
    this.updatePreviewOrientationAnimation(elapsed);

    if (this.movementPhase === "movingToBorder" && !this.player.isMoving) {
      if (this.pendingMonsterEncounter) {
        const monster = this.pendingMonsterEncounter;
        this.pendingMonsterEncounter = null;
        this.startMonsterEncounter(monster, this.moveTargetPosition ?? this.player.pos);
        return;
      }

      this.enterOrientationWait();
      return;
    }

    if (this.movementPhase === "attackingMonster") {
      this.monsterCombatElapsed = Math.min(this.monsterCombatElapsed + elapsed, this.monsterCombatDuration);

      if (this.monsterCombatElapsed >= this.monsterCombatDuration) {
        this.resolveMonsterEncounter();
      }

      return;
    }

    if (this.movementPhase === "turningAfterMonsterDefeat") {
      this.monsterDefeatTurnElapsed = Math.min(this.monsterDefeatTurnElapsed + elapsed, this.monsterDefeatTurnDuration);
      const progress = this.monsterDefeatTurnDuration <= 0 ? 1 : this.monsterDefeatTurnElapsed / this.monsterDefeatTurnDuration;
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      this.player.rotation = this.monsterDefeatTurnStartRotation + (this.monsterDefeatTurnTargetRotation - this.monsterDefeatTurnStartRotation) * easedProgress;

      if (progress >= 1) {
        this.beginMonsterDefeatReturnMovement();
      }

      return;
    }

    if (this.movementPhase === "returningAfterMonsterDefeat" && !this.player.isMoving) {
      this.finishMonsterDefeatMovement();
      return;
    }

    if (this.movementPhase === "movingToTarget" && !this.player.isMoving) {
      if (this.activeMonsterEncounter) {
        return;
      }

      this.finishMovementToTarget();
      return;
    }

    if (this.movementPhase === "movingBlockedToWall" && !this.player.isMoving) {
      this.beginBlockedReturnTurn();
      return;
    }

    if (this.movementPhase === "turningBlocked") {
      this.blockedTurnElapsed = Math.min(this.blockedTurnElapsed + elapsed, this.blockedTurnDuration);
      const progress = this.blockedTurnDuration <= 0 ? 1 : this.blockedTurnElapsed / this.blockedTurnDuration;
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      this.player.rotation = this.blockedTurnStartRotation + (this.blockedTurnTargetRotation - this.blockedTurnStartRotation) * easedProgress;

      if (progress >= 1) {
        this.beginBlockedReturnMovement();
      }
      return;
    }

    if (this.movementPhase === "returningBlocked" && !this.player.isMoving) {
      this.finishBlockedMovement();
      return;
    }

    if (this.movementPhase === "returningToStart" && !this.player.isMoving) {
      this.finishTileDiscovery(false);
    }
  }

  override onPostDraw(ctx: import("excalibur").ExcaliburGraphicsContext): void {
    this.drawTileMatrix(ctx);

    if (this.interactionMode !== "action" || !this.moveTargetPosition) {
      return;
    }

    const start = this.engine.screen.worldToScreenCoordinates(this.player.pos);
    const endTarget = this.moveTargetPosition;

    if (!endTarget) {
      return;
    }

    const end = this.engine.screen.worldToScreenCoordinates(endTarget);
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance < 1) {
      return;
    }

    const directionX = deltaX / distance;
    const directionY = deltaY / distance;
    const arrowColor = this.movementPhase === "movingBlockedToWall" || this.movementPhase === "turningBlocked" || this.movementPhase === "returningBlocked"
      ? Color.fromHex("#ff7b7b")
      : Color.fromHex("#7cf7a3");
    const headLength = 18;
    const headSpread = 0.45;
    const headBase = vec(end.x - directionX * headLength, end.y - directionY * headLength);
    const leftHead = vec(
      headBase.x + (-directionX * Math.cos(headSpread) - -directionY * Math.sin(headSpread)) * headLength,
      headBase.y + (-directionX * Math.sin(headSpread) + -directionY * Math.cos(headSpread)) * headLength
    );
    const rightHead = vec(
      headBase.x + (-directionX * Math.cos(-headSpread) - -directionY * Math.sin(-headSpread)) * headLength,
      headBase.y + (-directionX * Math.sin(-headSpread) + -directionY * Math.cos(-headSpread)) * headLength
    );

    ctx.debug.drawLine(start, end, { color: arrowColor, lineWidth: 4 });
    ctx.debug.drawLine(end, leftHead, { color: arrowColor, lineWidth: 4 });
    ctx.debug.drawLine(end, rightHead, { color: arrowColor, lineWidth: 4 });

  }

  private createDebugOverlayControls(): void {
    if (this.debugOverlayControls.length > 0) {
      return;
    }

    const overlays = [
      { centerX: this.topBar.pos.x, centerY: this.topBar.pos.y, width: this.topBar.width, height: this.topBar.height, color: "#ffd166" },
      { centerX: this.inventoryButton.button.pos.x, centerY: this.inventoryButton.button.pos.y, width: this.inventoryButton.button.width, height: this.inventoryButton.button.height, color: "#7cf7a3" },
      ...this.modeButtons.map((modeButton) => ({ centerX: modeButton.button.pos.x, centerY: modeButton.button.pos.y, width: modeButton.button.width, height: modeButton.button.height, color: "#7aa8ff" })),
      ...this.tileActionButtons.map((actionButton) => ({
        centerX: actionButton.button.pos.x,
        centerY: actionButton.button.pos.y,
        width: actionButton.button.width,
        height: actionButton.button.height,
        color: this.movementPhase === "waitingForOrientation" ? "#7cf7a3" : "#8f9cac"
      }))
    ];

    for (const overlay of overlays) {
      const actor = new Actor({
        pos: vec(overlay.centerX, overlay.centerY),
        width: overlay.width,
        height: overlay.height,
        coordPlane: CoordPlane.Screen,
        z: 200
      });

      actor.graphics.use(new Rectangle({ width: overlay.width, height: overlay.height, color: Color.fromHex(overlay.color) }));
      actor.graphics.opacity = 0.18;
      this.debugOverlayControls.push({ actor });
      this.add(actor);
    }
  }

  private drawTileMatrix(ctx: import("excalibur").ExcaliburGraphicsContext): void {
    const worldBounds = this.engine.screen.getWorldBounds();
    const startX = Math.floor(worldBounds.left / TILE_SIZE) * TILE_SIZE;
    const endX = Math.ceil(worldBounds.right / TILE_SIZE) * TILE_SIZE;
    const startY = Math.floor(worldBounds.top / TILE_SIZE) * TILE_SIZE;
    const endY = Math.ceil(worldBounds.bottom / TILE_SIZE) * TILE_SIZE;
    const gridColor = Color.fromHex("#27395f");

    for (let x = startX; x <= endX; x += TILE_SIZE) {
      const top = this.engine.screen.worldToScreenCoordinates(vec(x, startY));
      const bottom = this.engine.screen.worldToScreenCoordinates(vec(x, endY));
      ctx.debug.drawLine(top, bottom, { color: gridColor, lineWidth: 1 });
    }

    for (let y = startY; y <= endY; y += TILE_SIZE) {
      const left = this.engine.screen.worldToScreenCoordinates(vec(startX, y));
      const right = this.engine.screen.worldToScreenCoordinates(vec(endX, y));
      ctx.debug.drawLine(left, right, { color: gridColor, lineWidth: 1 });
    }
  }

  private createModeButton(mode: DemoMode, text: string, centerX: number, centerY: number, width: number, height: number): ModeButtonControl {
    const button = new Actor({
      pos: vec(centerX, centerY),
      width,
      height,
      color: Color.fromHex("#1a2948"),
      coordPlane: CoordPlane.Screen,
      z: 100
    });

    const label = new Label({
      text,
      pos: vec(centerX, centerY),
      font: new Font({ family: "Space Grotesk", size: clamp(height * 0.42, 14, 18), unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#edf4ff"),
      coordPlane: CoordPlane.Screen,
      z: 101
    });

    return { mode, button, label, width, height };
  }

  private createSimpleButton(centerX: number, centerY: number, width: number, height: number, text: string): SimpleButtonControl {
    const button = new Actor({
      pos: vec(centerX, centerY),
      width,
      height,
      color: Color.fromHex("#1a2948"),
      coordPlane: CoordPlane.Screen,
      z: 100
    });

    const label = new Label({
      text,
      pos: vec(centerX, centerY),
      font: new Font({ family: "Space Grotesk", size: clamp(height * 0.42, 14, 18), unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#edf4ff"),
      coordPlane: CoordPlane.Screen,
      z: 101
    });

    return { button, label, width, height };
  }

  private createTileActionButton(action: TileActionType, text: string, centerX: number, centerY: number, width: number, height: number): TileActionButtonControl {
    const button = new Actor({
      pos: vec(centerX, centerY),
      width,
      height,
      color: Color.fromHex("#263759"),
      coordPlane: CoordPlane.Screen,
      z: 100
    });

    const label = new Label({
      text,
      pos: vec(centerX, centerY),
      font: new Font({ family: "Space Grotesk", size: clamp(height * 0.38, 13, 17), unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#d6e2ff"),
      coordPlane: CoordPlane.Screen,
      z: 101
    });

    return { action, button, label, width, height };
  }

  private handleModeButtonPress(screenPos: Vector): boolean {
    if (this.movementPhase === "waitingForOrientation") {
      return false;
    }

    for (const modeButton of this.modeButtons) {
      if (this.isPointInsideButton(screenPos, modeButton)) {
        this.logPointerClick(`mode:${modeButton.mode}`, screenPos, this.engine.screen.screenToWorldCoordinates(screenPos));
        this.setInteractionMode(modeButton.mode);
        return true;
      }
    }

    return false;
  }

  private handleMenuButtonPress(screenPos: Vector): boolean {
    if (!this.showMenuButton) {
      return false;
    }

    if (this.isPointInsideButton(screenPos, this.menuButton)) {
      this.logPointerClick("menu", screenPos, this.engine.screen.screenToWorldCoordinates(screenPos));
      this.controller.showMenu();
      return true;
    }

    return false;
  }

  private handleInventoryButtonPress(screenPos: Vector): boolean {
    if (this.isPointInsideButton(screenPos, this.inventoryButton)) {
      this.logPointerClick(this.gameOver && gameSettings.debugInfoEnabled ? "continue" : "inventory", screenPos, this.engine.screen.screenToWorldCoordinates(screenPos));
      if (this.gameOver && gameSettings.debugInfoEnabled) {
        this.playerHealth = this.maxPlayerHealth;
        this.gameOver = false;
        this.updateHeartDisplay();
        this.scoreLabel.text = "All lives restored.";
        this.messageLabel.text = "Continue from the last game state.";
        this.controller.saveDemoState();
        return true;
      }

      this.scoreLabel.text = "Inventory is not implemented yet.";
      this.messageLabel.text = "Inventory button tapped.";
      return true;
    }

    return false;
  }

  private updateTapTrace(screenPos: Vector, worldPos: Vector): void {
    const hits = [
      this.showMenuButton && this.isPointInsideButton(screenPos, this.menuButton) ? "menu" : null,
      this.isPointInsideButton(screenPos, this.inventoryButton) ? "inventory" : null,
      this.modeButtons.some((modeButton) => this.isPointInsideButton(screenPos, modeButton)) ? "mode" : null,
      this.tileActionButtons.some((actionButton) => this.isPointInsideButton(screenPos, actionButton)) ? "action" : null
    ].filter((hit): hit is string => hit !== null);

    const hitText = hits.length > 0 ? hits.join(",") : "none";
    this.tapTraceLabel.text = `Tap trace: s(${Math.round(screenPos.x)},${Math.round(screenPos.y)}) w(${Math.round(worldPos.x)},${Math.round(worldPos.y)}) -> ${hitText}`;
  }

  private logPointerClick(componentName: string, screenPos: Vector, worldPos: Vector): void {
    console.log(`[pointer] ${componentName} screen=${Math.round(screenPos.x)},${Math.round(screenPos.y)} world=${Math.round(worldPos.x)},${Math.round(worldPos.y)}`);
  }

  private handleTileActionButtonPress(screenPos: Vector): boolean {
    if (!this.isInsideTileActionRow(screenPos)) {
      return false;
    }

    if (this.movementPhase !== "waitingForOrientation") {
      return true;
    }

    for (const actionButton of this.tileActionButtons) {
      if (this.isPointInsideButton(screenPos, actionButton)) {
        this.logPointerClick(`tile:${actionButton.action}`, screenPos, this.engine.screen.screenToWorldCoordinates(screenPos));
        if (actionButton.action === "rotate") {
          this.rotatePreviewTrailTile(1);
          return true;
        }

        if (actionButton.action === "accept") {
          this.resumeTileDiscovery();
          return true;
        }

        if (actionButton.action === "reject") {
          this.rejectTileDiscovery();
          return true;
        }
      }
    }

    return true;
  }

  private isInsideTileActionRow(screenPos: Vector): boolean {
    if (this.tileActionButtons.length === 0) {
      return false;
    }

    const left = Math.min(...this.tileActionButtons.map((button) => button.button.pos.x - button.button.width / 2));
    const right = Math.max(...this.tileActionButtons.map((button) => button.button.pos.x + button.button.width / 2));
    const top = Math.min(...this.tileActionButtons.map((button) => button.button.pos.y - button.button.height / 2));
    const bottom = Math.max(...this.tileActionButtons.map((button) => button.button.pos.y + button.button.height / 2));

    return screenPos.x >= left && screenPos.x <= right && screenPos.y >= top && screenPos.y <= bottom;
  }

  private rotatePreviewTrailTile(step: 1 | -1): void {
    if (this.movementPhase !== "waitingForOrientation") {
      return;
    }

    if (this.previewOrientationAnimationDirection) {
      return;
    }

    this.pendingTrailTileOrientation = this.tileValidation.cycleDiscoveryOrientation(this.pendingTrailTileOrientation, step);
    this.previewOrientationAnimationDirection = step;
    this.previewOrientationElapsed = 0;
    this.hintLabel.text = `Orientation: ${this.getOrientationName(this.pendingTrailTileOrientation)}.`;
  }

  private updatePreviewOrientationAnimation(elapsed: number): void {
    if (!this.previewTrailTile || !this.previewOrientationAnimationDirection) {
      return;
    }

    this.previewOrientationElapsed = Math.min(this.previewOrientationElapsed + elapsed, this.previewOrientationDuration);
    const progress = this.previewOrientationDuration <= 0 ? 1 : this.previewOrientationElapsed / this.previewOrientationDuration;
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const rotationAmount = (Math.PI / 2) * easedProgress * this.previewOrientationAnimationDirection;

    this.previewTrailTile.rotation = rotationAmount;

    if (progress >= 1) {
      this.previewTrailTile.rotation = 0;
      this.updatePreviewTrailTileOrientation();
      this.previewOrientationAnimationDirection = null;
      this.previewOrientationElapsed = 0;
    }
  }

  private finishPreviewOrientationAnimation(): void {
    if (!this.previewTrailTile || !this.previewOrientationAnimationDirection) {
      return;
    }

    this.previewTrailTile.rotation = 0;
    this.updatePreviewTrailTileOrientation();
    this.previewOrientationAnimationDirection = null;
    this.previewOrientationElapsed = 0;
  }

  private isPointInsideButton(point: Vector, button: ModeButtonControl | TileActionButtonControl | SimpleButtonControl): boolean {
    const halfWidth = button.width / 2;
    const halfHeight = button.height / 2;
    const left = button.button.pos.x - halfWidth;
    const right = button.button.pos.x + halfWidth;
    const top = button.button.pos.y - halfHeight;
    const bottom = button.button.pos.y + halfHeight;

    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  }

  private beginTileDiscovery(targetPosition: Vector): void {
    const startPosition = vec(this.player.pos.x, this.player.pos.y);
    const target = vec(targetPosition.x, targetPosition.y);
    const pausePosition = this.computeBorderPosition(startPosition, target);

    this.movementStartPosition = startPosition;
    this.moveTargetPosition = target;
    this.movementPausePosition = pausePosition;
    this.pendingTrailTilePosition = target;
    this.pendingTrailTileOrientation = this.getOrientationFromVector(startPosition, target);
    this.movementPhase = "movingToBorder";
    this.player.setTargetPosition(pausePosition, false);
    this.updateTileActionButtonStyles();
    this.hintLabel.text = `Orientation: ${this.getOrientationName(this.pendingTrailTileOrientation)}.`;
  }

  private enterOrientationWait(): void {
    const entryWallKey = this.getEntryWallKey(this.movementStartPosition ?? this.player.pos, this.pendingTrailTilePosition ?? this.player.pos);
    const allowedPendingTrailTileOrientations = this.getAllowedPendingTrailTileOrientations();

    if (allowedPendingTrailTileOrientations.length === 0) {
      this.startBlockedMovement(this.pendingTrailTilePosition ?? this.player.pos, this.movementStartPosition ?? this.player.pos);
      this.messageLabel.text = "That tile collides with the incoming side. The box turns back before the border.";
      this.scoreLabel.text = "Collision blocked the discovery.";
      this.hintLabel.text = `Orientation: ${this.getOrientationName(this.pendingTrailTileOrientation)}. Open the ${this.getWallLabel(entryWallKey)} side to accept.`;
      this.updateModeButtonStyles();
      this.updateTileActionButtonStyles();
      return;
    }

    this.movementPhase = "waitingForOrientation";
    this.player.clearTargetPosition();
    this.pendingTrailTileOrientation = allowedPendingTrailTileOrientations[0];

    this.showPreviewTrailTile();
    this.messageLabel.text = "Rotate the tile, accept to continue, or reject to return.";
    this.scoreLabel.text = "Waiting for tile orientation.";
    this.hintLabel.text = `Orientation: ${this.getOrientationName(this.pendingTrailTileOrientation)}. Open the ${this.getWallLabel(entryWallKey)} side to accept.`;
    this.updateModeButtonStyles();
    this.updateTileActionButtonStyles();
  }

  private resumeTileDiscovery(): void {
    if (!this.moveTargetPosition) {
      return;
    }

    if (!this.canAcceptPendingTrailTile()) {
      this.startBlockedMovement(this.moveTargetPosition);
      this.messageLabel.text = "That tile collides with the incoming side. The box turns back before the border.";
      this.scoreLabel.text = "Collision blocked the discovery.";
      return;
    }

    const nextTrailVariant = this.getNextTrailTileVariant();
    const isChamberTile = nextTrailVariant.assetName.startsWith("chamber");

    this.beginPreviewCommitAnimation();

    if (isChamberTile && this.pendingTrailTilePosition) {
      this.maybeShowChamberMonster(this.pendingTrailTilePosition, nextTrailVariant.assetName);
      this.messageLabel.text = "Chamber accepted. Monster encounter started.";
      this.scoreLabel.text = "Fighting the chamber monster.";
      this.refreshButtonStyles();
      return;
    }

    this.movementPhase = "movingToTarget";
    this.player.setTargetPosition(this.moveTargetPosition);
    this.messageLabel.text = "Tile accepted. Continuing to destination.";
    this.scoreLabel.text = "Moving to the discovered tile.";
    this.updateTileActionButtonStyles();
  }

  private rejectTileDiscovery(): void {
    if (!this.movementStartPosition) {
      return;
    }

    this.movementPhase = "returningToStart";
    this.clearPreviewTrailTile();
    this.player.setTargetPosition(this.movementStartPosition);
    this.messageLabel.text = "Tile rejected. Returning to start.";
    this.scoreLabel.text = "Rejected tile, moving back.";
    this.updateTileActionButtonStyles();
  }

  private finishTileDiscovery(accepted: boolean): void {
    this.movementPhase = "idle";
    if (accepted) {
      this.commitPreviewTrailTile();
    } else {
      this.clearPreviewTrailTile();
    }

    this.moveTargetPosition = null;
    this.pendingTrailTilePosition = null;
    this.movementStartPosition = null;
    this.movementPausePosition = null;
    this.previewCommitStartPosition = null;
    this.previewCommitTargetPosition = null;
    this.previewCommitElapsed = 0;
    this.cameraDragLastScreenPos = null;
    this.cameraZoomSwipeDistance = 0;
    this.cameraZoomSwipeConsumed = false;

    if (accepted) {
      this.messageLabel.text = "Tile discovered and added.";
      this.scoreLabel.text = "Discovery complete.";
    } else {
      this.player.select();
      this.messageLabel.text = "Tile rejected. Choose another move.";
      this.scoreLabel.text = "Back at the start position.";
    }

    this.controller.saveDemoState();

    this.refreshButtonStyles();
  }

  private finishMovementToTarget(): void {
    if (this.pendingTrailTilePosition || this.previewTrailTile) {
      this.finishTileDiscovery(true);
      return;
    }

    this.movementPhase = "idle";
    this.moveTargetPosition = null;
    this.movementStartPosition = null;
    this.movementPausePosition = null;
    this.cameraDragLastScreenPos = null;
    this.cameraZoomSwipeDistance = 0;
    this.cameraZoomSwipeConsumed = false;
    this.controller.saveDemoState();
    this.refreshButtonStyles();
  }

  private refreshButtonStyles(): void {
    this.updateModeButtonStyles();
    this.updateTileActionButtonStyles();
  }

  private computeBorderPosition(start: Vector, target: Vector): Vector {
    const delta = target.sub(start);
    const distance = Math.hypot(delta.x, delta.y);

    if (distance <= 0) {
      return vec(start.x, start.y);
    }

    const step = Math.min(TILE_SIZE / 2, distance / 2);
    const direction = delta.scale(1 / distance);
    return vec(start.x + direction.x * step, start.y + direction.y * step);
  }

  private getOrientationFromVector(start: Vector, target: Vector): TrailTileOrientation {
    const deltaX = target.x - start.x;
    const deltaY = target.y - start.y;

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      return deltaX >= 0 ? 1 : 3;
    }

    return deltaY >= 0 ? 2 : 0;
  }

  private getOrientationName(orientation: TrailTileOrientation): string {
    switch (orientation) {
      case 0:
        return "Up";
      case 1:
        return "Right";
      case 2:
        return "Down";
      case 3:
      default:
        return "Left";
    }
  }

  private updateTileActionButtonStyles(): void {
    const isWaiting = this.movementPhase === "waitingForOrientation";

    for (const actionButton of this.tileActionButtons) {
      if (!isWaiting) {
        actionButton.button.color = Color.fromHex("#263759");
        actionButton.label.color = Color.fromHex("#7f8ea8");
        continue;
      }

      if (actionButton.action === "rotate") {
        actionButton.button.color = Color.fromHex("#3a4e7b");
        actionButton.label.color = Color.fromHex("#edf4ff");
      } else if (actionButton.action === "accept") {
        actionButton.button.color = Color.fromHex("#7cf7a3");
        actionButton.label.color = Color.fromHex("#08121c");
      } else {
        actionButton.button.color = Color.fromHex("#ff7b7b");
        actionButton.label.color = Color.fromHex("#08121c");
      }
    }
  }

  private getPendingTrailTileVariant(): GameSprites["trailTiles"][number] {
    return this.sprites.trailTiles[this.nextTrailTileIndex % this.sprites.trailTiles.length];
  }

  private getEntryWallKey(start: Vector, target: Vector): TileWallKey {
    const deltaX = target.x - start.x;
    const deltaY = target.y - start.y;

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      return deltaX >= 0 ? "westWall" : "eastWall";
    }

    return deltaY >= 0 ? "northWall" : "southWall";
  }

  private getWallLabel(wallKey: TileWallKey): string {
    switch (wallKey) {
      case "northWall":
        return "North";
      case "eastWall":
        return "East";
      case "southWall":
        return "South";
      case "westWall":
      default:
        return "West";
    }
  }

  private canAcceptPendingTrailTile(): boolean {
    return this.tileValidation.isDiscoveryOrientationAllowed(this.pendingTrailTileOrientation);
  }

  private getAllowedPendingTrailTileOrientations(): TrailTileOrientation[] {
    if (!this.movementStartPosition || !this.pendingTrailTilePosition) {
      return [];
    }

    const sourceTile = this.getPlacedTrailTile(this.movementStartPosition);
    const currentVariant = this.getNextTrailTileVariant();
    const result = this.tileValidation.beginDiscovery(
      { x: this.movementStartPosition.x, y: this.movementStartPosition.y },
      { x: this.pendingTrailTilePosition.x, y: this.pendingTrailTilePosition.y },
      sourceTile?.walls ?? null,
      currentVariant.collisionByOrientation
    );

    return result.allowedOrientations;
  }

  private finishBlockedMovement(): void {
    this.movementPhase = "idle";
    this.moveTargetPosition = null;
    this.blockedReturnPosition = null;
    this.blockedTurnElapsed = 0;
    this.blockedTurnStartRotation = 0;
    this.blockedTurnTargetRotation = 0;
    this.movementStartPosition = null;
    this.movementPausePosition = null;
    this.pendingTrailTilePosition = null;
    this.pendingTrailTileOrientation = 0;
    this.previewCommitStartPosition = null;
    this.previewCommitTargetPosition = null;
    this.previewCommitElapsed = 0;
    this.cameraDragLastScreenPos = null;
    this.cameraZoomSwipeDistance = 0;
    this.cameraZoomSwipeConsumed = false;
    this.player.clearTargetPosition();
    this.clearPreviewTrailTile();
    this.scoreLabel.text = "Movement blocked by walls.";
    this.messageLabel.text = "The box turned back and returned to the start.";
    this.controller.saveDemoState();
    this.updateModeButtonStyles();
    this.updateTileActionButtonStyles();
  }

  private setInteractionMode(mode: DemoMode): void {
    this.interactionMode = mode;
    this.cameraDragLastScreenPos = null;
    this.moveTargetPosition = null;
    this.cameraZoomSwipeDistance = 0;
    this.cameraZoomSwipeConsumed = false;
    this.player.clearTargetPosition();
    this.player.deselect();
    this.camera.clearAllStrategies();

    if (mode === "action") {
      this.camera.strategy.lockToActor(this.player);
      this.scoreLabel.text = "Action mode: select the box, then tap a target.";
      this.hintLabel.text = "The camera follows the box in action mode.";
      this.messageLabel.text = "Action mode active.";
    } else if (mode === "move") {
      this.scoreLabel.text = "Move mode: drag anywhere to pan the camera.";
      this.hintLabel.text = "Use this to inspect the world without following the box.";
      this.messageLabel.text = "Move mode active.";
    } else {
      this.scoreLabel.text = "Zoom mode: drag vertically to change camera zoom.";
      this.cameraZoomLevelIndex = this.getClosestAllowedZoomLevelIndex(this.camera.zoom);
      const allowedZoomLevels = this.getAllowedZoomLevels();
      if (allowedZoomLevels.length > 0) {
        this.camera.zoom = allowedZoomLevels[this.cameraZoomLevelIndex];
      }
      this.hintLabel.text = "Drag downward to zoom in and upward to zoom out in fixed steps.";
      this.messageLabel.text = "Zoom mode active.";
    }

    this.updateModeButtonStyles();
  }

  private updateModeButtonStyles(): void {
    const isPreviewing = this.movementPhase === "waitingForOrientation";

    for (const modeButton of this.modeButtons) {
      const isActive = modeButton.mode === this.interactionMode;
      if (isPreviewing) {
        modeButton.button.color = isActive ? Color.fromHex("#4f7a57") : Color.fromHex("#152236");
        modeButton.label.color = isActive ? Color.fromHex("#c8d7ce") : Color.fromHex("#8f9cac");
        continue;
      }

      modeButton.button.color = isActive ? Color.fromHex("#7cf7a3") : Color.fromHex("#1a2948");
      modeButton.label.color = isActive ? Color.fromHex("#08121c") : Color.fromHex("#edf4ff");
    }
  }

  private isMovementInputLocked(): boolean {
    return this.gameOver
      || this.movementPhase === "movingToBorder"
      || this.movementPhase === "movingToTarget"
      || this.movementPhase === "attackingMonster"
      || this.movementPhase === "turningAfterMonsterDefeat"
      || this.movementPhase === "returningAfterMonsterDefeat"
      || this.movementPhase === "movingBlockedToWall"
      || this.movementPhase === "turningBlocked"
      || this.movementPhase === "returningBlocked"
      || this.movementPhase === "returningToStart";
  }

  private updateDebugInfoLabel(): void {
    if (!gameSettings.debugInfoEnabled) {
      this.debugInfoLabel.text = "";
      return;
    }

    const cameraX = Math.round(this.camera.pos.x);
    const cameraY = Math.round(this.camera.pos.y);
    const characterX = Math.round(this.player.pos.x);
    const characterY = Math.round(this.player.pos.y);
    const zoom = this.camera.zoom.toFixed(2);
    const winner = this.lastMonsterEncounterWinner === null ? "none" : this.lastMonsterEncounterWinner;
    this.debugInfoLabel.text = `M[${cameraX},${cameraY}]\nCh[${characterX},${characterY}]\nZ[${zoom}]\nFight[${winner}]`;
  }

  private showTrailTile(position: Vector, orientation: TrailTileOrientation): void {
    const key = tileKey(position);
    const trailVariant = this.getNextTrailTileVariant();

    if (this.occupiedTrailTiles.has(key)) {
      return;
    }

    const trailGraphic = trailVariant.orientations[orientation].clone();
    const trailTile = new Actor({
      pos: vec(position.x, position.y),
      width: TILE_SIZE,
      height: TILE_SIZE,
      graphic: trailGraphic,
      z: 0,
      scale: vec(this.previewIdleScale, this.previewIdleScale)
    });
    this.add(trailTile);
    trailTile.actions.scaleTo({ scale: vec(1, 1), duration: this.previewCommitDuration });
    this.occupiedTrailTiles.add(key);
    this.trailTilePlacements.set(key, {
      assetName: trailVariant.assetName,
      orientation,
      walls: trailVariant.collisionByOrientation[orientation]
    });
    this.trailTileActors.push(trailTile);
    this.nextTrailTileIndex += 1;
  }

  private maybeShowChamberMonster(tilePosition: Vector, assetName: string): void {
    if (!assetName.startsWith("chamber")) {
      return;
    }

    const tilePositionKey = tileKey(tilePosition);

    if (this.chamberMonsters.has(tilePositionKey)) {
      return;
    }

    const monsterIndex = this.getMonsterIndexForChamberAsset(assetName);
    const monsterGraphic = this.sprites.monsters[monsterIndex]?.graphic;

    if (!monsterGraphic) {
      throw new Error(`Missing monster graphic for chamber asset ${assetName}.`);
    }

    const debugColors = ["#ff3b30", "#34c759", "#007aff", "#ffcc00", "#ff2d55", "#00c7be"];
    const monster = this.createChamberMonsterUnit(monsterIndex, tilePositionKey, vec(tilePosition.x, tilePosition.y), monsterGraphic, debugColors[monsterIndex] ?? "#00c7be");

    this.chamberMonsters.set(tilePositionKey, monster);
    this.add(monster.actor);
    this.add(monster.label);
    this.applyChamberMonsterVisualMode(monster, gameSettings.debugInfoEnabled);
    this.syncChamberMonsterVisualMode();
    this.startMonsterEncounter(monster, tilePosition);
  }

  private createChamberMonsterUnit(monsterIndex: number, tilePositionKey: string, position: Vector, assetGraphic: Graphic, colorHex: string): MonsterDebugUnit {
    const actor = new Actor({
      pos: vec(position.x, position.y),
      width: this.playerSize,
      height: this.playerSize,
      z: 1
    });
    const label = new Label({
      text: (monsterIndex + 1).toString(),
      pos: vec(position.x, position.y),
      font: new Font({ family: "Space Grotesk", size: clamp(this.playerSize * 0.46, 14, 24), unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#f4f7ff"),
      z: 2
    });
    const debugGraphic = new Rectangle({
      width: this.playerSize,
      height: this.playerSize,
      color: Color.fromHex(colorHex),
      smoothing: false
    });

    return { actor, label, assetGraphic, debugGraphic, colorHex, debugLabel: (monsterIndex + 1).toString(), monsterIndex, tilePositionKey, offsetX: 0, offsetY: 0 };
  }

  private startMonsterEncounter(monster: MonsterDebugUnit, targetPosition: Vector): void {
    if (this.activeMonsterEncounter) {
      return;
    }

    this.activeMonsterEncounter = monster;
    this.lastMonsterEncounterWinner = null;
    this.monsterCombatElapsed = 0;
    this.monsterDefeatTurnElapsed = 0;
    this.player.clearTargetPosition();
    this.moveTargetPosition = targetPosition;
    this.movementPhase = "attackingMonster";
    this.scoreLabel.text = "Monster encounter started.";
    this.messageLabel.text = "The box attacks immediately.";
  }

  private resolveMonsterEncounter(): void {
    const monster = this.activeMonsterEncounter;

    if (!monster) {
      this.movementPhase = "idle";
      return;
    }

    if (this.isPlayerVictoriousAgainstMonster(monster.monsterIndex)) {
      this.removeChamberMonster(monster);
      this.activeMonsterEncounter = null;
      this.lastMonsterEncounterWinner = "char";
      this.messageLabel.text = "The monster is defeated. The box keeps moving forward.";
      this.scoreLabel.text = "Monster defeated.";
      this.player.setTargetPosition(this.moveTargetPosition ?? this.player.pos);
      this.movementPhase = "movingToTarget";
      return;
    }

    this.lastMonsterEncounterWinner = "monster";
    this.messageLabel.text = "The monster wins. The box turns back.";
    this.scoreLabel.text = "Monster won the encounter.";
    this.activeMonsterEncounter = null;
    this.playerHealth = clamp(this.playerHealth - 1, 0, this.maxPlayerHealth);
    this.updateHeartDisplay();
    if (this.movementPausePosition) {
      this.player.pos = vec(this.movementPausePosition.x, this.movementPausePosition.y);
    }
    this.player.clearTargetPosition();
    this.blockedReturnPosition = this.movementStartPosition ? vec(this.movementStartPosition.x, this.movementStartPosition.y) : null;
    this.beginMonsterDefeatTurn();
    this.messageLabel.text = "The monster wins. The box turns back at the border.";
    this.scoreLabel.text = "Returning to the initial position.";
  }

  private beginMonsterDefeatTurn(): void {
    this.movementPhase = "turningAfterMonsterDefeat";
    this.monsterDefeatTurnElapsed = 0;
    this.monsterDefeatTurnStartRotation = this.player.rotation;
    this.monsterDefeatTurnTargetRotation = this.player.rotation + Math.PI;
  }

  private beginMonsterDefeatReturnMovement(): void {
    this.player.setTargetPosition(this.movementStartPosition ?? this.player.pos, false);
    this.movementPhase = "returningAfterMonsterDefeat";
  }

  private finishMonsterDefeatMovement(): void {
    this.activeMonsterEncounter = null;
    this.player.clearTargetPosition();
    this.player.deselect();
    this.player.select();
    this.moveTargetPosition = null;
    this.pendingTrailTilePosition = null;
    this.movementStartPosition = null;
    this.movementPausePosition = null;
    this.blockedReturnPosition = null;
    this.previewTrailTile = null;
    this.previewCommitStartPosition = null;
    this.previewCommitTargetPosition = null;
    this.previewCommitElapsed = 0;
    this.movementPhase = "idle";
    if (this.playerHealth <= 0) {
      this.gameOver = true;
      this.scoreLabel.text = "No lives left.";
      this.messageLabel.text = gameSettings.debugInfoEnabled
        ? "Game over. Use Continue to restore all lives."
        : "Game over. Return to the menu.";
    } else {
      this.scoreLabel.text = "The box returned to the start tile.";
      this.messageLabel.text = "The chamber monster pushed it back.";
    }
    this.updateHeartDisplay();
    this.controller.saveDemoState();
  }

  private removeChamberMonster(monster: MonsterDebugUnit): void {
    this.chamberMonsters.delete(monster.tilePositionKey);
    monster.actor.kill();
    monster.label.kill();
  }

  private isPlayerVictoriousAgainstMonster(monsterIndex: number): boolean {
    return monsterIndex % 2 === 0;
  }

  private syncChamberMonsterVisualMode(): void {
    const debugModeEnabled = gameSettings.debugInfoEnabled;

    if (this.monsterVisualDebugMode === debugModeEnabled) {
      return;
    }

    this.monsterVisualDebugMode = debugModeEnabled;

    for (const monster of this.chamberMonsters.values()) {
      this.applyChamberMonsterVisualMode(monster, debugModeEnabled);
    }
  }

  private applyChamberMonsterVisualMode(monster: MonsterDebugUnit, debugModeEnabled: boolean): void {
    monster.actor.rotation = 0;

    if (debugModeEnabled) {
      monster.actor.graphics.use(monster.debugGraphic);
      monster.label.text = monster.debugLabel;
      monster.label.opacity = 1;
    } else {
      monster.actor.graphics.use(monster.assetGraphic);
      monster.label.opacity = 0;
    }
  }

  private getMonsterIndexForChamberAsset(assetName: string): number {
    const chamberIndex = Number.parseInt(assetName.replace("chamber", ""), 10);

    if (!Number.isInteger(chamberIndex) || chamberIndex < 0) {
      throw new Error(`Invalid chamber asset name: ${assetName}.`);
    }

    return Math.min(chamberIndex, this.sprites.monsters.length - 1);
  }

  private isOccupiedTrailTile(position: Vector): boolean {
    return this.occupiedTrailTiles.has(tileKey(position));
  }

  private getPlacedTrailTile(position: Vector): TrailTilePlacement | null {
    return this.trailTilePlacements.get(tileKey(position)) ?? null;
  }

  private getNextTrailTileVariant(): GameSprites["trailTiles"][number] {
    return this.sprites.trailTiles[this.nextTrailTileIndex % this.sprites.trailTiles.length];
  }

  private getMoveWallKeys(from: Vector, to: Vector): { fromWall: TileWallKey; toWall: TileWallKey } | null {
    return this.tileValidation.getMoveWallKeys(
      { x: from.x, y: from.y },
      { x: to.x, y: to.y }
    );
  }

  private canMoveBetweenPositions(from: Vector, to: Vector): boolean {
    const fromTile = this.getPlacedTrailTile(from);
    const toTile = this.getPlacedTrailTile(to);

    return this.tileValidation.validateDirectMove(
      { x: from.x, y: from.y },
      { x: to.x, y: to.y },
      fromTile?.walls ?? null,
      toTile?.walls ?? null
    ).kind === "allowed";
  }

  private canTraverseBetweenWalls(fromWalls: TrailTileWalls, toWalls: TrailTileWalls, wallKeys: { fromWall: TileWallKey; toWall: TileWallKey }): boolean {
    return this.tileValidation.canTraverseBetweenWalls(fromWalls, toWalls, wallKeys);
  }

  private startBlockedMovement(targetPosition: Vector, returnPosition?: Vector): void {
    this.clearPreviewTrailTile();
    this.moveTargetPosition = targetPosition;
    this.blockedReturnPosition = returnPosition ? vec(returnPosition.x, returnPosition.y) : this.movementStartPosition;
    this.blockedTurnElapsed = 0;
    this.blockedTurnStartRotation = this.player.rotation;
    this.blockedTurnTargetRotation = this.player.rotation + Math.PI;
    const blockedApproachTarget = this.computeBorderPosition(
      this.movementStartPosition ?? this.player.pos,
      targetPosition
    );

    this.movementPhase = "movingBlockedToWall";
    this.player.setTargetPosition(blockedApproachTarget, false);
  }

  private beginBlockedReturnTurn(): void {
    this.movementPhase = "turningBlocked";
    this.blockedTurnElapsed = 0;
    this.blockedTurnStartRotation = this.player.rotation;
    this.blockedTurnTargetRotation = this.player.rotation + Math.PI;
  }

  private beginBlockedReturnMovement(): void {
    if (!this.blockedReturnPosition) {
      this.finishBlockedMovement();
      return;
    }

    this.movementPhase = "returningBlocked";
    this.player.setTargetPosition(this.blockedReturnPosition, false);
    this.messageLabel.text = "Blocked by walls. Turning back to start.";
    this.scoreLabel.text = "Returning to the initial position.";
  }

  private showPreviewTrailTile(): void {
    if (!this.movementPausePosition) {
      return;
    }

    this.clearPreviewTrailTile();

    const previewGraphic = this.sprites.trailTiles[this.nextTrailTileIndex % this.sprites.trailTiles.length].orientations[this.pendingTrailTileOrientation].clone();
    this.previewTrailTile = new Actor({
      pos: vec(this.pendingTrailTilePosition?.x ?? this.movementPausePosition.x, this.pendingTrailTilePosition?.y ?? this.movementPausePosition.y),
      width: TILE_SIZE,
      height: TILE_SIZE,
      graphic: previewGraphic,
      z: 2,
      scale: vec(1, 1)
    });

    this.add(this.previewTrailTile);
    this.previewAnimationMode = "revealing";
    this.previewCommitStartPosition = vec(this.pendingTrailTilePosition?.x ?? this.movementPausePosition.x, this.pendingTrailTilePosition?.y ?? this.movementPausePosition.y);
    this.previewCommitTargetPosition = vec(this.movementPausePosition.x, this.movementPausePosition.y);
    this.previewCommitStartScale = 1;
    this.previewCommitTargetScale = this.previewIdleScale;
    this.previewCommitElapsed = 0;
  }

  private beginPreviewCommitAnimation(): void {
    if (!this.previewTrailTile || !this.pendingTrailTilePosition) {
      return;
    }

    this.previewAnimationMode = "committing";
    this.previewCommitStartPosition = vec(this.previewTrailTile.pos.x, this.previewTrailTile.pos.y);
    this.previewCommitTargetPosition = vec(this.pendingTrailTilePosition.x, this.pendingTrailTilePosition.y);
    this.previewCommitStartScale = this.previewTrailTile.scale.x;
    this.previewCommitTargetScale = 1;
    this.previewCommitElapsed = 0;
  }

  private updatePreviewCommitAnimation(elapsed: number): void {
    if (!this.previewTrailTile || !this.previewAnimationMode || !this.previewCommitStartPosition || !this.previewCommitTargetPosition) {
      return;
    }

    this.previewCommitElapsed = Math.min(this.previewCommitElapsed + elapsed, this.previewCommitDuration);
    const progress = this.previewCommitDuration <= 0 ? 1 : this.previewCommitElapsed / this.previewCommitDuration;
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const currentX = this.previewCommitStartPosition.x + (this.previewCommitTargetPosition.x - this.previewCommitStartPosition.x) * easedProgress;
    const currentY = this.previewCommitStartPosition.y + (this.previewCommitTargetPosition.y - this.previewCommitStartPosition.y) * easedProgress;
    const currentScale = this.previewCommitStartScale + (this.previewCommitTargetScale - this.previewCommitStartScale) * easedProgress;

    this.previewTrailTile.pos = vec(currentX, currentY);
    this.previewTrailTile.scale = vec(currentScale, currentScale);

    if (progress >= 1) {
      if (this.previewAnimationMode === "revealing") {
        this.previewAnimationMode = null;
      } else {
        this.commitPreviewTrailTile();
      }
    }
  }

  private commitPreviewTrailTile(): void {
    if (!this.previewTrailTile || !this.pendingTrailTilePosition) {
      return;
    }

    const key = tileKey(this.pendingTrailTilePosition);
    const trailVariant = this.getNextTrailTileVariant();
    this.previewTrailTile.pos = vec(this.pendingTrailTilePosition.x, this.pendingTrailTilePosition.y);
    this.previewTrailTile.scale = vec(1, 1);
    this.previewTrailTile.z = 0;
    this.occupiedTrailTiles.add(key);
    this.trailTilePlacements.set(key, {
      assetName: trailVariant.assetName,
      orientation: this.pendingTrailTileOrientation,
      walls: trailVariant.collisionByOrientation[this.pendingTrailTileOrientation]
    });
    this.trailTileActors.push(this.previewTrailTile);
    this.nextTrailTileIndex += 1;
    this.previewTrailTile = null;
    this.previewAnimationMode = null;
    this.previewCommitStartPosition = null;
    this.previewCommitTargetPosition = null;
    this.previewCommitElapsed = 0;
  }

  private clearPreviewTrailTile(): void {
    if (!this.previewTrailTile) {
      return;
    }

    this.previewTrailTile.kill();
    this.previewTrailTile = null;
    this.previewAnimationMode = null;
    this.previewCommitStartPosition = null;
    this.previewCommitTargetPosition = null;
    this.previewCommitElapsed = 0;
  }

  private updatePreviewTrailTileOrientation(): void {
    if (!this.previewTrailTile) {
      return;
    }

    const previewGraphic = this.sprites.trailTiles[this.nextTrailTileIndex % this.sprites.trailTiles.length].orientations[this.pendingTrailTileOrientation].clone();
    this.previewTrailTile.graphics.use(previewGraphic);
  }

  private getAllowedZoomLevels(): number[] {
    return gameSettings.cameraZoomLevels.filter((level) => level >= gameSettings.cameraZoomMin && level <= gameSettings.cameraZoomMax);
  }

  private getClosestAllowedZoomLevelIndex(zoom: number): number {
    const allowedZoomLevels = this.getAllowedZoomLevels();

    if (allowedZoomLevels.length === 0) {
      return 0;
    }

    let closestIndex = 0;
    let smallestDifference = Math.abs(allowedZoomLevels[0] - zoom);

    for (let index = 1; index < allowedZoomLevels.length; index += 1) {
      const difference = Math.abs(allowedZoomLevels[index] - zoom);

      if (difference < smallestDifference) {
        smallestDifference = difference;
        closestIndex = index;
      }
    }

    return closestIndex;
  }
}
