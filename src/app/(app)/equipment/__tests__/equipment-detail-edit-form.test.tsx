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
  createEquipmentFormSchema,
  type EquipmentFormValues,
} from "../_components/EquipmentDetailDialog/EquipmentDetailTypes"
import { DEFAULT_EQUIPMENT_FORM_VALUES } from "@/components/equipment-edit/EquipmentEditFormDefaults"
import { EquipmentEditTextareaField } from "@/components/equipment-edit/EquipmentEditFieldControls"
import { readyStatusCatalog } from "@/hooks/__tests__/equipment-status-catalog-fixtures"

const catalog = [
  ...readyStatusCatalog.data,
  {
    ...readyStatusCatalog.data[0],
    status_value: "Kết thúc theo dõi",
    is_terminal: true,
  },
]
vi.mock("@/hooks/use-equipment-status-catalog", () => ({
  useEquipmentStatusCatalog: () => ({
    data: catalog,
    activeValues: catalog.map((r) => r.status_value),
    canWrite: true,
    isSuccess: true,
    fetchStatus: "idle",
    refetch: vi.fn(),
  }),
}))

function FormHarness({
  initialStatus = "Hoạt động",
  initialDate = null,
  onSubmit,
}: {
  initialStatus?: string | null
  initialDate?: string | null
  onSubmit: (values: EquipmentFormValues) => void
}) {
  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(createEquipmentFormSchema(catalog, initialStatus)),
    defaultValues: {
      ...DEFAULT_EQUIPMENT_FORM_VALUES,
      ma_thiet_bi: "EQ-001",
      ten_thiet_bi: "Máy siêu âm",
      vi_tri_lap_dat: "Phòng 101",
      khoa_phong_quan_ly: "Khoa Nội",
      nguoi_dang_truc_tiep_quan_ly: "Nguyễn Văn A",
      tinh_trang_hien_tai: initialStatus ?? "Hoạt động",
      ngay_ngung_su_dung: initialDate,
    },
  })

  return (
    <FormProvider {...form}>
      <EquipmentDetailEditForm
        formId="equipment-inline-edit-form"
        initialStatus={initialStatus}
        {...{ statusCatalog: catalog }}
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
  it.each(["2026-03-24T16:59:59Z", "2026-03-24T17:00:00Z"])(
    "autofills catalog-required end date at the Vietnam boundary %s",
    async (now) => {
      const onSubmit = vi.fn()
      const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(new Date(now).getTime())
      try {
        render(<FormHarness onSubmit={onSubmit} />)
        fireEvent.change(screen.getAllByRole("combobox")[0], {
          target: { value: "Thanh lý nội bộ" },
        })
        const date = now.includes("16:59") ? "24/03/2026" : "25/03/2026"
        expect(screen.getByLabelText("Ngày ngừng sử dụng")).toHaveValue(date)
        fireEvent.submit(document.getElementById("equipment-inline-edit-form")!)
        await waitFor(() =>
          expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
              tinh_trang_hien_tai: "Thanh lý nội bộ",
              ngay_ngung_su_dung: date === "24/03/2026" ? "2026-03-24" : "2026-03-25",
            }),
            expect.anything()
          )
        )
      } finally {
        dateNowSpy.mockRestore()
      }
    }
  )

  it("preserves an explicit end date when entering catalog liquidation", async () => {
    const onSubmit = vi.fn()
    render(<FormHarness onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText("Ngày ngừng sử dụng"), {
      target: { value: "20/03/2026" },
    })
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "Thanh lý nội bộ" } })
    expect(screen.getByLabelText("Ngày ngừng sử dụng")).toHaveValue("20/03/2026")
    fireEvent.submit(document.getElementById("equipment-inline-edit-form")!)
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          ngay_ngung_su_dung: "2026-03-20",
        }),
        expect.anything()
      )
    )
  })

  it("preserves a valid existing date across terminal statuses", async () => {
    const onSubmit = vi.fn()
    render(
      <FormHarness initialStatus="Ngưng sử dụng" initialDate="20/03/2026" onSubmit={onSubmit} />
    )
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "Thanh lý nội bộ" } })
    fireEvent.submit(document.getElementById("equipment-inline-edit-form")!)
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          ngay_ngung_su_dung: "2026-03-20",
        }),
        expect.anything()
      )
    )
  })

  it("clears the end date on a permitted restore to active equipment", async () => {
    const onSubmit = vi.fn()
    render(
      <FormHarness initialStatus="Thanh lý nội bộ" initialDate="20/03/2026" onSubmit={onSubmit} />
    )
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "Hoạt động" } })
    expect(screen.getByLabelText("Ngày ngừng sử dụng")).toHaveValue("")
    fireEvent.submit(document.getElementById("equipment-inline-edit-form")!)
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          tinh_trang_hien_tai: "Hoạt động",
          ngay_ngung_su_dung: null,
        }),
        expect.anything()
      )
    )
  })

  it.each(["Thanh lý nội bộ", "Kết thúc theo dõi"])(
    "does not backfill missing historical end date on metadata edits for %s",
    async (status) => {
      const onSubmit = vi.fn()
      render(<FormHarness initialStatus={status} onSubmit={onSubmit} />)
      fireEvent.change(screen.getByLabelText("Tên thiết bị"), { target: { value: "Metadata mới" } })
      expect(screen.getByLabelText("Ngày ngừng sử dụng")).toHaveValue("")
      fireEvent.submit(document.getElementById("equipment-inline-edit-form")!)
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            tinh_trang_hien_tai: status,
            ngay_ngung_su_dung: null,
          }),
          expect.anything()
        )
      )
    }
  )

  it("does not mandate an end date for terminal-only metadata", async () => {
    const onSubmit = vi.fn()
    render(<FormHarness onSubmit={onSubmit} />)
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "Kết thúc theo dõi" } })
    expect(screen.getByLabelText("Ngày ngừng sử dụng")).toHaveValue("")
    fireEvent.submit(document.getElementById("equipment-inline-edit-form")!)
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
  })

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
