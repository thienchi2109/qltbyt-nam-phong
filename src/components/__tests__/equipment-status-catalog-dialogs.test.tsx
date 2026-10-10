import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useFormContext } from "react-hook-form"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  catalog: vi.fn(),
  rpc: vi.fn(),
  refetch: vi.fn(),
  rows: vi.fn(),
  session: vi.fn(),
}))
vi.mock("@/hooks/use-equipment-status-catalog", () => ({
  useEquipmentStatusCatalog: () => mocks.catalog(),
}))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("next-auth/react", () => ({ useSession: () => mocks.session() }))
vi.mock("@/lib/rpc-client", () => ({ callRpc: (...args: unknown[]) => mocks.rpc(...args) }))
vi.mock("@/lib/excel-utils", () => ({
  readExcelFile: async () => ({ SheetNames: ["Sheet1"], Sheets: { Sheet1: {} } }),
  worksheetToJson: () => mocks.rows(),
}))
vi.mock("../add-equipment-dialog.queries", () => ({
  fetchDepartmentNames: async () => [],
  fetchTenantList: async () => [],
  findCurrentTenant: () => null,
}))
vi.mock("../add-equipment-dialog.sections", () => ({
  AddEquipmentBasicFieldsSection: () => <AddFields />,
  AddEquipmentDateFinanceSection: () => null,
  AddEquipmentAssignmentSection: () => null,
  AddEquipmentAdditionalDetailsSection: () => null,
}))

import { AddEquipmentDialog } from "../add-equipment-dialog"
import { ImportEquipmentDialog } from "../import-equipment-dialog"
import type { AddEquipmentFormValues } from "../add-equipment-dialog.schema"
import { readyStatusCatalog } from "@/hooks/__tests__/equipment-status-catalog-fixtures"

function AddFields() {
  const { register } = useFormContext<AddEquipmentFormValues>()
  return (
    <>
      {(
        [
          "ma_thiet_bi",
          "ten_thiet_bi",
          "khoa_phong_quan_ly",
          "vi_tri_lap_dat",
          "nguoi_dang_truc_tiep_quan_ly",
          "tinh_trang_hien_tai",
          "ngay_dua_vao_su_dung",
          "ngay_ngung_su_dung",
        ] as const
      ).map((field) => (
        <input key={field} aria-label={field} {...register(field)} />
      ))}
    </>
  )
}
const activeValues = ["Hoạt động", "Thanh lý nội bộ", "Đang đánh giá kỹ thuật"]
const ready = () => ({
  activeValues,
  data: readyStatusCatalog.data,
  canWrite: true,
  isError: false,
  isPending: false,
  fetchStatus: "idle",
  refetch: mocks.refetch,
})
function Wrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
function fillAdd(status = "Đang đánh giá kỹ thuật") {
  for (const field of [
    "ma_thiet_bi",
    "ten_thiet_bi",
    "khoa_phong_quan_ly",
    "vi_tri_lap_dat",
    "nguoi_dang_truc_tiep_quan_ly",
    "tinh_trang_hien_tai",
  ])
    fireEvent.change(screen.getByLabelText(field), {
      target: { value: field === "tinh_trang_hien_tai" ? status : "Test" },
    })
}

describe("catalog-dependent equipment dialogs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.catalog.mockReturnValue(ready())
    mocks.rpc.mockResolvedValue({ inserted: 1, failed: 0, total: 1 })
    mocks.session.mockReturnValue({ data: { user: { id: 7, role: "to_qltb", don_vi: 1 } } })
    mocks.rows.mockResolvedValue([
      {
        "Mã thiết bị": "EQ-1",
        "Tên thiết bị": "Monitor",
        "Khoa/phòng quản lý": "Khoa Nội",
        "Vị trí lắp đặt": "101",
        "Người sử dụng": "A",
        "Tình trạng": "Đang đánh giá kỹ thuật",
      },
    ])
  })

  it("creates liquidation equipment with Vietnam's current day in the persisted payload", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(new Date("2026-03-24T17:00:00Z").getTime())
    try {
      render(<AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />, {
        wrapper: Wrapper,
      })
      fillAdd("Thanh lý nội bộ")
      expect(screen.getByLabelText("ngay_ngung_su_dung")).toHaveValue("25/03/2026")
      fireEvent.click(screen.getByRole("button", { name: "Lưu" }))
      await waitFor(() =>
        expect(mocks.rpc).toHaveBeenCalledWith(
          expect.objectContaining({
            fn: "equipment_create",
            args: {
              p_payload: expect.objectContaining({
                tinh_trang_hien_tai: "Thanh lý nội bộ",
                ngay_ngung_su_dung: "2026-03-25",
              }),
            },
          })
        )
      )
    } finally {
      now.mockRestore()
    }
  })

  it("keeps an explicit liquidation date ahead of autofill in the actual add form", async () => {
    render(<AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />, {
      wrapper: Wrapper,
    })
    fireEvent.change(screen.getByLabelText("ngay_ngung_su_dung"), {
      target: { value: "20/03/2026" },
    })
    fillAdd("Thanh lý nội bộ")
    expect(screen.getByLabelText("ngay_ngung_su_dung")).toHaveValue("20/03/2026")
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: "equipment_create",
          args: { p_payload: expect.objectContaining({ ngay_ngung_su_dung: "2026-03-20" }) },
        })
      )
    )
  })

  it.each([
    { name: "invalid full date", start: "", end: "31/02/2026" },
    { name: "end before start", start: "25/03/2026", end: "20/03/2026" },
  ])("rejects $name before liquidation creation", async ({ start, end }) => {
    render(<AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />, {
      wrapper: Wrapper,
    })
    fillAdd("Thanh lý nội bộ")
    fireEvent.change(screen.getByLabelText("ngay_dua_vao_su_dung"), { target: { value: start } })
    fireEvent.change(screen.getByLabelText("ngay_ngung_su_dung"), { target: { value: end } })
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Lưu" })).toBeEnabled())
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it.each(["pending", "error", "paused", "fetching"])(
    "disables add submission during catalog %s and exposes retry",
    (state) => {
      mocks.catalog.mockReturnValue({
        ...ready(),
        canWrite: false,
        isError: state === "error",
        isPending: state === "pending",
        fetchStatus: state === "pending" || state === "error" ? "idle" : state,
      })
      render(<AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />, {
        wrapper: Wrapper,
      })
      expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
      fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
      expect(mocks.refetch).toHaveBeenCalledOnce()
      expect(mocks.rpc).not.toHaveBeenCalled()
    }
  )

  it("updates the real RHF resolver when catalog data arrives and submits the future exact label", async () => {
    mocks.catalog.mockReturnValue({
      ...ready(),
      activeValues: [],
      canWrite: false,
      isPending: true,
    })
    const view = render(<AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />, {
      wrapper: Wrapper,
    })
    fillAdd()
    mocks.catalog.mockReturnValue(ready())
    view.rerender(<AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: "equipment_create",
          args: {
            p_payload: expect.objectContaining({ tinh_trang_hien_tai: "Đang đánh giá kỹ thuật" }),
          },
        })
      )
    )
  })

  it("retains existing add RBAC even when the catalog is ready", () => {
    mocks.session.mockReturnValue({ data: { user: { id: 7, role: "user" } } })
    render(<AddEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />, {
      wrapper: Wrapper,
    })
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
  })

  it("shows retry and disables import file admission while the catalog is unavailable", () => {
    mocks.catalog.mockReturnValue({ ...ready(), canWrite: false, isError: true })
    render(<ImportEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.getByLabelText("Chọn file")).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(mocks.refetch).toHaveBeenCalledOnce()
  })

  it("imports the future raw label and disables an already parsed submission on paused refresh", async () => {
    const view = render(<ImportEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Chọn file"), {
      target: { files: [new File(["test"], "equipment.xlsx")] },
    })
    const submit = await screen.findByRole("button", { name: /Nhập 1/ })
    expect(submit).toBeEnabled()
    mocks.catalog.mockReturnValue({ ...ready(), canWrite: false, fetchStatus: "paused" })
    view.rerender(<ImportEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
    expect(screen.getByRole("button", { name: /Nhập 1/ })).toBeDisabled()
    mocks.catalog.mockReturnValue(ready())
    view.rerender(<ImportEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: /Nhập 1/ }))
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: "equipment_bulk_import",
          args: {
            p_items: [expect.objectContaining({ tinh_trang_hien_tai: "Đang đánh giá kỹ thuật" })],
          },
        })
      )
    )
  })

  it("rejects a parsed import when its status becomes inactive before submission", async () => {
    const view = render(<ImportEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Chọn file"), {
      target: { files: [new File(["test"], "equipment.xlsx")] },
    })
    await screen.findByRole("button", { name: /Nhập 1/ })
    mocks.catalog.mockReturnValue({ ...ready(), activeValues: ["Hoạt động"] })
    view.rerender(<ImportEquipmentDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: /Nhập 1/ }))
    await waitFor(() => expect(mocks.rpc).not.toHaveBeenCalled())
    expect(screen.getByRole("button", { name: /Nhập 1/ })).toBeDisabled()
  })
})
