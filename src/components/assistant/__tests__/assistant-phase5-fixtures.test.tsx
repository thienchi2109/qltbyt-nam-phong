import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

type FixtureDocument = {
  dark_path_only: boolean
  cases: Array<{ id: string; payload: Record<string, unknown> }>
}

describe("shared AI Phase 5 UI fixtures", () => {
  it("covers the current text/tool/artifact/error/cancel/completion contracts", () => {
    const fixture = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          "openspec/changes/refactor-ai-into-shared-go-service/phase-5/fixtures/ui-contract.json"
        ),
        "utf8"
      )
    ) as FixtureDocument
    const ids = new Set(fixture.cases.map((item) => item.id))

    expect(fixture.dark_path_only).toBe(true)
    expect(ids).toEqual(
      new Set([
        "text",
        "tool-card",
        "report-chart",
        "repair-draft",
        "sanitized-error",
        "stop-cancel",
        "stream-completion",
        "markdown-table",
      ])
    )
    const draft = fixture.cases.find((item) => item.id === "repair-draft")?.payload
    expect(draft).toMatchObject({ draft_only: true, submit: false })
    expect(draft?.uiArtifact).toMatchObject({
      kind: "repairRequestDraft",
      current_turn: true,
      rawPayload: { equipmentId: 42 },
    })

    const reportChart = fixture.cases.find((item) => item.id === "report-chart")?.payload
    expect(reportChart?.uiArtifact).toMatchObject({
      kind: "reportChart",
      chart: { type: "bar", data: [{ khoa_phong_quan_ly: "ICU", so_luong: 12 }] },
    })

    const sanitizedError = fixture.cases.find((item) => item.id === "sanitized-error")?.payload
    expect(sanitizedError).toMatchObject({
      type: "error",
      code: "provider_quota",
      message: "Nhà cung cấp mô hình đang tạm thời quá tải. Vui lòng thử lại sau.",
    })

    const cancellation = fixture.cases.find((item) => item.id === "stop-cancel")?.payload
    expect(cancellation).toMatchObject({ requestSignal: "aborted", code: "cancelled" })

    const completion = fixture.cases.find((item) => item.id === "stream-completion")?.payload
    expect(completion?.events).toEqual([
      "start",
      "text-delta",
      "tool-output-available",
      "finish",
      "DONE",
    ])

    const markdownTable = fixture.cases.find((item) => item.id === "markdown-table")?.payload as {
      chunks: string[]
      expected: {
        columns: string[]
        rows: string[][]
        unicode: boolean
        escaped_pipe: boolean
        safe_cells: boolean
      }
      layout: { overflow_x_auto: boolean; min_w_0: boolean }
    }
    expect(markdownTable.chunks).toHaveLength(5)
    expect(markdownTable.chunks[0]).toContain("| Tình")
    expect(markdownTable.chunks[1]).toContain("| -")
    expect(markdownTable.chunks[2]).toContain("| Máy siêu âm")
    expect(markdownTable.chunks[2]).toContain("Chưa")
    expect(markdownTable.chunks[3]).toContain(" có dữ")
    expect(markdownTable.chunks[3]).toContain("\\|")
    expect(markdownTable.chunks[4]).toContain("onerror")
    expect(markdownTable.expected).toEqual({
      columns: ["Thiết bị", "Tình trạng", "Ghi chú"],
      rows: [
        ["Máy siêu âm", "Hoạt động", "Chưa có dữ liệu"],
        ["Máy X|Y", "Hỏng", '<img src=x onerror="alert(1)">'],
      ],
      unicode: true,
      escaped_pipe: true,
      safe_cells: true,
    })
    expect(markdownTable.layout).toEqual({ overflow_x_auto: true, min_w_0: true })
  })
})
