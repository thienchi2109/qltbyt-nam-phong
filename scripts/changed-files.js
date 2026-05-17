const { execFileSync } = require("node:child_process")

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

function getCommittedChangedFiles(baseRef, runGitImpl) {
  try {
    return runGitImpl(["diff", "--name-only", "--diff-filter=ACMR", `${baseRef}...HEAD`])
  } catch (error) {
    if (!baseRef) {
      throw error
    }

    return runGitImpl(["diff", "--name-only", "--diff-filter=ACMR", `${baseRef}..HEAD`])
  }
}

function collectChangedFiles(
  baseRef,
  { runGitImpl = runGit, includeFile = () => true, fileExists = () => true } = {}
) {
  const committed = getCommittedChangedFiles(baseRef, runGitImpl)
  const unstaged = runGitImpl(["diff", "--name-only", "--diff-filter=ACMR"])
  const staged = runGitImpl(["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
  const untracked = runGitImpl(["ls-files", "--others", "--exclude-standard"])

  return [...new Set([...committed, ...unstaged, ...staged, ...untracked])]
    .filter((filePath) => includeFile(filePath) && !isIgnoredPath(filePath))
    .filter((filePath) => fileExists(filePath))
    .sort((left, right) => left.localeCompare(right))
}

module.exports = {
  collectChangedFiles,
  GIT_EXECUTABLE,
  getCommittedChangedFiles,
  isIgnoredPath,
  runGit,
}
