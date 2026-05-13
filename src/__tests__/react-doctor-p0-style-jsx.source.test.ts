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
