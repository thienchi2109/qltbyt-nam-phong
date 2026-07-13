import fs from "node:fs"
import path from "node:path"

import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationDossierForm } from "../_components/TechnicalConfigurationDossierForm"

const TYPE_IMPORT_COMPONENTS = [
  "TechnicalConfigurationDossierForm.tsx",
  "TechnicalConfigurationDossierTable.tsx",
  "TechnicalConfigurationWorkspaceShell.tsx",
] as const
const TECHNICAL_CONFIGURATION_ROOT = path.resolve(
  process.cwd(),
  "src/app/(app)/technical-configurations"
)

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const props = {
    open: true,
    isSubmitting: false,
    errorMessage: null,
    onOpenChange: vi.fn(),
    onSubmit,
  }
  const view = render(<TechnicalConfigurationDossierForm {...props} />)

  return { ...view, onSubmit, props }
}

describe("technical configuration dossier form", () => {
  it("uses the project alias for shared dossier types", () => {
    const componentRoot = path.join(TECHNICAL_CONFIGURATION_ROOT, "_components")

    for (const file of TYPE_IMPORT_COMPONENTS) {
      const source = fs.readFileSync(path.join(componentRoot, file), "utf8")

      expect(source).toContain('from "@/app/(app)/technical-configurations/types"')
      expect(source).not.toContain('from "../types"')
    }
  })

  it("uses the shared side sheet with a scrollable body and linked footer submit", () => {
    const source = fs.readFileSync(
      path.join(TECHNICAL_CONFIGURATION_ROOT, "_components/TechnicalConfigurationDossierForm.tsx"),
      "utf8"
    )

    renderForm()

    const form = screen.getByLabelText("Loại thiết bị").closest("form")
    const submitButton = screen.getByRole("button", { name: "Lưu hồ sơ" })

    expect(source).toContain('from "@/components/shared/SideSheetShell"')
    expect(source).not.toContain('from "@/components/ui/dialog"')
    expect(screen.getByRole("dialog")).toHaveClass("sm:max-w-lg")
    expect(form).toHaveAttribute("id", "technical-configuration-dossier-form")
    expect(form?.parentElement).toHaveClass("overflow-y-auto", "p-4")
    expect(submitButton).toHaveAttribute("form", "technical-configuration-dossier-form")
  })

  it("uses the AppLayoutShell content area without nested page constraints", () => {
    for (const file of [
      "TechnicalConfigurationsClient.tsx",
      "_components/TechnicalConfigurationWorkspaceShell.tsx",
    ]) {
      const source = fs.readFileSync(path.join(TECHNICAL_CONFIGURATION_ROOT, file), "utf8")

      expect(source).toContain('<div className="w-full">')
      expect(source).not.toContain(
        '<main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">'
      )
    }
  })

  it("localizes the close control and hides it while submitting", () => {
    const { rerender, props } = renderForm()

    expect(screen.getByRole("button", { name: "Đóng" })).toBeInTheDocument()

    rerender(<TechnicalConfigurationDossierForm {...props} isSubmitting />)

    expect(screen.queryByRole("button", { name: /^(?:Đóng|Close)$/ })).not.toBeInTheDocument()
  })

  it("shows field errors instead of submitting whitespace-only required values", async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderForm()

    await user.type(screen.getByLabelText("Loại thiết bị"), "   ")
    await user.type(screen.getByLabelText("Tên hồ sơ"), "   ")
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }))

    expect(await screen.findByText("Vui lòng nhập loại thiết bị.")).toBeInTheDocument()
    expect(screen.getByText("Vui lòng nhập tên hồ sơ.")).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("resets values after an external close before reopening", async () => {
    const user = userEvent.setup()
    const { rerender, props } = renderForm()

    await user.type(screen.getByLabelText("Loại thiết bị"), "Máy siêu âm")
    await user.type(screen.getByLabelText("Tên hồ sơ"), "Cấu hình chuẩn")

    rerender(<TechnicalConfigurationDossierForm {...props} open={false} />)
    rerender(<TechnicalConfigurationDossierForm {...props} open />)

    expect(screen.getByLabelText("Loại thiết bị")).toHaveValue("")
    expect(screen.getByLabelText("Tên hồ sơ")).toHaveValue("")
  })
})
