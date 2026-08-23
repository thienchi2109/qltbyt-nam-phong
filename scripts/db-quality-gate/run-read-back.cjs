#!/usr/bin/env node

const { mkdtempSync, rmSync } = require("node:fs")
const { tmpdir } = require("node:os")
const path = require("node:path")

const esbuild = require("esbuild")

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "db-quality-gate-read-back-"))
const bundledCommandPath = path.join(temporaryDirectory, "command.cjs")

try {
  esbuild.buildSync({
    bundle: true,
    entryPoints: [path.join(__dirname, "read-back-cli.ts")],
    format: "cjs",
    logLevel: "silent",
    outfile: bundledCommandPath,
    platform: "node",
    target: "node20",
  })

  const { runReadBackCommand } = require(bundledCommandPath)
  const result = runReadBackCommand(process.argv.slice(2))

  process.stdout.write(result.stdout)
  process.exitCode = result.exitCode
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true })
}
