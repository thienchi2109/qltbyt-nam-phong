import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TechnicalConfigurationDossierWire } from "../types"
import { TechnicalConfigurationWorkspaceShell } from "../_components/TechnicalConfigurationWorkspaceShell"

vi.mock("../_components/TechnicalConfigurationBaselineTab", () => ({
  TechnicalConfigurationBaselineTab: () => <div>Baseline workspace</div>,
}))
vi.mock("../_components/TechnicalConfigurationBaselineEvidence", () => ({
  TechnicalConfigurationBaselineEvidence: () => <div>Evidence workspace</div>,
}))
vi.mock("../_components/TechnicalConfigurationReferenceProducts", () => ({
  TechnicalConfigurationReferenceProducts: () => <div>Reference workspace</div>,
}))
vi.mock("../_components/TechnicalConfigurationSuppliers", () => ({
  TechnicalConfigurationSuppliers: () => <div>Option workspace</div>,
}))
vi.mock("../_components/comparison/TechnicalConfigurationComparisonTab", () => ({
  TechnicalConfigurationComparisonTab: ({
    onDirtyChange,
    onNavigationBlockedChange,
  }: {
    onDirtyChange?: (dirty: boolean) => void
    onNavigationBlockedChange?: (blocked: boolean) => void
  }) => (
    <div>
      <span>Comparison workspace</span>
      <button type="button" onClick={() => onDirtyChange?.(true)}>
        Mark comparison dirty
      </button>
      <button type="button" onClick={() => onNavigationBlockedChange?.(true)}>
        Mark comparison pending
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

describe("P12A2 comparison shell guard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("guards top-level tab and dossier navigation for a dirty evaluation draft", async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={onBack} />)

    await user.click(screen.getByRole("tab", { name: "So sánh & đánh giá" }))
    await user.click(screen.getByRole("button", { name: "Mark comparison dirty" }))
    await user.click(screen.getByRole("tab", { name: "Cấu hình cơ sở" }))

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Bỏ thay đổi chưa lưu?")
    await user.click(screen.getByRole("button", { name: "Tiếp tục chỉnh sửa" }))
    expect(screen.getByRole("tab", { name: "So sánh & đánh giá" })).toHaveAttribute(
      "data-state",
      "active"
    )

    await user.click(screen.getByRole("button", { name: "Danh sách hồ sơ" }))
    await user.click(screen.getByRole("button", { name: "Bỏ thay đổi" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("hard-blocks top-level tab and dossier navigation while evaluation save is pending", async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(<TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={onBack} />)

    await user.click(screen.getByRole("tab", { name: "So sánh & đánh giá" }))
    await user.click(screen.getByRole("button", { name: "Mark comparison pending" }))

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Danh sách hồ sơ" })).toBeDisabled()
    )
    expect(screen.getByRole("tab", { name: "Cấu hình cơ sở" })).toBeDisabled()
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
