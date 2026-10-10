import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { useForm, FormProvider, type UseFormReturn } from "react-hook-form"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Equipment } from "@/types/database"
import type { EquipmentFormValues } from "@/components/equipment-edit/EquipmentEditTypes"

const mocks = vi.hoisted(() => ({ catalog: vi.fn(), update: vi.fn(), retry: vi.fn() }))
vi.mock("@/hooks/use-equipment-status-catalog", () => ({
  useEquipmentStatusCatalog: () => mocks.catalog(),
}))
vi.mock("../_hooks/useEquipmentContext", () => ({
  useEquipmentContext: () => ({ openDeleteDialog: vi.fn() }),
}))
vi.mock("@/components/equipment-edit/useEquipmentEditUpdate", () => ({
  useEquipmentEditUpdate: () => ({ updateEquipment: mocks.update, isPending: false }),
}))
vi.mock("../_components/EquipmentDetailDialog/hooks/useEquipmentHistory", () => ({
  useEquipmentHistory: () => ({ history: [], isLoading: false }),
}))
vi.mock("../_components/EquipmentDetailDialog/hooks/useEquipmentAttachments", () => ({
  useEquipmentAttachments: () => ({ attachments: [], isLoadingAttachments: false }),
}))
vi.mock("../_components/EquipmentDetailDialog/EquipmentDetailTabs", () => ({
  EquipmentDetailTabs: ({
    detail,
  }: {
    detail: {
      editForm: UseFormReturn<EquipmentFormValues>
      isEditingDetails: boolean
      onSubmitInlineEdit: (values: EquipmentFormValues) => void
    }
  }) =>
    detail.isEditingDetails ? (
      <FormProvider {...detail.editForm}>
        <form
          id="equipment-inline-edit-form"
          onSubmit={detail.editForm.handleSubmit(detail.onSubmitInlineEdit)}
        >
          <input aria-label="status" {...detail.editForm.register("tinh_trang_hien_tai")} />
          <input aria-label="notes" {...detail.editForm.register("ghi_chu")} />
        </form>
      </FormProvider>
    ) : null,
}))
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
    disabled,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
    disabled?: boolean
  }) => (
    <select
      aria-label="Status options"
      value={value ?? ""}
      onChange={(event) => onValueChange?.(event.target.value)}
      disabled={disabled}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    children,
    value,
    disabled,
  }: {
    children: React.ReactNode
    value: string
    disabled?: boolean
  }) => (
    <option value={value} disabled={disabled}>
      {children}
    </option>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
}))

import { EquipmentDetailDialog } from "../_components/EquipmentDetailDialog"
import { EquipmentDetailStatusSection } from "../_components/EquipmentDetailDialog/EquipmentDetailStatusSection"

const row = (status_value: string, is_active = true, display_order = 1) => ({
  status_value,
  is_active,
  display_order,
  is_terminal: false,
  requires_end_date: false,
  blocks_operational_actions: false,
  is_liquidation: false,
})
const data = [
  row("Hoạt động"),
  row("Đang đánh giá kỹ thuật", true, 2),
  row("Trạng thái đã ngừng cấp", false, 3),
]
const ready = () => ({
  data,
  activeValues: ["Hoạt động", "Đang đánh giá kỹ thuật"],
  canWrite: true,
  isSuccess: true,
  fetchStatus: "idle",
  refetch: mocks.retry,
})
const equipment = (status = "Hoạt động") =>
  ({
    id: 1,
    ma_thiet_bi: "EQ-1",
    ten_thiet_bi: "Monitor",
    khoa_phong_quan_ly: "Khoa Nội",
    vi_tri_lap_dat: "101",
    nguoi_dang_truc_tiep_quan_ly: "A",
    tinh_trang_hien_tai: status,
    ghi_chu: "",
  }) as Equipment
function Detail({ status = "Hoạt động" }: { status?: string }) {
  return (
    <EquipmentDetailDialog
      equipment={equipment(status)}
      open
      onOpenChange={vi.fn()}
      user={{ id: 7, role: "to_qltb", khoa_phong: null }}
      isRegionalLeader={false}
      onGenerateDeviceLabel={vi.fn()}
      onGenerateProfileSheet={vi.fn()}
      onEquipmentUpdated={vi.fn()}
    />
  )
}
function StatusHarness({ status }: { status: string }) {
  const form = useForm<EquipmentFormValues>({ defaultValues: { tinh_trang_hien_tai: status } })
  return (
    <FormProvider {...form}>
      <EquipmentDetailStatusSection />
    </FormProvider>
  )
}

describe("catalog equipment detail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.catalog.mockReturnValue(ready())
    mocks.update.mockResolvedValue({})
  })

  it.each(["error", "paused", "fetching"])("disables only the save during catalog %s", (state) => {
    mocks.catalog.mockReturnValue({
      ...ready(),
      canWrite: false,
      isSuccess: state !== "error",
      fetchStatus: state === "error" ? "idle" : state,
    })
    render(<Detail />)
    fireEvent.click(screen.getByRole("button", { name: "Sửa thông tin" }))
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Hủy" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Đóng" })).toBeEnabled()
  })

  it("allows metadata save with a known inactive current value even when no active options exist", async () => {
    mocks.catalog.mockReturnValue({
      ...ready(),
      data: [row("Trạng thái đã ngừng cấp", false)],
      activeValues: [],
      canWrite: false,
    })
    render(<Detail status="Trạng thái đã ngừng cấp" />)
    fireEvent.click(screen.getByRole("button", { name: "Sửa thông tin" }))
    fireEvent.change(screen.getByLabelText("notes"), { target: { value: "Metadata update" } })
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          patch: expect.objectContaining({
            tinh_trang_hien_tai: "Trạng thái đã ngừng cấp",
            ghi_chu: "Metadata update",
          }),
        })
      )
    )
  })

  it("saves an exact future active status using the real detail resolver", async () => {
    render(<Detail />)
    fireEvent.click(screen.getByRole("button", { name: "Sửa thông tin" }))
    fireEvent.change(screen.getByLabelText("status"), {
      target: { value: "Đang đánh giá kỹ thuật" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({
          patch: expect.objectContaining({ tinh_trang_hien_tai: "Đang đánh giá kỹ thuật" }),
        })
      )
    )
  })

  it("renders future active options and a disabled raw unknown current value", () => {
    render(<StatusHarness status="Giá trị lịch sử" />)
    expect(screen.getByRole("option", { name: "Đang đánh giá kỹ thuật" })).toBeEnabled()
    expect(screen.getByRole("option", { name: "Giá trị lịch sử" })).toBeDisabled()
    expect(
      screen.queryByRole("option", { name: "Trạng thái đã ngừng cấp" })
    ).not.toBeInTheDocument()
  })

  it("retains the known inactive current option without admitting other inactive choices", () => {
    render(<StatusHarness status="Trạng thái đã ngừng cấp" />)
    expect(screen.getByRole("option", { name: "Trạng thái đã ngừng cấp" })).toBeInTheDocument()
  })

  it("exposes retry while options are unavailable", () => {
    mocks.catalog.mockReturnValue({
      ...ready(),
      canWrite: false,
      isSuccess: false,
      isError: true,
      activeValues: [],
    })
    render(<StatusHarness status="Giá trị lịch sử" />)
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(mocks.retry).toHaveBeenCalledOnce()
  })
})
