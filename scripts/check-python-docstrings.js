#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const { collectChangedFiles, runGit } = require("./changed-files")

const DEFAULT_BASE_REF = process.env.PYTHON_DOCSTRINGS_BASE || "main"
const SERVICE_DIR = "services/device-quota-suggestion-service"
const SERVICE_VENV_PYTHON = path.join(SERVICE_DIR, ".venv", "bin", "python")
const PYTHON_SOURCE_DIRS = [
  path.join(SERVICE_DIR, "app"),
  path.join(SERVICE_DIR, "scripts"),
]

function isServicePythonSource(filePath) {
  return (
    filePath.endsWith(".py") &&
    PYTHON_SOURCE_DIRS.some(
      (sourceDir) => filePath === sourceDir || filePath.startsWith(`${sourceDir}/`)
    )
  )
}

function isPythonDocstringConfig(filePath) {
  return filePath === path.join(SERVICE_DIR, "pyproject.toml")
}

function shouldRunForChangedFiles(baseRef = DEFAULT_BASE_REF, { runGitImpl = runGit } = {}) {
  const changedFiles = collectChangedFiles(baseRef, {
    runGitImpl,
    includeFile: (filePath) => isServicePythonSource(filePath) || isPythonDocstringConfig(filePath),
    fileExists: fs.existsSync,
  })

  return changedFiles.length > 0
}

function hasRuff(pythonExecutable) {
  const result = spawnSync(pythonExecutable, ["-m", "ruff", "--version"], {
    cwd: SERVICE_DIR,
    stdio: "ignore",
  })

  return !result.error && result.status === 0
}

function resolvePythonExecutable() {
  if (process.env.PYTHON) {
    return process.env.PYTHON
  }

  if (fs.existsSync(SERVICE_VENV_PYTHON) && hasRuff(SERVICE_VENV_PYTHON)) {
    return SERVICE_VENV_PYTHON
  }

  return "python3"
}

function runRuffDocstringCheck() {
  if (!fs.existsSync(SERVICE_DIR)) {
    console.log("Python docstring gate skipped: service directory is missing.")
    return 0
  }

  const pythonExecutable = resolvePythonExecutable()
  const result = spawnSync(
    pythonExecutable,
    ["-m", "ruff", "check", "app", "scripts"],
    {
      cwd: SERVICE_DIR,
      stdio: "inherit",
    }
  )

  if (result.error) {
    console.error(`Unable to run Python docstring gate: ${result.error.message}`)
    return 1
  }

  return result.status ?? 1
}

function main() {
  const changedOnly = process.argv.includes("--changed")
  const baseRef = process.argv
    .slice(2)
    .find((argument) => !argument.startsWith("--")) || DEFAULT_BASE_REF

  if (changedOnly && !shouldRunForChangedFiles(baseRef)) {
    console.log("Python docstring gate skipped: no changed service Python files.")
    return
  }

  process.exitCode = runRuffDocstringCheck()
}

module.exports = {
  isPythonDocstringConfig,
  isServicePythonSource,
  resolvePythonExecutable,
  runRuffDocstringCheck,
  shouldRunForChangedFiles,
}

if (require.main === module) {
  main()
}
