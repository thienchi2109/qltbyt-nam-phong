import { execFileSync } from "node:child_process"

const MAX_GIT_EVIDENCE_OUTPUT_BYTES = 4 * 1024 * 1024

type GitOutputOptions = {
  credentialFree?: boolean
}

function gitOutput(
  repositoryRoot: string,
  args: string[],
  options: GitOutputOptions = {}
): string | undefined {
  try {
    return execFileSync("git", ["-C", repositoryRoot, ...args], {
      encoding: "utf8",
      env: options.credentialFree
        ? {
            ...process.env,
            GIT_ASKPASS: "/bin/false",
            GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o IdentitiesOnly=yes -o IdentityFile=/dev/null",
            GIT_TERMINAL_PROMPT: "0",
            SSH_ASKPASS: "/bin/false",
          }
        : process.env,
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

/** Rejects landed evidence when tracked or untracked worktree content is present. */
export function worktreeIsClean(repositoryRoot: string): boolean {
  return (
    gitOutput(repositoryRoot, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ]) === ""
  )
}

/** Resolves the immutable first parent of a landed commit. */
export function firstParentCommit(repositoryRoot: string, commit: string): string | undefined {
  return resolveGitCommit(repositoryRoot, `${commit}^1`)
}

/** Lists paths changed by one exact parent-to-commit comparison. */
export function listChangedFilesBetween(
  repositoryRoot: string,
  parentCommit: string,
  subjectCommit: string
): string[] | undefined {
  const output = gitOutput(repositoryRoot, [
    "diff",
    "--name-only",
    "--diff-filter=ACMRTUXB",
    parentCommit,
    subjectCommit,
    "--",
  ])

  return output?.split("\n").filter(Boolean)
}

function credentialFreeOriginUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.username === "" && url.password === ""
  } catch {
    return false
  }
}

/**
 * Refreshes the public main tracking ref with prompts, helpers, and SSH identities disabled.
 */
export function refreshPublicOriginMain(repositoryRoot: string): string | undefined {
  const originUrl = gitOutput(repositoryRoot, ["remote", "get-url", "origin"])?.trim()
  if (originUrl === undefined || !credentialFreeOriginUrl(originUrl)) {
    return undefined
  }

  const fetched = gitOutput(
    repositoryRoot,
    [
      "-c",
      "credential.helper=",
      "-c",
      "credential.interactive=never",
      "-c",
      "http.extraHeader=",
      "-c",
      `http.${originUrl}.extraHeader=`,
      "fetch",
      "--no-tags",
      originUrl,
      "+refs/heads/main:refs/remotes/origin/main",
    ],
    { credentialFree: true }
  )

  return fetched === undefined ? undefined : resolveGitCommit(repositoryRoot, "origin/main")
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
