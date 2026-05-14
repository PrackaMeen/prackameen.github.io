import { Actor, Color, CoordPlane, Font, FontUnit, Label, PointerButton, Scene, TextAlign, type PointerEvent, vec } from "excalibur";
import { GAME_HEIGHT, GAME_WIDTH, gameSettings } from "../config";
import type { GameController } from "../game-controller";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

interface ButtonControl {
  button: Actor;
  label: Label;
  onPress: () => void;
}

export class SettingsScene extends Scene {
  constructor(private readonly controller: GameController) {
    super();
  }

  override onInitialize(): void {
    const panelWidth = clamp(GAME_WIDTH - 32, 340, 760);
    const panelHeight = clamp(GAME_HEIGHT - 32, 420, 520);
    const titleSize = clamp(GAME_WIDTH * 0.056, 28, 56);
    const bodySize = clamp(GAME_WIDTH * 0.018, 15, 22);
    const buttonWidth = clamp(GAME_WIDTH * 0.16, 92, 128);
    const buttonHeight = clamp(GAME_HEIGHT * 0.062, 42, 56);
    const buttonTextSize = clamp(GAME_WIDTH * 0.022, 16, 22);
    const rowLeftX = GAME_WIDTH / 2 - panelWidth * 0.22;
    const rowRightX = GAME_WIDTH / 2 + panelWidth * 0.22;

    const panel = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2),
      width: panelWidth,
      height: panelHeight,
      color: Color.fromHex("#0f1b34"),
      coordPlane: CoordPlane.Screen
    });

    const title = new Label({
      text: "Settings",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2 - panelHeight * 0.36),
      font: new Font({ family: "Space Grotesk", size: titleSize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#f7fbff"),
      coordPlane: CoordPlane.Screen
    });

    const subtitle = new Label({
      text: "Adjust camera zoom boundaries for the demo.",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2 - panelHeight * 0.24),
      font: new Font({ family: "Inter", size: bodySize, unit: FontUnit.Px, textAlign: TextAlign.Center }),
      color: Color.fromHex("#a6b6d8"),
      maxWidth: panelWidth - 72,
      coordPlane: CoordPlane.Screen
    });

    const minLabel = new Label({
      text: "Zoom min",
      pos: vec(GAME_WIDTH / 2 - panelWidth * 0.25, GAME_HEIGHT / 2 - panelHeight * 0.05),
      font: new Font({ family: "Inter", size: bodySize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#d9ffea"),
      coordPlane: CoordPlane.Screen
    });

    const maxLabel = new Label({
      text: "Zoom max",
      pos: vec(GAME_WIDTH / 2 - panelWidth * 0.25, GAME_HEIGHT / 2 + panelHeight * 0.08),
      font: new Font({ family: "Inter", size: bodySize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#d9ffea"),
      coordPlane: CoordPlane.Screen
    });

    const minValue = new Label({
      text: gameSettings.cameraZoomMin.toFixed(2),
      pos: vec(GAME_WIDTH / 2 + panelWidth * 0.10, GAME_HEIGHT / 2 - panelHeight * 0.05),
      font: new Font({ family: "Space Grotesk", size: bodySize + 4, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#f7fbff"),
      coordPlane: CoordPlane.Screen
    });

    const maxValue = new Label({
      text: gameSettings.cameraZoomMax.toFixed(2),
      pos: vec(GAME_WIDTH / 2 + panelWidth * 0.10, GAME_HEIGHT / 2 + panelHeight * 0.08),
      font: new Font({ family: "Space Grotesk", size: bodySize + 4, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#f7fbff"),
      coordPlane: CoordPlane.Screen
    });

    const minDecrease = this.createButton(rowLeftX, GAME_HEIGHT / 2 - panelHeight * 0.05, buttonWidth, buttonHeight, "-");
    const minIncrease = this.createButton(rowRightX, GAME_HEIGHT / 2 - panelHeight * 0.05, buttonWidth, buttonHeight, "+");
    const maxDecrease = this.createButton(rowLeftX, GAME_HEIGHT / 2 + panelHeight * 0.08, buttonWidth, buttonHeight, "-");
    const maxIncrease = this.createButton(rowRightX, GAME_HEIGHT / 2 + panelHeight * 0.08, buttonWidth, buttonHeight, "+");
    const backButton = this.createButton(GAME_WIDTH / 2, GAME_HEIGHT / 2 + panelHeight * 0.28, buttonWidth * 1.5, buttonHeight, "Back");

    const controls: ButtonControl[] = [
      {
        ...minDecrease,
        onPress: () => {
          gameSettings.cameraZoomMin = clamp(gameSettings.cameraZoomMin - 0.1, 0.2, gameSettings.cameraZoomMax - 0.1);
          minValue.text = gameSettings.cameraZoomMin.toFixed(2);
        }
      },
      {
        ...minIncrease,
        onPress: () => {
          gameSettings.cameraZoomMin = clamp(gameSettings.cameraZoomMin + 0.1, 0.2, gameSettings.cameraZoomMax - 0.1);
          minValue.text = gameSettings.cameraZoomMin.toFixed(2);
        }
      },
      {
        ...maxDecrease,
        onPress: () => {
          gameSettings.cameraZoomMax = clamp(gameSettings.cameraZoomMax - 0.1, gameSettings.cameraZoomMin + 0.1, 5);
          maxValue.text = gameSettings.cameraZoomMax.toFixed(2);
        }
      },
      {
        ...maxIncrease,
        onPress: () => {
          gameSettings.cameraZoomMax = clamp(gameSettings.cameraZoomMax + 0.1, gameSettings.cameraZoomMin + 0.1, 5);
          maxValue.text = gameSettings.cameraZoomMax.toFixed(2);
        }
      },
      {
        ...backButton,
        onPress: () => {
          this.controller.showMenu();
        }
      }
    ];

    this.add(panel);
    this.add(title);
    this.add(subtitle);
    this.add(minLabel);
    this.add(maxLabel);
    this.add(minValue);
    this.add(maxValue);

    for (const control of controls) {
      this.add(control.button);
      this.add(control.label);
    }

    this.engine.input.pointers.primary.on("down", (event: PointerEvent) => {
      if (event.button !== PointerButton.Left) {
        return;
      }

      for (const control of controls) {
        if (this.isPointInsideButton(event.screenPos, control.button)) {
          control.onPress();
          return;
        }
      }
    });
  }

  private createButton(centerX: number, centerY: number, width: number, height: number, text: string): Pick<ButtonControl, "button" | "label"> {
    const buttonLabelYOffset = clamp(height * 0.09, 4, 6);

    const button = new Actor({
      pos: vec(centerX, centerY),
      width,
      height,
      color: Color.fromHex("#1a2948"),
      z: 100,
      coordPlane: CoordPlane.Screen
    });

    const label = new Label({
      text,
      pos: vec(centerX, centerY - buttonLabelYOffset),
      font: new Font({ family: "Space Grotesk", size: clamp(height * 0.42, 14, 18), unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#edf4ff"),
      z: 101,
      coordPlane: CoordPlane.Screen,
      maxWidth: width
    });

    return { button, label };
  }

  private isPointInsideButton(point: { x: number; y: number }, button: Actor): boolean {
    const halfWidth = button.width / 2;
    const halfHeight = button.height / 2;
    const left = button.pos.x - halfWidth;
    const right = button.pos.x + halfWidth;
    const top = button.pos.y - halfHeight;
    const bottom = button.pos.y + halfHeight;

    return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
  }
}