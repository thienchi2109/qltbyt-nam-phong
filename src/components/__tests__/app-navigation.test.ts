import { describe, expect, it } from "vitest"

import {
  getAppNavigationItems,
  getMobileFooterMainNavItems,
  getMobileFooterMoreNavItems,
} from "@/components/app-navigation"

const restrictedRoles = ["user", "qltb_khoa", "technician"] as const
const allowedRoles = ["to_qltb", "regional_leader", "global", "admin"] as const

function getHrefs(role: string): string[] {
  return getAppNavigationItems(role).map((item) => item.href)
}

function getMoreHrefs(role: string): string[] {
  return getMobileFooterMoreNavItems(role).map((item) => item.href)
}

describe("app-navigation role filtering", () => {
  it("shows technical configurations only to global-equivalent roles", () => {
    expect(getHrefs("global")).toContain("/technical-configurations")
    expect(getHrefs("admin")).toContain("/technical-configurations")

    for (const role of ["regional_leader", "to_qltb", ...restrictedRoles]) {
      expect(getHrefs(role)).not.toContain("/technical-configurations")
    }
  })

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

  it("does not expose device quota in the removed mobile more menu", () => {
    for (const role of restrictedRoles) {
      expect(getMoreHrefs(role)).not.toContain("/device-quota")
    }

    for (const role of allowedRoles) {
      expect(getMoreHrefs(role)).not.toContain("/device-quota")
    }
  })

  it("limits the small-screen footer to the field-work routes", () => {
    expect(getMobileFooterMainNavItems("admin").map((item) => item.href)).toEqual([
      "/dashboard",
      "/equipment",
      "/qr-scanner?autoStart=1",
      "/repair-requests",
      "/transfers",
    ])

    expect(getMobileFooterMoreNavItems("admin")).toEqual([])
  })
})
