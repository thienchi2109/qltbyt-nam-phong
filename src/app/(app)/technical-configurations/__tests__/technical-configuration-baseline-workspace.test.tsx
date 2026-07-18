import fs from "node:fs"
import path from "node:path"

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

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab",
  async () => {
    const ReactModule = await import("react")

    return {
      TechnicalConfigurationBaselineTab: ({
        onDirtyChange,
        onNavigationBlockedChange,
      }: {
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
        return <div>Baseline editor</div>
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

  it("keeps the shell thin and baseline responsibilities extracted before the threshold", () => {
    const moduleRoot = path.resolve(process.cwd(), "src/app/(app)/technical-configurations")
    const files = [
      "TechnicalConfigurationsClient.tsx",
      "_components/TechnicalConfigurationWorkspaceShell.tsx",
      "_components/TechnicalConfigurationBaselineTab.tsx",
      "_components/TechnicalConfigurationBaselineEvidence.tsx",
      "_components/TechnicalConfigurationBaselineAlerts.tsx",
      "_components/TechnicalConfigurationBaselineTabStates.tsx",
      "_components/TechnicalConfigurationBaselineEditor.tsx",
      "_components/TechnicalConfigurationCriteriaSpreadsheet.tsx",
      "_components/TechnicalConfigurationBulkEntryWorkbench.tsx",
      "_components/TechnicalConfigurationAllGroupsOverview.tsx",
      "_components/TechnicalConfigurationGroupNavigator.tsx",
      "_hooks/useTechnicalConfigurationBaselineEditor.ts",
      "_hooks/useTechnicalConfigurationBaselineImport.ts",
      "_hooks/useTechnicalConfigurationBulkEntrySessions.ts",
      "_hooks/useTechnicalConfigurationInlineEditor.ts",
    ]

    for (const file of files) {
      const source = fs.readFileSync(path.join(moduleRoot, file), "utf8")
      const lineCount = source.split("\n").length
      expect(lineCount).toBeLessThan(350)
    }

    const shellSource = fs.readFileSync(
      path.join(moduleRoot, "_components/TechnicalConfigurationWorkspaceShell.tsx"),
      "utf8"
    )
    expect(shellSource).toContain("TechnicalConfigurationBaselineTab")
    expect(shellSource).toContain("TechnicalConfigurationBaselineEvidence")
    expect(shellSource).not.toContain("useQuery")
    expect(shellSource).not.toContain("useMutation")

    for (const file of [
      "_components/TechnicalConfigurationBaselineTab.tsx",
      "_hooks/useTechnicalConfigurationBaselineEditor.ts",
    ]) {
      const source = fs.readFileSync(path.join(moduleRoot, file), "utf8")
      expect(source).not.toMatch(/reference[-_ ]?product/i)
    }
  })
})
