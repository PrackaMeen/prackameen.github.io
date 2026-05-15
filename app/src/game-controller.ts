import type { Engine } from "excalibur";

export class GameController {
  private hasPlayableDemoSession = false;
  private demoResetter: (() => void) | null = null;

  constructor(private readonly engine: Engine) {}

  registerDemoResetter(resetter: () => void): void {
    this.demoResetter = resetter;
  }

  showMenu(): void {
    this.engine.goToScene("menu");
  }

  showSettings(): void {
    this.engine.goToScene("settings");
  }

  startNewGame(): void {
    this.demoResetter?.();
    this.hasPlayableDemoSession = true;
    this.engine.goToScene("demo");
  }

  startDemo(): void {
    this.startNewGame();
  }

  continueDemo(): void {
    if (!this.hasPlayableDemoSession) {
      return;
    }

    this.engine.goToScene("demo");
  }

  get canContinueDemo(): boolean {
    return this.hasPlayableDemoSession;
  }

  setCanContinueDemo(canContinue: boolean): void {
    this.hasPlayableDemoSession = canContinue;
  }
}
