import { Actor, Color, CoordPlane, Font, FontUnit, Label, PointerButton, Scene, TextAlign, type PointerEvent, vec } from "excalibur";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import type { GameController } from "../game-controller";
import { createScreenButtonTemplate, getCanvasPointerPosition, isPointInsideScreenButton } from "../ui/screen-button-template";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

interface InventorySlot {
  title: string;
  subtitle: string;
  accentColor: string;
}

interface InventoryControl {
  button: Actor;
  label: Label;
  onPress: () => void;
}

export class InventoryScene extends Scene {
  private readonly slots: InventorySlot[] = [
    { title: "Sword", subtitle: "Weapon", accentColor: "#7cf7a3" },
    { title: "Magic Scroll", subtitle: "Item", accentColor: "#f2c66d" },
    { title: "Dagger", subtitle: "Weapon", accentColor: "#7cf7a3" },
    { title: "Treasure Key", subtitle: "Item", accentColor: "#f2c66d" },
    { title: "Axe", subtitle: "Weapon", accentColor: "#7cf7a3" },
    { title: "Magic Scroll", subtitle: "Item", accentColor: "#f2c66d" }
  ];

  private controls: InventoryControl[] = [];
  private inputEnabled = false;
  private inventoryPointerHandler = (event: PointerEvent): void => {
    if (!this.inputEnabled || event.button !== PointerButton.Left) {
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
    const panelHeight = clamp(GAME_HEIGHT - 32, 420, 560);
    const titleSize = clamp(GAME_WIDTH * 0.056, 28, 54);
    const bodySize = clamp(GAME_WIDTH * 0.018, 15, 21);
    const slotTitleSize = clamp(GAME_WIDTH * 0.023, 16, 22);
    const slotSubtitleSize = clamp(GAME_WIDTH * 0.014, 12, 16);
    const buttonWidth = clamp(GAME_WIDTH * 0.18, 96, 132);
    const buttonHeight = clamp(GAME_HEIGHT * 0.062, 40, 56);
    const buttonTextSize = clamp(GAME_WIDTH * 0.02, 16, 22);
    const cardWidth = clamp((panelWidth - 56) / 2, 130, 220);
    const cardHeight = clamp((panelHeight - 190) / 3, 68, 108);
    const columnGap = clamp(GAME_WIDTH * 0.035, 18, 32);
    const rowGap = clamp(GAME_HEIGHT * 0.02, 12, 18);
    const leftColumnX = GAME_WIDTH / 2 - cardWidth / 2 - columnGap / 2;
    const rightColumnX = GAME_WIDTH / 2 + cardWidth / 2 + columnGap / 2;
    const firstRowY = GAME_HEIGHT / 2 - cardHeight - rowGap;
    const secondRowY = GAME_HEIGHT / 2;
    const thirdRowY = GAME_HEIGHT / 2 + cardHeight + rowGap;

    const panel = new Actor({
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2),
      width: panelWidth,
      height: panelHeight,
      color: Color.fromHex("#0f1b34"),
      coordPlane: CoordPlane.Screen,
      z: 1
    });

    const title = new Label({
      text: "Inventory",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2 - panelHeight * 0.39),
      font: new Font({ family: "Space Grotesk", size: titleSize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
      color: Color.fromHex("#f7fbff"),
      coordPlane: CoordPlane.Screen,
      z: 2
    });

    const subtitle = new Label({
      text: "Weapons are listed on the left. Items are listed on the right.",
      pos: vec(GAME_WIDTH / 2, GAME_HEIGHT / 2 - panelHeight * 0.29),
      font: new Font({ family: "Inter", size: bodySize, unit: FontUnit.Px, textAlign: TextAlign.Center }),
      color: Color.fromHex("#a6b6d8"),
      maxWidth: panelWidth - 56,
      coordPlane: CoordPlane.Screen,
      z: 2
    });

    const columnLabels = [
      new Label({
        text: "Weapons",
        pos: vec(leftColumnX, GAME_HEIGHT / 2 - panelHeight * 0.19),
        font: new Font({ family: "Inter", size: bodySize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
        color: Color.fromHex("#7cf7a3"),
        coordPlane: CoordPlane.Screen,
        z: 2
      }),
      new Label({
        text: "Items",
        pos: vec(rightColumnX, GAME_HEIGHT / 2 - panelHeight * 0.19),
        font: new Font({ family: "Inter", size: bodySize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
        color: Color.fromHex("#f2c66d"),
        coordPlane: CoordPlane.Screen,
        z: 2
      })
    ];

    const slotPositions = [
      { x: leftColumnX, y: firstRowY },
      { x: rightColumnX, y: firstRowY },
      { x: leftColumnX, y: secondRowY },
      { x: rightColumnX, y: secondRowY },
      { x: leftColumnX, y: thirdRowY },
      { x: rightColumnX, y: thirdRowY }
    ];

    this.controls = [];

    for (let index = 0; index < this.slots.length; index++) {
      const slot = this.slots[index];
      const position = slotPositions[index];
      const slotCard = new Actor({
        pos: vec(position.x, position.y),
        width: cardWidth,
        height: cardHeight,
        color: Color.fromHex(slot.accentColor === "#7cf7a3" ? "#13281f" : "#2b2416"),
        coordPlane: CoordPlane.Screen,
        z: 2
      });

      const slotBorder = new Actor({
        pos: vec(position.x, position.y),
        width: cardWidth,
        height: cardHeight,
        color: Color.fromHex("#203253"),
        coordPlane: CoordPlane.Screen,
        z: 3
      });

      const slotLabel = new Label({
        text: slot.title,
        pos: vec(position.x, position.y - cardHeight * 0.12),
        font: new Font({ family: "Space Grotesk", size: slotTitleSize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
        color: Color.fromHex(slot.accentColor),
        coordPlane: CoordPlane.Screen,
        z: 4,
        maxWidth: cardWidth - 18
      });

      const slotSubtitle = new Label({
        text: slot.subtitle,
        pos: vec(position.x, position.y + cardHeight * 0.12),
        font: new Font({ family: "Inter", size: slotSubtitleSize, unit: FontUnit.Px, textAlign: TextAlign.Center }),
        color: Color.fromHex("#d6e2ff"),
        coordPlane: CoordPlane.Screen,
        z: 4,
        maxWidth: cardWidth - 18
      });

      this.add(slotCard);
      this.add(slotBorder);
      this.add(slotLabel);
      this.add(slotSubtitle);
    }

    const backTemplate = createScreenButtonTemplate({
      centerX: GAME_WIDTH / 2,
      centerY: GAME_HEIGHT / 2 + panelHeight * 0.40,
      width: buttonWidth,
      height: buttonHeight,
      text: "Back",
      buttonColor: "#1a2948",
      textColor: "#edf4ff",
      fontFamily: "Space Grotesk",
      fontSize: buttonTextSize,
      z: 10,
      labelZ: 11,
      maxWidth: buttonWidth,
      labelYOffset: clamp(buttonHeight * 0.09, 4, 6)
    });

    const backControl: InventoryControl = {
      button: backTemplate.button,
      label: backTemplate.label,
      onPress: () => {
        this.controller.returnFromInventory();
      }
    };

    this.controls.push(backControl);

    this.add(panel);
    this.add(title);
    this.add(subtitle);

    for (const label of columnLabels) {
      this.add(label);
    }

    for (const control of this.controls) {
      this.add(control.button);
      this.add(control.label);
    }

    this.engine.input.pointers.primary.on("down", this.inventoryPointerHandler);
    this.inputEnabled = true;
  }

  override onActivate(): void {
    (globalThis as typeof globalThis & { __activeSceneName?: string }).__activeSceneName = "inventory";
    this.inputEnabled = true;
  }

  override onDeactivate(): void {
    this.inputEnabled = false;
  }
}
