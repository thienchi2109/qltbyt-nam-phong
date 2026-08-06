import fs from "node:fs"
import path from "node:path"

import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationDossierForm } from "../_components/TechnicalConfigurationDossierForm"
import type { TechnicalConfigurationDossierWire } from "../types"

const TYPE_IMPORT_COMPONENTS = [
  "TechnicalConfigurationDossierForm.tsx",
  "TechnicalConfigurationDossierTable.tsx",
  "TechnicalConfigurationWorkspaceShell.tsx",
] as const
const TECHNICAL_CONFIGURATION_ROOT = path.resolve(
  process.cwd(),
  "src/app/(app)/technical-configurations"
)

const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy siêu âm",
  name: "Cấu hình máy siêu âm",
  description: "Cấu hình chuẩn",
  revision: 7,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-13T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-13T00:00:00.000Z",
  updated_by: 1,
}

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const props = {
    mode: "create" as const,
    open: true,
    isSubmitting: false,
    errorMessage: null,
    onOpenChange: vi.fn(),
    onSubmit,
  }
  const view = render(<TechnicalConfigurationDossierForm {...props} />)

  return { ...view, onSubmit, props }
}

function renderEditForm(
  onSubmit = vi.fn().mockResolvedValue(undefined),
  target: TechnicalConfigurationDossierWire = dossier
) {
  const props = {
    mode: "edit" as const,
    dossier: target,
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

      expect(source).toContain("w-full")
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

  it("prefills the selected dossier in edit mode", () => {
    renderEditForm()

    expect(screen.getByRole("heading", { name: "Sửa metadata hồ sơ" })).toBeInTheDocument()
    expect(screen.getByLabelText("Loại thiết bị")).toHaveValue("Máy siêu âm")
    expect(screen.getByLabelText("Tên hồ sơ")).toHaveValue("Cấu hình máy siêu âm")
    expect(screen.getByLabelText("Mô tả")).toHaveValue("Cấu hình chuẩn")
  })

  it("submits all editable fields with the selected dossier revision", async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditForm()

    await user.clear(screen.getByLabelText("Loại thiết bị"))
    await user.type(screen.getByLabelText("Loại thiết bị"), "Máy siêu âm tim")
    await user.clear(screen.getByLabelText("Tên hồ sơ"))
    await user.type(screen.getByLabelText("Tên hồ sơ"), "Cấu hình máy siêu âm tim")
    await user.clear(screen.getByLabelText("Mô tả"))
    await user.type(screen.getByLabelText("Mô tả"), "Metadata đã cập nhật")
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        p_id: "dossier-1",
        p_device_type_name: "Máy siêu âm tim",
        p_name: "Cấu hình máy siêu âm tim",
        p_description: "Metadata đã cập nhật",
        p_expected_revision: 7,
      })
    })
  })

  it("cancels edit without submitting", async () => {
    const user = userEvent.setup()
    const { onSubmit, props } = renderEditForm()

    await user.type(screen.getByLabelText("Tên hồ sơ"), " thay đổi")
    await user.click(screen.getByRole("button", { name: "Hủy" }))

    expect(props.onOpenChange).toHaveBeenCalledWith(false)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("preserves edited values across an error render and retry", async () => {
    const user = userEvent.setup()
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("stale_revision"))
      .mockResolvedValueOnce(undefined)
    const { rerender, props } = renderEditForm(onSubmit)

    await user.clear(screen.getByLabelText("Tên hồ sơ"))
    await user.type(screen.getByLabelText("Tên hồ sơ"), "Cấu hình đang sửa")
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    rerender(
      <TechnicalConfigurationDossierForm
        {...props}
        dossier={{
          ...dossier,
          name: "Tên mới từ server",
          revision: 8,
        }}
        errorMessage="Hồ sơ đã thay đổi. Vui lòng thử lại."
      />
    )

    expect(screen.getByLabelText("Tên hồ sơ")).toHaveValue("Cấu hình đang sửa")
    expect(screen.getByText("Hồ sơ đã thay đổi. Vui lòng thử lại.")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
  })

  it("resets edit values when a different dossier target opens", async () => {
    const user = userEvent.setup()
    const { rerender, props } = renderEditForm()
    const nextDossier: TechnicalConfigurationDossierWire = {
      ...dossier,
      id: "dossier-2",
      name: "Cấu hình máy X-quang",
      device_type_name: "Máy X-quang",
      description: null,
      revision: 3,
    }

    await user.clear(screen.getByLabelText("Tên hồ sơ"))
    await user.type(screen.getByLabelText("Tên hồ sơ"), "Giá trị chưa lưu")
    rerender(<TechnicalConfigurationDossierForm {...props} dossier={nextDossier} />)

    expect(screen.getByLabelText("Loại thiết bị")).toHaveValue("Máy X-quang")
    expect(screen.getByLabelText("Tên hồ sơ")).toHaveValue("Cấu hình máy X-quang")
    expect(screen.getByLabelText("Mô tả")).toHaveValue("")
  })
})
