import { describe, expect, it } from "vitest"

import {
  buildUsageLogCsv,
  buildUsageLogPrintHtml,
} from "../usage-log-print-builders"

const equipment = {
  id: 99,
  ten_thiet_bi: "Monitor",
  ma_thiet_bi: "TB-99",
  khoa_phong_quan_ly: "Khoa Xét nghiệm",
  hang_san_xuat: "Olympus",
  model: "CX-23",
  tinh_trang_hien_tai: "Hoạt động",
}

const usageLogs = [
  {
    id: 1,
    thiet_bi_id: 99,
    thoi_gian_bat_dau: "2026-04-15T01:00:00Z",
    thoi_gian_ket_thuc: "2026-04-15T02:00:00Z",
    trang_thai: "hoan_thanh" as const,
    created_at: "2026-04-15T01:00:00Z",
    updated_at: "2026-04-15T02:00:00Z",
    nguoi_su_dung: { full_name: "Nguyễn Văn A", khoa_phong: "Khoa Xét nghiệm" },
    tinh_trang_ban_dau: "Tốt",
    tinh_trang_ket_thuc: null,
    tinh_trang_thiet_bi: "Fallback legacy",
    ghi_chu: "Có thay đổi nhẹ",
  },
]

describe("usage log print builders", () => {
  it("includes split status columns in print HTML with fallback values", () => {
    const html = buildUsageLogPrintHtml({
      equipment,
      filteredLogs: usageLogs,
      tenantName: "QLTBYT",
      tenantLogoUrl: "https://example.com/logo.png",
      dateFrom: "",
      dateTo: "",
      now: new Date("2026-04-15T03:00:00Z"),
    })

    expect(html).toContain("Tình trạng ban đầu")
    expect(html).toContain("Tình trạng kết thúc")
    expect(html).toContain("Tốt")
    expect(html).toContain("Fallback legacy")
  })

  it("includes split status columns in CSV export with fallback values", () => {
    const csv = buildUsageLogCsv({
      equipment,
      filteredLogs: usageLogs,
      now: new Date("2026-04-15T03:00:00Z"),
    })

    expect(csv).toContain("Tình trạng ban đầu")
    expect(csv).toContain("Tình trạng kết thúc")
    expect(csv).toContain("Tốt")
    expect(csv).toContain("Fallback legacy")
  })

  it("escapes CSV quotes and neutralizes spreadsheet formulas in free-text cells", () => {
    const csv = buildUsageLogCsv({
      equipment,
      filteredLogs: [
        {
          ...usageLogs[0],
          tinh_trang_ban_dau: 'Kiểm tra "ABC"',
          ghi_chu: '=1+1 "quoted"',
        },
      ],
      now: new Date("2026-04-15T03:00:00Z"),
    })

    expect(csv).toContain(`"Kiểm tra ""ABC"""`)
    expect(csv).toContain(`"'=1+1 ""quoted"""`)
  })

  it("formats date-only print ranges without UTC day shifts", () => {
    const originalTz = process.env.TZ
    process.env.TZ = "America/Los_Angeles"

    try {
      const html = buildUsageLogPrintHtml({
        equipment,
        filteredLogs: usageLogs,
        tenantName: "QLTBYT",
        tenantLogoUrl: "https://example.com/logo.png",
        dateFrom: "2026-04-15",
        dateTo: "2026-04-16",
        now: new Date("2026-04-15T03:00:00Z"),
      })

      expect(html).toContain("(15/04/2026 - 16/04/2026)")
    } finally {
      process.env.TZ = originalTz
    }
  })

  it("rejects unsafe non-image data URIs for the printed tenant logo", () => {
    const html = buildUsageLogPrintHtml({
      equipment,
      filteredLogs: usageLogs,
      tenantName: "QLTBYT",
      tenantLogoUrl: "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      dateFrom: "",
      dateTo: "",
      now: new Date("2026-04-15T03:00:00Z"),
    })

    expect(html).toContain('<img src="" alt="Logo"')
  })
})
