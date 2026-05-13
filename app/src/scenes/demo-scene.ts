import { Actor, Color, Font, FontUnit, Label, Keys, PointerButton, Scene, TextAlign, type PointerEvent, type Vector, vec } from "excalibur";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import type { GameController } from "../game-controller";
import { BoxActor } from "../actors/box-actor";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

 
export class DemoScene extends Scene {
  private readonly controller: GameController;
  private readonly playerSize = clamp(Math.min(GAME_WIDTH, GAME_HEIGHT) * 0.07, 36, 48);
  private readonly player = new BoxActor({
    pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2),
    width: this.playerSize,
    height: this.playerSize,
    color: Color.fromHex("#6bf0ff")
  });
  private pointerPosition: Vector = vec(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  private readonly topInset = clamp(GAME_HEIGHT * 0.03, 18, 28);
  private readonly sideInset = clamp(GAME_WIDTH * 0.025, 16, 32);
  private readonly scoreLabel = new Label({
    text: "Click or tap anywhere to send the box there.",
    pos: vec(this.sideInset, this.topInset),
    font: new Font({ family: "Inter", size: clamp(GAME_WIDTH * 0.022, 18, 24), unit: FontUnit.Px, bold: true }),
    color: Color.fromHex("#ffffff")
  });
  private readonly hintLabel = new Label({
    text: "Move your finger or mouse to aim the arrow. Press Esc to return to menu.",
    pos: vec(this.sideInset, this.topInset + clamp(GAME_HEIGHT * 0.045, 26, 40)),
    font: new Font({ family: "Inter", size: clamp(GAME_WIDTH * 0.014, 14, 18), unit: FontUnit.Px }),
    color: Color.fromHex("#9db0d6")
  });
  private readonly messageLabel = new Label({
    text: "The box moves at a constant speed to the tapped or clicked point.",
    pos: vec(GAME_WIDTH / 2, this.topInset),
    font: new Font({ family: "Space Grotesk", size: clamp(GAME_WIDTH * 0.019, 18, 26), unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
    color: Color.fromHex("#7cf7a3")
  });

  constructor(controller: GameController) {
    super();
    this.controller = controller;
  }

  override onInitialize(): void {
    this.camera.strategy.lockToActor(this.player);

    const platformWidth = clamp(GAME_WIDTH - this.sideInset * 2, 320, 760);
    const platformHeight = clamp(GAME_HEIGHT * 0.06, 40, 52);
    const supportSize = clamp(GAME_WIDTH * 0.013, 14, 18);

    const backdrop = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2),
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      color: Color.fromHex("#0c1428")
    });

    const platform = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT - this.topInset - platformHeight / 2),
      width: platformWidth,
      height: platformHeight,
      color: Color.fromHex("#142445")
    });

    const support = new Label({
      text: "A tiny starter sandbox for demo work",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT - this.topInset - 12),
      font: new Font({ family: "Inter", size: supportSize, unit: FontUnit.Px, textAlign: TextAlign.Center }),
      color: Color.fromHex("#91a6cb")
    });

    this.add(backdrop);
    this.add(platform);
    this.add(support);
    this.add(this.player);
    this.add(this.scoreLabel);
    this.add(this.hintLabel);
    this.add(this.messageLabel);

    const primaryPointer = this.engine.input.pointers.primary;

    primaryPointer.on("move", (event: PointerEvent) => {
      this.pointerPosition = vec(event.worldPos.x, event.worldPos.y);
    });

    primaryPointer.on("down", (event: PointerEvent) => {
      if (event.button !== PointerButton.Left) {
        return;
      }

      this.pointerPosition = vec(event.worldPos.x, event.worldPos.y);

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
        this.player.setTargetPosition(this.pointerPosition);
        this.player.deselect();
        this.scoreLabel.text = "Click or tap the box to select it.";
        this.messageLabel.text = "The box moves at a constant speed to the tapped or clicked point.";
      }
    });
  }

  override onPreUpdate(engine: import("excalibur").Engine): void {
    if (engine.input.keyboard.wasPressed(Keys.Escape)) {
      this.controller.showMenu();
      return;
    }
  }

  override onPostDraw(ctx: import("excalibur").ExcaliburGraphicsContext): void {
    const start = this.player.pos;
    const end = this.pointerPosition;
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
}
