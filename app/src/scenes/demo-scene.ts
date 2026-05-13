import { Actor, Color, Font, FontUnit, Label, Scene, TextAlign, Keys, vec } from "excalibur";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import type { GameController } from "../game-controller";

class PlayerActor extends Actor {
  private readonly speed = 320;

  override onPreUpdate(engine: import("excalibur").Engine, delta: number): void {
    let moveX = 0;
    let moveY = 0;

    if (engine.input.keyboard.isHeld(Keys.ArrowLeft) || engine.input.keyboard.isHeld(Keys.A)) {
      moveX -= 1;
    }

    if (engine.input.keyboard.isHeld(Keys.ArrowRight) || engine.input.keyboard.isHeld(Keys.D)) {
      moveX += 1;
    }

    if (engine.input.keyboard.isHeld(Keys.ArrowUp) || engine.input.keyboard.isHeld(Keys.W)) {
      moveY -= 1;
    }

    if (engine.input.keyboard.isHeld(Keys.ArrowDown) || engine.input.keyboard.isHeld(Keys.S)) {
      moveY += 1;
    }

    if (moveX !== 0 || moveY !== 0) {
      const length = Math.hypot(moveX, moveY);
      const directionX = moveX / length;
      const directionY = moveY / length;
      const distance = this.speed * (delta / 1000);

      this.pos = this.pos.add(vec(directionX * distance, directionY * distance));
    }

    this.pos = vec(
      Math.max(32, Math.min(GAME_WIDTH - 32, this.pos.x)),
      Math.max(32, Math.min(GAME_HEIGHT - 32, this.pos.y))
    );
  }
}

export class DemoScene extends Scene {
  private readonly controller: GameController;
  private score = 0;
  private readonly scoreLabel = new Label({
    text: "Beacons captured: 0",
    pos: vec(32, 32),
    font: new Font({ family: "Inter", size: 24, unit: FontUnit.Px, bold: true }),
    color: Color.fromHex("#ffffff")
  });
  private readonly hintLabel = new Label({
    text: "Move with WASD or arrow keys. Press Esc to return to menu.",
    pos: vec(32, 64),
    font: new Font({ family: "Inter", size: 18, unit: FontUnit.Px }),
    color: Color.fromHex("#9db0d6")
  });
  private readonly messageLabel = new Label({
    text: "Collect the pulsing beacon to grow the score.",
    pos: vec(GAME_WIDTH / 2, 24),
    font: new Font({ family: "Space Grotesk", size: 26, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
    color: Color.fromHex("#7cf7a3")
  });
  private readonly player = new PlayerActor({
    pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2),
    width: 48,
    height: 48,
    color: Color.fromHex("#6bf0ff")
  });
  private readonly beacon = new Actor({
    pos: vec(GAME_WIDTH / 2 + 180, GAME_HEIGHT / 2 - 120),
    width: 42,
    height: 42,
    color: Color.fromHex("#ffcc4d")
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
    this.add(this.beacon);
    this.add(this.scoreLabel);
    this.add(this.hintLabel);
    this.add(this.messageLabel);
  }

  override onPreUpdate(engine: import("excalibur").Engine): void {
    if (engine.input.keyboard.wasPressed(Keys.Escape)) {
      this.controller.showMenu();
      return;
    }

    const dx = this.player.pos.x - this.beacon.pos.x;
    const dy = this.player.pos.y - this.beacon.pos.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 48) {
      this.score += 1;
      this.scoreLabel.text = `Beacons captured: ${this.score}`;
      this.messageLabel.text = this.score === 1 ? "First beacon captured. Keep going." : "Beacon relocated. Chase the next one.";

      const nextX = 90 + Math.random() * (GAME_WIDTH - 180);
      const nextY = 120 + Math.random() * (GAME_HEIGHT - 220);
      this.beacon.pos = vec(nextX, nextY);
    }
  }
}
