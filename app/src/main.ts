import { Color, DisplayMode, Engine, PointerScope } from "excalibur";
import { GAME_HEIGHT, GAME_TITLE, GAME_WIDTH } from "./config";
import { GameController } from "./game-controller";
import { DemoScene } from "./scenes/demo-scene";
import { MenuScene } from "./scenes/menu-scene";
import "./styles.css";

const engine = new Engine({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  canvasElementId: "game",
  backgroundColor: Color.fromHex("#081120"),
  antialiasing: false,
  pixelArt: true,
  suppressHiDPIScaling: true,
  displayMode: DisplayMode.FitScreen,
  pointerScope: PointerScope.Canvas,
  grabWindowFocus: false
});

const controller = new GameController(engine);

engine.addScene("menu", new MenuScene(controller));
engine.addScene("demo", new DemoScene(controller));
engine.goToScene("menu");

void engine.start();
