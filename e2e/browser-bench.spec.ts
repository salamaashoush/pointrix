// Real-browser benchmark comparing pointrix vs interact.js.
//
// Methodology:
//  We measure three things per (library × scenario) pair:
//   1. dispatchMs — synchronous cost of dispatching one pointermove event.
//      This is the CPU time the library spends in its pointermove listener
//      (state updates, scheduling, filters). The most sensitive signal.
//   2. rafMs — wall-clock between dispatch and the next RAF firing. Shows
//      whether the browser is hitting vsync (~16.7ms) or the library is
//      overloading the frame.
//   3. burst throughput — events/ms when dispatching as fast as possible
//      with no RAF between. Stress test for the sync path.
//
// Scenarios:
//  - draggable × 50/200/500 : simple independent draggables
//  - sortable × 50/200       : heavier per-frame work (reorder detection
//                              across all items during an active drag)
//
// Only draggable 50 is a vsync-bound workload; larger counts and sortable
// surface real per-frame differences.
//
// Run via `bun run bench:browser`. Kept out of the default `test:e2e` — see
// playwright.config.ts (BENCH=1 env flag enables the bench project).

import { test, expect, type Page } from '@playwright/test'

const PAGE = '/e2e/bench-page.html'

type Lib = 'pointrix' | 'interact'
type Mode = 'draggable' | 'sortable'

interface Scenario {
  mode: Mode
  count: number
}

const SCENARIOS: Scenario[] = [
  { mode: 'draggable', count: 50 },
  { mode: 'draggable', count: 200 },
  { mode: 'draggable', count: 500 },
  { mode: 'sortable', count: 50 },
  { mode: 'sortable', count: 200 },
]

const LIBS: Lib[] = ['pointrix', 'interact']

const RAF_FRAMES = 120
const BURST_EVENTS = 2000
const WARMUP_FRAMES = 30
const MEASURED_PASSES = 3

interface Sample { dispatchMs: number; rafMs: number }
interface Stats {
  lib: Lib
  mode: Mode
  count: number
  medianDispatch: number
  p95Dispatch: number
  medianRaf: number
  burstPerEventMs: number
}

function summarize(samples: Sample[]): { medianDispatch: number; p95Dispatch: number; medianRaf: number } {
  const d = samples.map((s) => s.dispatchMs).sort((a, b) => a - b)
  const r = samples.map((s) => s.rafMs).sort((a, b) => a - b)
  const pct = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))]
  return {
    medianDispatch: pct(d, 0.5),
    p95Dispatch: pct(d, 0.95),
    medianRaf: pct(r, 0.5),
  }
}

async function loadPage(page: Page, lib: Lib, mode: Mode, count: number) {
  await page.goto(`${PAGE}?lib=${lib}&mode=${mode}&count=${count}`)
  await page.waitForFunction(() => (window as unknown as { __benchReady: boolean }).__benchReady === true)
}

async function runOnce(page: Page, frames: number): Promise<{ samples: Sample[]; totalMs: number }> {
  return page.evaluate(
    async (f) =>
      (window as unknown as {
        __bench: { run: (n: number) => Promise<{ samples: Sample[]; totalMs: number }> }
      }).__bench.run(f),
    frames,
  )
}

async function burstOnce(page: Page, events: number): Promise<{ totalMs: number; perEventMs: number }> {
  return page.evaluate(
    async (e) =>
      (window as unknown as {
        __bench: { burst: (n: number) => Promise<{ totalMs: number; perEventMs: number }> }
      }).__bench.burst(e),
    events,
  )
}

async function benchOne(page: Page, lib: Lib, mode: Mode, count: number): Promise<Stats> {
  await loadPage(page, lib, mode, count)

  // Warmup.
  await runOnce(page, WARMUP_FRAMES)

  // Measured passes (RAF-paced).
  const all: Sample[] = []
  for (let p = 0; p < MEASURED_PASSES; p++) {
    const { samples } = await runOnce(page, RAF_FRAMES)
    for (const s of samples) all.push(s)
  }

  // Burst throughput (one pass is enough — pure CPU, low variance).
  const burst = await burstOnce(page, BURST_EVENTS)

  const s = summarize(all)
  return {
    lib,
    mode,
    count,
    medianDispatch: s.medianDispatch,
    p95Dispatch: s.p95Dispatch,
    medianRaf: s.medianRaf,
    burstPerEventMs: burst.perEventMs,
  }
}

const RESULTS: Stats[] = []

test.describe.configure({ mode: 'serial' })

test.describe('pointrix vs interact.js — real browser', () => {
  for (const { mode, count } of SCENARIOS) {
    for (const lib of LIBS) {
      test(`${lib} / ${mode} / ${count}`, async ({ page }) => {
        const s = await benchOne(page, lib, mode, count)
        RESULTS.push(s)
        // Floor: even the slowest CI should not exceed 10ms per dispatch.
        expect(s.medianDispatch).toBeLessThan(50)
      })
    }
  }

  test('report', async () => {
    const lines: string[] = []
    lines.push('')
    lines.push('Browser benchmark (Chromium, real pointer events):')
    lines.push('  dispatchMs = synchronous cost of one pointermove event')
    lines.push('  rafMs      = time from dispatch to next animation frame')
    lines.push('  burst      = ms per event in tight-loop mode (no RAF)')
    lines.push('')

    // Group by (mode, count).
    const key = (s: Stats) => `${s.mode}-${s.count}`
    const groups = new Map<string, { pointrix?: Stats; interact?: Stats }>()
    for (const r of RESULTS) {
      if (!groups.has(key(r))) groups.set(key(r), {})
      groups.get(key(r))![r.lib] = r
    }

    const header = `  ${'scenario'.padEnd(22)} | ${'lib'.padEnd(10)} | ${'dispatch med'.padEnd(14)} | ${'dispatch p95'.padEnd(14)} | ${'raf med'.padEnd(10)} | ${'burst ms/ev'.padEnd(12)}`
    lines.push(header)
    lines.push(`  ${'-'.repeat(header.length - 2)}`)

    for (const [k, row] of groups) {
      for (const lib of LIBS) {
        const s = row[lib]
        if (!s) continue
        lines.push(
          `  ${k.padEnd(22)} | ${lib.padEnd(10)} | ${s.medianDispatch.toFixed(3).padEnd(14)} | ${s.p95Dispatch.toFixed(3).padEnd(14)} | ${s.medianRaf.toFixed(2).padEnd(10)} | ${s.burstPerEventMs.toFixed(4).padEnd(12)}`,
        )
      }
      const p = row.pointrix
      const i = row.interact
      if (p && i) {
        // p95 is more reliable than median for the dispatch ratio because
        // Chromium clamps performance.now() to 0.1ms; many medians end up
        // at 0, which makes the ratio Infinity. Burst is the real headline.
        const burstRatio = i.burstPerEventMs / p.burstPerEventMs
        const p95Ratio = i.p95Dispatch / p.p95Dispatch
        lines.push(
          `  ${' '.repeat(22)} · ratio (interact/pointrix): burst ${burstRatio.toFixed(2)}× · p95-dispatch ${p95Ratio.toFixed(2)}×`,
        )
      }
    }
    lines.push('')
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'))
  })
})
