import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Equipment } from "@/types/database"
import type { EquipmentDetailDialogProps } from "../_components/EquipmentDetailDialog"

const mockOpenDeleteDialog = vi.fn()
const mockUpdateEquipment = vi.fn()

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
    ...props
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => (
    <select
      {...props}
      value={value ?? ""}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}))

vi.mock("../_hooks/useEquipmentContext", () => ({
  useEquipmentContext: () => ({
    openDeleteDialog: mockOpenDeleteDialog,
  }),
}))

vi.mock("../_components/EquipmentDetailDialog/EquipmentDetailDetailsTab", () => ({
  EquipmentDetailDetailsTab: ({
    isEditing,
    children,
  }: {
    isEditing: boolean
    children?: React.ReactNode
  }) => <div>{isEditing ? children : null}</div>,
}))

vi.mock("../_components/EquipmentDetailDialog/EquipmentDetailConfigTab", () => ({
  EquipmentDetailConfigTab: () => <div>Config</div>,
}))

vi.mock("../_components/EquipmentDetailDialog/EquipmentDetailFilesTab", () => ({
  EquipmentDetailFilesTab: () => <div>Files</div>,
}))

vi.mock("../_components/EquipmentDetailDialog/EquipmentDetailHistoryTab", () => ({
  EquipmentDetailHistoryTab: () => <div>History</div>,
}))

vi.mock("../_components/EquipmentDetailDialog/EquipmentDetailUsageTab", () => ({
  EquipmentDetailUsageTab: () => <div>Usage</div>,
}))

vi.mock("../_components/EquipmentDetailDialog/hooks/useEquipmentHistory", () => ({
  useEquipmentHistory: () => ({
    history: [],
    isLoading: false,
  }),
}))

vi.mock("../_components/EquipmentDetailDialog/hooks/useEquipmentAttachments", () => ({
  useEquipmentAttachments: () => ({
    attachments: [],
    isLoading: false,
    addAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    isAdding: false,
    isDeleting: false,
  }),
}))

vi.mock("@/components/equipment-edit/useEquipmentEditUpdate", () => ({
  useEquipmentEditUpdate: ({ onSuccess }: { onSuccess?: (patch: unknown) => void }) => ({
    updateEquipment: async (payload: unknown) => {
      await mockUpdateEquipment(payload)
      onSuccess?.((payload as { patch: unknown }).patch)
    },
    isPending: false,
  }),
}))

import { EquipmentDetailDialog } from "../_components/EquipmentDetailDialog"

describe("EquipmentDetailDialog decommission date", () => {
  const baseProps: Omit<EquipmentDetailDialogProps, "equipment"> = {
    open: true,
    onOpenChange: vi.fn(),
    user: { id: 1, role: "to_qltb", khoa_phong: "ICU" },
    isRegionalLeader: false,
    onGenerateProfileSheet: vi.fn(),
    onGenerateDeviceLabel: vi.fn(),
    onEquipmentUpdated: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        writable: true,
        value: vi.fn(),
      })
    }
  })

  it("does not auto-fill on initial load for an existing decommissioned record without a date", async () => {
    render(
      <EquipmentDetailDialog
        {...baseProps}
        equipment={{
          id: 42,
          ma_thiet_bi: "EQ-042",
          ten_thiet_bi: "Monitor",
          khoa_phong_quan_ly: "ICU",
          vi_tri_lap_dat: "P-01",
          nguoi_dang_truc_tiep_quan_ly: "Nguyễn Văn A",
          tinh_trang_hien_tai: "Ngưng sử dụng",
          ngay_ngung_su_dung: null,
        } as Equipment}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Sửa thông tin" }))

    expect(await screen.findByLabelText("Ngày ngừng sử dụng")).toHaveValue("")
  })

  it("auto-fills on status transition during the current detail-edit session and submits ISO format", async () => {
    const dateNowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-03-24T17:30:00.000Z").getTime())

    try {
      render(
        <EquipmentDetailDialog
          {...baseProps}
          equipment={{
            id: 7,
            ma_thiet_bi: "EQ-007",
            ten_thiet_bi: "Infusion Pump",
            khoa_phong_quan_ly: "ICU",
            vi_tri_lap_dat: "P-02",
            nguoi_dang_truc_tiep_quan_ly: "Trần Văn B",
            tinh_trang_hien_tai: "Hoạt động",
            ngay_ngung_su_dung: null,
          } as Equipment}
        />
      )

      fireEvent.click(screen.getByRole("button", { name: "Sửa thông tin" }))

      const decommissionDateInput = await screen.findByLabelText("Ngày ngừng sử dụng")
      expect(decommissionDateInput).toHaveValue("")

      fireEvent.change(screen.getAllByRole("combobox")[0], {
        target: { value: "Ngưng sử dụng" },
      })

      expect(decommissionDateInput).toHaveValue("25/03/2026")

      fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

      await waitFor(() => {
        expect(mockUpdateEquipment).toHaveBeenCalledWith({
          id: 7,
          patch: expect.objectContaining({
            tinh_trang_hien_tai: "Ngưng sử dụng",
            ngay_ngung_su_dung: "2026-03-25",
          }),
        })
      })
    } finally {
      dateNowSpy.mockRestore()
    }
  })

  it("resets dirty form values when the same equipment record is reopened", async () => {
    const equipment = {
      id: 9,
      ma_thiet_bi: "EQ-009",
      ten_thiet_bi: "Monitor theo dõi",
      khoa_phong_quan_ly: "ICU",
      vi_tri_lap_dat: "P-03",
      nguoi_dang_truc_tiep_quan_ly: "Lê Văn C",
      tinh_trang_hien_tai: "Hoạt động",
    } as Equipment

    const view = render(
      <EquipmentDetailDialog
        {...baseProps}
        equipment={equipment}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Sửa thông tin" }))

    const nameInput = await screen.findByLabelText("Tên thiết bị")
    expect(nameInput).toHaveValue("Monitor theo dõi")

    fireEvent.change(nameInput, { target: { value: "Giá trị chỉnh tạm" } })
    expect(nameInput).toHaveValue("Giá trị chỉnh tạm")

    view.rerender(
      <EquipmentDetailDialog
        {...baseProps}
        equipment={equipment}
        open={false}
      />
    )

    view.rerender(
      <EquipmentDetailDialog
        {...baseProps}
        equipment={equipment}
        open
      />
    )

    const reopenEditButton = screen.queryByRole("button", { name: "Sửa thông tin" })
    if (reopenEditButton) {
      fireEvent.click(reopenEditButton)
    }

    await waitFor(() => {
      expect(screen.getByLabelText("Tên thiết bị")).toHaveValue("Monitor theo dõi")
    })
  })

  it("does not leak a rejected submit promise when inline update fails", async () => {
    mockUpdateEquipment.mockRejectedValueOnce(new Error("Permission denied"))

    render(
      <EquipmentDetailDialog
        {...baseProps}
        equipment={{
          id: 12,
          ma_thiet_bi: "EQ-012",
          ten_thiet_bi: "Máy thở",
          khoa_phong_quan_ly: "ICU",
          vi_tri_lap_dat: "P-04",
          nguoi_dang_truc_tiep_quan_ly: "Phạm Văn D",
          tinh_trang_hien_tai: "Hoạt động",
        } as Equipment}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Sửa thông tin" }))

    await screen.findByLabelText("Tên thiết bị")

    const submitPromise = Promise.resolve().then(() => {
      fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }))
    })

    await expect(submitPromise).resolves.toBeUndefined()
    await waitFor(() => {
      expect(mockUpdateEquipment).toHaveBeenCalledWith({
        id: 12,
        patch: expect.objectContaining({
          ten_thiet_bi: "Máy thở",
        }),
      })
    })
    expect(baseProps.onEquipmentUpdated).not.toHaveBeenCalled()
  })
})
