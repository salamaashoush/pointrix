import { defineConfig } from "tsdown";

const shared = {
  format: ["esm", "cjs"] as const,
  dts: true,
  minify: true,
  treeshake: true,
};

export default defineConfig([
  { entry: { "hyperact-nano": "src/nano.ts" }, ...shared, clean: true },
  { entry: { "hyperact-drag": "src/drag.ts" }, ...shared },
  { entry: { "hyperact-resize": "src/resize.ts" }, ...shared },
  { entry: { "hyperact-gesture": "src/gesture.ts" }, ...shared },
  { entry: { "hyperact-dropzone": "src/dropzone.ts" }, ...shared },
  { entry: { "hyperact-sortable": "src/sortable.ts" }, ...shared },
  { entry: { "hyperact-modifiers": "src/modifiers/index.ts" }, ...shared },
  { entry: { hyperact: "src/index.ts" }, ...shared },
  {
    entry: { "hyperact-react": "src/react.tsx" },
    ...shared,
    deps: { neverBundle: ["react"] },
  },
  {
    entry: { "hyperact-vue": "src/vue.ts" },
    ...shared,
    deps: { neverBundle: ["vue"] },
  },
]);
