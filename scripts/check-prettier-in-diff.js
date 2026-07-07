#!/usr/bin/env node

const { execFileSync } = require("node:child_process")
const fs = require("node:fs")
const path = require("node:path")
const { collectChangedFiles, getCommittedChangedFiles, runGit } = require("./changed-files")

const DEFAULT_BASE_REF = process.env.PRETTIER_BASE || "main"
const PRETTIER_CHECK_CHUNK_SIZE = 100
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

function runPrettierCheck(
  filePaths,
  {
    chunkSize = PRETTIER_CHECK_CHUNK_SIZE,
    execFileSyncImpl = execFileSync,
    prettierBin = require.resolve("prettier/bin/prettier.cjs"),
  } = {}
) {
  for (let index = 0; index < filePaths.length; index += chunkSize) {
    const chunk = filePaths.slice(index, index + chunkSize)

    execFileSyncImpl(process.execPath, [prettierBin, "--check", "--ignore-unknown", ...chunk], {
      cwd: process.cwd(),
      stdio: "inherit",
    })
  }
}

function main(
  baseRef = process.argv[2] || DEFAULT_BASE_REF,
  {
    collectChangedPrettierFilesImpl = collectChangedPrettierFiles,
    runPrettierCheckImpl = runPrettierCheck,
    consoleError = console.error,
    consoleLog = console.log,
  } = {}
) {
  let filePaths

  try {
    filePaths = collectChangedPrettierFilesImpl(baseRef)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    consoleError(`Unable to determine changed files for Prettier: ${message}`)
    return 1
  }

  if (filePaths.length === 0) {
    consoleLog("No changed Prettier-supported files to check.")
    return 0
  }

  try {
    runPrettierCheckImpl(filePaths)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    consoleError(`Prettier check failed: ${message}`)
    return 1
  }

  return 0
}

module.exports = {
  collectChangedPrettierFiles,
  getCommittedChangedFiles,
  isPrettierSupportedFile,
  main,
  PRETTIER_CHECK_CHUNK_SIZE,
  runGit,
  runPrettierCheck,
}

if (require.main === module) {
  process.exitCode = main()
}
