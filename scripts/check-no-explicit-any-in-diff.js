#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { execFileSync } = require("child_process")
const ts = require("typescript")

const DEFAULT_BASE_REF = process.env.EXPLICIT_ANY_BASE || "main"
const TYPE_SCRIPT_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"])
const IGNORED_PATH_SEGMENTS = [".git", ".next", "build", "coverage", "dist", "node_modules"]

function isTypeScriptFile(filePath) {
  return TYPE_SCRIPT_EXTENSIONS.has(path.extname(filePath))
}

function isIgnoredPath(filePath) {
  return IGNORED_PATH_SEGMENTS.some((segment) => filePath.split(/[\\/]/).includes(segment))
}

function getScriptKind(filePath) {
  return filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
}

function findExplicitAnyViolations(source, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath)
  )
  const violations = []

  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      violations.push({
        filePath,
        line: line + 1,
        column: character + 1,
      })
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return violations
}

function formatViolations(violations) {
  return violations
    .map(
      (violation) =>
        `${violation.filePath}:${violation.line}:${violation.column} explicit any is not allowed`
    )
    .join("\n")
}

function runGit(args) {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`git ${args.join(" ")} failed: ${message}`)
  }
}

function collectChangedTypeScriptFiles(
  baseRef = DEFAULT_BASE_REF,
  { runGitImpl = runGit } = {}
) {
  const committed = runGitImpl(["diff", "--name-only", "--diff-filter=ACMR", `${baseRef}...HEAD`])
  const unstaged = runGitImpl(["diff", "--name-only", "--diff-filter=ACMR"])
  const staged = runGitImpl(["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
  const untracked = runGitImpl(["ls-files", "--others", "--exclude-standard"])

  return [...new Set([...committed, ...unstaged, ...staged, ...untracked])]
    .filter((filePath) => isTypeScriptFile(filePath) && !isIgnoredPath(filePath))
    .filter((filePath) => fs.existsSync(filePath))
    .sort()
}

function scanFiles(filePaths) {
  return filePaths.flatMap((filePath) => {
    const source = fs.readFileSync(filePath, "utf8")
    return findExplicitAnyViolations(source, filePath)
  })
}

function main() {
  let filePaths

  try {
    filePaths = collectChangedTypeScriptFiles(process.argv[2] || DEFAULT_BASE_REF)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Unable to determine changed TypeScript files: ${message}`)
    process.exitCode = 1
    return
  }

  if (filePaths.length === 0) {
    console.log("No changed TypeScript files to scan for explicit any.")
    return
  }

  const violations = scanFiles(filePaths)

  if (violations.length === 0) {
    console.log("No explicit any found in changed TypeScript files.")
    return
  }

  console.error(formatViolations(violations))
  console.error(
    `Found ${violations.length} explicit any violation${violations.length === 1 ? "" : "s"} in changed TypeScript files.`
  )
  process.exitCode = 1
}

module.exports = {
  collectChangedTypeScriptFiles,
  findExplicitAnyViolations,
  formatViolations,
  runGit,
  scanFiles,
}

if (require.main === module) {
  main()
}
