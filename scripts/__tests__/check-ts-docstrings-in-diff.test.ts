import { describe, expect, it } from "vitest"

import {
  collectChangedJavaScriptTypeScriptFiles,
  findMissingJsDocViolations,
  formatViolations,
} from "../check-ts-docstrings-in-diff"

describe("check-ts-docstrings-in-diff", () => {
  it("flags exported JavaScript and TypeScript declarations without JSDoc", () => {
    const source = `
      export function buildFilter() {
        return {}
      }

      export class DeviceMapper {}

      export const useDeviceRows = () => []

      const normalizeStatus = () => "active"
      export { normalizeStatus }
    `

    const violations = findMissingJsDocViolations(source, "src/lib/device-utils.ts")

    expect(formatViolations(violations)).toContain(
      "src/lib/device-utils.ts:2:7 exported function buildFilter requires JSDoc"
    )
    expect(formatViolations(violations)).toContain(
      "src/lib/device-utils.ts:8:7 exported variable useDeviceRows requires JSDoc"
    )
    expect(violations.map((violation) => violation.name)).toEqual([
      "buildFilter",
      "DeviceMapper",
      "useDeviceRows",
      "normalizeStatus",
    ])
  })

  it("accepts JSDoc on exported declarations", () => {
    const source = `
      /**
       * Builds stable filter params for report RPCs.
       */
      export function buildReportFilters() {
        return {}
      }

      /**
       * Maps raw rows into table rows.
       */
      const mapRows = () => []
      export { mapRows }
    `

    expect(findMissingJsDocViolations(source, "src/lib/report-utils.ts")).toEqual([])
  })

  it("does not require JSDoc for private helpers, component-local handlers, callbacks, or test files", () => {
    const componentSource = `
      export function EquipmentDialog() {
        const handleSave = () => null
        return rows.map((row) => row.id).join(",")
      }

      function privateHelper() {
        return "hidden"
      }
    `

    expect(
      findMissingJsDocViolations(componentSource, "src/components/equipment-dialog.test.tsx")
    ).toEqual([])

    expect(
      findMissingJsDocViolations(componentSource, "src/components/equipment-dialog.tsx")
    ).toHaveLength(1)
  })

  it("collects only changed JavaScript and TypeScript source files", () => {
    const runGitImpl = (args: string[]) => {
      const command = args.join(" ")

      if (command === "diff --name-only --diff-filter=ACMR main...HEAD") {
        return [
          "src/lib/report-utils.ts",
          "src/components/report-panel.tsx",
          "src/components/report-panel.test.tsx",
          "scripts/check-docs.js",
          "README.md",
        ]
      }

      if (command === "diff --name-only --diff-filter=ACMR") {
        return ["src/app/page.jsx"]
      }

      if (command === "diff --cached --name-only --diff-filter=ACMR") {
        return ["src/app/api/route.js"]
      }

      if (command === "ls-files --others --exclude-standard") {
        return ["src/lib/new-helper.mts", "src/lib/new-helper.ts"]
      }

      return []
    }

    expect(
      collectChangedJavaScriptTypeScriptFiles("main", {
        runGitImpl,
        fileExists: () => true,
      })
    ).toEqual([
      "scripts/check-docs.js",
      "src/app/api/route.js",
      "src/app/page.jsx",
      "src/components/report-panel.tsx",
      "src/lib/new-helper.ts",
      "src/lib/report-utils.ts",
    ])
  })
})
