import { describe, expect, it } from "vitest"

import { generateHandoverHTML } from "@/components/handover-preview-dialog.document"
import type { HandoverData } from "@/components/handover-preview-dialog.data"

function makeHandoverData(): HandoverData {
  return {
    department: "Khoa Cấp cứu",
    handoverDate: "16/05/2026",
    reason: "Bàn giao phục vụ khám bệnh",
    requestCode: "LC-0001",
    giverName: "Đại diện Khoa Cấp cứu",
    directorName: "",
    receiverName: "Đại diện Khoa Nội",
    device: {
      code: "TB-001",
      name: "Máy thở",
      model: "M-100",
      serial: "SN-001",
      condition: "Hoạt động",
      accessories: "Dây nguồn",
      note: "Không có",
    },
  }
}

describe("handover preview document generation", () => {
  it("renders the handover document with transfer, device, and signature details", () => {
    const html = generateHandoverHTML(makeHandoverData())

    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("BIÊN BẢN BÀN GIAO THIẾT BỊ")
    expect(html).toContain("LC-0001")
    expect(html).toContain("TB-001")
    expect(html).toContain("Máy thở")
    expect(html).toContain("Bàn giao phục vụ khám bệnh")
    expect(html).toContain("Đại diện Khoa Cấp cứu")
    expect(html).toContain("Đại diện Khoa Nội")
    expect(html).toContain("Dây nguồn")
  })

  it("keeps the generated page printable as an A4 landscape document", () => {
    const html = generateHandoverHTML(makeHandoverData())

    expect(html).toContain(".a4-landscape-page")
    expect(html).toContain("@media print")
    expect(html).toContain("print-color-adjust")
  })
})
