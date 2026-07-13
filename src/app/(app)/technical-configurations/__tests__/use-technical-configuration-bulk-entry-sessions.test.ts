import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useTechnicalConfigurationBulkEntrySessions } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import type { TechnicalConfigurationBulkEntryPreview } from "@/app/(app)/technical-configurations/bulk-entry-utils"

const preview: TechnicalConfigurationBulkEntryPreview = {
  rows: [{ sourceLine: 1, requirementText: "Yêu cầu hợp lệ", error: null }],
  canAccept: true,
}

describe("useTechnicalConfigurationBulkEntrySessions", () => {
  it("keeps independent group buffers and invalidates only the edited preview", () => {
    const { result } = renderHook(() => useTechnicalConfigurationBulkEntrySessions())

    act(() => {
      result.current.setInput("group-1", "Yêu cầu 1")
      result.current.setPreview("group-1", preview)
      result.current.setInput("group-2", "Yêu cầu 2")
      result.current.setPreview("group-2", preview)
    })

    act(() => {
      result.current.setInput("group-1", "Yêu cầu 1 đã sửa")
    })

    expect(result.current.getSession("group-1")).toEqual({
      input: "Yêu cầu 1 đã sửa",
      preview: null,
    })
    expect(result.current.getSession("group-2")).toEqual({
      input: "Yêu cầu 2",
      preview,
    })
  })

  it("clears one session and removes orphaned group sessions", () => {
    const { result } = renderHook(() => useTechnicalConfigurationBulkEntrySessions())

    act(() => {
      result.current.setInput("group-1", "Yêu cầu 1")
      result.current.setInput("group-2", "Yêu cầu 2")
      result.current.clearSession("group-1")
      result.current.syncGroupKeys(["group-1"])
    })

    expect(result.current.getSession("group-1")).toEqual({ input: "", preview: null })
    expect(result.current.getSession("group-2")).toEqual({ input: "", preview: null })
  })

  it("reports pending input only for parser-meaningful buffers", () => {
    const { result } = renderHook(() => useTechnicalConfigurationBulkEntrySessions())

    act(() => {
      result.current.setInput("group-1", "\u200B\u2060")
    })
    expect(result.current.hasPendingInput).toBe(false)

    act(() => {
      result.current.setInput("group-1", "Yêu cầu hợp lệ")
    })
    expect(result.current.hasPendingInput).toBe(true)

    act(() => {
      result.current.clearAll()
    })
    expect(result.current.hasPendingInput).toBe(false)
  })

  it("replaces and clears recently accepted criterion keys", () => {
    const { result } = renderHook(() => useTechnicalConfigurationBulkEntrySessions())

    act(() => {
      result.current.setRecentlyAccepted(["criterion-1", "criterion-2"])
    })
    expect([...result.current.recentlyAcceptedCriterionKeys]).toEqual([
      "criterion-1",
      "criterion-2",
    ])

    act(() => {
      result.current.setRecentlyAccepted(["criterion-3"])
    })
    expect([...result.current.recentlyAcceptedCriterionKeys]).toEqual(["criterion-3"])

    act(() => {
      result.current.clearRecentHighlights()
    })
    expect(result.current.recentlyAcceptedCriterionKeys.size).toBe(0)
  })
})
