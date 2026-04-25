# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repo.

## Project

**pointrix** (npm package name) — ultra-fast drag/resize/gesture/dropzone/sortable library. Framework-agnostic core with optional React and Vue 3 integrations. Zero runtime dependencies. Competes with interact.js on both bundle size and per-event perf (13-15× faster synchronous event dispatch per our Chromium bench).

Note: the working directory is `/home/sashoush/Workspace/hyperact` — "hyperact" was the first name, "grip" was the second, "pointrix" is current (see README). The directory name hasn't been changed.

## Package manager: bun

All scripts are bun-friendly. The lockfile is `bun.lock`. Typical commands:

```bash
bun run build          # tsdown → dist/*.mjs / *.cjs / *.d.mts
bun run dev            # tsdown --watch
bun run test           # vitest run (all unit + integration tests)
bun run test:watch     # vitest (watch)
bun run test:coverage  # vitest run --coverage
bun run test:e2e       # playwright test (functional e2e only, skips benches)
bun run typecheck      # tsc --noEmit
bun run lint           # oxlint src/
bun run format         # oxlint src/ --fix
bun run demo           # vite (serves *.html at project root)
bun run bench          # vitest bench (headless, jsdom — comparison + micro)
bun run bench:browser  # BENCH=1 playwright test (real Chromium)
bun run size           # build + print gzipped main-bundle size
```

Run a single test file: `bun run test src/__tests__/drag.test.ts`.

## Source layout

Flat `src/` — no nested `core/plugins/integrations`. One concept per file:

- `src/nano.ts` — `Pointrix` base class. Owns pointer tracking, velocity smoothing, the shared RAF scheduler, ARIA plumbing hooks, and the `rectChecker` / `origin` helpers. All subclasses extend this.
- `src/drag.ts` — `Draggable` (extends Pointrix). Bounds, grid, axis lock, momentum, modifier pipeline, dropzone bridge.
- `src/resize.ts` — `Resizable`. Edge detection, aspect ratio, invert modes, modifier pipeline.
- `src/gesture.ts` — `Gesturable`. Multi-touch pinch/rotate/pan with mutation-based scalars (no per-frame allocation).
- `src/dropzone.ts` — `Dropzone` + `DropzoneManager` singleton. Rect caching with scroll/resize invalidation.
- `src/sortable.ts` — `Sortable`. Uses Draggables internally per item. Diff-based setup (no O(n·m) churn on drop).
- `src/types.ts` — Shared types (`Point`, `Rect`, `ActiveEdges`, `Modifier`, `ModifierContext`) + `applyModifiers` + `prefersReducedMotion` helper.
- `src/modifiers/*.ts` — Built-in modifiers. Every modifier mutates `ctx` in place (see Architecture).
- `src/react.tsx` — React hooks. Returns `RefCallback<HTMLElement>`; optional instance ref as 2nd arg.
- `src/vue.ts` — Vue 3 composables + directives + plugin.
- `src/aria.ts` — ARIA attribute setters, live region, i18n messages.
- `src/utils/spatial-index.ts` — QuadTree + SpatialHashGrid (used for some modifiers, e.g., magneticSnap).
- `src/index.ts` — Full bundle barrel export.
- `src/nano.ts`, `src/drag.ts`, etc. — Each is also its own sub-path export (`pointrix/drag`, `pointrix/nano`, ...).

## Architecture

- **Shared RAF scheduler.** `nano.ts` owns one `dirtyInstances` Set and one `requestAnimationFrame`. Subclasses opt in by calling `dirtyInstances.add(this)` from `onPointerMove`. `update()` runs once per instance per frame.
- **Mutation-based modifier contract.** `Modifier.modify(ctx): void` mutates `ctx.position`, `ctx.velocity`, `ctx.size` in place. There is no `ModifierResult` — `applyModifiers` returns the same ctx reference. This removed ~2 allocations per modifier per frame.
- **In-place state.** Hot-path code avoids object literals: `{ x, y }` becomes direct `transform.x = x; transform.y = y`. `InteractionEvent`, `DragEvent`, `ResizeEvent`, `GestureEvent` are each cached per instance and mutated.
- **Rect caching.** Dropzones cache their rect at drag-start and refresh on scroll/resize (shared listener across all active dragzone drags). Sortable caches sibling container rects the same way. Sortable drag-center uses `origRect + pointerDelta` instead of a live layout read.
- **No self-animating loop.** Nano only schedules frames in response to pointer events. Momentum and inertia run their own RAF loops.
- **Option-callback-only event API.** There is no `.on/.off/.emit`. All subscriptions are via option callbacks (`onDragMove`, `onSortEnd`, etc.). The React hooks route callbacks through a ref so inline handlers are safe.
- **Passive listener flag is conditional.** When `preventScroll: false`, pointermove is registered as `{ passive: true }` so the browser can skip main-thread scroll blocking.

## Code style

- No semicolons, single quotes, 120-char line width.
- TypeScript strict mode. Target ES2020.
- Tree-shakeable ESM with per-feature sub-path exports in `package.json`.
- oxlint (not ESLint/Prettier) for lint. Run `bun run lint`.
- Tests use Vitest (jsdom env). React tests use `@testing-library/react` + real `createRoot`.
- Playwright is set up with a `BENCH=1` project switch to split benchmarks from functional e2e.

## Tests

- Unit + integration: `src/__tests__/*.test.ts(x)`.
- Vitest benches: `*.bench.ts(x)` — comparison vs interact.js, plus modifier/spatial-index microbenches.
- Custom geometry coverage: `src/__tests__/custom-geometry.test.ts` — drives a full drag/drop/sortable cycle without any real `getBoundingClientRect`.
- Functional e2e: `e2e/*.spec.ts` (excluding `browser-bench.spec.ts`). Runs across chromium/firefox/webkit.
- Browser benches: `e2e/browser-bench.spec.ts` + `e2e/bench-page.(html|ts)`. Only runs with `BENCH=1`.

## When changing the hot path

- Run `bun run bench` for jsdom comparisons.
- Run `bun run bench:browser` for real-browser dispatch cost.
- Both report ratios vs interact.js; those ratios are the defensible number.
- Don't optimize based on jsdom wall-clock — `performance.now()` is clamped and RAF is mocked; only ratios survive the noise.

## Public API invariants (don't break without a reason)

- `draggable(el)` / `new Draggable(el)` both work. So for resize / gesture / dropzone / sortable.
- Every instance has `.destroy()`, `.cancel()`, `.enabled`, `.interacting`, `.updateOptions(partial)`.
- React hooks return `RefCallback<HTMLElement>`. Second arg is optional `RefObject<Instance>` for imperative access.
- Modifier authors write `modify(ctx): void` — mutate ctx, don't return anything.
- `rectChecker` and `origin` on PointrixOptions are honored by all internal rect / pointer math.
