#!/usr/bin/env node

const { execFileSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const { collectChangedFiles, getCommittedChangedFiles, runGit } = require("./changed-files")

const DEFAULT_BASE_REF = process.env.PRETTIER_BASE || "main"
const PRETTIER_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".scss",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
  ".txt",
])

function isPrettierSupportedFile(filePath) {
  return PRETTIER_EXTENSIONS.has(path.extname(filePath))
}

function collectChangedPrettierFiles(
  baseRef = DEFAULT_BASE_REF,
  { runGitImpl = runGit, fileExists = fs.existsSync } = {}
) {
  return collectChangedFiles(baseRef, {
    runGitImpl,
    includeFile: isPrettierSupportedFile,
    fileExists,
  })
}

function runPrettierCheck(filePaths) {
  const prettierBin = require.resolve("prettier/bin/prettier.cjs")

  execFileSync(process.execPath, [prettierBin, "--check", "--ignore-unknown", ...filePaths], {
    cwd: process.cwd(),
    stdio: "inherit",
  })
}

function main() {
  let filePaths

  try {
    filePaths = collectChangedPrettierFiles(process.argv[2] || DEFAULT_BASE_REF)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Unable to determine changed files for Prettier: ${message}`)
    process.exitCode = 1
    return
  }

  if (filePaths.length === 0) {
    console.log("No changed Prettier-supported files to check.")
    return
  }

  try {
    runPrettierCheck(filePaths)
  } catch {
    process.exitCode = 1
  }
}

module.exports = {
  collectChangedPrettierFiles,
  getCommittedChangedFiles,
  isPrettierSupportedFile,
  runGit,
  runPrettierCheck,
}

if (require.main === module) {
  main()
}
