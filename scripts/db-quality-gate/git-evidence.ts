import { execFileSync } from "node:child_process"

const MAX_GIT_EVIDENCE_OUTPUT_BYTES = 4 * 1024 * 1024

function gitOutput(repositoryRoot: string, args: string[]): string | undefined {
  try {
    return execFileSync("git", ["-C", repositoryRoot, ...args], {
      encoding: "utf8",
      maxBuffer: MAX_GIT_EVIDENCE_OUTPUT_BYTES,
      stdio: ["ignore", "pipe", "ignore"],
    })
  } catch {
    return undefined
  }
}

/** Resolves a Git commit to its immutable full SHA without accepting a caller-supplied label. */
export function resolveGitCommit(repositoryRoot: string, ref: string): string | undefined {
  return gitOutput(repositoryRoot, ["rev-parse", "--verify", `${ref}^{commit}`])?.trim()
}

/** Resolves the immutable commit checked out at repository HEAD. */
export function currentHeadCommit(repositoryRoot: string): string | undefined {
  return resolveGitCommit(repositoryRoot, "HEAD")
}

/** Reads a tracked file at a resolved Git commit without consulting the worktree. */
export function readFileAtCommit(
  repositoryRoot: string,
  commit: string,
  relativePath: string
): string | undefined {
  return gitOutput(repositoryRoot, ["show", `${commit}:${relativePath}`])
}

/** Lists tracked paths beneath a commit tree directory without reading the worktree. */
export function listFilesAtCommit(
  repositoryRoot: string,
  commit: string,
  relativeDirectory: string
): string[] | undefined {
  const output = gitOutput(repositoryRoot, [
    "ls-tree",
    "-r",
    "--name-only",
    commit,
    "--",
    relativeDirectory,
  ])

  return output?.split("\n").filter(Boolean)
}

/** Verifies that evidence commit is in the current branch ancestry. */
export function isAncestorCommit(
  repositoryRoot: string,
  ancestor: string,
  descendant: string
): boolean {
  try {
    execFileSync(
      "git",
      ["-C", repositoryRoot, "merge-base", "--is-ancestor", ancestor, descendant],
      {
        stdio: "ignore",
      }
    )
    return true
  } catch {
    return false
  }
}
