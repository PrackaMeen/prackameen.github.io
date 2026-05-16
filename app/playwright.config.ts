import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  fullyParallel: false,
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true
  },
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: "msedge",
    launchOptions: {
      headless: !process.env.CI,
      args: ["--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader"]
    },
    viewport: { width: 400, height: 300 }
  }
});