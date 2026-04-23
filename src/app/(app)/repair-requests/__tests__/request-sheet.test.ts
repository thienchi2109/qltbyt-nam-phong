import { describe, expect, it } from "vitest"

import { buildRepairRequestSheetHtml } from "../request-sheet"
import { REPAIR_SHEET_STYLES } from "../request-sheet-styles"
import type { RepairRequestWithEquipment } from "../types"

const request: RepairRequestWithEquipment = {
  id: 10,
  thiet_bi_id: 5,
  ngay_yeu_cau: "2026-01-01T00:00:00.000Z",
  trang_thai: "Đã duyệt",
  mo_ta_su_co: "Lỗi nguồn",
  hang_muc_sua_chua: "Kiểm tra bộ nguồn",
  ngay_mong_muon_hoan_thanh: "2026-01-10T00:00:00.000Z",
  nguoi_yeu_cau: "Nguyễn Văn A",
  ngay_duyet: "2026-01-02T00:00:00.000Z",
  ngay_hoan_thanh: null,
  nguoi_duyet: "Nguyễn Văn B",
  nguoi_xac_nhan: null,
  chi_phi_sua_chua: null,
  don_vi_thuc_hien: "noi_bo",
  ten_don_vi_thue: null,
  ket_qua_sua_chua: null,
  ly_do_khong_hoan_thanh: null,
  thiet_bi: {
    ten_thiet_bi: "Máy Monitor",
    ma_thiet_bi: "TB-10",
    model: "M-10",
    serial: "SN-10",
    khoa_phong_quan_ly: "Khoa A",
    facility_name: "BV A",
    facility_id: 1,
  },
}

describe("buildRepairRequestSheetHtml", () => {
  it("renders the compact one-page request sheet layout", () => {
    const html = buildRepairRequestSheetHtml(request, {
      organizationName: "CDC Cần Thơ",
      logoUrl: "https://example.com/logo.png",
    })

    expect(html).toContain("1. THÔNG TIN THIẾT BỊ")
    expect(html).toContain("2. ĐỀ NGHỊ SỬA CHỮA")
    expect(html).not.toContain("II. BỘ PHẬN SỬA CHỮA")
    expect(html).not.toContain("III. KẾT QUẢ, TÌNH TRẠNG THIẾT BỊ SAU KHI XỬ LÝ")
    expect(html).not.toContain("page-break")

    expect(html).toContain("PHÒNG VT-TBYT")
    expect(html).toContain("LÃNH ĐẠO KHOA/PHÒNG")
    expect(html).toContain("NGƯỜI ĐỀ NGHỊ")
    expect(html).toContain("BAN GIÁM ĐỐC")

    const topRowStart = html.indexOf("PHÒNG VT-TBYT")
    const topRowMiddle = html.indexOf("LÃNH ĐẠO KHOA/PHÒNG")
    const topRowEnd = html.indexOf("NGƯỜI ĐỀ NGHỊ")
    const bottomRow = html.indexOf("BAN GIÁM ĐỐC")

    expect(topRowStart).toBeGreaterThan(-1)
    expect(topRowMiddle).toBeGreaterThan(topRowStart)
    expect(topRowEnd).toBeGreaterThan(topRowMiddle)
    expect(bottomRow).toBeGreaterThan(topRowEnd)
    expect(html).toContain("Nguyễn Văn A")
  })

  it("renders a signature line fallback when requester name is missing", () => {
    const html = buildRepairRequestSheetHtml(
      {
        ...request,
        nguoi_yeu_cau: null,
      },
      {
        organizationName: "CDC Cần Thơ",
        logoUrl: "https://example.com/logo.png",
      }
    )

    const requesterSection = html.slice(
      html.indexOf("NGƯỜI ĐỀ NGHỊ"),
      html.indexOf("BAN GIÁM ĐỐC")
    )

    expect(requesterSection).toContain('<div class="sig-line"></div>')
    expect(requesterSection).not.toContain('class="sig-name"')
  })

  it("centers the department name in the department field", () => {
    const deptValueBlock = REPAIR_SHEET_STYLES.slice(
      REPAIR_SHEET_STYLES.indexOf(".dept-row .dept-value"),
      REPAIR_SHEET_STYLES.indexOf("/* ── Section Title ── */")
    )

    expect(deptValueBlock).toContain(".dept-row .dept-value")
    expect(deptValueBlock).toContain("text-align: center;")
  })
})
