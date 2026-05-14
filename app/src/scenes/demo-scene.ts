import { Actor, Color, CoordPlane, Font, FontUnit, Label, Keys, PointerButton, Scene, TextAlign, type PointerEvent, type Vector, vec } from "excalibur";
import { CHAR_SIZE, GAME_HEIGHT, GAME_WIDTH, TILE_SIZE, gameSettings } from "../config";
import type { GameSprites, TrailTileOrientation } from "../game-assets";
import type { GameController } from "../game-controller";
import { BoxActor } from "../actors/box-actor";

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
type MovementPhase = "idle" | "movingToBorder" | "waitingForOrientation" | "movingToTarget" | "returningToStart";

type TileActionType = "rotate" | "accept" | "reject";

interface ModeButtonControl {
  mode: DemoMode;
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
  private readonly topInset = clamp(GAME_HEIGHT * 0.03, 18, 28);
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
  private moveTargetPosition: Vector | null = null;
  private pendingTrailTilePosition: Vector | null = null;
  private pendingTrailTileOrientation: TrailTileOrientation = 0;
  private movementPhase: MovementPhase = "idle";
  private movementStartPosition: Vector | null = null;
  private movementPausePosition: Vector | null = null;
  private previewTrailTile: Actor | null = null;
  private readonly occupiedTrailTiles = new Set<string>();
  private readonly modeButtons: ModeButtonControl[] = [];
  private readonly tileActionButtons: TileActionButtonControl[] = [];
  private interactionMode: DemoMode = "action";
  private cameraDragLastScreenPos: Vector | null = null;
  private cameraZoomLevelIndex = 1;
  private cameraZoomDragAccumulator = 0;
  private nextTrailTileIndex = 0;

  constructor(controller: GameController, sprites: GameSprites) {
    super();
    this.controller = controller;
    this.sprites = sprites;
  }

  override onInitialize(): void {
    this.player.setStateGraphics(this.sprites.playerNormal, this.sprites.playerSelected);

    this.showTrailTile(this.player.pos, 0);
    this.add(this.player);

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
    const tileActionCenterY = this.topInset + clamp(GAME_HEIGHT * 0.16, 72, 120);

    const rotateButton = this.createTileActionButton("rotate", "Rotate", tileActionCenterX - tileActionTotalWidth / 2 + tileActionButtonWidth / 2, tileActionCenterY, tileActionButtonWidth, tileActionButtonHeight);
    const acceptButton = this.createTileActionButton("accept", "Accept", tileActionCenterX, tileActionCenterY, tileActionButtonWidth, tileActionButtonHeight);
    const rejectButton = this.createTileActionButton("reject", "Reject", tileActionCenterX + tileActionTotalWidth / 2 - tileActionButtonWidth / 2, tileActionCenterY, tileActionButtonWidth, tileActionButtonHeight);

    this.tileActionButtons.push(rotateButton, acceptButton, rejectButton);

    for (const actionButton of this.tileActionButtons) {
      this.add(actionButton.button);
      this.add(actionButton.label);
    }

    this.setInteractionMode("action");
    this.updateTileActionButtonStyles();

    const primaryPointer = this.engine.input.pointers.primary;

    primaryPointer.on("down", (event: PointerEvent) => {
      if (event.button !== PointerButton.Left) {
        return;
      }

      if (this.handleModeButtonPress(event.screenPos)) {
        return;
      }

      if (this.handleTileActionButtonPress(event.screenPos)) {
        return;
      }

      if (this.interactionMode === "move" || this.interactionMode === "zoom") {
        this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
        this.cameraZoomDragAccumulator = 0;
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
        this.cameraZoomDragAccumulator += deltaY;

        if (Math.abs(this.cameraZoomDragAccumulator) < gameSettings.cameraZoomDragThreshold) {
          this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
          return;
        }

        const zoomSteps = Math.trunc(this.cameraZoomDragAccumulator / gameSettings.cameraZoomDragThreshold);
        if (zoomSteps !== 0) {
          const nextZoomLevels = this.getAllowedZoomLevels();
          const nextIndex = clamp(this.cameraZoomLevelIndex + zoomSteps, 0, nextZoomLevels.length - 1);
          this.cameraZoomLevelIndex = nextIndex;
          this.camera.zoom = nextZoomLevels[nextIndex];
          this.cameraZoomDragAccumulator -= zoomSteps * gameSettings.cameraZoomDragThreshold;
        }

        this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
      }
    });

    primaryPointer.on("up", () => {
      this.cameraDragLastScreenPos = null;
      this.cameraZoomDragAccumulator = 0;
    });

    primaryPointer.on("cancel", () => {
      this.cameraDragLastScreenPos = null;
      this.cameraZoomDragAccumulator = 0;
    });
  }

  override onPreUpdate(engine: import("excalibur").Engine): void {
    if (engine.input.keyboard.wasPressed(Keys.Escape)) {
      this.controller.showMenu();
      return;
    }

    if (this.movementPhase === "movingToBorder" && !this.player.isMoving) {
      this.enterOrientationWait();
      return;
    }

    if (this.movementPhase === "movingToTarget" && !this.player.isMoving) {
      if (this.pendingTrailTilePosition) {
        this.showTrailTile(this.pendingTrailTilePosition, this.pendingTrailTileOrientation);
      }

      this.finishTileDiscovery(true);
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
    const end = this.engine.screen.worldToScreenCoordinates(this.moveTargetPosition);
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance < 1) {
      return;
    }

    const directionX = deltaX / distance;
    const directionY = deltaY / distance;
    const arrowColor = Color.fromHex("#7cf7a3");
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
    for (const modeButton of this.modeButtons) {
      if (this.isPointInsideButton(screenPos, modeButton)) {
        this.setInteractionMode(modeButton.mode);
        return true;
      }
    }

    return false;
  }

  private handleTileActionButtonPress(screenPos: Vector): boolean {
    if (this.movementPhase !== "waitingForOrientation") {
      return false;
    }

    for (const actionButton of this.tileActionButtons) {
      if (this.isPointInsideButton(screenPos, actionButton)) {
        if (actionButton.action === "rotate") {
          this.pendingTrailTileOrientation = ((this.pendingTrailTileOrientation + 1) % 4) as TrailTileOrientation;
          this.hintLabel.text = `Orientation: ${this.getOrientationName(this.pendingTrailTileOrientation)}.`;
          this.updatePreviewTrailTileOrientation();
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

    return false;
  }

  private isPointInsideButton(point: Vector, button: ModeButtonControl | TileActionButtonControl): boolean {
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
    this.movementPhase = "waitingForOrientation";
    this.player.clearTargetPosition();
    this.showPreviewTrailTile();
    this.messageLabel.text = "Rotate the tile, accept to continue, or reject to return.";
    this.scoreLabel.text = "Waiting for tile orientation.";
    this.updateTileActionButtonStyles();
  }

  private resumeTileDiscovery(): void {
    if (!this.moveTargetPosition) {
      return;
    }

    this.movementPhase = "movingToTarget";
    this.clearPreviewTrailTile();
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
    this.moveTargetPosition = null;
    this.pendingTrailTilePosition = null;
    this.movementStartPosition = null;
    this.movementPausePosition = null;
    this.clearPreviewTrailTile();
    this.cameraDragLastScreenPos = null;
    this.cameraZoomDragAccumulator = 0;

    if (accepted) {
      this.messageLabel.text = "Tile discovered and added.";
      this.scoreLabel.text = "Discovery complete.";
    } else {
      this.player.select();
      this.messageLabel.text = "Tile rejected. Choose another move.";
      this.scoreLabel.text = "Back at the start position.";
    }

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

  private setInteractionMode(mode: DemoMode): void {
    this.interactionMode = mode;
    this.cameraDragLastScreenPos = null;
    this.moveTargetPosition = null;
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
    for (const modeButton of this.modeButtons) {
      const isActive = modeButton.mode === this.interactionMode;
      modeButton.button.color = isActive ? Color.fromHex("#7cf7a3") : Color.fromHex("#1a2948");
      modeButton.label.color = isActive ? Color.fromHex("#08121c") : Color.fromHex("#edf4ff");
    }
  }

  private showTrailTile(position: Vector, orientation: TrailTileOrientation): void {
    const key = tileKey(position);

    if (this.occupiedTrailTiles.has(key)) {
      return;
    }

    const trailGraphic = this.sprites.trailTiles[this.nextTrailTileIndex % this.sprites.trailTiles.length].orientations[orientation].clone();
    const trailTile = new Actor({
      pos: vec(position.x, position.y),
      width: TILE_SIZE,
      height: TILE_SIZE,
      graphic: trailGraphic,
      z: 0
    });

    this.add(trailTile);
    this.occupiedTrailTiles.add(key);
    this.nextTrailTileIndex += 1;
  }

  private showPreviewTrailTile(): void {
    if (!this.movementPausePosition) {
      return;
    }

    this.clearPreviewTrailTile();

    const previewGraphic = this.sprites.trailTiles[this.nextTrailTileIndex % this.sprites.trailTiles.length].orientations[this.pendingTrailTileOrientation].clone();
    this.previewTrailTile = new Actor({
      pos: vec(this.movementPausePosition.x, this.movementPausePosition.y),
      width: TILE_SIZE,
      height: TILE_SIZE,
      graphic: previewGraphic,
      z: 0.5
    });

    this.add(this.previewTrailTile);
  }

  private clearPreviewTrailTile(): void {
    if (!this.previewTrailTile) {
      return;
    }

    this.previewTrailTile.kill();
    this.previewTrailTile = null;
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
