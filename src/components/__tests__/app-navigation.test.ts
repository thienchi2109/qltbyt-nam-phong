import { describe, expect, it } from "vitest"

import { getAppNavigationItems, getMobileFooterMoreNavItems } from "@/components/app-navigation"

const restrictedRoles = ["user", "qltb_khoa", "technician"] as const
const allowedRoles = ["to_qltb", "regional_leader", "global", "admin"] as const

function getHrefs(role: string): string[] {
  return getAppNavigationItems(role).map((item) => item.href)
}

function getMoreHrefs(role: string): string[] {
  return getMobileFooterMoreNavItems(role).map((item) => item.href)
}

describe("app-navigation role filtering", () => {
  it("hides device quota from restricted roles in the main navigation", () => {
    for (const role of restrictedRoles) {
      expect(getHrefs(role)).not.toContain("/device-quota")
    }
  })

  it("keeps device quota visible for allowed roles in the main navigation", () => {
    for (const role of allowedRoles) {
      expect(getHrefs(role)).toContain("/device-quota")
    }
  })

  it("applies the same device quota filtering to the mobile more menu", () => {
    for (const role of restrictedRoles) {
      expect(getMoreHrefs(role)).not.toContain("/device-quota")
    }

    for (const role of allowedRoles) {
      expect(getMoreHrefs(role)).toContain("/device-quota")
    }
  })
})
