import { Actor, Color, CoordPlane, Font, FontUnit, Label, Scene, TextAlign, type PointerEvent, vec } from "excalibur";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import type { GameController } from "../game-controller";
import { createScreenButtonTemplate, getScreenButtonBounds, isPointInsideScreenButton } from "../ui/screen-button-template";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

const MENU_CSS_Y_OFFSET = 20;

export class MenuScene extends Scene {
  private continueButton!: Actor;
  private continueText!: Label;
  private startButton!: Actor;
  private settingsButton!: Actor;
  private inputEnabled = false;
  private menuPointerHandler = (event: PointerEvent): void => {
    if (!this.inputEnabled) {
      return;
    }

    this.handleMenuPointerDown(event.screenPos);
  };

  constructor(private readonly controller: GameController) {
    super();
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

    const continueTemplate = createScreenButtonTemplate({
      centerX: GAME_WIDTH / 2,
      centerY: buttonCenterY - buttonHeight - buttonGap,
      width: buttonWidth,
      height: buttonHeight,
      text: "Continue",
      buttonColor: "#7b8492",
      textColor: "#edf4ff",
      fontFamily: "Space Grotesk",
      fontSize: clamp(GAME_WIDTH * 0.02, 16, 22),
      z: 10,
      labelZ: 11,
      maxWidth: buttonWidth,
      labelYOffset: buttonLabelYOffset
    });

    this.continueButton = continueTemplate.button;
    this.continueText = continueTemplate.label;

    const panel = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2),
      width: panelWidth,
      height: panelHeight,
      color: Color.fromHex("#0f1b34"),
      coordPlane: CoordPlane.Screen,
      z: 1
    });

    const title = new Label({
      text: "G.A.M.E",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2 - panelHeight * 0.18),
      font: new Font({ family: "Space Grotesk", size: titleSize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#f7fbff"),
      coordPlane: CoordPlane.Screen,
      z: 2
    });

    const startTemplate = createScreenButtonTemplate({
      centerX: GAME_WIDTH / 2,
      centerY: buttonCenterY,
      width: buttonWidth,
      height: buttonHeight,
      text: "New Game",
      buttonColor: "#7cf7a3",
      textColor: "#081120",
      fontFamily: "Space Grotesk",
      fontSize: buttonTextSize,
      z: 10,
      labelZ: 11,
      maxWidth: buttonWidth,
      labelYOffset: buttonLabelYOffset
    });

    const settingsTemplate = createScreenButtonTemplate({
      centerX: GAME_WIDTH / 2,
      centerY: buttonCenterY + buttonHeight + buttonGap,
      width: buttonWidth,
      height: buttonHeight,
      text: "Settings",
      buttonColor: "#1a2948",
      textColor: "#edf4ff",
      fontFamily: "Space Grotesk",
      fontSize: buttonTextSize,
      z: 10,
      labelZ: 11,
      maxWidth: buttonWidth,
      labelYOffset: buttonLabelYOffset
    });

    this.startButton = startTemplate.button;
    this.settingsButton = settingsTemplate.button;

    this.add(panel);
    this.add(title);
    this.add(this.continueButton);
    this.add(this.continueText);
    this.add(this.startButton);
    this.add(this.settingsButton);
    this.add(startTemplate.label);
    this.add(settingsTemplate.label);

    (globalThis as typeof globalThis & {
      __menuButtonRects?: {
        settings: { left: number; top: number; right: number; bottom: number };
      };
    }).__menuButtonRects = {
      settings: getScreenButtonBounds(settingsTemplate)
    };

    this.engine.input.pointers.primary.on("down", this.menuPointerHandler);

    this.updateContinueButtonState();
    this.inputEnabled = true;
  }

  override onActivate(): void {
    (globalThis as typeof globalThis & { __activeSceneName?: string }).__activeSceneName = "menu";
    this.inputEnabled = true;
  }

  override onDeactivate(): void {
    this.inputEnabled = false;
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

  private logPointerClick(componentName: string): void {
    console.log(`[menu-pointer] ${componentName}`);
  }

  private handleMenuPointerDown(screenPos: import("excalibur").Vector): void {
    (globalThis as typeof globalThis & {
      __lastMenuPointer?: { x: number; y: number };
      __lastMenuHitTarget?: string | null;
    }).__lastMenuPointer = { x: screenPos.x, y: screenPos.y };

    console.log(`[menu-pointer] raw s=${Math.round(screenPos.x)},${Math.round(screenPos.y)} canvas=${Math.round(this.engine.canvas.getBoundingClientRect().left)},${Math.round(this.engine.canvas.getBoundingClientRect().top)}`);
    const adjustedScreenPos = vec(screenPos.x, screenPos.y + MENU_CSS_Y_OFFSET);

    const targets = [
      { name: "new-game", button: this.startButton, action: () => this.controller.startNewGame() },
      { name: "settings", button: this.settingsButton, action: () => this.controller.showSettings() },
      {
        name: "continue",
        button: this.continueButton,
        action: () => {
          if (this.controller.canContinueDemo) {
            this.controller.continueDemo();
          }
        }
      }
    ];

    for (const target of targets) {
      const targetButton = {
        button: target.button,
        label: { text: target.name } as Label,
        width: target.button.width,
        height: target.button.height,
        hitboxOrigin: "center" as const
      };

      const isInside = isPointInsideScreenButton(adjustedScreenPos, targetButton);

      if (isInside) {
        (globalThis as typeof globalThis & { __lastMenuHitTarget?: string | null }).__lastMenuHitTarget = target.name;
        this.logPointerClick(target.name);
        target.action();
        return;
      }
    }

    (globalThis as typeof globalThis & { __lastMenuHitTarget?: string | null }).__lastMenuHitTarget = null;
  }

}
