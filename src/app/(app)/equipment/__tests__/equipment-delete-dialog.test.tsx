import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  isDeleteOpen: false,
  deleteTarget: null as { id: number; ten_thiet_bi?: string } | null,
  deleteSource: null as "actions_menu" | "detail_dialog" | null,
  isDeleting: false,
}))

const mocks = vi.hoisted(() => ({
  closeDeleteDialog: vi.fn(),
  closeDetailDialog: vi.fn(),
  deleteMutate: vi.fn(),
}))

vi.mock("../_hooks/useEquipmentContext", () => ({
  useEquipmentContext: () => ({
    dialogState: {
      isDeleteOpen: state.isDeleteOpen,
      deleteTarget: state.deleteTarget,
      deleteSource: state.deleteSource,
    },
    closeDeleteDialog: mocks.closeDeleteDialog,
    closeDetailDialog: mocks.closeDetailDialog,
  }),
}))

vi.mock("@/hooks/use-cached-equipment", () => ({
  useDeleteEquipment: () => ({
    mutate: mocks.deleteMutate,
    isPending: state.isDeleting,
  }),
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    open,
    children,
  }: {
    open: boolean
    children: React.ReactNode
  }) => (open ? <div data-testid="delete-dialog">{children}</div> : null),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  }) => <button onClick={onClick}>{children}</button>,
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

import { EquipmentDeleteDialog } from "../_components/EquipmentDeleteDialog"

function renderDialog() {
  return render(<EquipmentDeleteDialog />)
}

describe("EquipmentDeleteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.isDeleteOpen = false
    state.deleteTarget = null
    state.deleteSource = null
    state.isDeleting = false
  })

  it("does not render when delete dialog is closed", () => {
    state.isDeleteOpen = false
    state.deleteTarget = { id: 101, ten_thiet_bi: "TB Test" }
    state.deleteSource = "actions_menu"

    renderDialog()

    expect(screen.queryByTestId("delete-dialog")).not.toBeInTheDocument()
  })

  it("calls mutate with string id when confirming delete", () => {
    state.isDeleteOpen = true
    state.deleteTarget = { id: 101, ten_thiet_bi: "TB Test" }
    state.deleteSource = "actions_menu"

    renderDialog()

    fireEvent.click(screen.getByRole("button", { name: "Xóa" }))

    expect(mocks.deleteMutate).toHaveBeenCalledWith(
      "101",
      expect.objectContaining({ onSuccess: expect.any(Function) })
    )
  })

  it("calls closeDeleteDialog and does not mutate when canceling", () => {
    state.isDeleteOpen = true
    state.deleteTarget = { id: 101, ten_thiet_bi: "TB Test" }
    state.deleteSource = "actions_menu"

    renderDialog()

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }))

    expect(mocks.closeDeleteDialog).toHaveBeenCalledTimes(1)
    expect(mocks.deleteMutate).not.toHaveBeenCalled()
  })

  it("closes both delete and detail dialogs after successful delete from detail dialog source", () => {
    state.isDeleteOpen = true
    state.deleteTarget = { id: 101, ten_thiet_bi: "TB Test" }
    state.deleteSource = "detail_dialog"

    renderDialog()

    fireEvent.click(screen.getByRole("button", { name: "Xóa" }))
    const [, options] = mocks.deleteMutate.mock.calls[0] as [
      string,
      { onSuccess?: () => void }
    ]
    options.onSuccess?.()

    expect(mocks.closeDeleteDialog).toHaveBeenCalledTimes(1)
    expect(mocks.closeDetailDialog).toHaveBeenCalledTimes(1)
  })

  it("closes only delete dialog after successful delete from actions menu source", () => {
    state.isDeleteOpen = true
    state.deleteTarget = { id: 101, ten_thiet_bi: "TB Test" }
    state.deleteSource = "actions_menu"

    renderDialog()

    fireEvent.click(screen.getByRole("button", { name: "Xóa" }))
    const [, options] = mocks.deleteMutate.mock.calls[0] as [
      string,
      { onSuccess?: () => void }
    ]
    options.onSuccess?.()

    expect(mocks.closeDeleteDialog).toHaveBeenCalledTimes(1)
    expect(mocks.closeDetailDialog).not.toHaveBeenCalled()
  })
})
