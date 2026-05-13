import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

describe("React Doctor P0 DOM correctness", () => {
  it("does not render styled-jsx-only props on plain style tags", () => {
    const files = [
      "src/components/handover-template.tsx",
      "src/components/maintenance-form.tsx",
      "src/components/qr-scanner-camera.tsx",
      "src/components/log-template.tsx",
      "src/app/(app)/device-quota/dashboard/_components/DeviceQuotaComplianceReport.tsx",
    ]

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8")

      expect(source).not.toContain("<style jsx>")
    }
  })
})

describe("React Doctor P5 accessibility source guards", () => {
  it("does not keep fake anchors or autofocus in the flagged accessibility files", () => {
    const files = [
      "src/components/login-template.tsx",
      "src/app/(app)/maintenance/_components/notes-input.tsx",
    ]

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8")

      expect(source).not.toContain('href="#"')
      expect(source).not.toContain("autoFocus")
    }
  })

  it("does not use form labels for readonly handover display fields", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/handover-template.tsx"),
      "utf8",
    )

    expect(source).not.toContain("<label")
    expect(source).toContain("Khoa/Phòng lập:")
    expect(source).toContain("Ngày nhận/giao:")
    expect(source).toContain("Lý do nhận bàn giao:")
    expect(source).toContain("Mã yêu cầu:")
  })
})
