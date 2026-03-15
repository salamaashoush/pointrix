import { defineConfig } from "tsdown";

const shared = {
  format: ["esm", "cjs"] as const,
  dts: true,
  minify: true,
  treeshake: true,
};

export default defineConfig([
  { entry: { "pointrix-nano": "src/nano.ts" }, ...shared, clean: true },
  { entry: { "pointrix-drag": "src/drag.ts" }, ...shared },
  { entry: { "pointrix-resize": "src/resize.ts" }, ...shared },
  { entry: { "pointrix-gesture": "src/gesture.ts" }, ...shared },
  { entry: { "pointrix-dropzone": "src/dropzone.ts" }, ...shared },
  { entry: { "pointrix-sortable": "src/sortable.ts" }, ...shared },
  { entry: { "pointrix-modifiers": "src/modifiers/index.ts" }, ...shared },
  { entry: {pointrix: "src/index.ts" }, ...shared },
  {
    entry: { "pointrix-react": "src/react.tsx" },
    ...shared,
    deps: { neverBundle: ["react"] },
  },
  {
    entry: { "pointrix-vue": "src/vue.ts" },
    ...shared,
    deps: { neverBundle: ["vue"] },
  },
]);
