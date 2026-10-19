import ExcelJS from "exceljs"
import { readFile, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { describe, expect, it } from "vitest"
import { temperatureExportSchema } from "@/lib/temperature-monitoring-export-contract"
import { prepareTemperatureExport } from "@/lib/temperature-monitoring-export"
import { acquireTemperatureExport } from "@/lib/temperature-monitoring-export-limiter"

describe("temperature export boundaries", () => {
  it("accepts a full historical leap year beyond 90 days, rejects crossing years and invalid dates", () => {
    expect(
      temperatureExportSchema.safeParse({ from: "2024-01-01", to: "2024-12-31" }).success
    ).toBe(true)
    for (const dates of [
      { from: "2024-12-31", to: "2025-01-01" },
      { from: "2023-02-29", to: "2023-03-01" },
      { from: "0000-01-01", to: "0000-12-31" },
      { from: "2024-03-01", to: "2024-02-29" },
      { from: "2024-01-01", to: "2024-12-31", status: "Chưa ghi" },
    ])
      expect(temperatureExportSchema.safeParse(dates).success).toBe(false)
  })

  it("commits cursor pages to real XLSX and keeps zero, NULL, literal text and child membership", async () => {
    const calls: Record<string, unknown>[] = []
    const artifact = await prepareTemperatureExport(
      { from: "2024-01-01", to: "2024-12-31" },
      "7",
      async (args) => {
        calls.push(args)
        const reading = args.p_dataset === "readings"
        return {
          items: reading
            ? [
                {
                  id: args.p_cursor
                    ? "00000000-0000-4000-8000-000000000002"
                    : "00000000-0000-4000-8000-000000000001",
                  original_value_c: args.p_cursor ? null : 0,
                  effective_value_c: args.p_cursor ? null : 4,
                  effective_unable_reason: args.p_cursor
                    ? { reason: "thermometer unavailable" }
                    : null,
                  lower_c: 2,
                  upper_c: 8,
                  note: "=1+1",
                  operator_user_id: 7,
                  state: { confirmed_by: 8, slot_status: "Đã ghi" },
                },
              ]
            : args.p_dataset === "amendments"
              ? [
                  {
                    reason: "corrected source",
                    value_c: 4,
                    author_user_id: 7,
                    decision_actor_user_id: 8,
                    decision_reason: "approved evidence",
                  },
                ]
              : args.p_dataset === "deviations"
                ? [
                    {
                      immediate_action: "move samples",
                      owner_user_id: 9,
                      verified_by: 8,
                      triggering_snapshot: { lower_c: 2, upper_c: 8 },
                    },
                  ]
                : [{ action: "reviewed", actor_user_id: 8, reason: "evidence retained" }],
          next_cursor: reading && !args.p_cursor ? { id: "first" } : null,
          page_read_at: "2026-10-19T00:00:00Z",
        }
      },
      AbortSignal.timeout(5000)
    )
    try {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.readFile(artifact.path)
      const sheet = workbook.getWorksheet("Readings")!
      const headers = sheet.getRow(1).values as string[]
      expect(sheet.getRow(2).getCell(headers.indexOf("original_value_c")).value).toBe(0)
      expect(sheet.getRow(3).getCell(headers.indexOf("original_value_c")).value).toBeNull()
      expect(sheet.getRow(2).getCell(headers.indexOf("note")).value).toBe("=1+1")
      const value = (sheetName: string, row: number, column: string) => {
        const target = workbook.getWorksheet(sheetName)!
        return target.getRow(row).getCell((target.getRow(1).values as string[]).indexOf(column))
          .value
      }
      expect(value("Readings", 2, "effective_value_c")).toBe(4)
      expect(value("Readings", 3, "effective_value_c")).toBeNull()
      expect(value("Readings", 3, "effective_unable_reason")).toBe(
        '{"reason":"thermometer unavailable"}'
      )
      expect(JSON.parse(String(value("Readings", 3, "state")))).toEqual({
        confirmed_by: 8,
        slot_status: "Đã ghi",
      })
      expect(value("Readings", 2, "lower_c")).toBe(2)
      expect(value("Readings", 2, "upper_c")).toBe(8)
      expect(value("Amendments", 2, "reason")).toBe("corrected source")
      expect(value("Amendments", 2, "decision_actor_user_id")).toBe(8)
      expect(value("Amendments", 2, "decision_reason")).toBe("approved evidence")
      expect(value("Deviations", 2, "immediate_action")).toBe("move samples")
      expect(value("Deviations", 2, "owner_user_id")).toBe(9)
      expect(value("Deviations", 2, "verified_by")).toBe(8)
      expect(value("Deviation events", 2, "actor_user_id")).toBe(8)
      expect(value("Reading events", 2, "reason")).toBe("evidence retained")
      expect(
        calls
          .filter((c) => c.p_dataset !== "readings")
          .every((c) => Array.isArray(c.p_reading_ids) && c.p_reading_ids.length === 2)
      ).toBe(true)
      expect((await readFile(artifact.path)).subarray(0, 2).toString()).toBe("PK")
    } finally {
      await artifact.cleanup()
    }
    await expect(readFile(artifact.path)).rejects.toThrow()
  })

  it("rejects later page failure, cursor cycles and row/byte limits without returning a file", async () => {
    const filter = { from: "2024-01-01", to: "2024-12-31" }
    let page = 0
    await expect(
      prepareTemperatureExport(
        filter,
        "7",
        async () => {
          if (page++) throw new Error("database secret")
          return {
            items: [{ id: "00000000-0000-4000-8000-000000000001" }],
            next_cursor: { id: "a" },
            page_read_at: "now",
          }
        },
        AbortSignal.timeout(5000)
      )
    ).rejects.toThrow()
    await expect(
      prepareTemperatureExport(
        filter,
        "7",
        async () => ({ items: [], next_cursor: { id: "a" }, page_read_at: "now" }),
        AbortSignal.timeout(5000)
      )
    ).rejects.toThrow("cursor")
    for (const limits of [{ rows: 0 }, { bytes: 10 }]) {
      await expect(
        prepareTemperatureExport(
          filter,
          "7",
          async () => ({
            items: [{ id: "00000000-0000-4000-8000-000000000001" }],
            next_cursor: null,
            page_read_at: "now",
          }),
          AbortSignal.timeout(5000),
          limits
        )
      ).rejects.toThrow()
    }
  })

  it("releases active slots idempotently and enforces cooldown plus process concurrency", () => {
    const release = acquireTemperatureExport("limit-a", 1000)!
    expect(acquireTemperatureExport("limit-a", 1001)).toBeNull()
    const second = acquireTemperatureExport("limit-b", 1002)!
    expect(acquireTemperatureExport("limit-c", 1003)).toBeNull()
    release()
    release()
    second()
    for (let index = 0; index < 4; index++) acquireTemperatureExport("limit-a", 1010 + index)!()
    expect(acquireTemperatureExport("limit-a", 1020)).toBeNull()
    const afterWindow = acquireTemperatureExport("limit-a", 601_100)
    expect(afterWindow).not.toBeNull()
    afterWindow!()
  })

  it("cleans temporary files after mid-page cancellation and oversized Excel cells", async () => {
    const currentDirectories = async () =>
      (await readdir(tmpdir()))
        .filter((name) => name.startsWith(`temperature-export-${process.pid}-`))
        .sort()
    const before = await currentDirectories()
    const controller = new AbortController()
    await expect(
      prepareTemperatureExport(
        { from: "2024-01-01", to: "2024-12-31" },
        "7",
        async () => {
          controller.abort()
          return { items: [], next_cursor: null, page_read_at: "now" }
        },
        controller.signal
      )
    ).rejects.toThrow()
    await expect(
      prepareTemperatureExport(
        { from: "2024-01-01", to: "2024-12-31" },
        "7",
        async () => ({
          items: [{ id: "00000000-0000-4000-8000-000000000001", note: "x".repeat(32768) }],
          next_cursor: null,
          page_read_at: "now",
        }),
        AbortSignal.timeout(5000)
      )
    ).rejects.toThrow("cell limit")
    expect(await currentDirectories()).toEqual(before)
  })

  it("streams 64 MiB of raw cells with bounded heap instead of retaining workbook rows", async () => {
    let count = 0
    const initialHeap = process.memoryUsage().heapUsed
    let peakHeap = initialHeap
    const artifact = await prepareTemperatureExport(
      { from: "2024-01-01", to: "2024-12-31" },
      "7",
      async (args) => {
        peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed)
        if (args.p_dataset !== "readings")
          return { items: [], next_cursor: null, page_read_at: "now" }
        const items = Array.from({ length: 25 }, () => ({
          id: `00000000-0000-4000-8000-${String(++count).padStart(12, "0")}`,
          note: `${count}${"x".repeat(8190)}`,
        }))
        return { items, next_cursor: count < 8000 ? { page: count } : null, page_read_at: "now" }
      },
      AbortSignal.timeout(20_000)
    )
    try {
      expect(count).toBe(8000)
      expect(peakHeap - initialHeap).toBeLessThan(48 * 1024 * 1024)
    } finally {
      await artifact.cleanup()
    }
  }, 25_000)
})
