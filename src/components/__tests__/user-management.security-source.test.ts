import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("user-management nhan_vien security posture", () => {
  it("does not read or mutate nhan_vien directly from the users page", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(app)/users/page.tsx"),
      "utf8",
    )

    expect(source).not.toContain('.from("nhan_vien")')
    expect(source).not.toContain(".from('nhan_vien')")
    expect(source).not.toContain('.select("*")')
    expect(source).not.toContain("supabase.rpc('reset_password_by_admin'")
  })

  it("does not keep the edit-user password/direct-table fallback", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/edit-user-dialog.tsx"),
      "utf8",
    )

    expect(source).not.toContain(".from('nhan_vien')")
    expect(source).not.toContain('.from("nhan_vien")')
    expect(source).not.toContain("temporary fallback")
    expect(source).not.toContain("p_password")
    expect(source).not.toContain("edit-password")
  })

  it("does not switch tenants by mutating nhan_vien directly", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/tenants/switch/route.ts"),
      "utf8",
    )

    expect(source).toContain("export const runtime = 'nodejs'")
    expect(source).toContain("user_set_current_don_vi")
    expect(source).not.toContain(".from('nhan_vien')")
    expect(source).not.toContain('.from("nhan_vien")')
    expect(source).not.toContain("current_don_vi: don_vi")
  })
})
