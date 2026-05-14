import type { Engine } from "excalibur";

export class GameController {
  constructor(private readonly engine: Engine) {}

  showMenu(): void {
    this.engine.goToScene("menu");
  }

  showSettings(): void {
    this.engine.goToScene("settings");
  }

  startDemo(): void {
    this.engine.goToScene("demo");
  }
}
