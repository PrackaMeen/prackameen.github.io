import { Color, Engine, PointerScope } from "excalibur";
import { GAME_HEIGHT, GAME_TITLE, GAME_WIDTH } from "./config";
import { createGameSprites, loadGameAssets } from "./game-assets";
import { GameController } from "./game-controller";
import { DemoScene } from "./scenes/game-scene";
import { MenuScene } from "./scenes/menu-scene";
import { SettingsScene } from "./scenes/settings-scene";
import "./styles.css";

void (async () => {
  await loadGameAssets();

  const engine = new Engine({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    canvasElementId: "game",
    backgroundColor: Color.fromHex("#081120"),
    antialiasing: false,
    pixelArt: true,
    suppressHiDPIScaling: true,
    pointerScope: PointerScope.Canvas,
    grabWindowFocus: false
  });

  const sprites = createGameSprites();
  const controller = new GameController(engine);
  const demoScene = new DemoScene(controller, sprites);

  engine.addScene("menu", new MenuScene(controller));
  engine.addScene("settings", new SettingsScene(controller));
  engine.addScene("demo", demoScene);
  controller.registerDemoResetter(() => demoScene.requestGameReset());
  engine.goToScene("menu");

  void engine.start();
})();
