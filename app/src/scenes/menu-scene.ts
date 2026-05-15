import { Actor, Color, Font, FontUnit, Label, Scene, TextAlign, type PointerEvent, vec } from "excalibur";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import type { GameController } from "../game-controller";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export class MenuScene extends Scene {
  private readonly continueButton: Actor;
  private readonly continueText: Label;

  constructor(private readonly controller: GameController) {
    super();
    const panelHeight = clamp(GAME_HEIGHT - 32, 360, 440);
    const buttonWidth = clamp(GAME_WIDTH - 120, 200, 260);
    const buttonHeight = clamp(GAME_HEIGHT * 0.07, 46, 58);
    const buttonGap = clamp(GAME_HEIGHT * 0.018, 10, 16);
    const buttonCenterY = GAME_HEIGHT / 2 + panelHeight * 0.12;
    const buttonLabelYOffset = clamp(buttonHeight * 0.09, 4, 6);

    this.continueButton = new Actor({
      pos: vec(GAME_WIDTH / 2, buttonCenterY - buttonHeight - buttonGap),
      width: buttonWidth,
      height: buttonHeight,
      color: Color.fromHex("#7b8492")
    });

    this.continueText = new Label({
      text: "Continue",
      pos: vec(GAME_WIDTH / 2, buttonCenterY - buttonHeight - buttonGap - buttonLabelYOffset),
      font: new Font({ family: "Space Grotesk", size: clamp(GAME_WIDTH * 0.02, 16, 22), unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#edf4ff"),
      maxWidth: buttonWidth
    });
  }

  override onInitialize(): void {
    const panelWidth = clamp(GAME_WIDTH - 32, 320, 760);
    const panelHeight = clamp(GAME_HEIGHT - 32, 360, 440);
    const titleSize = clamp(GAME_WIDTH * 0.05, 26, 48);
    const buttonWidth = clamp(GAME_WIDTH - 120, 200, 260);
    const buttonHeight = clamp(GAME_HEIGHT * 0.07, 46, 58);
    const buttonTextSize = clamp(GAME_WIDTH * 0.02, 16, 22);
    const buttonGap = clamp(GAME_HEIGHT * 0.018, 10, 16);
    const buttonCenterY = GAME_HEIGHT / 2 + panelHeight * 0.12;
    const buttonLabelYOffset = clamp(buttonHeight * 0.09, 4, 6);

    const panel = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2),
      width: panelWidth,
      height: panelHeight,
      color: Color.fromHex("#0f1b34")
    });

    const title = new Label({
      text: "G.A.M.E",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2 - panelHeight * 0.18),
      font: new Font({ family: "Space Grotesk", size: titleSize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#f7fbff")
    });

    const startButton = new Actor({
      pos: vec(GAME_WIDTH / 2, buttonCenterY),
      width: buttonWidth,
      height: buttonHeight,
      color: Color.fromHex("#7cf7a3")
    });

    const settingsButton = new Actor({
      pos: vec(GAME_WIDTH / 2, buttonCenterY + buttonHeight + buttonGap),
      width: buttonWidth,
      height: buttonHeight,
      color: Color.fromHex("#1a2948")
    });

    const continueTextYOffset = clamp(buttonHeight * 0.09, 4, 6);
    const buttonText = new Label({
      text: "New Game",
      pos: vec(GAME_WIDTH / 2, buttonCenterY - buttonLabelYOffset),
      font: new Font({ family: "Space Grotesk", size: buttonTextSize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#081120"),
      maxWidth: buttonWidth
    });

    const continueText = this.continueText;
    continueText.pos = vec(GAME_WIDTH / 2, buttonCenterY - buttonHeight - buttonGap - continueTextYOffset);

    const settingsText = new Label({
      text: "Settings",
      pos: vec(GAME_WIDTH / 2, buttonCenterY + buttonHeight + buttonGap - buttonLabelYOffset),
      font: new Font({ family: "Space Grotesk", size: buttonTextSize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#edf4ff"),
      maxWidth: buttonWidth
    });

    this.add(panel);
    this.add(title);
    this.add(this.continueButton);
    this.add(this.continueText);
    this.add(startButton);
    this.add(settingsButton);
    this.add(buttonText);
    this.add(settingsText);

    this.continueButton.on("pointerdown", () => {
      if (!this.controller.canContinueDemo) {
        return;
      }

      this.controller.continueDemo();
    });

    startButton.on("pointerdown", (event: PointerEvent) => {
      this.controller.startNewGame();
    });

    settingsButton.on("pointerdown", () => {
      this.controller.showSettings();
    });

    this.updateContinueButtonState();
  }

  override onPreUpdate(): void {
    this.updateContinueButtonState();
  }

  private updateContinueButtonState(): void {
    const canContinue = this.controller.canContinueDemo;
    this.continueButton.color = canContinue ? Color.fromHex("#7cf7a3") : Color.fromHex("#7b8492");
    this.continueText.color = canContinue ? Color.fromHex("#081120") : Color.fromHex("#edf4ff");
    this.continueText.text = canContinue ? "Continue" : "Continue";
  }
}
