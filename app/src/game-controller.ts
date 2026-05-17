import type { Engine } from "excalibur";

export class GameController {
  private readonly demoStateStorageKey = "game-demo-state-v1";
  private hasPlayableDemoSession = false;
  private demoResetter: (() => void) | null = null;
  private demoStateSerializer: (() => string | null) | null = null;
  private pendingDemoState: string | null = null;
  private inventoryReturnScene: string = "demo";

  constructor(private readonly engine: Engine) {}

  registerDemoResetter(resetter: () => void): void {
    this.demoResetter = resetter;
  }

  registerDemoStateSerializer(serializer: () => string | null): void {
    this.demoStateSerializer = serializer;
  }

  prepareDemoStateForLoad(): void {
    this.pendingDemoState = this.readStoredDemoState();
    this.hasPlayableDemoSession = this.pendingDemoState !== null;
  }

  consumePendingDemoState(): string | null {
    const demoState = this.pendingDemoState;
    this.pendingDemoState = null;
    return demoState;
  }

  saveDemoState(): void {
    const serializedState = this.demoStateSerializer?.() ?? null;

    if (!serializedState) {
      return;
    }

    this.writeStoredDemoState(serializedState);
    this.hasPlayableDemoSession = true;
  }

  clearDemoState(): void {
    this.pendingDemoState = null;
    this.hasPlayableDemoSession = false;
    this.writeStoredDemoState(null);
  }

  showMenu(): void {
    this.engine.goToScene("menu");
  }

  showSettings(): void {
    this.engine.goToScene("settings");
  }

  showInventory(returnScene: string = "demo"): void {
    this.inventoryReturnScene = returnScene;
    this.engine.goToScene("inventory");
  }

  returnFromInventory(): void {
    this.engine.goToScene(this.inventoryReturnScene);
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
    if (!this.canContinueDemo) {
      return;
    }

    this.prepareDemoStateForLoad();
    this.engine.goToScene("demo");
  }

  get canContinueDemo(): boolean {
    return this.hasPlayableDemoSession || this.readStoredDemoState() !== null;
  }

  setCanContinueDemo(canContinue: boolean): void {
    this.hasPlayableDemoSession = canContinue;
  }

  private readStoredDemoState(): string | null {
    try {
      return globalThis.localStorage?.getItem(this.demoStateStorageKey) ?? null;
    } catch {
      return null;
    }
  }

  private writeStoredDemoState(serializedState: string | null): void {
    try {
      if (serializedState === null) {
        globalThis.localStorage?.removeItem(this.demoStateStorageKey);
      } else {
        globalThis.localStorage?.setItem(this.demoStateStorageKey, serializedState);
      }
    } catch {
      return;
    }
  }
}
