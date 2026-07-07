import { describe, expect, it, vi } from "vitest"

import {
  collectChangedPrettierFiles,
  isPrettierSupportedFile,
  main,
} from "../check-prettier-in-diff"

describe("check-prettier-in-diff", () => {
  it("collects only changed files supported by the Prettier hook", () => {
    const runGitImpl = (args: string[]) => {
      const command = args.join(" ")

      if (command === "diff --name-only --diff-filter=ACMR main...HEAD") {
        return ["src/app/page.tsx", "README.md", "src/generated.sql", "node_modules/pkg/file.ts"]
      }

      if (command === "diff --name-only --diff-filter=ACMR") {
        return ["src/local-helper.js", "docs/runbook.mdx"]
      }

      if (command === "diff --cached --name-only --diff-filter=ACMR") {
        return ["lefthook.yml", "src/styles.css"]
      }

      if (command === "ls-files --others --exclude-standard") {
        return ["scripts/new-check.cjs", "notes.txt"]
      }

      return []
    }

    expect(collectChangedPrettierFiles("main", { runGitImpl, fileExists: () => true })).toEqual([
      "docs/runbook.mdx",
      "lefthook.yml",
      "notes.txt",
      "README.md",
      "scripts/new-check.cjs",
      "src/app/page.tsx",
      "src/local-helper.js",
      "src/styles.css",
    ])
  })

  it("matches the file extensions formatted by the Lefthook Prettier command", () => {
    expect(isPrettierSupportedFile("src/component.tsx")).toBe(true)
    expect(isPrettierSupportedFile("package.json")).toBe(true)
    expect(isPrettierSupportedFile("docs/spec.md")).toBe(true)
    expect(isPrettierSupportedFile("supabase/migration.sql")).toBe(false)
  })

  it("prints the root cause when Prettier cannot be started", () => {
    const consoleError = vi.fn()

    expect(
      main("main", {
        collectChangedPrettierFilesImpl: () => ["src/app/page.tsx"],
        runPrettierCheckImpl: () => {
          throw new Error("Cannot find module 'prettier/bin/prettier.cjs'")
        },
        consoleError,
        consoleLog: vi.fn(),
      })
    ).toBe(1)

    expect(consoleError).toHaveBeenCalledWith(
      "Prettier check failed: Cannot find module 'prettier/bin/prettier.cjs'"
    )
  })
})
