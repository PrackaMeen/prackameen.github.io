import { Actor, Color, type Graphic, type Vector, vec } from "excalibur";
import { TILE_SIZE } from "../config";

type CharacterFacingOrientation = 0 | 1 | 2 | 3;

function snapToGrid(value: number, tileSize: number): number {
  return Math.round((value - tileSize / 2) / tileSize) * tileSize + tileSize / 2;
}

export class BoxActor extends Actor {
  private readonly speed = 320;
  private targetPosition: Vector | null = null;
  private targetSnapToGrid = true;
  private selected = false;
  private facingOrientation: CharacterFacingOrientation = 0;
  private normalGraphics: Graphic[] = [];
  private selectedGraphics: Graphic[] = [];

  setTargetPosition(target: Vector, snapToGrid = true): void {
    this.targetPosition = vec(target.x, target.y);
    this.targetSnapToGrid = snapToGrid;
  }

  clearTargetPosition(): void {
    this.targetPosition = null;
  }

  setStateGraphics(normalGraphics: Graphic[], selectedGraphics: Graphic[]): void {
    this.normalGraphics = normalGraphics;
    this.selectedGraphics = selectedGraphics;
    this.updateDisplayedGraphic();
  }

  setFacingOrientation(orientation: CharacterFacingOrientation): void {
    this.facingOrientation = orientation;
    this.updateDisplayedGraphic();
  }

  select(): void {
    this.selected = true;
    this.updateDisplayedGraphic();
  }

  deselect(): void {
    this.selected = false;
    this.updateDisplayedGraphic();
  }

  get isSelected(): boolean {
    return this.selected;
  }

  get isMoving(): boolean {
    return this.targetPosition !== null;
  }

  override onPreUpdate(engine: import("excalibur").Engine, delta: number): void {
    if (this.targetPosition) {
      const offsetX = this.targetPosition.x - this.pos.x;
      const offsetY = this.targetPosition.y - this.pos.y;
      const distance = Math.hypot(offsetX, offsetY);

      if (distance <= 1) {
        this.pos = this.targetSnapToGrid
          ? vec(
            snapToGrid(this.targetPosition.x, TILE_SIZE),
            snapToGrid(this.targetPosition.y, TILE_SIZE)
          )
          : vec(this.targetPosition.x, this.targetPosition.y);
        this.targetPosition = null;
      } else {
        const step = this.speed * (delta / 1000);

        if (distance <= step) {
          this.pos = this.targetSnapToGrid
            ? vec(
              snapToGrid(this.targetPosition.x, TILE_SIZE),
              snapToGrid(this.targetPosition.y, TILE_SIZE)
            )
            : vec(this.targetPosition.x, this.targetPosition.y);
          this.targetPosition = null;
        } else {
          const directionX = offsetX / distance;
          const directionY = offsetY / distance;
          const facingOrientation: CharacterFacingOrientation = Math.abs(directionX) >= Math.abs(directionY)
            ? (directionX >= 0 ? 1 : 3)
            : (directionY >= 0 ? 2 : 0);

          this.setFacingOrientation(facingOrientation);
          this.pos = this.pos.add(vec(directionX * step, directionY * step));
        }
      }
    }

  }

  private updateDisplayedGraphic(): void {
    const graphics = this.selected ? this.selectedGraphics : this.normalGraphics;
    const graphic = graphics[this.facingOrientation] ?? graphics[0];

    if (graphic) {
      this.graphics.use(graphic);
      return;
    }

    this.color = this.selected ? Color.fromHex("#ff5b5b") : Color.fromHex("#6bf0ff");
  }
}