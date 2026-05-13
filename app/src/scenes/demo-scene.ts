import { Actor, Color, Font, FontUnit, Label, Keys, PointerButton, Scene, TextAlign, type PointerEvent, type Vector, vec } from "excalibur";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import type { GameController } from "../game-controller";

class PlayerActor extends Actor {
  private readonly speed = 320;
  private targetPosition: Vector | null = null;

  setTargetPosition(target: Vector): void {
    this.targetPosition = vec(target.x, target.y);
  }

  override onPreUpdate(engine: import("excalibur").Engine, delta: number): void {
    if (this.targetPosition) {
      const offsetX = this.targetPosition.x - this.pos.x;
      const offsetY = this.targetPosition.y - this.pos.y;
      const distance = Math.hypot(offsetX, offsetY);

      if (distance <= 1) {
        this.pos = vec(this.targetPosition.x, this.targetPosition.y);
        this.targetPosition = null;
      } else {
        const step = this.speed * (delta / 1000);

        if (distance <= step) {
          this.pos = vec(this.targetPosition.x, this.targetPosition.y);
          this.targetPosition = null;
        } else {
          const directionX = offsetX / distance;
          const directionY = offsetY / distance;
          this.pos = this.pos.add(vec(directionX * step, directionY * step));
        }
      }
    }

    this.pos = vec(
      Math.max(32, Math.min(GAME_WIDTH - 32, this.pos.x)),
      Math.max(32, Math.min(GAME_HEIGHT - 32, this.pos.y))
    );
  }
}

export class DemoScene extends Scene {
  private readonly controller: GameController;
  private readonly player = new PlayerActor({
    pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2),
    width: 48,
    height: 48,
    color: Color.fromHex("#6bf0ff")
  });
  private pointerPosition: Vector = vec(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  private readonly scoreLabel = new Label({
    text: "Click or tap anywhere to send the box there.",
    pos: vec(32, 32),
    font: new Font({ family: "Inter", size: 24, unit: FontUnit.Px, bold: true }),
    color: Color.fromHex("#ffffff")
  });
  private readonly hintLabel = new Label({
    text: "Move your finger or mouse to aim the arrow. Press Esc to return to menu.",
    pos: vec(32, 64),
    font: new Font({ family: "Inter", size: 18, unit: FontUnit.Px }),
    color: Color.fromHex("#9db0d6")
  });
  private readonly messageLabel = new Label({
    text: "The box moves at a constant speed to the tapped or clicked point.",
    pos: vec(GAME_WIDTH / 2, 24),
    font: new Font({ family: "Space Grotesk", size: 26, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
    color: Color.fromHex("#7cf7a3")
  });

  constructor(controller: GameController) {
    super();
    this.controller = controller;
  }

  override onInitialize(): void {
    const backdrop = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2),
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      color: Color.fromHex("#0c1428")
    });

    const platform = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT - 104),
      width: GAME_WIDTH - 120,
      height: 52,
      color: Color.fromHex("#142445")
    });

    const support = new Label({
      text: "A tiny starter sandbox for demo work",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT - 92),
      font: new Font({ family: "Inter", size: 18, unit: FontUnit.Px, textAlign: TextAlign.Center }),
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
      this.player.setTargetPosition(this.pointerPosition);
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
