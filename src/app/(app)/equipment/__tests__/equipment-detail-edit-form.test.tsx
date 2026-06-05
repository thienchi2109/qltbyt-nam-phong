import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FormProvider, useForm } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }) => (
    <select
      aria-label="Select field"
      value={value ?? ""}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <>{placeholder ?? null}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}))

import { EquipmentDetailEditForm } from "../_components/EquipmentDetailDialog/EquipmentDetailEditForm"
import {
  equipmentFormSchema,
  type EquipmentFormValues,
} from "../_components/EquipmentDetailDialog/EquipmentDetailTypes"
import { DEFAULT_EQUIPMENT_FORM_VALUES } from "@/components/equipment-edit/EquipmentEditFormDefaults"
import { EquipmentEditTextareaField } from "@/components/equipment-edit/EquipmentEditFieldControls"

function FormHarness({
  initialStatus = "Hoạt động",
  onSubmit,
}: {
  initialStatus?: string | null
  onSubmit: (values: EquipmentFormValues) => void
}) {
  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      ...DEFAULT_EQUIPMENT_FORM_VALUES,
      ma_thiet_bi: "EQ-001",
      ten_thiet_bi: "Máy siêu âm",
      vi_tri_lap_dat: "Phòng 101",
      khoa_phong_quan_ly: "Khoa Nội",
      nguoi_dang_truc_tiep_quan_ly: "Nguyễn Văn A",
      tinh_trang_hien_tai: "Hoạt động",
    },
  })

  return (
    <FormProvider {...form}>
      <EquipmentDetailEditForm
        formId="equipment-inline-edit-form"
        initialStatus={initialStatus}
        onSubmit={onSubmit}
      />
    </FormProvider>
  )
}

function RequiredTextareaHarness() {
  const form = useForm<EquipmentFormValues>({
    defaultValues: DEFAULT_EQUIPMENT_FORM_VALUES,
  })

  return (
    <FormProvider {...form}>
      <EquipmentEditTextareaField name="ghi_chu" label="Ghi chú bắt buộc" required />
    </FormProvider>
  )
}

describe("EquipmentDetailEditForm", () => {
  it("renders key fields and classification options", () => {
    render(<FormHarness onSubmit={vi.fn()} />)

    expect(screen.getByLabelText("Mã thiết bị")).toBeInTheDocument()
    expect(screen.getByLabelText("Tên thiết bị")).toBeInTheDocument()
    expect(screen.getByLabelText("Ngày ngừng sử dụng")).toBeInTheDocument()
    expect(screen.getByLabelText("Năm tính hao mòn")).toBeInTheDocument()
    expect(screen.getByLabelText("Tỷ lệ hao mòn theo TT23")).toBeInTheDocument()
    expect(screen.getByLabelText("Chu kỳ BT định kỳ (ngày)")).toBeInTheDocument()
    expect(screen.getByLabelText("Ngày BT tiếp theo")).toBeInTheDocument()
    expect(screen.getByLabelText("Chu kỳ HC định kỳ (ngày)")).toBeInTheDocument()
    expect(screen.getByLabelText("Ngày HC tiếp theo")).toBeInTheDocument()
    expect(screen.getByLabelText("Chu kỳ KĐ định kỳ (ngày)")).toBeInTheDocument()
    expect(screen.getByLabelText("Ngày KĐ tiếp theo")).toBeInTheDocument()
    expect(screen.getByText("Chọn tình trạng")).toBeInTheDocument()
    expect(screen.getByText("Chọn phân loại")).toBeInTheDocument()
  })

  it("submits maintenance schedule and depreciation fields", async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(<FormHarness onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText("Năm tính hao mòn"), "2026")
    await user.type(screen.getByLabelText("Tỷ lệ hao mòn theo TT23"), "10%")
    await user.type(screen.getByLabelText("Chu kỳ BT định kỳ (ngày)"), "90")
    await user.type(screen.getByLabelText("Ngày BT tiếp theo"), "01/04/2026")
    await user.type(screen.getByLabelText("Chu kỳ HC định kỳ (ngày)"), "180")
    await user.type(screen.getByLabelText("Ngày HC tiếp theo"), "15/04/2026")
    await user.type(screen.getByLabelText("Chu kỳ KĐ định kỳ (ngày)"), "365")
    await user.type(screen.getByLabelText("Ngày KĐ tiếp theo"), "30/04/2026")

    fireEvent.submit(document.getElementById("equipment-inline-edit-form")!)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
      expect(onSubmit.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          nam_tinh_hao_mon: 2026,
          ty_le_hao_mon: "10%",
          chu_ky_bt_dinh_ky: 90,
          ngay_bt_tiep_theo: "2026-04-01",
          chu_ky_hc_dinh_ky: 180,
          ngay_hc_tiep_theo: "2026-04-15",
          chu_ky_kd_dinh_ky: 365,
          ngay_kd_tiep_theo: "2026-04-30",
        })
      )
    })
  })

  it("renders textarea required marker when requested", () => {
    render(<RequiredTextareaHarness />)

    expect(screen.getByRole("textbox", { name: /Ghi chú bắt buộc/ })).toBeInTheDocument()
    expect(screen.getByLabelText("bắt buộc")).toBeInTheDocument()
  })

  it("auto-fills the decommission date on status transition and submits normalized values", async () => {
    const onSubmit = vi.fn()
    const dateNowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-03-24T17:30:00.000Z").getTime())

    try {
      render(<FormHarness onSubmit={onSubmit} initialStatus="Hoạt động" />)

      const selects = screen.getAllByRole("combobox")
      const statusSelect = selects[0]
      const classificationSelect = selects[1]
      const decommissionDateInput = screen.getByLabelText("Ngày ngừng sử dụng")
      const form = document.getElementById("equipment-inline-edit-form")

      expect(decommissionDateInput).toHaveValue("")

      fireEvent.change(statusSelect, { target: { value: "Ngưng sử dụng" } })

      await waitFor(() => {
        expect(decommissionDateInput).toHaveValue("25/03/2026")
      })

      fireEvent.change(classificationSelect, { target: { value: "A" } })
      fireEvent.submit(form!)

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled()
        expect(onSubmit.mock.calls[0]?.[0]).toEqual(
          expect.objectContaining({
            tinh_trang_hien_tai: "Ngưng sử dụng",
            ngay_ngung_su_dung: "2026-03-25",
            phan_loai_theo_nd98: "A",
          })
        )
      })
    } finally {
      dateNowSpy.mockRestore()
    }
  })
})
