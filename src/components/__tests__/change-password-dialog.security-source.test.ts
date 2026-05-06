import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("ChangePasswordDialog password-change security posture", () => {
  it("does not include the legacy client-side password fallback", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/change-password-dialog.tsx"),
      "utf8",
    )

    expect(source).not.toContain("hashed_password")
    expect(source).not.toContain(".from('nhan_vien')")
    expect(source).not.toContain('.from("nhan_vien")')
    expect(source).not.toContain(".update({ password")
    expect(source).not.toContain("temporary fallback")
  })
})
