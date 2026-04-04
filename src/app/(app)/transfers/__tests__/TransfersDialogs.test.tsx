import "@testing-library/jest-dom"
import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TransferRequest } from "@/types/database"

const dialogMocks = vi.hoisted(() => ({
  AddTransferDialog: vi.fn(() => <div data-testid="add-transfer-dialog" />),
  EditTransferDialog: vi.fn(() => <div data-testid="edit-transfer-dialog" />),
  FilterModal: vi.fn(() => <div data-testid="filter-modal" />),
  HandoverPreviewDialog: vi.fn(() => <div data-testid="handover-dialog" />),
  TransferDetailDialog: vi.fn(() => <div data-testid="transfer-detail-dialog" />),
}))

vi.mock("@/components/add-transfer-dialog", () => ({
  AddTransferDialog: (props: unknown) => dialogMocks.AddTransferDialog(props),
}))

vi.mock("@/components/edit-transfer-dialog", () => ({
  EditTransferDialog: (props: unknown) => dialogMocks.EditTransferDialog(props),
}))

vi.mock("@/components/handover-preview-dialog", () => ({
  HandoverPreviewDialog: (props: unknown) => dialogMocks.HandoverPreviewDialog(props),
}))

vi.mock("@/components/transfer-detail-dialog", () => ({
  TransferDetailDialog: (props: unknown) => dialogMocks.TransferDetailDialog(props),
}))

vi.mock("@/components/transfers/FilterModal", () => ({
  FilterModal: (props: unknown) => dialogMocks.FilterModal(props),
}))

import { TransfersDialogs } from "@/app/(app)/transfers/_components/TransfersDialogs"

function makeTransferRequest(): TransferRequest {
  return {
    id: 1,
    ma_yeu_cau: "LC-0001",
    thiet_bi_id: 10,
    loai_hinh: "noi_bo",
    trang_thai: "cho_duyet",
    nguoi_yeu_cau_id: 1,
    ly_do_luan_chuyen: "Điều phối",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    created_by: 1,
    updated_by: 1,
    thiet_bi: null,
  }
}

describe("TransfersDialogs", () => {
  const transfer = makeTransferRequest()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderDialogs(overrides: Partial<React.ComponentProps<typeof TransfersDialogs>> = {}) {
    const defaultProps: React.ComponentProps<typeof TransfersDialogs> = {
      isAddDialogOpen: false,
      onAddDialogOpenChange: vi.fn(),
      onAddSuccess: vi.fn(),
      isEditDialogOpen: false,
      onEditDialogOpenChange: vi.fn(),
      onEditSuccess: vi.fn(),
      editingTransfer: null,
      detailDialogOpen: false,
      onDetailDialogOpenChange: vi.fn(),
      detailTransfer: null,
      handoverDialogOpen: false,
      onHandoverDialogOpenChange: vi.fn(),
      handoverTransfer: null,
      deleteDialogOpen: false,
      onDeleteDialogOpenChange: vi.fn(),
      onConfirmDelete: vi.fn(),
      isFilterModalOpen: false,
      onFilterModalOpenChange: vi.fn(),
      filterValue: { statuses: [], dateRange: null },
      onFilterChange: vi.fn(),
      filterVariant: "dialog",
    }

    return render(<TransfersDialogs {...defaultProps} {...overrides} />)
  }

  it("renders only dialogs that are open", () => {
    renderDialogs({
      isAddDialogOpen: true,
      detailDialogOpen: true,
      isFilterModalOpen: true,
      detailTransfer: transfer,
    })

    expect(screen.getByTestId("add-transfer-dialog")).toBeInTheDocument()
    expect(screen.getByTestId("transfer-detail-dialog")).toBeInTheDocument()
    expect(screen.getByTestId("filter-modal")).toBeInTheDocument()
    expect(screen.queryByTestId("edit-transfer-dialog")).not.toBeInTheDocument()
    expect(screen.queryByTestId("handover-dialog")).not.toBeInTheDocument()
  })

  it("forwards open handlers and success callbacks to child dialogs", () => {
    const onAddDialogOpenChange = vi.fn()
    const onAddSuccess = vi.fn()
    const onEditDialogOpenChange = vi.fn()
    const onEditSuccess = vi.fn()

    renderDialogs({
      isAddDialogOpen: true,
      onAddDialogOpenChange,
      onAddSuccess,
      isEditDialogOpen: true,
      onEditDialogOpenChange,
      onEditSuccess,
      editingTransfer: transfer,
    })

    expect(dialogMocks.AddTransferDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        onOpenChange: onAddDialogOpenChange,
        onSuccess: onAddSuccess,
      }),
    )
    expect(dialogMocks.EditTransferDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        onOpenChange: onEditDialogOpenChange,
        onSuccess: onEditSuccess,
        transfer,
      }),
    )
  })

  it("passes selected transfer props to detail and handover dialogs", () => {
    renderDialogs({
      detailDialogOpen: true,
      detailTransfer: transfer,
      handoverDialogOpen: true,
      handoverTransfer: transfer,
    })

    expect(dialogMocks.TransferDetailDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        transfer,
      }),
    )
    expect(dialogMocks.HandoverPreviewDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        transfer,
      }),
    )
  })

  it("calls the injected confirm handler from the delete dialog", () => {
    const onConfirmDelete = vi.fn()

    renderDialogs({
      deleteDialogOpen: true,
      onConfirmDelete,
    })

    fireEvent.click(screen.getByRole("button", { name: "Xóa" }))

    expect(onConfirmDelete).toHaveBeenCalledTimes(1)
  })
})
