import fs from "node:fs"
import path from "node:path"

import type * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { TechnicalConfigurationDossierListItemWire } from "../types"

type DeleteDialogProps = {
  dossier: TechnicalConfigurationDossierListItemWire | null
  errorMessage: string | null
  isPending: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

type DeleteDialogModule = {
  TechnicalConfigurationDossierDeleteDialog: React.ComponentType<DeleteDialogProps>
}

const COMPONENT_PATH = path.resolve(
  process.cwd(),
  "src/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierDeleteDialog.tsx"
)

const dossier: TechnicalConfigurationDossierListItemWire = {
  id: "dossier-1",
  device_type_name: "Máy siêu âm",
  name: "Cấu hình máy siêu âm",
  description: "Cấu hình chuẩn",
  revision: 7,
  archived_at: null,
  archived_by: null,
  created_at: "2026-08-06T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-08-06T00:00:00.000Z",
  updated_by: 1,
  can_delete: true,
}

async function loadDeleteDialog() {
  const componentExists = fs.existsSync(COMPONENT_PATH)

  expect(componentExists).toBe(true)
  if (!componentExists) return null

  return (await vi.importActual(
    "@/app/(app)/technical-configurations/_components/TechnicalConfigurationDossierDeleteDialog"
  )) as DeleteDialogModule
}

async function renderDeleteDialog(overrides: Partial<DeleteDialogProps> = {}) {
  const module = await loadDeleteDialog()
  if (!module) return null

  const props: DeleteDialogProps = {
    dossier,
    errorMessage: null,
    isPending: false,
    onConfirm: vi.fn(),
    onOpenChange: vi.fn(),
    ...overrides,
  }

  const view = render(<module.TechnicalConfigurationDossierDeleteDialog {...props} />)

  return { ...view, props }
}

describe("technical configuration dossier delete dialog", () => {
  it("wraps the shared destructive dialog with permanent dossier copy", async () => {
    const sourceExists = fs.existsSync(COMPONENT_PATH)

    expect(sourceExists).toBe(true)
    if (!sourceExists) return

    const source = fs.readFileSync(COMPONENT_PATH, "utf8")

    expect(source).toContain('from "@/components/shared/DestructiveConfirmDialog"')

    await renderDeleteDialog()

    expect(
      screen.getByRole("heading", { name: "Xóa hồ sơ cấu hình vĩnh viễn?" })
    ).toBeInTheDocument()
    expect(screen.getByText("Cấu hình máy siêu âm")).toBeInTheDocument()
    expect(
      screen.getByText(/toàn bộ dữ liệu làm việc phụ thuộc sẽ bị xóa vĩnh viễn/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/không thể hoàn tác/i)).toBeInTheDocument()
  })

  it("cancels without confirming a delete", async () => {
    const user = userEvent.setup()
    const result = await renderDeleteDialog()
    if (!result) return

    await user.click(screen.getByRole("button", { name: "Hủy" }))

    expect(result.props.onOpenChange).toHaveBeenCalledWith(false)
    expect(result.props.onConfirm).not.toHaveBeenCalled()
  })

  it("confirms only after the destructive command is clicked", async () => {
    const user = userEvent.setup()
    const result = await renderDeleteDialog()
    if (!result) return

    expect(result.props.onConfirm).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }))

    expect(result.props.onConfirm).toHaveBeenCalledTimes(1)
  })

  it("prevents duplicate submit and unsafe close while pending", async () => {
    const user = userEvent.setup()
    const result = await renderDeleteDialog({ isPending: true })
    if (!result) return

    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Xóa vĩnh viễn" })).toBeDisabled()

    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }))

    expect(result.props.onOpenChange).not.toHaveBeenCalled()
    expect(result.props.onConfirm).not.toHaveBeenCalled()
  })

  it("keeps the error in context and allows an explicit retry", async () => {
    const user = userEvent.setup()
    const result = await renderDeleteDialog({
      errorMessage: "Hồ sơ đã được khóa ở phiên khác.",
    })
    if (!result) return

    expect(screen.getByRole("alert")).toHaveTextContent("Hồ sơ đã được khóa ở phiên khác.")
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Thử xóa lại" }))

    expect(result.props.onConfirm).toHaveBeenCalledTimes(1)
  })
})
