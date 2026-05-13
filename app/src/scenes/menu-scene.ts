import { Actor, Color, Font, FontUnit, Label, Scene, TextAlign, Keys, vec } from "excalibur";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import type { GameController } from "../game-controller";

export class MenuScene extends Scene {
  constructor(private readonly controller: GameController) {
    super();
  }

  override onInitialize(): void {
    const panel = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2),
      width: 760,
      height: 440,
      color: Color.fromHex("#0f1b34")
    });

    const title = new Label({
      text: "PrackaMeen Arcade Lab",
      pos: vec(GAME_WIDTH / 2, 170),
      font: new Font({ family: "Space Grotesk", size: 64, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#f7fbff")
    });

    const subtitle = new Label({
      text: "Menu scene ready. Enter the starter demo and test movement, scoring, and scene swaps.",
      pos: vec(GAME_WIDTH / 2, 248),
      font: new Font({ family: "Inter", size: 24, unit: FontUnit.Px, textAlign: TextAlign.Center }),
      color: Color.fromHex("#a6b6d8"),
      maxWidth: 600
    });

    const startHint = new Label({
      text: "Press Enter or Space to start",
      pos: vec(GAME_WIDTH / 2, 360),
      font: new Font({ family: "Inter", size: 28, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#7cf7a3")
    });

    const footer = new Label({
      text: "TypeScript + Excalibur.js",
      pos: vec(GAME_WIDTH / 2, 414),
      font: new Font({ family: "Inter", size: 18, unit: FontUnit.Px, textAlign: TextAlign.Center }),
      color: Color.fromHex("#6d7ca3")
    });

    this.add(panel);
    this.add(title);
    this.add(subtitle);
    this.add(startHint);
    this.add(footer);
  }

  override onPreUpdate(engine: import("excalibur").Engine): void {
    if (engine.input.keyboard.wasPressed(Keys.Enter) || engine.input.keyboard.wasPressed(Keys.Space)) {
      this.controller.startDemo();
    }
  }
}
