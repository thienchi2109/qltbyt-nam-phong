import { readFileSync } from "node:fs"
import { join } from "node:path"

import { USER_MANAGEMENT_ROLE_OPTIONS } from "@/types/database"
import { describe, expect, it } from "vitest"

describe("technical expert role user-management activation", () => {
  it("keeps base roles stable and routes selectors through operator-scoped options", () => {
    expect(Object.keys(USER_MANAGEMENT_ROLE_OPTIONS)).toEqual([
      "global",
      "regional_leader",
      "to_qltb",
      "technician",
      "qltb_khoa",
      "user",
    ])

    for (const path of [
      "src/components/add-user-dialog.tsx",
      "src/components/edit-user-dialog.tsx",
    ]) {
      const source = readFileSync(join(process.cwd(), path), "utf8")

      expect(source).toContain("getUserManagementRoleOptions(operatorRole)")
      expect(source).not.toContain("Object.entries(USER_ROLES)")
    }
  })
})
