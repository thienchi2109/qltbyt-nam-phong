import { describe, expect, it } from "vitest"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { buildPrintTemplate } from "../maintenance-print-template"

const selectedPlan: MaintenancePlan = {
  id: 17,
  ten_ke_hoach: "Kế hoạch bảo trì 2026",
  nam: 2026,
  loai_cong_viec: "Bảo trì",
  khoa_phong: "Khoa Xét nghiệm",
  nguoi_lap_ke_hoach: "Nguyễn Văn A",
  trang_thai: "Đã duyệt",
  ngay_phe_duyet: null,
  nguoi_duyet: null,
  ly_do_khong_duyet: null,
  created_at: "2026-07-28T00:00:00Z",
  don_vi: 42,
  facility_name: "CDC Cần Thơ",
}

function renderTemplate(printLocation: string): string {
  return buildPrintTemplate({
    selectedPlan,
    tasks: [],
    user: { full_name: "Người lập kế hoạch" },
    logoUrl: "https://example.com/tenant-logo.png",
    organizationName: "Trung tâm Y tế An Giang",
    printLocation,
  })
}

describe("buildPrintTemplate", () => {
  it("renders a populated location before the maintenance plan date", () => {
    const html = renderTemplate("An Giang")

    expect(html).toContain(
      '<input type="text" class="form-input-line w-24" value="An Giang"/>, ngày'
    )
  })

  it("renders a blank location without a leading comma", () => {
    const html = renderTemplate("")

    expect(html).toContain('<input type="text" class="form-input-line w-24" value=""/>ngày')
    expect(html).not.toContain('value=""/>, ngày')
  })

  it("escapes the maintenance plan print location", () => {
    const html = renderTemplate('An Giang"><script>alert(1)</script>')

    expect(html).not.toContain('value="An Giang"><script>alert(1)</script>"')
    expect(html).toContain(
      'value="An Giang&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"/>, ngày'
    )
  })

  it("keeps the maintenance plan print location editable", () => {
    const html = renderTemplate("An Giang")
    const locationInput =
      html.match(/<input type="text" class="form-input-line w-24" value="An Giang"\/>/)?.[0] ?? ""

    expect(locationInput).toBe('<input type="text" class="form-input-line w-24" value="An Giang"/>')
    expect(locationInput).not.toMatch(/\breadonly\b/i)
    expect(locationInput).not.toMatch(/\bdisabled\b/i)
  })
})
