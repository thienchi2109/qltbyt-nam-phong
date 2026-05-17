import { describe, expect, it } from "vitest"

import { collectChangedFiles, GIT_EXECUTABLE, getCommittedChangedFiles } from "../changed-files"

describe("changed-files", () => {
  it("uses a fixed Git executable path instead of PATH lookup", () => {
    expect(GIT_EXECUTABLE).toBe("/usr/bin/git")
  })

  it("collects committed, staged, unstaged, and untracked files once", () => {
    const runGitImpl = (args: string[]) => {
      const command = args.join(" ")

      if (command === "diff --name-only --diff-filter=ACMR main...HEAD") {
        return ["src/a.ts", "README.md"]
      }

      if (command === "diff --name-only --diff-filter=ACMR") {
        return ["src/b.ts", "src/a.ts"]
      }

      if (command === "diff --cached --name-only --diff-filter=ACMR") {
        return ["src/c.ts"]
      }

      if (command === "ls-files --others --exclude-standard") {
        return ["src/d.ts", "node_modules/pkg/index.ts"]
      }

      return []
    }

    expect(
      collectChangedFiles("main", {
        runGitImpl,
        includeFile: (filePath) => filePath.endsWith(".ts"),
        fileExists: () => true,
      })
    ).toEqual(["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"])
  })

  it("falls back to two-dot diff when merge-base diff is unavailable", () => {
    const runGitImpl = (args: string[]) => {
      const command = args.join(" ")

      if (command === "diff --name-only --diff-filter=ACMR origin/main...HEAD") {
        throw new Error("no merge base")
      }

      if (command === "diff --name-only --diff-filter=ACMR origin/main..HEAD") {
        return ["scripts/check.js"]
      }

      return []
    }

    expect(getCommittedChangedFiles("origin/main", runGitImpl)).toEqual(["scripts/check.js"])
  })
})
