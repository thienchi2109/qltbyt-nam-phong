import { writeFile } from "node:fs/promises"
import { describe, expect, it, vi } from "vitest"
import { createMultiSheetExcel, type MultiSheetExcelSheet } from "@/lib/excel-utils"
import { distribution } from "@/hooks/__tests__/equipment-status-distribution-fixtures"
import { buildExportSheets, type ExportSheet } from "../export-report-dialog.utils"
import { dateRange, maintenanceStats, sampleRows, summary } from "./export-report-workbook.fixtures"

const downloads = vi.hoisted(() => ({ blobs: [] as Blob[] }))

vi.mock("@/lib/excel-workbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/excel-workbook")>()
  return {
    ...actual,
    downloadBlob: (blob: Blob) => downloads.blobs.push(blob),
  }
})

async function exportAndRead(sheets: MultiSheetExcelSheet[], filename: string, saveSample = false) {
  downloads.blobs.length = 0
  await createMultiSheetExcel(sheets, filename)
  const blob = downloads.blobs.at(-1)
  if (!blob) throw new Error("The workbook was not downloaded")
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })

  if (saveSample && process.env.RPT1007_SAMPLE_XLSX) {
    await writeFile(process.env.RPT1007_SAMPLE_XLSX, Buffer.from(bytes))
  }

  const ExcelJS = await import("exceljs")
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes)
  return workbook
}

function buildSampleSheets(
  data = sampleRows(),
  maintenanceAvailable = true,
  maintenanceStatsUnavailable = false,
  allFacilities = false,
  distributionData = distribution
): ExportSheet[] {
  return buildExportSheets({
    data,
    summary,
    dateRange,
    department: "Khoa Hồi sức",
    distribution: distributionData,
    maintenanceStats: maintenanceAvailable ? maintenanceStats : undefined,
    maintenanceStatsUnavailable,
    usageAnalytics: {
      overview: { total_sessions: 14, active_sessions: 2, total_usage_time: 120 },
      daily: [
        {
          date: "2026-01-12",
          session_count: 2,
          total_usage_time: 40,
          unique_users: 1,
          unique_equipment: 2,
        },
      ],
    },
    reportScope: {
      facility: "Cơ sở #42",
      dataset: "Thiết bị thường",
      searchTerm: "máy thở",
      usageDays: 31,
      allFacilities,
    },
  })
}

describe("Reports Excel workbook serialization", () => {
  it("keeps report content and serializes the designed overview and print-ready tables", async () => {
    const workbook = await exportAndRead(buildSampleSheets(), "rpt-1007-synthetic.xlsx", true)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Tổng quan",
      "Chi tiết giao dịch",
      "Thống kê giao dịch",
      "Phân bố trạng thái",
      "Trạng thái theo khoa",
      "Trạng thái theo vị trí",
      "Sửa chữa - Tổng quan",
      "Bảo trì - Tổng quan",
      "Sử dụng TB - Tổng quan",
      "Sử dụng TB - Theo ngày",
    ])

    const overview = workbook.getWorksheet("Tổng quan")!
    expect(overview.getCell("A1").value).toBe("BÁO CÁO TỔNG HỢP THIẾT BỊ")
    expect(overview.getCell("A1").font).toMatchObject({ name: "Aptos", size: 18, bold: true })
    expect(overview.getCell("A6").value).toBe("TỔNG QUAN")
    expect(overview.getCell("A7").value).toBe("Thiết bị nhập:")
    expect(overview.getCell("C7").value).toBe("Thiết bị xuất:")
    expect(overview.getCell("E7").value).toBe("Tồn kho hiện tại:")
    expect(overview.getCell("G7").value).toBe("Biến động thuần:")
    expect(overview.getCell("A8").value).toBe(7)
    expect(overview.getCell("C8").value).toBe(8)
    expect(overview.getCell("E8").value).toBe(42)
    expect(overview.getCell("G8").value).toBe(-1)
    expect(overview.getCell("A8").font.size).toBe(22)
    expect(overview.getCell("A8").numFmt).toBe("#,##0")
    expect(overview.getCell("G8").numFmt).toBe("+#,##0;-#,##0;0")
    expect(overview.getCell("A7").isMerged).toBe(true)
    expect(overview.getCell("B7").isMerged).toBe(true)
    expect(overview.getCell("A3").value).toBe("Đơn vị: Cơ sở #42 · Tập dữ liệu: Thiết bị thường")
    expect(overview.getCell("A4").value).toContain("Dòng chi tiết trong file: 3")
    expect(overview.getCell("A5").value).toContain("KPI và chi tiết có phạm vi tổng hợp khác nhau")
    expect(overview.getCell("A10").value).toContain(
      "Tồn kho hiện tại theo dữ liệu hiện có từ nguồn"
    )
    expect(overview.getCell("A10").value).toContain("KPI và chi tiết có phạm vi tổng hợp khác nhau")

    const detail = workbook.getWorksheet("Chi tiết giao dịch")!
    expect(detail.getRow(4).values.slice(1)).toEqual([
      "Ngày",
      "Mã thiết bị",
      "Tên thiết bị",
      "Model",
      "Serial",
      "Khoa/Phòng",
      "Loại giao dịch",
      "Nguồn/Hình thức",
      "Lý do/Đích đến",
      "Giá trị",
    ])
    expect(detail.getCell("A5").value).toBe("02/01/2026")
    expect(detail.getCell("C5").value).toBe("Máy thở hồi sức với tên dài để kiểm tra wrap")
    expect(detail.getCell("J5").value).toBe(1_250_000)
    expect(detail.getCell("J5").numFmt).toContain("₫")
    expect(detail.getCell("J6").value).toBe("")
    expect(detail.getCell("J7").value).toBe(0)
    expect(detail.getCell("J7").numFmt).toContain("₫")
    expect(detail.getCell("C5").alignment.wrapText).toBe(true)
    expect(detail.getCell("C6").fill.fgColor?.argb).toBe("FFF3F6FA")
    expect(detail.getColumn(3).width).toBe(30)
    expect(detail.getCell("A4").font.color?.argb).toBe("FFFFFFFF")
    expect(detail.views[0]).toMatchObject({ state: "frozen", ySplit: 4, xSplit: 2 })
    expect(detail.autoFilter).toBe("A4:J7")
    expect(detail.pageSetup).toMatchObject({
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "4:4",
    })

    const statistics = workbook.getWorksheet("Thống kê giao dịch")!
    expect(statistics.getCell("B5").value).toBe(1)
    expect(statistics.getCell("C5").value).toBe(2)
    expect(statistics.getCell("D5").value).toBe(3)
    expect(statistics.getCell("D5").numFmt).toBe("#,##0")

    const statuses = workbook.getWorksheet("Phân bố trạng thái")!
    let activeRowNumber = 0
    let historicalRowNumber = 0
    let zeroStatusRowNumber = 0
    statuses.eachRow((row, rowNumber) => {
      if (row.getCell(1).value === "Hoạt động") activeRowNumber = rowNumber
      if (row.getCell(1).value === "Giá trị lịch sử") historicalRowNumber = rowNumber
      if (row.getCell(1).value === "Chờ sửa chữa") zeroStatusRowNumber = rowNumber
    })
    expect(activeRowNumber).toBeGreaterThan(0)
    expect(statuses.getCell(activeRowNumber, 2).value).toBe(2)
    expect(statuses.getCell(activeRowNumber, 2).numFmt).toBe("#,##0")
    expect(statuses.getCell(activeRowNumber, 3).value).toBe(25)
    expect(statuses.getCell(activeRowNumber, 3).numFmt).toBe('0.0"%"')
    expect(statuses.getCell(historicalRowNumber, 2).value).toBe(1)
    expect(statuses.getCell(zeroStatusRowNumber, 2).value).toBe(0)
    expect(statuses.getColumn(1).width).toBe(28)

    const repair = workbook.getWorksheet("Sửa chữa - Tổng quan")!
    let totalCostRowNumber = 0
    let averageCompletedCostRowNumber = 0
    repair.eachRow((row, rowNumber) => {
      if (row.getCell(1).value === "Tổng chi phí sửa chữa") totalCostRowNumber = rowNumber
      if (row.getCell(1).value === "Chi phí TB ca hoàn thành có ghi nhận chi phí") {
        averageCompletedCostRowNumber = rowNumber
      }
    })
    expect(totalCostRowNumber).toBeGreaterThan(0)
    expect(repair.getCell(totalCostRowNumber, 2).value).toBe(12_500_000)
    expect(repair.getCell(totalCostRowNumber, 2).numFmt).toContain("₫")
    expect(averageCompletedCostRowNumber).toBeGreaterThan(0)
    expect(repair.getCell(averageCompletedCostRowNumber, 2).value).toBe(6_250_000)
    expect(repair.getCell(averageCompletedCostRowNumber, 2).numFmt).toContain("₫")

    expect(workbook.getWorksheet("Sử dụng TB - Tổng quan")!.getCell("A2").value).toContain(
      "Tổng quan toàn thời gian"
    )
    expect(workbook.getWorksheet("Sử dụng TB - Theo ngày")!.getCell("A2").value).toContain(
      "từ ngày hiện tại trừ 31 ngày trở đi"
    )
  })

  it("round-trips large reports and legacy sheets without presentation", async () => {
    const sourceRows = sampleRows()
    const movementRows = Array.from({ length: 250 }, (_, index) => ({
      ...sourceRows[index % sourceRows.length],
      id: index % 2,
    }))
    const boundaryDistribution = {
      ...distribution,
      totalEquipment: 4,
      statusCounts: {
        ...distribution.statusCounts,
        hoat_dong: 1,
        cho_sua_chua: 0,
        "Thanh lý nội bộ": 4,
      },
    }
    const legacySheets: MultiSheetExcelSheet[] = [
      {
        name: "Legacy array",
        data: [
          [17, null, "first row"],
          [2, 3, "second row"],
        ],
        type: "array",
      },
      {
        name: "Legacy sparse JSON",
        data: [
          { first: 11, second: "a" },
          { first: 12, third: "b" },
        ],
        type: "json",
      },
    ]
    const workbook = await exportAndRead(
      [
        ...buildSampleSheets(movementRows, true, false, false, boundaryDistribution),
        ...legacySheets,
      ],
      "large-and-legacy-report.xlsx"
    )

    const detail = workbook.getWorksheet("Chi tiết giao dịch")!
    expect(detail.rowCount).toBe(254)
    expect(detail.autoFilter).toBe("A4:J254")

    const statuses = workbook.getWorksheet("Phân bố trạng thái")!
    const statusPercentages = new Map<string, { value: unknown; numFmt: string | undefined }>()
    statuses.eachRow((row) => {
      const label = row.getCell(1).value
      if (typeof label === "string") {
        const percentage = row.getCell(3)
        statusPercentages.set(label, { value: percentage.value, numFmt: percentage.numFmt })
      }
    })
    expect(statusPercentages.get("Chờ sửa chữa")).toEqual({ value: 0, numFmt: '0.0"%"' })
    expect(statusPercentages.get("Hoạt động")).toEqual({ value: 25, numFmt: '0.0"%"' })
    expect(statusPercentages.get("Thanh lý nội bộ")).toEqual({ value: 100, numFmt: '0.0"%"' })

    const legacyArray = workbook.getWorksheet("Legacy array")!
    expect(legacyArray.rowCount).toBe(2)
    expect(legacyArray.getRow(1).values.slice(1)).toEqual([17, undefined, "first row"])
    expect(legacyArray.getRow(2).values.slice(1)).toEqual([2, 3, "second row"])

    const legacyJson = workbook.getWorksheet("Legacy sparse JSON")!
    expect(legacyJson.rowCount).toBe(3)
    expect(legacyJson.getRow(1).values.slice(1)).toEqual(["first", "second", "third"])
    expect(legacyJson.getCell("A2").value).toBe(11)
    expect(legacyJson.getCell("C3").value).toBe("b")
  })

  it("shows a truthful empty-detail message without inventing data rows", async () => {
    const workbook = await exportAndRead(
      buildSampleSheets([], true, false, true),
      "empty-report.xlsx"
    )
    const detail = workbook.getWorksheet("Chi tiết giao dịch")!

    expect(detail.getRow(4).values.slice(1)).toEqual([
      "Ngày",
      "Mã thiết bị",
      "Tên thiết bị",
      "Model",
      "Serial",
      "Khoa/Phòng",
      "Loại giao dịch",
      "Nguồn/Hình thức",
      "Lý do/Đích đến",
      "Giá trị",
    ])
    expect(detail.getCell("A5").value).toBe(
      "Bảng chi tiết giao dịch không khả dụng khi xem tất cả cơ sở. Chọn một cơ sở cụ thể để xem chi tiết."
    )
    expect(detail.rowCount).toBe(5)
    expect(workbook.getWorksheet("Tổng quan")!.getCell("A4").value).toContain(
      "Dòng chi tiết trong file: 0"
    )
  })

  it("marks failed optional maintenance data unavailable without exporting zero metrics", async () => {
    const workbook = await exportAndRead(
      buildSampleSheets(sampleRows(), false, true),
      "failed-maintenance.xlsx"
    )
    const maintenance = workbook.getWorksheet("Sửa chữa - Tổng quan")

    expect(maintenance).toBeDefined()
    expect(maintenance!.getCell("A5").value).toBe(
      "Không có số liệu sửa chữa và bảo trì khả dụng tại thời điểm xuất; các chỉ số được lược khỏi tệp."
    )
    expect(maintenance!.getCell("B5").value).toBeNull()
  })
})
