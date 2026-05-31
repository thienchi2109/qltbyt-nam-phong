import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { RepairRequestWithEquipment } from "../types"
import { RepairRequestsDeleteDialog } from "../_components/RepairRequestsDeleteDialog"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"

vi.mock("lucide-react", () => ({
  Loader2: ({ className }: { readonly className?: string }) => (
    <svg aria-hidden="true" className={className} data-testid="pending-spinner" />
  ),
}))

vi.mock("../_hooks/useRepairRequestsContext", () => ({
  useRepairRequestsContext: vi.fn(),
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    open,
    onOpenChange,
    children,
  }: {
    readonly open: boolean
    readonly onOpenChange: (open: boolean) => void
    readonly children: React.ReactNode
  }) =>
    open ? (
      <div data-testid="alert-dialog">
        <button type="button" onClick={() => onOpenChange(false)}>
          mock close
        </button>
        {children}
      </div>
    ) : null,
  AlertDialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { readonly children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { readonly children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({
    children,
    disabled,
  }: {
    readonly children: React.ReactNode
    readonly disabled?: boolean
  }) => (
    <button type="button" disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogAction: ({
    children,
    className,
    disabled,
    onClick,
  }: {
    readonly children: React.ReactNode
    readonly className?: string
    readonly disabled?: boolean
    readonly onClick?: () => void
  }) => (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}))

const mockUseRepairRequestsContext = vi.mocked(useRepairRequestsContext)

const requestToDelete: RepairRequestWithEquipment = {
  id: 7,
  thiet_bi_id: 55,
  ngay_yeu_cau: "2026-05-01",
  trang_thai: "Chờ xử lý",
  mo_ta_su_co: "Không lên nguồn",
  hang_muc_sua_chua: null,
  ngay_mong_muon_hoan_thanh: null,
  nguoi_yeu_cau: null,
  ngay_duyet: null,
  ngay_hoan_thanh: null,
  nguoi_duyet: null,
  nguoi_xac_nhan: null,
  chi_phi_sua_chua: null,
  don_vi_thuc_hien: "noi_bo",
  ten_don_vi_thue: null,
  ket_qua_sua_chua: null,
  ly_do_khong_hoan_thanh: null,
  thiet_bi: {
    ten_thiet_bi: "Monitor",
    ma_thiet_bi: "TB-55",
    model: "M1",
    serial: "SN55",
    khoa_phong_quan_ly: "Khoa A",
    facility_name: "BV A",
    facility_id: 1,
  },
}

function setupContext({
  isPending = false,
  request = requestToDelete,
}: {
  readonly isPending?: boolean
  readonly request?: RepairRequestWithEquipment | null
} = {}) {
  const closeAllDialogs = vi.fn()
  const deleteMutate = vi.fn()

  mockUseRepairRequestsContext.mockReturnValue({
    dialogState: { requestToDelete: request },
    closeAllDialogs,
    deleteMutation: {
      mutate: deleteMutate,
      isPending,
    },
  } as ReturnType<typeof useRepairRequestsContext>)

  return { closeAllDialogs, deleteMutate }
}

describe("RepairRequestsDeleteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls delete mutation with close callback when confirming", () => {
    const { closeAllDialogs, deleteMutate } = setupContext()

    render(<RepairRequestsDeleteDialog />)

    fireEvent.click(screen.getByRole("button", { name: "Xóa" }))

    expect(deleteMutate).toHaveBeenCalledWith(7, { onSuccess: closeAllDialogs })
  })

  it("forwards close changes to close all dialogs", () => {
    const { closeAllDialogs } = setupContext()

    render(<RepairRequestsDeleteDialog />)

    fireEvent.click(screen.getByRole("button", { name: "mock close" }))

    expect(closeAllDialogs).toHaveBeenCalledTimes(1)
  })

  it("disables actions and keeps the destructive label while pending", () => {
    setupContext({ isPending: true })

    render(<RepairRequestsDeleteDialog />)

    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Xóa" })).toBeDisabled()
    expect(screen.getByTestId("pending-spinner")).toHaveClass("animate-spin")
  })
})
