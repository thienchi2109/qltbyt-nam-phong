const { execFileSync } = require("node:child_process")

const DEFAULT_DIFF_FILTER = "ACMR"
const GIT_EXECUTABLE = "/usr/bin/git"
const IGNORED_PATH_SEGMENTS = [".git", ".next", "build", "coverage", "dist", "node_modules"]

function isIgnoredPath(filePath) {
  return IGNORED_PATH_SEGMENTS.some((segment) => filePath.split(/[\\/]/).includes(segment))
}

function runGit(args) {
  try {
    return execFileSync(GIT_EXECUTABLE, args, {
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

function getCommittedChangedFiles(baseRef, runGitImpl, diffFilter = DEFAULT_DIFF_FILTER) {
  try {
    return runGitImpl(["diff", "--name-only", `--diff-filter=${diffFilter}`, `${baseRef}...HEAD`])
  } catch (error) {
    if (!baseRef) {
      throw error
    }

    return runGitImpl(["diff", "--name-only", `--diff-filter=${diffFilter}`, `${baseRef}..HEAD`])
  }
}

function collectChangedFiles(
  baseRef,
  {
    diffFilter = DEFAULT_DIFF_FILTER,
    runGitImpl = runGit,
    includeFile = () => true,
    fileExists = () => true,
  } = {}
) {
  const committed = getCommittedChangedFiles(baseRef, runGitImpl, diffFilter)
  const unstaged = runGitImpl(["diff", "--name-only", `--diff-filter=${diffFilter}`])
  const staged = runGitImpl(["diff", "--cached", "--name-only", `--diff-filter=${diffFilter}`])
  const untracked = runGitImpl(["ls-files", "--others", "--exclude-standard"])

  return [...new Set([...committed, ...unstaged, ...staged, ...untracked])]
    .filter((filePath) => includeFile(filePath) && !isIgnoredPath(filePath))
    .filter((filePath) => fileExists(filePath))
    .sort((left, right) => left.localeCompare(right))
}

module.exports = {
  collectChangedFiles,
  DEFAULT_DIFF_FILTER,
  GIT_EXECUTABLE,
  getCommittedChangedFiles,
  isIgnoredPath,
  runGit,
}
