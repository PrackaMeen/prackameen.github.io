import { Actor, Color, type Vector, vec } from "excalibur";
import { GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from "../config";

function snapToGrid(value: number, tileSize: number): number {
  return Math.round((value - tileSize / 2) / tileSize) * tileSize + tileSize / 2;
}

export class BoxActor extends Actor {
  private readonly speed = 320;
  private targetPosition: Vector | null = null;
  private selected = false;

  setTargetPosition(target: Vector): void {
    this.targetPosition = vec(target.x, target.y);
  }

  clearTargetPosition(): void {
    this.targetPosition = null;
  }

  select(): void {
    this.selected = true;
    this.color = Color.fromHex("#ff5b5b");
  }

  deselect(): void {
    this.selected = false;
    this.color = Color.fromHex("#6bf0ff");
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
        this.pos = vec(
          snapToGrid(this.targetPosition.x, TILE_SIZE),
          snapToGrid(this.targetPosition.y, TILE_SIZE)
        );
        this.targetPosition = null;
      } else {
        const step = this.speed * (delta / 1000);

        if (distance <= step) {
          this.pos = vec(
            snapToGrid(this.targetPosition.x, TILE_SIZE),
            snapToGrid(this.targetPosition.y, TILE_SIZE)
          );
          this.targetPosition = null;
        } else {
          const directionX = offsetX / distance;
          const directionY = offsetY / distance;
          this.pos = this.pos.add(vec(directionX * step, directionY * step));
        }
      }
    }

    this.pos = vec(
      Math.max(32, Math.min(GAME_WIDTH - 32, this.pos.x)),
      Math.max(32, Math.min(GAME_HEIGHT - 32, this.pos.y))
    );
  }
}