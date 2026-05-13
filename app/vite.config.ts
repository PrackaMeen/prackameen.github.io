import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: "0.0.0.0",
    open: true
  },
  build: {
    outDir: "dist"
  }
});
