import { describe, expect, it } from "vitest"

import {
  collectChangedTypeScriptFiles,
  findExplicitAnyViolations,
  formatViolations,
} from "../check-no-explicit-any-in-diff"

describe("check-no-explicit-any-in-diff", () => {
  it("finds explicit any usages in changed TypeScript code", () => {
    const source = `
      const user = session?.user as any
      const result = callRpc<any>({ fn: "tenant_list" })
      function handleError(error: any) {
        return error
      }
    `

    const violations = findExplicitAnyViolations(source, "src/components/add-equipment-dialog.tsx")

    expect(violations).toHaveLength(3)
    expect(formatViolations(violations)).toContain(
      "src/components/add-equipment-dialog.tsx:2:37 explicit any is not allowed"
    )
  })

  it("does not flag unknown-based typing", () => {
    const source = `
      const user = session?.user
      const result = callRpc<void, { p_payload: Payload }>({ fn: "tenant_list" })
      function handleError(error: unknown) {
        return error instanceof Error ? error.message : ""
      }
    `

    expect(findExplicitAnyViolations(source, "src/components/add-equipment-dialog.tsx")).toEqual([])
  })

  it("fails closed when git discovery cannot run", () => {
    expect(() =>
      collectChangedTypeScriptFiles("main", {
        runGitImpl: () => {
          throw new Error("git diff failed")
        },
      })
    ).toThrow("git diff failed")
  })
})
