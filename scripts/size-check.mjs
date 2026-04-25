#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'

const limits = {
  'dist/pointrix.mjs': 16 * 1024,
  'dist/pointrix-nano.mjs': 4 * 1024,
  'dist/pointrix-react.mjs': 13 * 1024,
  'dist/pointrix-vue.mjs': 13 * 1024,
}

let failed = false
for (const [file, limit] of Object.entries(limits)) {
  const path = resolve(file)
  try {
    statSync(path)
  } catch {
    console.error(`MISSING ${file} (run \`bun run build\` first)`)
    failed = true
    continue
  }
  const gz = gzipSync(readFileSync(path)).length
  const status = gz <= limit ? 'OK' : 'FAIL'
  const pct = ((gz / limit) * 100).toFixed(1)
  console.log(`${status.padEnd(4)} ${file.padEnd(28)} ${gz.toString().padStart(6)} B gzip / ${limit} B limit (${pct}%)`)
  if (gz > limit) failed = true
}

process.exit(failed ? 1 : 0)
