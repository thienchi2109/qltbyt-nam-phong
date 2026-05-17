import { describe, expect, it } from "vitest"
import path from "node:path"

import {
  collectChangedJavaScriptFiles,
  formatLintMessages,
  SONARJS_DUPLICATION_RULES,
} from "../check-sonarjs-duplication-in-diff"

describe("check-sonarjs-duplication-in-diff", () => {
  it("collects only changed JavaScript and TypeScript files from the diff set", () => {
    const runGitImpl = (args: string[]) => {
      const command = args.join(" ")

      if (command === "diff --name-only --diff-filter=ACMR main...HEAD") {
        return ["src/new-component.tsx", "README.md", "node_modules/pkg/index.ts"]
      }

      if (command === "diff --name-only --diff-filter=ACMR") {
        return ["src/local-helper.js"]
      }

      if (command === "diff --cached --name-only --diff-filter=ACMR") {
        return ["src/staged-route.mts"]
      }

      if (command === "ls-files --others --exclude-standard") {
        return ["scripts/new-check.cjs", "docs/note.md"]
      }

      return []
    }

    expect(collectChangedJavaScriptFiles("main", { runGitImpl, fileExists: () => true })).toEqual([
      "scripts/new-check.cjs",
      "src/local-helper.js",
      "src/new-component.tsx",
      "src/staged-route.mts",
    ])
  })

  it("formats only SonarJS duplicate rule messages", () => {
    const messages = formatLintMessages([
      {
        filePath: path.join(process.cwd(), "src/example.ts"),
        messages: [
          {
            ruleId: "sonarjs/no-identical-functions",
            severity: 2,
            line: 7,
            column: 3,
            message: "Functions should not have identical implementations",
          },
          {
            ruleId: "@typescript-eslint/no-unused-vars",
            severity: 1,
            line: 9,
            column: 5,
            message: "unused",
          },
        ],
      },
    ])

    expect(messages).toEqual([
      "src/example.ts:7:3 sonarjs/no-identical-functions Functions should not have identical implementations",
    ])
  })

  it("keeps the gate limited to duplicate-oriented SonarJS rules", () => {
    expect(
      Object.keys(SONARJS_DUPLICATION_RULES).sort((left, right) => left.localeCompare(right))
    ).toEqual([
      "sonarjs/no-all-duplicated-branches",
      "sonarjs/no-duplicate-in-composite",
      "sonarjs/no-duplicated-branches",
      "sonarjs/no-identical-conditions",
      "sonarjs/no-identical-expressions",
      "sonarjs/no-identical-functions",
    ])
  })
})
