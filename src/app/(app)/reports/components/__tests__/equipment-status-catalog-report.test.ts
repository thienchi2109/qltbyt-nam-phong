import { describe, expect, it } from "vitest"
import { buildExportSheets } from "../export-report-dialog.utils"
import {
  distribution,
  statusCatalog,
  statusCounts,
} from "@/hooks/__tests__/equipment-status-distribution-fixtures"

describe("actual catalog inventory report export utility", () => {
  it("reconciles actual RPC unknown statuses in khac for all export sheets", () => {
    const { "Giá trị lịch sử": historical, ...knownCounts } = statusCounts
    const rpcCounts = { ...knownCounts, khac: knownCounts.khac + historical }
    const group = { name: "Khoa Nội", total: 8, ...rpcCounts }
    const rpcData = {
      ...distribution,
      statusCounts: rpcCounts,
      byDepartment: [group],
      byLocation: [{ ...group, name: "101" }],
    }
    const sheets = buildExportSheets({
      data: [],
      summary: { totalImported: 0, totalExported: 0, currentStock: 8, netChange: 0 },
      dateRange: { from: new Date("2026-01-01"), to: new Date("2026-01-31") },
      department: "all",
      distribution: rpcData,
    })
    const overall = sheets.find((sheet) => sheet.name === "Phân bố trạng thái")!
    expect(overall.data).toContainEqual({ "Trạng thái": "Khác", "Số lượng": 2, "Tỷ lệ (%)": 25 })
    expect(
      overall.data.reduce((sum, row) => sum + ("Số lượng" in row ? Number(row["Số lượng"]) : 0), 0)
    ).toBe(8)
    for (const name of ["Trạng thái theo khoa", "Trạng thái theo vị trí"]) {
      expect(sheets.find((sheet) => sheet.name === name)!.data[0]).toMatchObject({
        Khác: 2,
        Tổng: 8,
      })
      expect(sheets.find((sheet) => sheet.name === name)!.data[0]).not.toHaveProperty(
        "Giá trị lịch sử"
      )
    }
  })
  it("exports catalog zero, inactive, future and unknown rows in overall, department and location sheets", () => {
    const sheets = buildExportSheets({
      data: [],
      summary: { totalImported: 0, totalExported: 0, currentStock: 8, netChange: 0 },
      dateRange: { from: new Date("2026-01-01"), to: new Date("2026-01-31") },
      department: "all",
      distribution,
    })
    const overall = sheets.find((sheet) => sheet.name === "Phân bố trạng thái")!
    expect(overall.data).toContainEqual({
      "Trạng thái": "Đang đánh giá kỹ thuật",
      "Số lượng": 2,
      "Tỷ lệ (%)": 25,
    })
    expect(overall.data).toContainEqual({
      "Trạng thái": "Trạng thái đã ngừng cấp",
      "Số lượng": 1,
      "Tỷ lệ (%)": 12.5,
    })
    expect(overall.data).toContainEqual({
      "Trạng thái": "Giá trị lịch sử",
      "Số lượng": 1,
      "Tỷ lệ (%)": 12.5,
    })
    expect(overall.data.at(-1)).toMatchObject({ "Trạng thái": "Thanh lý nội bộ", "Số lượng": 1 })
    expect(
      overall.data.reduce((sum, row) => sum + ("Số lượng" in row ? Number(row["Số lượng"]) : 0), 0)
    ).toBe(8)
    for (const name of ["Trạng thái theo khoa", "Trạng thái theo vị trí"]) {
      const sheet = sheets.find((value) => value.name === name)!
      expect(sheet.data[0]).toMatchObject({
        "Đang đánh giá kỹ thuật": 2,
        "Trạng thái đã ngừng cấp": 1,
        "Giá trị lịch sử": 1,
        "Thanh lý nội bộ": 1,
        "Chờ sửa chữa": 0,
        Khác: 1,
        Tổng: 8,
      })
    }
    expect(statusCatalog).toHaveLength(9)
  })
})
