import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TechnicalConfigurationDossierWire } from "../types"
import { TechnicalConfigurationComparisonTab } from "../_components/comparison/TechnicalConfigurationComparisonTab"

const mocks = vi.hoisted(() => ({
  onDirtyChange: vi.fn(),
  onNavigationBlockedChange: vi.fn(),
  onRevisionChange: vi.fn(),
}))

vi.mock("../_hooks/useTechnicalConfigurationComparisonMatrix", () => ({
  useTechnicalConfigurationComparisonMatrix: () => ({
    baselineVersionId: null,
    versions: [],
    versionsQuery: { isLoading: false, isError: false },
    options: [],
    optionsQuery: { isLoading: false, isError: false },
    selectedOptions: [],
    visibleOptionIds: [],
    pinnedOptionIds: [],
    focusedOptionId: null,
    isSelectionLimitReached: false,
    comparison: {
      comparisonQuery: {
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      },
    },
    selectBaselineVersion: vi.fn(),
    loadMoreVersions: vi.fn(),
    retryVersions: vi.fn(),
    addOption: vi.fn(),
    removeOption: vi.fn(),
    toggleOptionVisibility: vi.fn(),
    toggleOptionPin: vi.fn(),
    focusOption: vi.fn(),
    exitFocusMode: vi.fn(),
    setPage: vi.fn(),
  }),
}))

vi.mock("../_components/comparison/TechnicalConfigurationMatrixToolbar", () => ({
  TechnicalConfigurationMatrixToolbar: () => <div>Matrix toolbar</div>,
}))

vi.mock("../_components/comparison/TechnicalConfigurationMatrix", () => ({
  TechnicalConfigurationMatrix: () => <div>Matrix view</div>,
}))

vi.mock("../_components/comparison/TechnicalConfigurationCriterionPanel", () => ({
  TechnicalConfigurationCriterionPanel: () => null,
}))

vi.mock("../_components/evaluation/TechnicalConfigurationEvaluationWorkspace", () => ({
  TechnicalConfigurationEvaluationWorkspace: ({
    onDirtyChange,
    onNavigationBlockedChange,
    onRevisionChange,
  }: {
    onDirtyChange?: (dirty: boolean) => void
    onNavigationBlockedChange?: (blocked: boolean) => void
    onRevisionChange?: (revision: number) => void
  }) => (
    <div>
      <span>Evaluation view</span>
      <button type="button" onClick={() => onDirtyChange?.(true)}>
        Mark evaluation dirty
      </button>
      <button type="button" onClick={() => onNavigationBlockedChange?.(true)}>
        Mark evaluation pending
      </button>
      <button type="button" onClick={() => onRevisionChange?.(9)}>
        Bump evaluation revision
      </button>
    </div>
  ),
}))

const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy siêu âm",
  name: "Cấu hình máy siêu âm",
  description: null,
  revision: 6,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-30T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-30T00:00:00.000Z",
  updated_by: 1,
}

function renderComparisonTab() {
  return render(
    <TechnicalConfigurationComparisonTab
      dossier={dossier}
      onDirtyChange={mocks.onDirtyChange}
      onNavigationBlockedChange={mocks.onNavigationBlockedChange}
      onRevisionChange={mocks.onRevisionChange}
    />
  )
}

describe("P12A2 comparison evaluation mode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("guards dirty internal mode changes and discards only after confirmation", async () => {
    const user = userEvent.setup()
    renderComparisonTab()

    expect(screen.getByText("Matrix view")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Đánh giá" }))
    await user.click(screen.getByRole("button", { name: "Mark evaluation dirty" }))
    await waitFor(() => expect(mocks.onDirtyChange).toHaveBeenLastCalledWith(true))

    await user.click(screen.getByRole("tab", { name: "Ma trận" }))
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Bỏ thay đổi chưa lưu?")
    await user.click(screen.getByRole("button", { name: "Hủy" }))
    expect(screen.getByRole("tab", { name: "Đánh giá" })).toHaveAttribute("data-state", "active")

    await user.click(screen.getByRole("tab", { name: "Ma trận" }))
    await user.click(screen.getByRole("button", { name: "Bỏ thay đổi" }))

    expect(screen.getByRole("tab", { name: "Ma trận" })).toHaveAttribute("data-state", "active")
    await waitFor(() => expect(mocks.onDirtyChange).toHaveBeenLastCalledWith(false))
  })

  it("hard-blocks mode changes during save and forwards workspace revision", async () => {
    const user = userEvent.setup()
    renderComparisonTab()

    await user.click(screen.getByRole("tab", { name: "Đánh giá" }))
    await user.click(screen.getByRole("button", { name: "Bump evaluation revision" }))
    expect(mocks.onRevisionChange).toHaveBeenCalledWith(9)

    await user.click(screen.getByRole("button", { name: "Mark evaluation pending" }))
    await waitFor(() => expect(screen.getByRole("tab", { name: "Ma trận" })).toBeDisabled())
    expect(mocks.onNavigationBlockedChange).toHaveBeenLastCalledWith(true)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
