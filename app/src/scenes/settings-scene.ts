import { Actor, Color, CoordPlane, Font, FontUnit, Label, PointerButton, Scene, TextAlign, type PointerEvent, vec } from "excalibur";
import { GAME_HEIGHT, GAME_WIDTH, getTrailTileVersion, gameSettings, setTrailTileVersionPreference, type TrailTileVersion } from "../config";
import type { GameController } from "../game-controller";
import { getNextHeroId, getSelectedHero, heroRoster, setSelectedHeroPreference, type HeroId } from "../hero-roster";
import { createScreenButtonTemplate, getCanvasPointerPosition, isPointInsideScreenButton } from "../ui/screen-button-template";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

interface ButtonControl {
  button: Actor;
  label: Label;
  onPress: () => void;
}

export class SettingsScene extends Scene {
  private inputEnabled = false;
  private controls: ButtonControl[] = [];
  private selectedHeroId: HeroId = getSelectedHero().id;

  private settingsPointerHandler = (event: PointerEvent): void => {
    if (!this.inputEnabled) {
      return;
    }

    if (event.button !== PointerButton.Left) {
      return;
    }

    const screenPos = getCanvasPointerPosition(event, this.engine.canvas);

    for (const control of this.controls) {
      if (isPointInsideScreenButton(screenPos, {
        button: control.button,
        label: control.label,
        width: control.button.width,
        height: control.button.height,
        hitboxOrigin: "center"
      })) {
        control.onPress();
        return;
      }
    }
  };

  constructor(private readonly controller: GameController) {
    super();
  }

  override onInitialize(): void {
    const panelWidth = clamp(GAME_WIDTH - 32, 340, 760);
    const panelHeight = clamp(GAME_HEIGHT - 32, 500, 640);
    const titleSize = clamp(GAME_WIDTH * 0.056, 28, 56);
    const bodySize = clamp(GAME_WIDTH * 0.018, 15, 22);
    const buttonWidth = clamp(GAME_WIDTH * 0.16, 92, 128);
    const buttonHeight = clamp(GAME_HEIGHT * 0.062, 42, 56);
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
      text: "Adjust camera zoom, trail tiles, and the temporary hero roster.",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2 - panelHeight * 0.28),
      font: new Font({ family: "Inter", size: bodySize, unit: FontUnit.Px, textAlign: TextAlign.Center }),
      color: Color.fromHex("#a6b6d8"),
      maxWidth: panelWidth - 72,
      coordPlane: CoordPlane.Screen
    });

    const heroLabel = new Label({
      text: "Hero",
      pos: vec(GAME_WIDTH / 2 - panelWidth * 0.25, GAME_HEIGHT / 2 - panelHeight * 0.16),
      font: new Font({ family: "Inter", size: bodySize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#d9ffea"),
      coordPlane: CoordPlane.Screen
    });

    const heroValue = new Label({
      text: this.formatHeroSelection(this.selectedHeroId),
      pos: vec(GAME_WIDTH / 2 + panelWidth * 0.07, GAME_HEIGHT / 2 - panelHeight * 0.16),
      font: new Font({ family: "Space Grotesk", size: bodySize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#f7fbff"),
      maxWidth: panelWidth * 0.62,
      coordPlane: CoordPlane.Screen
    });

    const heroPrevious = this.createButton(rowLeftX, GAME_HEIGHT / 2 - panelHeight * 0.16, buttonWidth, buttonHeight, "<");
    const heroNext = this.createButton(rowRightX, GAME_HEIGHT / 2 - panelHeight * 0.16, buttonWidth, buttonHeight, ">");

    const minLabel = new Label({
      text: "Zoom min",
      pos: vec(GAME_WIDTH / 2 - panelWidth * 0.25, GAME_HEIGHT / 2 - panelHeight * 0.01),
      font: new Font({ family: "Inter", size: bodySize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#d9ffea"),
      coordPlane: CoordPlane.Screen
    });

    const maxLabel = new Label({
      text: "Zoom max",
      pos: vec(GAME_WIDTH / 2 - panelWidth * 0.25, GAME_HEIGHT / 2 + panelHeight * 0.12),
      font: new Font({ family: "Inter", size: bodySize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#d9ffea"),
      coordPlane: CoordPlane.Screen
    });

    const debugLabel = new Label({
      text: "Debug info",
      pos: vec(GAME_WIDTH / 2 - panelWidth * 0.25, GAME_HEIGHT / 2 + panelHeight * 0.25),
      font: new Font({ family: "Inter", size: bodySize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#d9ffea"),
      coordPlane: CoordPlane.Screen
    });

    const tileVersionLabel = new Label({
      text: "Tiles",
      pos: vec(GAME_WIDTH / 2 - panelWidth * 0.25, GAME_HEIGHT / 2 + panelHeight * 0.36),
      font: new Font({ family: "Inter", size: bodySize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#d9ffea"),
      coordPlane: CoordPlane.Screen
    });

    const minValue = new Label({
      text: gameSettings.cameraZoomMin.toFixed(2),
      pos: vec(GAME_WIDTH / 2 + panelWidth * 0.10, GAME_HEIGHT / 2 - panelHeight * 0.01),
      font: new Font({ family: "Space Grotesk", size: bodySize + 4, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#f7fbff"),
      coordPlane: CoordPlane.Screen
    });

    const maxValue = new Label({
      text: gameSettings.cameraZoomMax.toFixed(2),
      pos: vec(GAME_WIDTH / 2 + panelWidth * 0.10, GAME_HEIGHT / 2 + panelHeight * 0.12),
      font: new Font({ family: "Space Grotesk", size: bodySize + 4, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#f7fbff"),
      coordPlane: CoordPlane.Screen
    });

    const debugToggle = this.createButton(rowRightX, GAME_HEIGHT / 2 + panelHeight * 0.25, buttonWidth, buttonHeight, gameSettings.debugInfoEnabled ? "On" : "Off");
    debugToggle.button.color = gameSettings.debugInfoEnabled ? Color.fromHex("#7cf7a3") : Color.fromHex("#7b8492");
    debugToggle.label.color = gameSettings.debugInfoEnabled ? Color.fromHex("#08121c") : Color.fromHex("#edf4ff");

    const tileVersionValue = new Label({
      text: getTrailTileVersion().toUpperCase(),
      pos: vec(GAME_WIDTH / 2 + panelWidth * 0.10, GAME_HEIGHT / 2 + panelHeight * 0.36),
      font: new Font({ family: "Space Grotesk", size: bodySize + 4, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#f7fbff"),
      coordPlane: CoordPlane.Screen
    });

    const minDecrease = this.createButton(rowLeftX, GAME_HEIGHT / 2 - panelHeight * 0.01, buttonWidth, buttonHeight, "-");
    const minIncrease = this.createButton(rowRightX, GAME_HEIGHT / 2 - panelHeight * 0.01, buttonWidth, buttonHeight, "+");
    const maxDecrease = this.createButton(rowLeftX, GAME_HEIGHT / 2 + panelHeight * 0.12, buttonWidth, buttonHeight, "-");
    const maxIncrease = this.createButton(rowRightX, GAME_HEIGHT / 2 + panelHeight * 0.12, buttonWidth, buttonHeight, "+");
    const tileVersionToggle = this.createButton(rowRightX, GAME_HEIGHT / 2 + panelHeight * 0.36, buttonWidth, buttonHeight, getTrailTileVersion().toUpperCase());
    const backButton = this.createButton(GAME_WIDTH / 2, GAME_HEIGHT / 2 + panelHeight * 0.46, buttonWidth * 1.5, buttonHeight, "Back");

    this.controls = [
      {
        ...heroPrevious,
        onPress: () => {
          this.selectedHeroId = getNextHeroId(this.selectedHeroId, -1);
          setSelectedHeroPreference(this.selectedHeroId);
          heroValue.text = this.formatHeroSelection(this.selectedHeroId);
        }
      },
      {
        ...heroNext,
        onPress: () => {
          this.selectedHeroId = getNextHeroId(this.selectedHeroId, 1);
          setSelectedHeroPreference(this.selectedHeroId);
          heroValue.text = this.formatHeroSelection(this.selectedHeroId);
        }
      },
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
        ...debugToggle,
        onPress: () => {
          gameSettings.debugInfoEnabled = !gameSettings.debugInfoEnabled;
          debugToggle.label.text = gameSettings.debugInfoEnabled ? "On" : "Off";
          debugToggle.button.color = gameSettings.debugInfoEnabled ? Color.fromHex("#7cf7a3") : Color.fromHex("#7b8492");
          debugToggle.label.color = gameSettings.debugInfoEnabled ? Color.fromHex("#08121c") : Color.fromHex("#edf4ff");
        }
      },
      {
        ...tileVersionToggle,
        onPress: () => {
          const nextVersion: TrailTileVersion = getTrailTileVersion() === "v1" ? "v2" : "v1";

          setTrailTileVersionPreference(nextVersion);
          tileVersionValue.text = nextVersion.toUpperCase();
          tileVersionToggle.label.text = nextVersion.toUpperCase();
          window.location.reload();
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
    this.add(heroLabel);
    this.add(heroValue);
    this.add(minLabel);
    this.add(maxLabel);
    this.add(debugLabel);
    this.add(tileVersionLabel);
    this.add(minValue);
    this.add(maxValue);
    this.add(tileVersionValue);

    this.add(heroPrevious.button);
    this.add(heroPrevious.label);
    this.add(heroNext.button);
    this.add(heroNext.label);

    for (const control of this.controls) {
      this.add(control.button);
      this.add(control.label);
    }

    this.engine.input.pointers.primary.on("down", this.settingsPointerHandler);
    this.inputEnabled = true;
  }

  override onActivate(): void {
    (globalThis as typeof globalThis & { __activeSceneName?: string }).__activeSceneName = "settings";
    this.inputEnabled = true;
  }

  override onDeactivate(): void {
    this.inputEnabled = false;
  }

  private createButton(centerX: number, centerY: number, width: number, height: number, text: string): Pick<ButtonControl, "button" | "label"> {
    const template = createScreenButtonTemplate({
      centerX,
      centerY,
      width,
      height,
      text,
      buttonColor: "#1a2948",
      textColor: "#edf4ff",
      fontFamily: "Space Grotesk",
      fontSize: clamp(height * 0.42, 14, 18),
      z: 100,
      labelZ: 101,
      maxWidth: width,
      hitboxOrigin: "center"
    });

    return { button: template.button, label: template.label };
  }

  private formatHeroSelection(heroId: HeroId): string {
    const hero = heroRoster.find((entry) => entry.id === heroId) ?? heroRoster[0];
    return `${hero.name}\n${hero.abilities.join(" • ")}`;
  }
}
