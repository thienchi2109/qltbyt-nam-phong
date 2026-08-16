#!/usr/bin/env node

const { buildSync } = require("esbuild")
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs")
const { tmpdir } = require("node:os")
const path = require("node:path")

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "db-quality-gate-"))
const bundledCommandPath = path.join(temporaryDirectory, "cli.cjs")

try {
  buildSync({
    bundle: true,
    entryPoints: [path.join(__dirname, "cli.ts")],
    format: "cjs",
    outfile: bundledCommandPath,
    platform: "node",
    target: "node20",
  })

  const { runDatabaseQualityGateCommand } = require(bundledCommandPath)
  const result = runDatabaseQualityGateCommand(process.argv.slice(2))

  process.stdout.write(result.stdout)
  process.exitCode = result.exitCode
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true })
}
