import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  minify: false,
  noExternal: ["@copilot-portal/core", "@hono/node-server"],
});
