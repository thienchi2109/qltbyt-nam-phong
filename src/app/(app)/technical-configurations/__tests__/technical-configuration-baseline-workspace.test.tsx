import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationWorkspaceShell } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"

const baselineTabMock = vi.hoisted(() => ({
  dirty: true,
  navigationBlocked: false,
}))

const baselineEvidenceMock = vi.hoisted(() => ({
  dirty: false,
  navigationBlocked: false,
}))

const supplierOptionsMock = vi.hoisted(() => ({
  dirty: false,
  navigationBlocked: false,
}))

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab",
  async () => {
    const ReactModule = await import("react")

    return {
      TechnicalConfigurationBaselineTab: ({
        dossier,
        onDirtyChange,
        onNavigationBlockedChange,
      }: {
        dossier: TechnicalConfigurationDossierWire
        onDirtyChange: (dirty: boolean) => void
        onNavigationBlockedChange?: (blocked: boolean) => void
      }) => {
        ReactModule.useEffect(() => {
          onDirtyChange(baselineTabMock.dirty)
          onNavigationBlockedChange?.(baselineTabMock.navigationBlocked)
          return () => {
            onDirtyChange(false)
            onNavigationBlockedChange?.(false)
          }
        }, [onDirtyChange, onNavigationBlockedChange])
        return (
          <div>
            <span>Baseline editor</span>
            <span>Baseline revision {dossier.revision}</span>
          </div>
        )
      },
    }
  }
)

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEvidence",
  async () => {
    const ReactModule = await import("react")

    return {
      TechnicalConfigurationBaselineEvidence: ({
        onDirtyChange,
        onNavigationBlockedChange,
      }: {
        onDirtyChange: (dirty: boolean) => void
        onNavigationBlockedChange?: (blocked: boolean) => void
      }) => {
        ReactModule.useEffect(() => {
          onDirtyChange(baselineEvidenceMock.dirty)
          onNavigationBlockedChange?.(baselineEvidenceMock.navigationBlocked)
        }, [onDirtyChange, onNavigationBlockedChange])
        return <div>Baseline evidence workspace</div>
      },
    }
  }
)

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers",
  async () => {
    const ReactModule = await import("react")

    return {
      TechnicalConfigurationSuppliers: ({
        dossier,
        onDirtyChange,
        onNavigationBlockedChange,
        onRevisionChange,
      }: {
        dossier: TechnicalConfigurationDossierWire
        onDirtyChange?: (dirty: boolean) => void
        onNavigationBlockedChange?: (blocked: boolean) => void
        onRevisionChange?: (revision: number) => void
      }) => {
        ReactModule.useEffect(() => {
          onDirtyChange?.(supplierOptionsMock.dirty)
          onNavigationBlockedChange?.(supplierOptionsMock.navigationBlocked)
          return () => {
            onDirtyChange?.(false)
            onNavigationBlockedChange?.(false)
          }
        }, [onDirtyChange, onNavigationBlockedChange])
        return (
          <div>
            <span>Supplier option workspace revision {dossier.revision}</span>
            <button type="button" onClick={() => onRevisionChange?.(4)}>
              Advance option revision
            </button>
          </div>
        )
      },
    }
  }
)

vi.mock(
  "@/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationComparisonTab",
  () => ({
    TechnicalConfigurationComparisonTab: () => <div>Comparison matrix workspace</div>,
  })
)

const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy lọc thận",
  name: "Cấu hình máy lọc thận",
  description: null,
  revision: 3,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-13T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-13T00:00:00.000Z",
  updated_by: 1,
}

describe("technical configuration baseline workspace integration", () => {
  it("uses an alert dialog before leaving a dirty dossier", async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const nativeConfirm = vi.spyOn(window, "confirm").mockReturnValue(false)

    try {
      render(<TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={onBack} />)
      await screen.findByText("Baseline editor")

      await user.click(screen.getByRole("button", { name: "Danh sách hồ sơ" }))

      expect(nativeConfirm).not.toHaveBeenCalled()
      const dialog = await screen.findByRole("alertdialog")
      expect(within(dialog).getByText("Bỏ thay đổi chưa lưu?")).toBeInTheDocument()
      expect(onBack).not.toHaveBeenCalled()

      await user.click(
        within(dialog).getByRole("button", {
          name: "Tiếp tục chỉnh sửa",
        })
      )
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
      expect(screen.getByText("Baseline editor")).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Danh sách hồ sơ" }))
      await user.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", {
          name: "Bỏ thay đổi",
        })
      )
      expect(onBack).toHaveBeenCalledTimes(1)
    } finally {
      nativeConfirm.mockRestore()
    }
  })

  it("uses an alert dialog before switching away from a dirty workspace", async () => {
    const user = userEvent.setup()
    const nativeConfirm = vi.spyOn(window, "confirm").mockReturnValue(false)

    try {
      render(<TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={vi.fn()} />)
      await screen.findByText("Baseline editor")

      await user.click(screen.getByRole("tab", { name: "Tài liệu & trích dẫn" }))

      expect(nativeConfirm).not.toHaveBeenCalled()
      expect(screen.queryByText("Baseline evidence workspace")).not.toBeInTheDocument()

      await user.click(
        within(await screen.findByRole("alertdialog")).getByRole("button", {
          name: "Bỏ thay đổi",
        })
      )

      expect(screen.getByText("Baseline evidence workspace")).toBeInTheDocument()
      expect(screen.queryByText("Baseline editor")).not.toBeInTheDocument()
    } finally {
      nativeConfirm.mockRestore()
    }
  })

  it("blocks dossier navigation while an atomic baseline apply is pending", async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const confirm = vi.spyOn(window, "confirm")
    confirm.mockClear()
    baselineTabMock.navigationBlocked = true

    try {
      render(<TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={onBack} />)
      const backButton = await screen.findByRole("button", { name: "Danh sách hồ sơ" })

      expect(backButton).toBeDisabled()
      await user.click(backButton)
      expect(confirm).not.toHaveBeenCalled()
      expect(onBack).not.toHaveBeenCalled()
    } finally {
      baselineTabMock.navigationBlocked = false
      confirm.mockRestore()
    }
  })

  it("renders baseline evidence in a separate workspace tab", async () => {
    const user = userEvent.setup()
    baselineTabMock.dirty = false

    try {
      render(<TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={vi.fn()} />)
      await user.click(screen.getByRole("tab", { name: "Tài liệu & trích dẫn" }))

      expect(screen.getByText("Baseline evidence workspace")).toBeInTheDocument()
      expect(screen.queryByText("Baseline editor")).not.toBeInTheDocument()
    } finally {
      baselineTabMock.dirty = true
    }
  })

  it("enables the complete comparison workspace in its own tab", async () => {
    const user = userEvent.setup()
    baselineTabMock.dirty = false

    try {
      render(<TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={vi.fn()} />)
      const comparisonTab = screen.getByRole("tab", { name: "So sánh & đánh giá" })

      expect(comparisonTab).toBeEnabled()
      await user.click(comparisonTab)

      expect(screen.getByText("Comparison matrix workspace")).toBeInTheDocument()
      expect(screen.queryByText("Baseline editor")).not.toBeInTheDocument()
    } finally {
      baselineTabMock.dirty = true
    }
  })

  it("enables the supplier option tab and guards dirty option navigation", async () => {
    const user = userEvent.setup()
    baselineTabMock.dirty = false
    supplierOptionsMock.dirty = true

    try {
      render(<TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={vi.fn()} />)
      const optionsTab = screen.getByRole("tab", { name: "Phương án" })
      expect(optionsTab).toBeEnabled()

      await user.click(optionsTab)
      expect(await screen.findByText(/Supplier option workspace revision/)).toBeInTheDocument()

      await user.click(screen.getByRole("tab", { name: "Sản phẩm tham chiếu" }))
      expect(await screen.findByRole("alertdialog")).toHaveTextContent("Bỏ thay đổi chưa lưu?")
      expect(screen.getByText(/Supplier option workspace revision/)).toBeInTheDocument()
    } finally {
      baselineTabMock.dirty = true
      supplierOptionsMock.dirty = false
    }
  })

  it("blocks outer back and tab navigation while the option workspace is pending", async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    baselineTabMock.dirty = false
    supplierOptionsMock.dirty = true
    supplierOptionsMock.navigationBlocked = true

    try {
      render(<TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={onBack} />)
      await user.click(screen.getByRole("tab", { name: "Phương án" }))
      expect(await screen.findByText(/Supplier option workspace revision/)).toBeInTheDocument()

      const backButton = screen.getByRole("button", { name: "Danh sách hồ sơ" })
      expect(backButton).toBeDisabled()
      await user.click(backButton)
      await user.click(screen.getByRole("tab", { name: "Sản phẩm tham chiếu" }))

      expect(onBack).not.toHaveBeenCalled()
      expect(screen.getByText(/Supplier option workspace revision/)).toBeInTheDocument()
      expect(screen.queryByText("Reference product workspace")).not.toBeInTheDocument()
    } finally {
      baselineTabMock.dirty = true
      supplierOptionsMock.dirty = false
      supplierOptionsMock.navigationBlocked = false
    }
  })

  it("propagates an option mutation revision to another workspace tab", async () => {
    const user = userEvent.setup()
    baselineTabMock.dirty = false

    try {
      render(<TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={vi.fn()} />)
      await user.click(screen.getByRole("tab", { name: "Phương án" }))
      await user.click(screen.getByRole("button", { name: "Advance option revision" }))
      await user.click(screen.getByRole("tab", { name: "Cấu hình cơ sở" }))

      expect(await screen.findByText("Baseline revision 4")).toBeInTheDocument()
    } finally {
      baselineTabMock.dirty = true
    }
  })
})
