import fs from "node:fs"
import path from "node:path"

import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationWorkspaceShell } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"

const baselineTabMock = vi.hoisted(() => ({
  dirty: true,
}))

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab",
  async () => {
    const ReactModule = await import("react")

    return {
      TechnicalConfigurationBaselineTab: ({
        onDirtyChange,
      }: {
        onDirtyChange: (dirty: boolean) => void
      }) => {
        ReactModule.useEffect(() => {
          onDirtyChange(baselineTabMock.dirty)
          return () => onDirtyChange(false)
        }, [onDirtyChange])
        return <div>Baseline editor</div>
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
  it("keeps dirty form state when dossier-back confirmation is rejected", async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true)

    render(<TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={onBack} />)
    await waitFor(() => expect(screen.getByText("Baseline editor")).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: "Danh sách hồ sơ" }))
    expect(confirm).toHaveBeenCalledWith("Bạn có thay đổi chưa lưu. Rời hồ sơ và bỏ các thay đổi?")
    expect(onBack).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Danh sách hồ sơ" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("keeps the shell thin and baseline responsibilities extracted before the threshold", () => {
    const moduleRoot = path.resolve(process.cwd(), "src/app/(app)/technical-configurations")
    const files = [
      "TechnicalConfigurationsClient.tsx",
      "_components/TechnicalConfigurationWorkspaceShell.tsx",
      "_components/TechnicalConfigurationBaselineTab.tsx",
      "_components/TechnicalConfigurationBaselineEditor.tsx",
      "_hooks/useTechnicalConfigurationBaselineEditor.ts",
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
    expect(shellSource).not.toContain("useQuery")
    expect(shellSource).not.toContain("useMutation")
  })
})
