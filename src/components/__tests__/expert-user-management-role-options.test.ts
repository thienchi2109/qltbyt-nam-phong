import { describe, expect, it } from "vitest"

import { getUserManagementRoleOptions } from "@/components/user-management-role-options"

describe("expert user-management role options", () => {
  it.each(["global", "admin"])("offers Chuyên gia to %s operators", (operatorRole) => {
    expect(getUserManagementRoleOptions(operatorRole)).toContainEqual(["chuyen_gia", "Chuyên gia"])
  })

  it("does not offer Chuyên gia outside global/admin user-management flows", () => {
    expect(getUserManagementRoleOptions("to_qltb")).not.toContainEqual(["chuyen_gia", "Chuyên gia"])
  })
})
