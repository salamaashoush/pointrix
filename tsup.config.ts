import { defineConfig } from 'tsup'

export default defineConfig([
  // Nano build - Core only (~3KB)
  {
    entry: { 'hyperact-nano': 'src/nano.ts' },
    format: ['esm', 'cjs', 'iife'],
    dts: true,
    clean: true,
    minify: true,
    globalName: 'hyperact',
    external: [],
    treeshake: true,
    splitting: false
  },
  // Drag build - Core + Drag (~5KB)
  {
    entry: { 'hyperact-drag': 'src/drag.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    minify: true,
    external: [],
    treeshake: true,
    splitting: false
  },
  // Resize build - Core + Resize (~6KB)
  {
    entry: { 'hyperact-resize': 'src/resize.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    minify: true,
    external: [],
    treeshake: true,
    splitting: false
  },
  // Full build - Everything (~8KB)
  {
    entry: { 'hyperact': 'src/index.ts' },
    format: ['esm', 'cjs', 'iife'],
    dts: true,
    minify: true,
    globalName: 'hyperact',
    external: [],
    treeshake: true,
    splitting: false
  },
  // React wrapper (~1KB)
  {
    entry: { 'hyperact-react': 'src/react.tsx' },
    format: ['esm', 'cjs'],
    dts: true,
    minify: true,
    external: ['react'],
    treeshake: true,
    splitting: false
  }
])