import { defineConfig } from "tsdown";

const shared = {
  format: ["esm", "cjs"] as const,
  dts: true,
  minify: true,
  treeshake: true,
};

export default defineConfig([
  { entry: { "grip-nano": "src/nano.ts" }, ...shared, clean: true },
  { entry: { "grip-drag": "src/drag.ts" }, ...shared },
  { entry: { "grip-resize": "src/resize.ts" }, ...shared },
  { entry: { "grip-gesture": "src/gesture.ts" }, ...shared },
  { entry: { "grip-dropzone": "src/dropzone.ts" }, ...shared },
  { entry: { "grip-sortable": "src/sortable.ts" }, ...shared },
  { entry: { "grip-modifiers": "src/modifiers/index.ts" }, ...shared },
  { entry: { grip: "src/index.ts" }, ...shared },
  {
    entry: { "grip-react": "src/react.tsx" },
    ...shared,
    deps: { neverBundle: ["react"] },
  },
  {
    entry: { "grip-vue": "src/vue.ts" },
    ...shared,
    deps: { neverBundle: ["vue"] },
  },
]);
