import { copyFileSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2020",
  sourcemap: false,
  external: ["react", "react-dom", "react/jsx-runtime"],
  // Required so the component works when imported from a Next.js Server Component.
  banner: { js: '"use client";' },
  // The optional theme ships as plain CSS, untouched by the bundler.
  onSuccess: async () => copyFileSync("src/styles.css", "dist/styles.css"),
});
