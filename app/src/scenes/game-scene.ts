import { Actor, Circle, Color, CoordPlane, Font, FontUnit, Label, PointerButton, PointerType, Rectangle, Scene, TextAlign, type Graphic, type PointerEvent, type Vector, vec } from "excalibur";
import { CHAR_SIZE, GAME_HEIGHT, GAME_WIDTH, TILE_SIZE, gameSettings, getCombatSeed } from "../config";
import type { GameSprites, TrailTileOrientation, TrailTileWalls } from "../game-assets";
import type { GameController } from "../game-controller";
import { getHeroById, getSelectedHero, type HeroDefinition, type HeroId } from "../hero-roster";
import { resolveKarakCombat } from "../karak-combat";
import { applyKarakMonsterDamage, reviveKarakHero } from "../karak-health-flow";
import { SeededRandom } from "../seeded-rng";
import { monsterTable } from "../game-data";
import { BoxActor } from "../actors/box-actor";
import { TileValidationStateMachine } from "../tile-validation-state-machine";
import { TileTapFlowStateMachine } from "../tile-tap-flow-state-machine";
import { MonsterTreasureDropStateMachine } from "../monster-treasure-drop-state-machine";
import { createScreenButtonTemplate, getCanvasPointerPosition, isPointInsideScreenButton } from "../ui/screen-button-template";

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
type TileActionMode = "hidden" | "discovery" | "treasure";

type TileActionType = "rotate" | "accept" | "reject" | "pick" | "leave";
type TileWallKey = keyof TrailTileWalls;

interface TrailTilePlacement {
  assetName: string;
  orientation: TrailTileOrientation;
  walls: TrailTileWalls;
}

type CharacterFacingOrientation = 0 | 1 | 2 | 3;

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

interface TreasureDropUnit {
  actor: Actor;
  treasureKey: string;
  tilePositionKey: string;
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

interface DemoSavedTreasureDrop {
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

interface DemoSavedStateV2 {
  version: 2 | 3;
  player: {
    x: number;
    y: number;
    rotation: number;
    selected: boolean;
  };
  playerHealth?: number;
  heroId?: HeroId;
  turnCounter?: number;
  combatRollCount?: number;
  isUnconscious?: boolean;
  revivePending?: boolean;
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  nextTrailTileIndex: number;
  trailTiles: DemoSavedTrailTile[];
  monsters: DemoSavedMonster[];
  treasureDrops: DemoSavedTreasureDrop[];
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

function isDemoSavedTreasureDrop(value: unknown): value is DemoSavedTreasureDrop {
  if (!value || typeof value !== "object") {
    return false;
  }

  const treasureDrop = value as Partial<DemoSavedTreasureDrop>;
  const monsterIndex = treasureDrop.monsterIndex;

  return isFiniteNumber(treasureDrop.x)
    && isFiniteNumber(treasureDrop.y)
    && monsterIndex !== undefined
    && Number.isInteger(monsterIndex)
    && monsterIndex >= 0;
}

function isDemoSavedState(value: unknown): value is DemoSavedStateV2 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as Partial<DemoSavedStateV2>;
  const player = snapshot.player;
  const camera = snapshot.camera;
  const nextTrailTileIndex = snapshot.nextTrailTileIndex;

  return (snapshot.version === 2 || snapshot.version === 3)
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
    && (snapshot.turnCounter === undefined || Number.isInteger(snapshot.turnCounter) && snapshot.turnCounter >= 0)
    && (snapshot.combatRollCount === undefined || Number.isInteger(snapshot.combatRollCount) && snapshot.combatRollCount >= 0)
    && (snapshot.isUnconscious === undefined || typeof snapshot.isUnconscious === "boolean")
    && (snapshot.revivePending === undefined || typeof snapshot.revivePending === "boolean")
    && (snapshot.heroId === undefined || typeof snapshot.heroId === "string")
    && Array.isArray(snapshot.trailTiles)
    && snapshot.trailTiles.every((tile) => isDemoSavedTrailTile(tile))
    && Array.isArray(snapshot.monsters)
    && snapshot.monsters.every((monster) => isDemoSavedMonster(monster))
    && Array.isArray(snapshot.treasureDrops)
    && snapshot.treasureDrops.every((treasureDrop) => isDemoSavedTreasureDrop(treasureDrop));
}

export class DemoScene extends Scene {
  private readonly controller: GameController;
  private readonly sprites: GameSprites;
  private selectedHero: HeroDefinition = getSelectedHero();
  private combatRandom = new SeededRandom(`${getCombatSeed()}::${this.selectedHero.id}`);
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
  private isUnconscious = false;
  private revivePending = false;
  private turnCounter = 0;
  private combatRollCount = 0;
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
  private readonly treasureDropStateMachine = new MonsterTreasureDropStateMachine();
  private readonly treasureDrops = new Map<string, TreasureDropUnit>();
  private tileActionMode: TileActionMode = "hidden";
  private pendingTreasureDrop: TreasureDropUnit | null = null;
  private readonly trailTileActors: Actor[] = [];
  private readonly modeButtons: ModeButtonControl[] = [];
  private readonly tileActionButtons: TileActionButtonControl[] = [];
  private readonly menuButton: SimpleButtonControl;
  private readonly inventoryButton: SimpleButtonControl;
  private readonly tileTapFlowStateMachine = new TileTapFlowStateMachine();
  private readonly topBar: Actor;
  private readonly bottomBar: Actor;
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
  private readonly activeTouchPointerIds = new Set<number>();
  private touchGestureTrackingInitialized = false;
  private touchMoveOverrideActive = false;
  private touchMoveOverrideBaseMode: DemoMode | null = null;
  private touchZoomOverrideActive = false;
  private touchZoomOverrideBaseMode: DemoMode | null = null;
  private touchZoomLastDistance: number | null = null;
  private touchZoomDistanceDelta = 0;
  private readonly handlePointerReceiverDown = (event: PointerEvent): void => {
    if (event.pointerType === PointerType.Touch) {
      this.activeTouchPointerIds.add(event.pointerId);
      this.captureTouchPointer(event);

      if (!this.player.isSelected && this.shouldActivateTouchMove(event.screenPos, event.worldPos) && !this.touchMoveOverrideActive) {
        this.enableTouchMoveOverride(event.screenPos);
      }
    }
  };
  private readonly handlePointerReceiverUp = (event: PointerEvent): void => {
    this.handleTouchPointerEnded(event);
  };
  private readonly handleNativePointerEnded = (event: globalThis.PointerEvent): void => {
    if (event.pointerType !== "touch") {
      return;
    }

    this.handleNativeTouchPointerEnded(event.pointerId);
  };
  private readonly handleLostPointerCapture = (event: globalThis.PointerEvent): void => {
    if (event.pointerType !== "touch") {
      return;
    }

    this.handleNativeTouchPointerEnded(event.pointerId);
  };
  private readonly handleNativeTouchEnd = (event: globalThis.TouchEvent): void => {
    for (const touch of Array.from(event.changedTouches)) {
      this.activeTouchPointerIds.delete(touch.identifier);
    }

    if (event.touches.length === 0) {
      this.resetTouchGestureState();
      return;
    }

    this.syncTouchMoveOverrideState();
    this.syncTouchZoomOverrideState();
  };
  private readonly handleNativeTouchCancel = (event: globalThis.TouchEvent): void => {
    for (const touch of Array.from(event.changedTouches)) {
      this.activeTouchPointerIds.delete(touch.identifier);
    }

    this.resetTouchGestureState();
  };
  private readonly handleWindowBlur = (): void => {
    this.resetTouchGestureState();
  };
  private readonly handleDocumentVisibilityChange = (): void => {
    if (document.visibilityState !== "visible") {
      this.resetTouchGestureState();
    }
  };
  private handleTouchPointerEnded(event: PointerEvent): void {
    if (event.pointerType === PointerType.Touch) {
      this.activeTouchPointerIds.delete(event.pointerId);

      this.syncTouchMoveOverrideState();
      this.syncTouchZoomOverrideState();
    }
  }

  private reconcileActiveTouchPointers(): void {
    for (const pointerId of Array.from(this.activeTouchPointerIds)) {
      if (!this.engine.input.pointers.currentFramePointerCoords.has(pointerId)) {
        this.activeTouchPointerIds.delete(pointerId);
      }
    }
  }

  private handleNativeTouchPointerEnded(pointerId: number): void {
    this.activeTouchPointerIds.delete(pointerId);

    this.syncTouchMoveOverrideState();
    this.syncTouchZoomOverrideState();
  }

  private resetTouchGestureState(): void {
    this.activeTouchPointerIds.clear();
    this.touchMoveOverrideActive = false;
    this.touchMoveOverrideBaseMode = null;
    this.touchZoomOverrideActive = false;
    this.touchZoomOverrideBaseMode = null;
    this.touchZoomLastDistance = null;
    this.touchZoomDistanceDelta = 0;

    if (this.interactionMode !== "action") {
      this.setInteractionMode("action");
    }

    this.cameraDragLastScreenPos = null;
    this.cameraZoomSwipeDistance = 0;
    this.cameraZoomSwipeConsumed = false;
    this.tileRotationSwipeDistance = 0;
    this.tileRotationSwipeConsumed = false;
  }

  private captureTouchPointer(event: PointerEvent): void {
    const target = this.engine.canvas;

    if (typeof target.setPointerCapture !== "function") {
      return;
    }

    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // Ignore pointer capture failures when the browser has already moved the pointer elsewhere.
    }
  }
  private readonly primaryPointerDownHandler = (event: PointerEvent): void => {
    if (event.pointerType !== PointerType.Touch && event.button !== PointerButton.Left) {
      return;
    }

    const canvasScreenPos = getCanvasPointerPosition(event, this.engine.canvas);

    this.logPointerClick("raw", canvasScreenPos, event.worldPos);
    console.log(`[game-pointer] raw page=${Math.round(event.pagePos.x)},${Math.round(event.pagePos.y)} canvas=${Math.round(canvasScreenPos.x)},${Math.round(canvasScreenPos.y)} w=${Math.round(event.worldPos.x)},${Math.round(event.worldPos.y)}`);
    this.updateTapTrace(canvasScreenPos, event.worldPos);

    if (this.handleMenuButtonPress(canvasScreenPos)) {
      return;
    }

    if (this.handleInventoryButtonPress(canvasScreenPos)) {
      return;
    }

    if (this.handleModeButtonPress(canvasScreenPos, event.pointerType)) {
      return;
    }

    if (this.handleTileActionButtonPress(canvasScreenPos)) {
      return;
    }

    if (event.pointerType === PointerType.Touch && this.activeTouchPointerIds.size >= 2) {
      this.enableTouchZoomOverride();
      return;
    }

    if (event.pointerType === PointerType.Touch && !this.player.isSelected && this.shouldActivateTouchMove(event.screenPos, event.worldPos)) {
      this.enableTouchMoveOverride(event.screenPos);
      return;
    }

    if (this.isMovementInputLocked()) {
      return;
    }

    if (this.movementPhase === "waitingForOrientation") {
      this.cameraDragLastScreenPos = vec(canvasScreenPos.x, canvasScreenPos.y);
      this.tileRotationSwipeDistance = 0;
      this.tileRotationSwipeConsumed = false;
      return;
    }

    if (this.interactionMode === "move" || this.interactionMode === "zoom") {
      this.cameraDragLastScreenPos = vec(canvasScreenPos.x, canvasScreenPos.y);
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
      const currentPosition = { x: this.player.pos.x, y: this.player.pos.y };
      const currentHasPlacedTrailTile = this.getPlacedTrailTile(this.player.pos) !== null;
      const targetHasPlacedTrailTile = this.getPlacedTrailTile(targetPosition) !== null;
      const isAdjacent = this.getMoveWallKeys(this.player.pos, targetPosition) !== null;

      const decision = this.tileTapFlowStateMachine.resolveSelectedTap({
        currentPosition,
        targetPosition: { x: targetPosition.x, y: targetPosition.y },
        isAdjacent,
        canMoveBetweenPositions: this.canMoveBetweenPositions(this.player.pos, targetPosition),
        currentHasPlacedTrailTile,
        targetHasPlacedTrailTile,
        hasChamberMonster: this.chamberMonsters.has(tileKey(targetPosition))
      });

      if (decision.kind === "ignore") {
        return;
      }

      if (decision.kind === "fightChamber") {
        const monster = this.chamberMonsters.get(tileKey(targetPosition));

        if (!monster) {
          return;
        }

        this.pendingMonsterEncounter = monster;
        this.moveTargetPosition = targetPosition;
        this.beginTileDiscovery(targetPosition);
        return;
      }

      if (decision.kind === "moveToPlacedTile") {
        this.moveTargetPosition = targetPosition;
        this.movementPhase = "movingToTarget";
        this.player.setTargetPosition(targetPosition);
        this.messageLabel.text = "Moving to an existing tile.";
        this.scoreLabel.text = "Moving to a placed tile.";
        return;
      }

      this.moveTargetPosition = targetPosition;
      this.beginTileDiscovery(targetPosition);
    }
  };

  constructor(controller: GameController, sprites: GameSprites) {
    super();
    this.controller = controller;
    this.sprites = sprites;
    const topBarButtonHeight = clamp(this.topBarHeight * 0.4, 24, 32);
    const topBarSideInset = clamp(GAME_WIDTH * 0.015, 16, 24);
    this.topBar = new Actor({
      pos: vec(GAME_WIDTH / 2, this.topBarHeight / 2),
      width: GAME_WIDTH,
      height: this.topBarHeight,
      color: Color.fromHex("#6a4322"),
      coordPlane: CoordPlane.Screen,
      z: 90
    });
    this.bottomBar = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT - this.topBarHeight / 2),
      width: GAME_WIDTH,
      height: this.topBarHeight,
      color: Color.fromHex("#6a4322"),
      coordPlane: CoordPlane.Screen,
      z: 89
    });
    const menuButtonWidth = clamp(GAME_WIDTH * 0.16, 96, 136);
    const inventoryButtonWidth = clamp(GAME_WIDTH * 0.08, 70, 92);
    this.menuButton = this.createSimpleButton(topBarSideInset + menuButtonWidth / 2, this.topBarItemY, menuButtonWidth, topBarButtonHeight, "go-to-menu");
    this.inventoryButton = this.createSimpleButton(GAME_WIDTH - topBarSideInset - inventoryButtonWidth / 2, this.topBarItemY, inventoryButtonWidth, topBarButtonHeight, "Inv");
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
    (globalThis as typeof globalThis & { __activeSceneName?: string }).__activeSceneName = "demo";
    this.initializeTouchGestureTracking();
    this.syncSelectedHeroFromSettings();

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

  override onDeactivate(): void {
    this.activeTouchPointerIds.clear();
    this.touchMoveOverrideActive = false;
    this.touchMoveOverrideBaseMode = null;
    this.touchZoomOverrideActive = false;
    this.touchZoomOverrideBaseMode = null;
    this.touchZoomLastDistance = null;
    this.touchZoomDistanceDelta = 0;
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
    this.isUnconscious = false;
    this.revivePending = false;
    this.turnCounter = 0;
    this.combatRollCount = 0;
    this.syncSelectedHeroFromSettings();

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
    for (const treasureDrop of this.treasureDrops.values()) {
      treasureDrop.actor.kill();
    }
    this.treasureDrops.clear();
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
    this.isUnconscious = false;
    this.revivePending = false;
    this.turnCounter = 0;
    this.combatRollCount = 0;
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
    const canContinue = this.isUnconscious && gameSettings.debugInfoEnabled;

    this.menuButton.button.color = Color.fromHex("#4c3220");
    this.menuButton.label.color = Color.fromHex("#f3e7d8");

    this.inventoryButton.label.text = canContinue ? "Revive" : "Inv";
    this.inventoryButton.button.color = canContinue ? Color.fromHex("#7cf7a3") : Color.fromHex("#2c1d14");
    this.inventoryButton.label.color = canContinue ? Color.fromHex("#08121c") : Color.fromHex("#f3e7d8");
    this.inventoryButton.button.graphics.opacity = canContinue ? 1 : 0.92;
    this.inventoryButton.label.opacity = canContinue ? 1 : 0.92;
    this.tapTraceLabel.opacity = gameSettings.debugInfoEnabled ? 1 : 0;
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

    const treasureDrops: DemoSavedTreasureDrop[] = [];

    for (const treasureDrop of this.treasureDrops.values()) {
      treasureDrops.push({
        x: treasureDrop.actor.pos.x,
        y: treasureDrop.actor.pos.y,
        monsterIndex: this.getTreasureSourceMonsterIndex(treasureDrop.treasureKey)
      });
    }

    const snapshot: DemoSavedStateV2 = {
      version: 3,
      player: {
        x: this.player.pos.x,
        y: this.player.pos.y,
        rotation: this.player.rotation,
        selected: this.player.isSelected
      },
      playerHealth: this.playerHealth,
      heroId: this.selectedHero.id,
      turnCounter: this.turnCounter,
      combatRollCount: this.combatRollCount,
      isUnconscious: this.isUnconscious,
      revivePending: this.revivePending,
      camera: {
        x: this.camera.pos.x,
        y: this.camera.pos.y,
        zoom: this.camera.zoom
      },
      nextTrailTileIndex: this.nextTrailTileIndex,
      trailTiles,
      monsters,
      treasureDrops
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
    this.turnCounter = snapshot.turnCounter ?? 0;
    this.combatRollCount = snapshot.combatRollCount ?? 0;
    this.isUnconscious = snapshot.isUnconscious ?? false;
    this.revivePending = snapshot.revivePending ?? false;
    this.selectedHero = getHeroById(snapshot.heroId);
    this.resetCombatRandom();

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

    for (const treasureDrop of snapshot.treasureDrops) {
      this.spawnTreasureDrop(vec(treasureDrop.x, treasureDrop.y), treasureDrop.monsterIndex);
    }

    this.player.pos = vec(snapshot.player.x, snapshot.player.y);
    this.player.setFacingOrientation(this.getFacingOrientationFromRotation(snapshot.player.rotation));
    this.player.clearTargetPosition();
    this.playerHealth = clamp(snapshot.playerHealth ?? this.maxPlayerHealth, 0, this.maxPlayerHealth);
    this.gameOver = false;

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

  private syncSelectedHeroFromSettings(): void {
    const currentHero = getSelectedHero();

    if (currentHero.id === this.selectedHero.id) {
      return;
    }

    this.selectedHero = currentHero;
    this.resetCombatRandom();
    this.updateDebugInfoLabel();
  }

  private resetCombatRandom(): void {
    this.combatRandom = new SeededRandom(`${getCombatSeed()}::${this.selectedHero.id}`);
    this.combatRandom.skip(this.combatRollCount);
  }

  private reviveHero(): void {
    const nextHealthState = reviveKarakHero({
      health: this.playerHealth,
      isUnconscious: this.isUnconscious,
      revivePending: this.revivePending
    });

    if (nextHealthState.health === this.playerHealth && nextHealthState.isUnconscious === this.isUnconscious && nextHealthState.revivePending === this.revivePending) {
      return;
    }

    this.playerHealth = nextHealthState.health;
    this.isUnconscious = nextHealthState.isUnconscious;
    this.revivePending = nextHealthState.revivePending;
    this.updateHeartDisplay();
    this.scoreLabel.text = "Revived to 1 life.";
    this.messageLabel.text = "The next turn can begin.";
    this.controller.saveDemoState();
  }

  private rollCombatDie(): number {
    this.combatRollCount += 1;
    return this.combatRandom.rollDie();
  }

  private rollCombatDice(count: number = 2): number[] {
    return Array.from({ length: count }, () => this.rollCombatDie());
  }

  private getMonsterCombatStrength(monsterIndex: number): number {
    return monsterTable[monsterIndex]?.hp ?? monsterIndex + 1;
  }

  private resolveHeroCombat(monsterIndex: number): { rolls: number[]; heroTotal: number; monsterTotal: number; victory: boolean; tie: boolean } {
    const monsterTotal = this.getMonsterCombatStrength(monsterIndex);
    return resolveKarakCombat(this.selectedHero, monsterTotal, this.combatRandom, this.turnCounter);
  }

  override onInitialize(): void {
    this.player.setStateGraphics(this.sprites.playerNormalByOrientation, this.sprites.playerSelectedByOrientation);

    this.showTrailTile(this.player.pos, 0);
    this.add(this.player);

    this.add(this.topBar);
    this.add(this.bottomBar);
    this.add(this.menuButton.button);
    this.add(this.menuButton.label);
    this.add(this.tapTraceLabel);
    this.add(this.inventoryButton.button);
    this.add(this.inventoryButton.label);

    const buttonWidth = clamp(GAME_WIDTH * 0.12, 72, 110);
    const buttonHeight = clamp(GAME_HEIGHT * 0.055, 40, 54);
    const buttonGap = clamp(GAME_WIDTH * 0.02, 12, 18);
    const totalWidth = buttonWidth * 3 + buttonGap * 2;
    const centerX = GAME_WIDTH / 2;
    const modeRowCenterY = GAME_HEIGHT - this.topBarHeight - clamp(GAME_HEIGHT * 0.02, 10, 16) - buttonHeight / 2;

    const actionButton = this.createModeButton("action", "A", centerX - totalWidth / 2 + buttonWidth / 2, modeRowCenterY, buttonWidth, buttonHeight);
    const moveButton = this.createModeButton("move", "M", centerX, modeRowCenterY, buttonWidth, buttonHeight);
    const zoomButton = this.createModeButton("zoom", "Z", centerX + totalWidth / 2 - buttonWidth / 2, modeRowCenterY, buttonWidth, buttonHeight);

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
    const tileActionCenterY = GAME_HEIGHT - this.topBarHeight / 2;

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

    primaryPointer.on("down", this.primaryPointerDownHandler);

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
        if (event.pointerType === PointerType.Touch && this.activeTouchPointerIds.size < 2 && !this.touchZoomOverrideActive) {
          this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
          return;
        }

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
    this.reconcileActiveTouchPointers();
    this.updateDebugInfoLabel();
    this.updateTopBarButtonState();
    this.syncTouchMoveOverrideState();
    this.syncTouchZoomOverrideState();
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
      this.beginMonsterDefeatReturnMovement();
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
      this.beginBlockedReturnMovement();
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
    const template = createScreenButtonTemplate({
      centerX,
      centerY,
      width,
      height,
      text,
      buttonColor: "#1a2948",
      textColor: "#edf4ff",
      fontFamily: "Space Grotesk",
      fontSize: clamp(height * 0.42, 14, 18),
      z: 100,
      labelZ: 101,
      hitboxOrigin: "center"
    });

    return { mode, button: template.button, label: template.label, width, height };
  }

  private createSimpleButton(centerX: number, centerY: number, width: number, height: number, text: string): SimpleButtonControl {
    const template = createScreenButtonTemplate({
      centerX,
      centerY,
      width,
      height,
      text,
      buttonColor: "#1a2948",
      textColor: "#edf4ff",
      fontFamily: "Space Grotesk",
      fontSize: clamp(height * 0.42, 14, 18),
      z: 100,
      labelZ: 101,
      hitboxOrigin: "center"
    });

    return { button: template.button, label: template.label, width, height };
  }

  private createTileActionButton(action: TileActionType, text: string, centerX: number, centerY: number, width: number, height: number): TileActionButtonControl {
    const template = createScreenButtonTemplate({
      centerX,
      centerY,
      width,
      height,
      text,
      buttonColor: "#263759",
      textColor: "#d6e2ff",
      fontFamily: "Space Grotesk",
      fontSize: clamp(height * 0.38, 13, 17),
      z: 100,
      labelZ: 101,
      hitboxOrigin: "center"
    });

    return { action, button: template.button, label: template.label, width, height };
  }

  private handleModeButtonPress(screenPos: Vector, pointerType: PointerType): boolean {
    if (!gameSettings.debugInfoEnabled) {
      return false;
    }

    if (this.movementPhase === "waitingForOrientation") {
      return false;
    }

    const isTwoFingerTouch = pointerType === PointerType.Touch && this.activeTouchPointerIds.size >= 2;

    for (const modeButton of this.modeButtons) {
      if (pointerType === PointerType.Touch && modeButton.mode !== "move") {
        continue;
      }

      if (this.isPointInsideButton(screenPos, modeButton) && (!isTwoFingerTouch || modeButton.mode === "move")) {
        this.logPointerClick(`mode:${modeButton.mode}`, screenPos, this.engine.screen.screenToWorldCoordinates(screenPos));
        this.setInteractionMode(modeButton.mode);

        if (pointerType === PointerType.Touch && modeButton.mode === "zoom") {
          this.cameraDragLastScreenPos = vec(screenPos.x, screenPos.y);
          this.cameraZoomSwipeDistance = 0;
          this.cameraZoomSwipeConsumed = false;
        }

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
      this.logPointerClick(this.isUnconscious && gameSettings.debugInfoEnabled ? "revive" : "inventory", screenPos, this.engine.screen.screenToWorldCoordinates(screenPos));

      if (this.isUnconscious || this.revivePending) {
        this.reviveHero();
        return true;
      }

      this.controller.showInventory("demo");
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
    if (this.tileActionMode === "hidden") {
      return false;
    }

    if (!this.isInsideTileActionRow(screenPos)) {
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

        if (actionButton.action === "pick") {
          this.pickTreasureDrop();
          return true;
        }

        if (actionButton.action === "leave") {
          this.leaveTreasureDrop();
          return true;
        }
      }
    }

    return true;
  }

  private layoutTileActionButtons(): void {
    const buttonWidth = clamp(GAME_WIDTH * 0.11, 84, 120);
    const buttonGap = clamp(GAME_WIDTH * 0.015, 10, 14);
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT - this.topBarHeight / 2;

    const visibleButtons: Array<{ action: TileActionType; text: string; buttonColor: string; labelColor: string; x: number }> = this.tileActionMode === "treasure"
      ? [
          { action: "pick", text: "Pick", buttonColor: "#7cf7a3", labelColor: "#08121c", x: centerX - (buttonWidth + buttonGap) / 2 },
          { action: "leave", text: "Leave", buttonColor: "#52657d", labelColor: "#edf4ff", x: centerX + (buttonWidth + buttonGap) / 2 }
        ]
      : this.tileActionMode === "discovery"
        ? [
            { action: "rotate", text: "Rotate", buttonColor: "#3a4e7b", labelColor: "#edf4ff", x: centerX - (buttonWidth * 3 + buttonGap * 2) / 2 + buttonWidth / 2 },
            { action: "accept", text: "Accept", buttonColor: "#7cf7a3", labelColor: "#08121c", x: centerX },
            { action: "reject", text: "Reject", buttonColor: "#ff7b7b", labelColor: "#08121c", x: centerX + (buttonWidth * 3 + buttonGap * 2) / 2 - buttonWidth / 2 }
          ]
        : [];

    for (let index = 0; index < this.tileActionButtons.length; index++) {
      const actionButton = this.tileActionButtons[index];
      const visibleButton = visibleButtons[index];

      if (!visibleButton) {
        actionButton.action = "reject";
        actionButton.button.pos = vec(-1000, -1000);
        actionButton.label.pos = vec(-1000, -1000);
        actionButton.button.graphics.opacity = 0;
        actionButton.label.graphics.opacity = 0;
        continue;
      }

      actionButton.action = visibleButton.action;
      actionButton.button.pos = vec(visibleButton.x, centerY);
      actionButton.label.pos = vec(visibleButton.x, centerY);
      actionButton.button.graphics.opacity = 1;
      actionButton.label.graphics.opacity = 1;
      actionButton.button.color = Color.fromHex(visibleButton.buttonColor);
      actionButton.label.color = Color.fromHex(visibleButton.labelColor);
      actionButton.label.text = visibleButton.text;
    }
  }

  private setTileActionMode(mode: TileActionMode): void {
    if (this.tileActionMode === mode) {
      return;
    }

    this.tileActionMode = mode;
    this.layoutTileActionButtons();
  }

  private showTreasurePickupPrompt(treasureDrop: TreasureDropUnit): void {
    this.pendingTreasureDrop = treasureDrop;
    this.setTileActionMode("treasure");
    this.messageLabel.text = "Treasure found. Pick it up or leave it here.";
    this.scoreLabel.text = "Treasure awaits your choice.";
  }

  private pickTreasureDrop(): void {
    if (!this.pendingTreasureDrop) {
      return;
    }

    const treasureDrop = this.pendingTreasureDrop;
    this.pendingTreasureDrop = null;
    this.treasureDrops.delete(treasureDrop.tilePositionKey);
    treasureDrop.actor.kill();
    this.setTileActionMode("hidden");
    this.messageLabel.text = "Treasure collected.";
    this.scoreLabel.text = "The treasure disappears from the tile.";
    this.controller.saveDemoState();
    this.refreshButtonStyles();
  }

  private leaveTreasureDrop(): void {
    if (!this.pendingTreasureDrop) {
      return;
    }

    this.pendingTreasureDrop = null;
    this.setTileActionMode("hidden");
    this.messageLabel.text = "Treasure left behind.";
    this.scoreLabel.text = "The treasure stays on the tile.";
    this.controller.saveDemoState();
    this.refreshButtonStyles();
  }

  private primeTouchCameraDrag(screenPos: Vector): void {
    this.cameraDragLastScreenPos = vec(screenPos.x, screenPos.y);
    this.cameraZoomSwipeDistance = 0;
    this.cameraZoomSwipeConsumed = false;
  }

  private shouldActivateTouchMove(screenPos: Vector, worldPos: Vector): boolean {
    if (this.movementPhase === "waitingForOrientation" || this.previewTrailTile) {
      return false;
    }

    if (screenPos.y <= this.topBarHeight || screenPos.y >= GAME_HEIGHT - this.topBarHeight) {
      return false;
    }

    const boxLeft = this.player.pos.x - this.playerSize / 2;
    const boxRight = this.player.pos.x + this.playerSize / 2;
    const boxTop = this.player.pos.y - this.playerSize / 2;
    const boxBottom = this.player.pos.y + this.playerSize / 2;

    return !(worldPos.x >= boxLeft && worldPos.x <= boxRight && worldPos.y >= boxTop && worldPos.y <= boxBottom);
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
    return isPointInsideScreenButton(point, {
      button: button.button,
      label: button.label,
      width: button.width,
      height: button.height,
      hitboxOrigin: "center"
    });
  }

  private beginTileDiscovery(targetPosition: Vector): void {
    this.beginTurnIfNeeded();
    const startPosition = vec(this.player.pos.x, this.player.pos.y);
    const pausePosition = this.computeBorderPosition(startPosition, targetPosition);

    this.movementStartPosition = startPosition;
    this.moveTargetPosition = vec(targetPosition.x, targetPosition.y);
    this.movementPausePosition = pausePosition;
    this.pendingTrailTilePosition = vec(targetPosition.x, targetPosition.y);
    this.pendingTrailTileOrientation = this.getOrientationFromVector(startPosition, targetPosition);
    this.movementPhase = "movingToBorder";
    this.setTileActionMode("hidden");
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

    if (this.pendingTrailTilePosition) {
      const occupiedMonster = this.chamberMonsters.get(tileKey(this.pendingTrailTilePosition));

      if (occupiedMonster) {
        this.pendingMonsterEncounter = occupiedMonster;
        this.messageLabel.text = "Chamber occupied by a monster. The box attacks immediately.";
        this.scoreLabel.text = "Fighting the chamber monster.";
        this.hintLabel.text = `Orientation: ${this.getOrientationName(this.pendingTrailTileOrientation)}. Combat starts instead of preview.`;
        this.updateModeButtonStyles();
        this.updateTileActionButtonStyles();
        return;
      }
    }

    this.movementPhase = "waitingForOrientation";
    this.setTileActionMode("discovery");
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
      this.setTileActionMode("hidden");
      this.refreshButtonStyles();
      return;
    }

    this.movementPhase = "movingToTarget";
    this.setTileActionMode("hidden");
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
    this.setTileActionMode("hidden");
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
    this.setTileActionMode("hidden");

    if (accepted) {
      this.messageLabel.text = "Tile discovered and added.";
      this.scoreLabel.text = "Discovery complete.";
    } else {
      this.player.select();
      this.messageLabel.text = "Tile rejected. Choose another move.";
      this.scoreLabel.text = "Back at the start position.";
    }

    this.finishTurn();
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
    const treasureDrop = this.treasureDrops.get(tileKey(this.player.pos));

    if (treasureDrop) {
      this.showTreasurePickupPrompt(treasureDrop);
    } else {
      this.setTileActionMode("hidden");
    }

    this.finishTurn();
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
    this.layoutTileActionButtons();

    if (this.tileActionMode === "hidden") {
      for (const actionButton of this.tileActionButtons) {
        actionButton.button.color = Color.fromHex("#263759");
        actionButton.label.color = Color.fromHex("#7f8ea8");
      }

      return;
    }

    if (this.tileActionMode === "discovery") {
      for (const actionButton of this.tileActionButtons) {
        if (actionButton.action === "rotate") {
          actionButton.button.color = Color.fromHex("#3a4e7b");
          actionButton.label.color = Color.fromHex("#edf4ff");
        } else if (actionButton.action === "accept") {
          actionButton.button.color = Color.fromHex("#7cf7a3");
          actionButton.label.color = Color.fromHex("#08121c");
        } else if (actionButton.action === "reject") {
          actionButton.button.color = Color.fromHex("#ff7b7b");
          actionButton.label.color = Color.fromHex("#08121c");
        }
      }

      return;
    }

    for (const actionButton of this.tileActionButtons) {
      if (actionButton.action === "pick") {
        actionButton.button.color = Color.fromHex("#7cf7a3");
        actionButton.label.color = Color.fromHex("#08121c");
      } else if (actionButton.action === "leave") {
        actionButton.button.color = Color.fromHex("#52657d");
        actionButton.label.color = Color.fromHex("#edf4ff");
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
    this.finishTurn();
    this.controller.saveDemoState();
    this.updateModeButtonStyles();
    this.updateTileActionButtonStyles();
  }

  private setInteractionMode(mode: DemoMode): void {
    const preservePreviewState = this.movementPhase === "waitingForOrientation";
    this.interactionMode = mode;
    this.cameraDragLastScreenPos = null;
    if (!preservePreviewState) {
      this.moveTargetPosition = null;
    }
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

  private initializeTouchGestureTracking(): void {
    if (this.touchGestureTrackingInitialized) {
      return;
    }

    this.touchGestureTrackingInitialized = true;
    this.engine.input.pointers.on("down", this.handlePointerReceiverDown);
    this.engine.input.pointers.on("up", this.handlePointerReceiverUp);
    window.addEventListener("pointerup", this.handleNativePointerEnded, true);
    window.addEventListener("pointercancel", this.handleNativePointerEnded, true);
    this.engine.canvas.addEventListener("lostpointercapture", this.handleLostPointerCapture, true);
    window.addEventListener("touchend", this.handleNativeTouchEnd, true);
    window.addEventListener("touchcancel", this.handleNativeTouchCancel, true);
    window.addEventListener("blur", this.handleWindowBlur);
    document.addEventListener("visibilitychange", this.handleDocumentVisibilityChange);
  }

  private enableTouchMoveOverride(screenPos: Vector): void {
    if (this.touchMoveOverrideActive) {
      return;
    }

    this.touchMoveOverrideBaseMode = "action";
    this.touchMoveOverrideActive = true;

    if (this.interactionMode !== "move") {
      this.setInteractionMode("move");
    }

    this.primeTouchCameraDrag(screenPos);
  }

  private enableTouchZoomOverride(): void {
    if (this.touchZoomOverrideActive) {
      return;
    }

    this.touchZoomOverrideBaseMode = "action";
    this.touchZoomOverrideActive = true;
    this.touchZoomLastDistance = null;
    this.touchZoomDistanceDelta = 0;

    if (this.interactionMode !== "zoom") {
      this.setInteractionMode("zoom");
    }
  }

  private syncTouchZoomOverrideState(): void {
    if (this.activeTouchPointerIds.size >= 2) {
      this.enableTouchZoomOverride();
      this.applyTouchPinchZoom();
      return;
    }

    if (!this.touchZoomOverrideActive) {
      return;
    }

    const restoreMode = "action";
    this.touchZoomOverrideActive = false;
    this.touchZoomOverrideBaseMode = null;
    this.touchZoomLastDistance = null;
    this.touchZoomDistanceDelta = 0;

    if (this.interactionMode !== restoreMode) {
      this.setInteractionMode(restoreMode);
    }
  }

  private syncTouchMoveOverrideState(): void {
    if (this.activeTouchPointerIds.size >= 1) {
      return;
    }

    if (!this.touchMoveOverrideActive) {
      return;
    }

    const restoreMode = this.touchMoveOverrideBaseMode ?? "action";
    this.touchMoveOverrideActive = false;
    this.touchMoveOverrideBaseMode = null;

    if (this.interactionMode !== restoreMode) {
      this.setInteractionMode(restoreMode);
    }
  }

  private applyTouchPinchZoom(): void {
    const touchIds = Array.from(this.activeTouchPointerIds);

    if (touchIds.length < 2) {
      return;
    }

    const firstTouch = this.engine.input.pointers.currentFramePointerCoords.get(touchIds[0]);
    const secondTouch = this.engine.input.pointers.currentFramePointerCoords.get(touchIds[1]);

    if (!firstTouch || !secondTouch) {
      return;
    }

    const currentDistance = Math.hypot(
      firstTouch.screenPos.x - secondTouch.screenPos.x,
      firstTouch.screenPos.y - secondTouch.screenPos.y
    );

    if (this.touchZoomLastDistance === null) {
      this.touchZoomLastDistance = currentDistance;
      return;
    }

    this.touchZoomDistanceDelta += currentDistance - this.touchZoomLastDistance;
    this.touchZoomLastDistance = currentDistance;

    const zoomThreshold = gameSettings.cameraZoomDragThreshold;
    if (Math.abs(this.touchZoomDistanceDelta) < zoomThreshold) {
      return;
    }

    const zoomSteps = Math.trunc(Math.abs(this.touchZoomDistanceDelta) / zoomThreshold) * (this.touchZoomDistanceDelta > 0 ? 1 : -1);
    const nextZoomLevels = this.getAllowedZoomLevels();
    const nextIndex = clamp(this.cameraZoomLevelIndex + zoomSteps, 0, nextZoomLevels.length - 1);

    if (nextIndex !== this.cameraZoomLevelIndex) {
      this.cameraZoomLevelIndex = nextIndex;
      this.camera.zoom = nextZoomLevels[nextIndex];
    }

    this.touchZoomDistanceDelta -= zoomSteps * zoomThreshold;
  }

  private updateModeButtonStyles(): void {
    const visible = gameSettings.debugInfoEnabled;
    const isPreviewing = this.movementPhase === "waitingForOrientation";

    for (const modeButton of this.modeButtons) {
      const isActive = modeButton.mode === this.interactionMode;
      modeButton.button.graphics.opacity = visible ? 1 : 0;
      modeButton.label.opacity = visible ? 1 : 0;

      if (!visible) {
        continue;
      }

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
      || this.isUnconscious
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
    this.debugInfoLabel.text = `M[${cameraX},${cameraY}]\nCh[${characterX},${characterY}]\nZ[${zoom}]\nHero[${this.selectedHero.name}]\nTurn[${this.turnCounter}]\nFight[${winner}]`;
  }

  private beginTurnIfNeeded(): void {
    if (!this.revivePending) {
      return;
    }

    this.revivePending = false;
    this.isUnconscious = false;
    this.playerHealth = Math.max(1, this.playerHealth);
    this.updateHeartDisplay();
  }

  private finishTurn(): void {
    this.turnCounter += 1;
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
    this.beginTurnIfNeeded();
    this.scoreLabel.text = "Monster encounter started.";
    this.messageLabel.text = "The box attacks immediately.";
  }

  private resolveMonsterEncounter(): void {
    const monster = this.activeMonsterEncounter;

    if (!monster) {
      this.movementPhase = "idle";
      return;
    }

    const combatResult = this.resolveHeroCombat(monster.monsterIndex);

    if (combatResult.victory) {
      const monsterPosition = vec(monster.actor.pos.x, monster.actor.pos.y);
      this.removeChamberMonster(monster);
      this.spawnTreasureDrop(monsterPosition, monster.monsterIndex);
      this.activeMonsterEncounter = null;
      this.lastMonsterEncounterWinner = "char";
      this.messageLabel.text = `Victory with ${combatResult.rolls.join(" + ")} = ${combatResult.heroTotal} against ${combatResult.monsterTotal}.`;
      this.scoreLabel.text = "Monster defeated.";
      this.player.setTargetPosition(this.moveTargetPosition ?? this.player.pos);
      this.movementPhase = "movingToTarget";
      return;
    }

    this.lastMonsterEncounterWinner = "monster";
    this.messageLabel.text = `The monster wins: ${combatResult.heroTotal} against ${combatResult.monsterTotal}.`;
    this.scoreLabel.text = combatResult.tie ? "Tie lost to monster." : "Monster won the encounter.";
    this.activeMonsterEncounter = null;
    const nextHealthState = applyKarakMonsterDamage(this.playerHealth, this.maxPlayerHealth);
    this.playerHealth = nextHealthState.health;
    this.isUnconscious = nextHealthState.isUnconscious;
    this.revivePending = nextHealthState.revivePending;
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
    const returnOrientation = this.getOppositeFacingOrientation(
      this.getFacingOrientationFromVector(this.movementStartPosition ?? this.player.pos, this.moveTargetPosition ?? this.player.pos)
    );

    this.player.setFacingOrientation(returnOrientation);
    this.beginMonsterDefeatReturnMovement();
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
      this.isUnconscious = true;
      this.revivePending = true;
      this.gameOver = false;
      this.scoreLabel.text = "Unconscious until the next turn.";
      this.messageLabel.text = gameSettings.debugInfoEnabled
        ? "The hero is unconscious. Use Revive to continue on the next turn."
        : "The hero is unconscious.";
    } else {
      this.scoreLabel.text = "The box returned to the start tile.";
      this.messageLabel.text = "The chamber monster pushed it back.";
    }
    this.updateHeartDisplay();
    this.finishTurn();
    this.controller.saveDemoState();
  }

  private removeChamberMonster(monster: MonsterDebugUnit): void {
    this.chamberMonsters.delete(monster.tilePositionKey);
    monster.actor.kill();
    monster.label.kill();
  }

  private spawnTreasureDrop(position: Vector, monsterIndex: number): void {
    const treasureDrop = this.treasureDropStateMachine.resolveTreasureDrop(monsterIndex);
    const tilePositionKey = tileKey(position);

    if (this.treasureDrops.has(tilePositionKey)) {
      return;
    }

    const actor = new Actor({
      pos: vec(position.x, position.y),
      width: this.playerSize * 0.8,
      height: this.playerSize * 0.8,
      z: 0.5
    });
    const treasureGraphic = this.sprites.treasureAnimationsById[treasureDrop.dropSpriteAnimationId] ?? this.sprites.treasure;

    actor.graphics.use(treasureGraphic.clone());

    this.treasureDrops.set(tilePositionKey, { actor, treasureKey: treasureDrop.treasureKey, tilePositionKey });
    this.add(actor);
  }

  private getTreasureSourceMonsterIndex(treasureKey: string): number {
    return this.treasureDropStateMachine.resolveMonsterIndexForTreasureKey(treasureKey);
  }

  private isPlayerVictoriousAgainstMonster(monsterIndex: number): boolean {
    return this.resolveHeroCombat(monsterIndex).victory;
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

  private getFacingOrientationFromVector(from: Vector, to: Vector): CharacterFacingOrientation {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      return deltaX >= 0 ? 1 : 3;
    }

    return deltaY >= 0 ? 2 : 0;
  }

  private getOppositeFacingOrientation(orientation: CharacterFacingOrientation): CharacterFacingOrientation {
    return ((orientation + 2) % 4) as CharacterFacingOrientation;
  }

  private getFacingOrientationFromRotation(rotation: number): CharacterFacingOrientation {
    const normalizedRotation = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return (Math.round(normalizedRotation / (Math.PI / 2)) % 4) as CharacterFacingOrientation;
  }

  private startBlockedMovement(targetPosition: Vector, returnPosition?: Vector): void {
    this.clearPreviewTrailTile();
    this.moveTargetPosition = vec(targetPosition.x, targetPosition.y);
    this.blockedReturnPosition = returnPosition ? vec(returnPosition.x, returnPosition.y) : this.movementStartPosition;
    const blockedApproachTarget = this.computeBorderPosition(
      this.movementStartPosition ?? this.player.pos,
      targetPosition
    );

    this.movementPhase = "movingBlockedToWall";
    this.player.setTargetPosition(blockedApproachTarget, false);
  }

  private beginBlockedReturnTurn(): void {
    const returnOrientation = this.getOppositeFacingOrientation(
      this.getFacingOrientationFromVector(this.movementStartPosition ?? this.player.pos, this.blockedReturnPosition ?? this.player.pos)
    );

    this.player.setFacingOrientation(returnOrientation);
    this.beginBlockedReturnMovement();
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
