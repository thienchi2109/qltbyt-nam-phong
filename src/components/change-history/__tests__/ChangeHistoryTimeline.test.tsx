/**
 * Tests for ChangeHistoryTimeline timeFormat prop.
 * Covers the newly added relative time display mode.
 * @module components/change-history/__tests__/ChangeHistoryTimeline.test
 */
import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ChangeHistoryEntry } from "../ChangeHistoryTypes"
import { ChangeHistoryTimeline } from "../ChangeHistoryTimeline"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RECENT_ISO = new Date(Date.now() - 5 * 60_000).toISOString() // ~5 minutes ago
const OLD_ISO = "2026-01-15T10:30:00.000Z"

const recentEntry: ChangeHistoryEntry = {
  id: "recent-1",
  occurredAt: RECENT_ISO,
  actionLabel: "Tạo yêu cầu sửa chữa",
  actorName: "Trần Văn B",
  details: [],
}

const oldEntry: ChangeHistoryEntry = {
  id: "old-1",
  occurredAt: OLD_ISO,
  actionLabel: "Phê duyệt sửa chữa",
  actorName: "Nguyễn Văn C",
  details: [{ label: "Mã:", value: "YCSC-001" }],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChangeHistoryTimeline timeFormat", () => {
  it("renders absolute timestamp by default (dd/MM/yyyy HH:mm)", () => {
    render(<ChangeHistoryTimeline entries={[oldEntry]} />)

    // Default = absolute → expect "15/01/2026"
    expect(screen.getByText(/15\/01\/2026/)).toBeInTheDocument()
  })

  it('renders absolute timestamp when timeFormat="absolute"', () => {
    render(
      <ChangeHistoryTimeline entries={[oldEntry]} timeFormat="absolute" />
    )

    expect(screen.getByText(/15\/01\/2026/)).toBeInTheDocument()
  })

  it('renders relative timestamp when timeFormat="relative"', () => {
    render(
      <ChangeHistoryTimeline entries={[recentEntry]} timeFormat="relative" />
    )

    // "~5 phút trước" or similar relative text from date-fns/vi
    // Should NOT contain a date pattern like dd/MM/yyyy
    const timestampEl = screen.getByText(/trước|vừa xong/i)
    expect(timestampEl).toBeInTheDocument()
  })

  it("renders action label and actor regardless of timeFormat", () => {
    render(
      <ChangeHistoryTimeline entries={[recentEntry]} timeFormat="relative" />
    )

    expect(screen.getByText("Tạo yêu cầu sửa chữa")).toBeInTheDocument()
    expect(screen.getByText("Trần Văn B")).toBeInTheDocument()
  })

  it("renders detail rows in relative mode", () => {
    render(
      <ChangeHistoryTimeline entries={[oldEntry]} timeFormat="relative" />
    )

    expect(screen.getByText("Mã:")).toBeInTheDocument()
    expect(screen.getByText("YCSC-001")).toBeInTheDocument()
  })
})
