import { defineConfig } from "vite";

export default defineConfig({
  // relative base so the bundle works at https://<user>.github.io/<repo>/
  base: "./",
  build: {
    // build straight into docs/ so GitHub Pages can serve it from the
    // main branch ("deploy from branch" -> /docs) with no CI required
    outDir: "docs",
    emptyOutDir: true,
    sourcemap: true,
  },
});
