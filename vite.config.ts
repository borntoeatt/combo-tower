import { defineConfig } from "vite";

export default defineConfig({
  // relative base so the bundle works at https://<user>.github.io/<repo>/
  base: "./",
  build: {
    // dist/ is gitignored — GitHub Pages deploys from the CI workflow
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
