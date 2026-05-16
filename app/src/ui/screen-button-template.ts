import { Actor, Color, CoordPlane, Font, FontUnit, Label, TextAlign, type Vector, vec } from "excalibur";

export type ScreenButtonHitboxOrigin = "center" | "bottom";

export interface ScreenButtonTemplate {
  button: Actor;
  label: Label;
  width: number;
  height: number;
  hitboxOrigin: ScreenButtonHitboxOrigin;
}

export interface ScreenButtonTemplateOptions {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  text: string;
  buttonColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  z: number;
  labelZ: number;
  maxWidth?: number;
  labelYOffset?: number;
  hitboxOrigin?: ScreenButtonHitboxOrigin;
}

export function createScreenButtonTemplate(options: ScreenButtonTemplateOptions): ScreenButtonTemplate {
  const buttonLabelYOffset = options.labelYOffset ?? Math.max(Math.min(options.height * 0.09, 6), 4);

  const button = new Actor({
    pos: vec(options.centerX, options.centerY),
    width: options.width,
    height: options.height,
    color: Color.fromHex(options.buttonColor),
    coordPlane: CoordPlane.Screen,
    z: options.z,
  });

  const label = new Label({
    text: options.text,
    pos: vec(options.centerX, options.centerY - buttonLabelYOffset),
    font: new Font({ family: options.fontFamily, size: options.fontSize, unit: FontUnit.Px, bold: true, textAlign: TextAlign.Center }),
    color: Color.fromHex(options.textColor),
    coordPlane: CoordPlane.Screen,
    z: options.labelZ,
    maxWidth: options.maxWidth ?? options.width,
  });

  label.pointer.owner = button;

  return {
    button,
    label,
    width: options.width,
    height: options.height,
    hitboxOrigin: options.hitboxOrigin ?? "center"
  };
}

export function getCanvasPointerPosition(pointer: { pagePos: Vector }, canvas: HTMLCanvasElement): Vector {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return vec(
    (pointer.pagePos.x - rect.left) * scaleX,
    (pointer.pagePos.y - rect.top) * scaleY
  );
}

export function isPointInsideScreenButton(point: Vector, button: ScreenButtonTemplate): boolean {
  const halfWidth = button.width / 2;
  const left = button.button.pos.x - halfWidth;
  const right = button.button.pos.x + halfWidth;
  const top = button.hitboxOrigin === "bottom" 
    ? button.button.pos.y - button.height 
    : button.button.pos.y - button.height / 2;
  const bottom = button.hitboxOrigin === "bottom" 
    ? button.button.pos.y 
    : button.button.pos.y + button.height / 2;

  const result = point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;

  if (result) {
    console.log("[button-hit-test] inside", {
      text: button.label.text,
      point: { x: point.x, y: point.y },
      bounds: { left, right, top, bottom },
      hitboxOrigin: button.hitboxOrigin
    });
  }

  return result;
}

export function getScreenButtonBounds(button: ScreenButtonTemplate): { left: number; top: number; right: number; bottom: number } {
  const halfWidth = button.width / 2;
  return {
    left: button.button.pos.x - halfWidth,
    right: button.button.pos.x + halfWidth,
    top: button.hitboxOrigin === "bottom" ? button.button.pos.y - button.height : button.button.pos.y - button.height / 2,
    bottom: button.hitboxOrigin === "bottom" ? button.button.pos.y : button.button.pos.y + button.height / 2
  };
}