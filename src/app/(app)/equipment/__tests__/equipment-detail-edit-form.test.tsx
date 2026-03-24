import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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

import { DEFAULT_EQUIPMENT_FORM_VALUES } from "../_components/EquipmentDetailDialog/EquipmentDetailFormDefaults"
import { EquipmentDetailEditForm } from "../_components/EquipmentDetailDialog/EquipmentDetailEditForm"
import {
  equipmentFormSchema,
  type EquipmentFormValues,
} from "../_components/EquipmentDetailDialog/EquipmentDetailTypes"

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

describe("EquipmentDetailEditForm", () => {
  it("renders key fields and classification options", () => {
    render(<FormHarness onSubmit={vi.fn()} />)

    expect(screen.getByLabelText("Mã thiết bị")).toBeInTheDocument()
    expect(screen.getByLabelText("Tên thiết bị")).toBeInTheDocument()
    expect(screen.getByLabelText("Ngày ngừng sử dụng")).toBeInTheDocument()
    expect(screen.getByText("Chọn tình trạng")).toBeInTheDocument()
    expect(screen.getByText("Chọn phân loại")).toBeInTheDocument()
  })

  it("auto-fills the decommission date on status transition and submits normalized values", async () => {
    const onSubmit = vi.fn()
    const dateNowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-03-24T17:30:00.000Z").getTime())

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

    dateNowSpy.mockRestore()
  })
})
