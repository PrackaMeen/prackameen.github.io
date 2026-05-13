import { Actor, Color, Font, FontUnit, Label, Scene, TextAlign, type PointerEvent, vec } from "excalibur";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import type { GameController } from "../game-controller";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export class MenuScene extends Scene {
  constructor(private readonly controller: GameController) {
    super();
  }

  override onInitialize(): void {
    const panelWidth = clamp(GAME_WIDTH - 32, 320, 760);
    const panelHeight = clamp(GAME_HEIGHT - 32, 360, 440);
    const titleSize = clamp(GAME_WIDTH * 0.065, 32, 64);
    const subtitleSize = clamp(GAME_WIDTH * 0.024, 18, 24);
    const buttonWidth = clamp(GAME_WIDTH - 80, 220, 290);
    const buttonHeight = clamp(GAME_HEIGHT * 0.09, 64, 74);
    const buttonTextSize = clamp(GAME_WIDTH * 0.028, 24, 32);
    const captionSize = clamp(GAME_WIDTH * 0.014, 15, 18);

    const panel = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2),
      width: panelWidth,
      height: panelHeight,
      color: Color.fromHex("#0f1b34")
    });

    const title = new Label({
      text: "PrackaMeen Arcade Lab",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2 - panelHeight * 0.28),
      font: new Font({ family: "Space Grotesk", size: titleSize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#f7fbff")
    });

    const subtitle = new Label({
      text: "Menu scene ready. Enter the starter demo and test movement, scoring, and scene swaps.",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2 - panelHeight * 0.08),
      font: new Font({ family: "Inter", size: subtitleSize, unit: FontUnit.Px, textAlign: TextAlign.Center }),
      color: Color.fromHex("#a6b6d8"),
      maxWidth: panelWidth - 80
    });

    const startButton = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2 + panelHeight * 0.20),
      width: buttonWidth,
      height: buttonHeight,
      color: Color.fromHex("#7cf7a3")
    });

    const buttonText = new Label({
      text: "Start Demo",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2 + panelHeight * 0.165),
      font: new Font({ family: "Space Grotesk", size: buttonTextSize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#081120")
    });

    const buttonCaption = new Label({
      text: "Tap or click to begin",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2 + panelHeight * 0.30),
      font: new Font({ family: "Inter", size: captionSize, unit: FontUnit.Px, textAlign: TextAlign.Center }),
      color: Color.fromHex("#d9ffea")
    });

    const footer = new Label({
      text: "TypeScript + Excalibur.js",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2 + panelHeight * 0.42),
      font: new Font({ family: "Inter", size: captionSize, unit: FontUnit.Px, textAlign: TextAlign.Center }),
      color: Color.fromHex("#6d7ca3")
    });

    this.add(panel);
    this.add(title);
    this.add(subtitle);
    this.add(startButton);
    this.add(buttonText);
    this.add(buttonCaption);
    this.add(footer);

    startButton.on("pointerdown", (event: PointerEvent) => {
      this.controller.startDemo();
    });
  }
}
