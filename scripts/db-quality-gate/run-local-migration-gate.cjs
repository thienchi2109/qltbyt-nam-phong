#!/usr/bin/env node

const { mkdtempSync, rmSync } = require("node:fs")
const { tmpdir } = require("node:os")
const path = require("node:path")

let temporaryDirectory

try {
  const { buildSync } = require("esbuild")
  temporaryDirectory = mkdtempSync(path.join(tmpdir(), "db-quality-gate-local-"))
  const bundledCommandPath = path.join(temporaryDirectory, "local-migration-gate.cjs")

  buildSync({
    bundle: true,
    entryPoints: [path.join(__dirname, "local-migration-gate.ts")],
    format: "cjs",
    outfile: bundledCommandPath,
    platform: "node",
    target: "node20",
  })

  const { runLocalMigrationGate } = require(bundledCommandPath)
  const result = runLocalMigrationGate()

  process.stdout.write(result.stdout)
  process.exitCode = result.exitCode
} catch (error) {
  const message = error instanceof Error ? error.message.split(/\r?\n/, 1)[0] : String(error)
  process.stdout.write(`[db-quality-gate] INCOMPLETE local gate bootstrap failed: ${message}\n`)
  process.exitCode = 2
} finally {
  if (temporaryDirectory) {
    rmSync(temporaryDirectory, { force: true, recursive: true })
  }
}
