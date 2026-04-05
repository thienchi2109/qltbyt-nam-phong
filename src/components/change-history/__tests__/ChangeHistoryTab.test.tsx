/**
 * Tests for the shared ChangeHistoryTab presentation component.
 * Covers loading, empty, populated, and edge-case states.
 * @module components/change-history/__tests__/ChangeHistoryTab.test
 */
import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ChangeHistoryEntry } from "../ChangeHistoryTypes"
import { ChangeHistoryTab } from "../ChangeHistoryTab"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseEntry: ChangeHistoryEntry = {
  id: "1",
  occurredAt: "2026-04-04T08:00:00.000Z",
  actionLabel: "Tạo yêu cầu",
  actorName: "Nguyễn Văn A",
  details: [{ label: "Trạng thái", value: "Đã duyệt" }],
}

const entryNullActor: ChangeHistoryEntry = {
  ...baseEntry,
  id: "2",
  actorName: null,
}

const entryEmptyDetails: ChangeHistoryEntry = {
  ...baseEntry,
  id: "3",
  details: [],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChangeHistoryTab", () => {
  it("renders skeleton placeholders when loading", () => {
    render(<ChangeHistoryTab entries={[]} isLoading={true} />)

    // Should render at least one skeleton element (role="status" or data-testid)
    const skeletons = screen.getAllByTestId("change-history-skeleton")
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  it("renders empty state copy when entries is empty and not loading", () => {
    render(<ChangeHistoryTab entries={[]} isLoading={false} />)

    expect(screen.getByText(/chưa có lịch sử/i)).toBeInTheDocument()
  })

  it("renders populated timeline with timestamp, action, actor, and details", () => {
    render(<ChangeHistoryTab entries={[baseEntry]} isLoading={false} />)

    // Action label
    expect(screen.getByText("Tạo yêu cầu")).toBeInTheDocument()

    // Actor name
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument()

    // Detail row
    expect(screen.getByText("Trạng thái")).toBeInTheDocument()
    expect(screen.getByText("Đã duyệt")).toBeInTheDocument()

    // Timestamp (formatted — we just check something date-ish renders)
    expect(screen.getByText(/04\/04\/2026/)).toBeInTheDocument()
  })

  it("handles actorName: null gracefully without crashing", () => {
    render(<ChangeHistoryTab entries={[entryNullActor]} isLoading={false} />)

    // Action label should still render
    expect(screen.getByText("Tạo yêu cầu")).toBeInTheDocument()

    // Actor "Nguyễn Văn A" should NOT be present
    expect(screen.queryByText("Nguyễn Văn A")).not.toBeInTheDocument()
  })

  it("handles details: [] gracefully — renders timeline item without detail rows", () => {
    render(
      <ChangeHistoryTab entries={[entryEmptyDetails]} isLoading={false} />
    )

    // Action label renders
    expect(screen.getByText("Tạo yêu cầu")).toBeInTheDocument()

    // The detail label from baseEntry should NOT be present
    expect(screen.queryByText("Trạng thái")).not.toBeInTheDocument()
  })

  it("renders multiple entries in chronological order", () => {
    const entries: ChangeHistoryEntry[] = [
      { ...baseEntry, id: "a", actionLabel: "Bước 1" },
      { ...baseEntry, id: "b", actionLabel: "Bước 2" },
    ]

    render(<ChangeHistoryTab entries={entries} isLoading={false} />)

    const step1 = screen.getByText("Bước 1")
    const step2 = screen.getByText("Bước 2")
    expect(step1).toBeInTheDocument()
    expect(step2).toBeInTheDocument()

    // Verify DOM order: step1 must precede step2
    // DOCUMENT_POSITION_FOLLOWING (4) means step2 comes after step1
    // eslint-disable-next-line no-bitwise
    expect(step1.compareDocumentPosition(step2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
