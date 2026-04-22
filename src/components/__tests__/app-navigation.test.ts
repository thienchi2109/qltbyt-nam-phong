import { describe, expect, it } from "vitest"

import { getAppNavigationItems, getMobileFooterMoreNavItems } from "@/components/app-navigation"

function getHrefs(role: string) {
  return getAppNavigationItems(role).map((item) => item.href)
}

function getMoreHrefs(role: string) {
  return getMobileFooterMoreNavItems(role).map((item) => item.href)
}

describe("app-navigation role filtering", () => {
  it("hides device quota from restricted roles in the main navigation", () => {
    expect(getHrefs("user")).not.toContain("/device-quota")
    expect(getHrefs("qltb_khoa")).not.toContain("/device-quota")
    expect(getHrefs("technician")).not.toContain("/device-quota")
  })

  it("keeps device quota visible for allowed roles in the main navigation", () => {
    expect(getHrefs("to_qltb")).toContain("/device-quota")
    expect(getHrefs("regional_leader")).toContain("/device-quota")
    expect(getHrefs("global")).toContain("/device-quota")
  })

  it("applies the same device quota filtering to the mobile more menu", () => {
    expect(getMoreHrefs("user")).not.toContain("/device-quota")
    expect(getMoreHrefs("qltb_khoa")).not.toContain("/device-quota")
    expect(getMoreHrefs("technician")).not.toContain("/device-quota")
    expect(getMoreHrefs("to_qltb")).toContain("/device-quota")
  })
})
