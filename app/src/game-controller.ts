import type { Engine } from "excalibur";

export class GameController {
  constructor(private readonly engine: Engine) {}

  showMenu(): void {
    this.engine.goToScene("menu");
  }

  startDemo(): void {
    this.engine.goToScene("demo");
  }
}
