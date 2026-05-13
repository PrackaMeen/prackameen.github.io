import { Actor, Color, CoordPlane, Font, FontUnit, Label, Keys, PointerButton, Scene, TextAlign, type PointerEvent, type Vector, vec } from "excalibur";
import { GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from "../config";
import type { GameController } from "../game-controller";
import { BoxActor } from "../actors/box-actor";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function snapToTileCenter(value: number): number {
  return Math.round((value - TILE_SIZE / 2) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
}

type DemoMode = "action" | "move" | "zoom";

interface ModeButtonControl {
  mode: DemoMode;
  button: Actor;
  label: Label;
  width: number;
  height: number;
}

export class DemoScene extends Scene {
  private readonly controller: GameController;
  private readonly playerSize = TILE_SIZE;
  private readonly player = new BoxActor({
    pos: vec(snapToTileCenter(GAME_WIDTH / 2), snapToTileCenter(GAME_HEIGHT / 2)),
    width: this.playerSize,
    height: this.playerSize,
    color: Color.fromHex("#6bf0ff")
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
  private readonly modeButtons: ModeButtonControl[] = [];
  private interactionMode: DemoMode = "action";
  private cameraDragLastScreenPos: Vector | null = null;

  constructor(controller: GameController) {
    super();
    this.controller = controller;
  }

  override onInitialize(): void {
    const platformWidth = clamp(GAME_WIDTH - this.sideInset * 2, 320, 760);
    const platformHeight = clamp(GAME_HEIGHT * 0.06, 40, 52);
    const supportSize = clamp(GAME_WIDTH * 0.013, 14, 18);
    const screenWidth = this.engine.screen.canvasWidth;
    const screenHeight = this.engine.screen.canvasHeight;
    const buttonWidth = clamp(screenWidth * 0.15, 72, 120);
    const buttonHeight = clamp(screenHeight * 0.06, 34, 46);
    const buttonGap = clamp(buttonWidth * 0.12, 10, 16);
    const bottomInset = screenWidth <= 900 ? clamp(screenHeight * 0.12, 72, 132) : clamp(screenHeight * 0.05, 24, 40);
    const buttonCenterY = screenHeight - bottomInset - buttonHeight / 2;
    const centerButtonX = screenWidth / 2;
    const leftButtonX = centerButtonX - buttonWidth - buttonGap;
    const rightButtonX = centerButtonX + buttonWidth + buttonGap;

    const backdrop = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2),
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      color: Color.fromHex("#0c1428"),
      z: -20
    });

    const platform = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT - this.topInset - platformHeight / 2),
      width: platformWidth,
      height: platformHeight,
      color: Color.fromHex("#142445"),
      z: -10
    });

    const support = new Label({
      text: "A tiny starter sandbox for demo work",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT - this.topInset - 12),
      font: new Font({ family: "Inter", size: supportSize, unit: FontUnit.Px, textAlign: TextAlign.Center }),
      color: Color.fromHex("#91a6cb"),
      coordPlane: CoordPlane.Screen
    });

    this.modeButtons.push(
      this.createModeButton("action", "A", leftButtonX, buttonCenterY, buttonWidth, buttonHeight),
      this.createModeButton("move", "M", centerButtonX, buttonCenterY, buttonWidth, buttonHeight),
      this.createModeButton("zoom", "Z", rightButtonX, buttonCenterY, buttonWidth, buttonHeight)
    );

    this.add(backdrop);
    this.add(platform);
    this.add(support);
    this.add(this.player);
    this.add(this.scoreLabel);
    this.add(this.hintLabel);
    this.add(this.messageLabel);
    for (const modeButton of this.modeButtons) {
      this.add(modeButton.button);
      this.add(modeButton.label);
    }

    this.setInteractionMode("action");

    const primaryPointer = this.engine.input.pointers.primary;

    primaryPointer.on("down", (event: PointerEvent) => {
      if (event.button !== PointerButton.Left) {
        return;
      }

      if (this.handleModeButtonPress(event.screenPos)) {
        return;
      }

      if (this.interactionMode === "move" || this.interactionMode === "zoom") {
        this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
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
        this.showTrailTile(this.player.pos);
        this.moveTargetPosition = vec(event.worldPos.x, event.worldPos.y);
        this.player.setTargetPosition(this.moveTargetPosition);
        this.player.deselect();
        this.scoreLabel.text = "Click or tap the box to select it.";
        this.messageLabel.text = "The box moves at a constant speed to the tapped or clicked point.";
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
        this.camera.zoom = clamp(this.camera.zoom - deltaY * 0.005, 0.6, 2.5);
        this.cameraDragLastScreenPos = vec(event.screenPos.x, event.screenPos.y);
      }
    });

    primaryPointer.on("up", () => {
      this.cameraDragLastScreenPos = null;
    });

    primaryPointer.on("cancel", () => {
      this.cameraDragLastScreenPos = null;
    });
  }

  override onPreUpdate(engine: import("excalibur").Engine): void {
    if (engine.input.keyboard.wasPressed(Keys.Escape)) {
      this.controller.showMenu();
      return;
    }

    if (this.moveTargetPosition && !this.player.isMoving) {
      this.moveTargetPosition = null;
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

  private handleModeButtonPress(screenPos: Vector): boolean {
    for (const modeButton of this.modeButtons) {
      if (this.isPointInsideButton(screenPos, modeButton)) {
        this.setInteractionMode(modeButton.mode);
        return true;
      }
    }

    return false;
  }

  private isPointInsideButton(point: Vector, button: ModeButtonControl): boolean {
    const halfWidth = button.width / 2;
    const halfHeight = button.height / 2;
    const left = button.button.pos.x - halfWidth;
    const right = button.button.pos.x + halfWidth;
    const top = button.button.pos.y - halfHeight;
    const bottom = button.button.pos.y + halfHeight;

    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
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
      this.hintLabel.text = "Drag upward to zoom in and downward to zoom out.";
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

  private showTrailTile(position: Vector): void {
    const trailTile = new Actor({
      pos: vec(position.x, position.y),
      width: TILE_SIZE,
      height: TILE_SIZE,
      color: Color.fromHex("#47e36d"),
      z: 0
    });

    this.add(trailTile);
  }
}
