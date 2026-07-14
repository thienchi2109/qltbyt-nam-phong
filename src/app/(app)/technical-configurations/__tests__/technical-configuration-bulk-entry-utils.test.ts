import { describe, expect, it } from "vitest"

import {
  hasTechnicalConfigurationBulkEntryInput,
  parseTechnicalConfigurationBulkEntry,
} from "@/app/(app)/technical-configurations/bulk-entry-utils"

describe("technical configuration bulk entry parser", () => {
  it("parses LF and CRLF rows while trimming text and preserving Vietnamese Unicode", () => {
    expect(
      parseTechnicalConfigurationBulkEntry(
        "  Nguồn điện ổn định  \r\nÁp lực vận hành ≥ 3 bar\nChế độ khử khuẩn tự động  "
      )
    ).toEqual({
      rows: [
        {
          sourceLine: 1,
          requirementText: "Nguồn điện ổn định",
          error: null,
        },
        {
          sourceLine: 2,
          requirementText: "Áp lực vận hành ≥ 3 bar",
          error: null,
        },
        {
          sourceLine: 3,
          requirementText: "Chế độ khử khuẩn tự động",
          error: null,
        },
      ],
      canAccept: true,
    })
  })

  it("ignores outer blank rows but keeps internal blank rows as validation errors", () => {
    expect(
      parseTechnicalConfigurationBulkEntry(
        "\n \r\n  Yêu cầu thứ nhất  \r\n \r\nYêu cầu thứ hai\n\n"
      )
    ).toEqual({
      rows: [
        {
          sourceLine: 3,
          requirementText: "Yêu cầu thứ nhất",
          error: null,
        },
        {
          sourceLine: 4,
          requirementText: "",
          error: "Nội dung yêu cầu là bắt buộc.",
        },
        {
          sourceLine: 5,
          requirementText: "Yêu cầu thứ hai",
          error: null,
        },
      ],
      canAccept: false,
    })
  })

  it("does not allow an empty preview to be accepted", () => {
    expect(parseTechnicalConfigurationBulkEntry("\n \r\n\t")).toEqual({
      rows: [],
      canAccept: false,
    })
  })

  it("strips zero-width characters from content edges", () => {
    expect(
      parseTechnicalConfigurationBulkEntry("\u200B\u2060\nYêu cầu hợp lệ\u200B\n\u2060\u200B")
    ).toEqual({
      rows: [
        {
          sourceLine: 2,
          requirementText: "Yêu cầu hợp lệ",
          error: null,
        },
      ],
      canAccept: true,
    })
  })

  it("treats all-zero-width input as empty", () => {
    expect(parseTechnicalConfigurationBulkEntry("\u200B\u2060")).toEqual({
      rows: [],
      canAccept: false,
    })
  })

  it.each([
    ["", false],
    ["   \n\t", false],
    ["\u200B\u2060", false],
    ["Yêu cầu kỹ thuật", true],
  ])("classifies parser-meaningful input %#", (input, expected) => {
    expect(hasTechnicalConfigurationBulkEntryInput(input)).toBe(expected)
  })
})
