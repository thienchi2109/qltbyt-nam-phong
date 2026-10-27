import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EquipmentDetailTemperatureTab } from "@/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailTemperatureTab"

const mock = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue({}),
  suggestedEffectiveFrom: "2026-07-31T17:00:45+00:00" as string | null,
}))
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: { user: { role: "to_qltb" } } }) }))
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/components/equipment/equipment-table-columns", () => ({ columnLabels: {} }))
vi.mock("@/hooks/use-temperature-monitoring", () => ({
  useTemperatureMutation: () => ({ mutateAsync: mock.save, isPending: false }),
  useTemperatureQuery: (fn: string, args: { p_cursor?: number }) => ({
    data:
      fn === "temperature_monitoring_configuration_choices"
        ? {
            methods: [
              { code: "manual", name: "Nhập tay" },
              { code: "device", name: "Thiết bị" },
            ],
            profiles: [
              { id: "profile", code: "default", name: "Bốn ca" },
              { id: "alternate", code: "alternate", name: "Hai ca" },
            ],
            server_now: "2026-07-02T16:00:00Z",
            suggested_effective_from: mock.suggestedEffectiveFrom,
            configuration: {
              monitoring_enabled: true,
              lower_c: 2,
              upper_c: 8,
              schedule_profile_id: "profile",
              display_timezone: "Asia/Ho_Chi_Minh",
              recording_method_code: "manual",
              responsible_primary_user_id: 7,
              responsible_substitute_user_ids: [8, 9],
            },
          }
        : fn === "temperature_monitoring_staff_choices"
          ? args.p_cursor
            ? { items: [{ id: 10, full_name: "Người mới" }], next_cursor: null }
            : {
                items: [
                  { id: 7, full_name: "Chính" },
                  { id: 8, full_name: "Thay thế" },
                ],
                next_cursor: 8,
              }
          : undefined,
  }),
}))

describe("temperature staff selection across pages", () => {
  beforeEach(() => {
    mock.save.mockClear()
    mock.suggestedEffectiveFrom = "2026-07-31T17:00:45+00:00"
  })

  it("preserves existing and selected assignments outside the current staff page", async () => {
    const user = userEvent.setup()
    render(
      <EquipmentDetailTemperatureTab
        displayEquipment={{ id: 42, ten_thiet_bi: "Tủ lạnh" }}
        isEditing={false}
      />
    )
    expect(screen.getByText("Phụ trách chính: #7 · Thay thế: #8, #9")).toBeInTheDocument()
    expect(screen.getByLabelText("Từ (giờ thiết bị)")).toHaveValue("2026-08-01T00:00:45.000")
    expect(screen.getByLabelText("Từ (giờ thiết bị)")).toHaveAttribute("readonly")
    await user.click(screen.getByRole("button", { name: "Nhân sự tiếp" }))
    await user.click(screen.getByLabelText("Nhân sự thay thế"))
    expect(screen.getByRole("menuitemcheckbox", { name: "#8 (đã chọn)" })).toBeChecked()
    expect(screen.getByRole("menuitemcheckbox", { name: "#9 (đã chọn)" })).toBeChecked()
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Người mới" }))
    await user.keyboard("{Escape}")
    fireEvent.change(screen.getByLabelText("Đến (tùy chọn)"), {
      target: { value: "2026-09-01T00:00" },
    })
    fireEvent.change(screen.getByLabelText("Lý do thay đổi"), {
      target: { value: "Giữ phân công" },
    })
    await user.click(screen.getByRole("button", { name: "Lưu cấu hình nhiệt độ" }))
    await waitFor(() => expect(mock.save).toHaveBeenCalled())
    expect(mock.save.mock.calls[0][0].args).toMatchObject({
      p_responsible_primary_user_id: 7,
      p_responsible_substitute_user_ids: [8, 9, 10],
      p_schedule_profile_id: "profile",
      p_recording_method_code: "manual",
      p_effective_from: "2026-07-31T17:00:45+00:00",
      p_effective_to: "2026-08-31T17:00:00.000Z",
    })
    expect(screen.getByLabelText("Múi giờ")).toHaveAttribute("readonly")
  })

  it("blocks configuration replacement when the server has no valid future boundary", () => {
    mock.suggestedEffectiveFrom = null
    render(
      <EquipmentDetailTemperatureTab
        displayEquipment={{ id: 42, ten_thiet_bi: "Tủ lạnh" }}
        isEditing={false}
      />
    )

    expect(screen.getByLabelText("Từ (giờ thiết bị)")).toHaveValue("")
    expect(screen.getByRole("button", { name: "Lưu cấu hình nhiệt độ" })).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent(/chưa có ranh giới hiệu lực hợp lệ/i)
  })

  it("explains blocked saves and saves after the required reason is supplied", async () => {
    const user = userEvent.setup()
    render(
      <EquipmentDetailTemperatureTab
        displayEquipment={{ id: 3779, ten_thiet_bi: "Ngân hàng máu, 180 túi" }}
        isEditing={false}
      />
    )

    await user.click(screen.getByRole("button", { name: "Lưu cấu hình nhiệt độ" }))

    expect(mock.save).not.toHaveBeenCalled()
    expect(screen.getByRole("status")).toHaveTextContent(/chưa lưu cấu hình.*lý do thay đổi/i)
    expect(screen.getByRole("checkbox", { name: "Bật theo dõi nhiệt độ" })).toBeChecked()
    expect(screen.getByLabelText("Lý do thay đổi")).toBeRequired()
    expect(screen.getByLabelText("Lý do thay đổi")).toHaveAttribute("maxlength", "2000")

    await user.type(screen.getByLabelText("Lý do thay đổi"), "Bật theo dõi nhiệt độ")
    await user.click(screen.getByRole("button", { name: "Lưu cấu hình nhiệt độ" }))

    await waitFor(() => expect(mock.save).toHaveBeenCalledTimes(1))
    expect(mock.save.mock.calls[0][0].args).toMatchObject({
      p_equipment_id: 3779,
      p_monitoring_enabled: true,
      p_change_reason: "Bật theo dõi nhiệt độ",
    })
    expect(screen.getByRole("status")).toHaveTextContent("Đã lưu phiên bản cấu hình.")
  })

  it("submits changed single selections and removes only the unchecked substitute", async () => {
    const user = userEvent.setup()
    render(<EquipmentDetailTemperatureTab displayEquipment={{ id: 42 }} isEditing={false} />)
    for (const [label, option] of [
      ["Hồ sơ ca", "Hai ca"],
      ["Cách ghi nhận", "Thiết bị"],
      ["Phụ trách chính", "Thay thế"],
    ]) {
      await user.click(screen.getByRole("combobox", { name: label }))
      await user.click(await screen.findByRole("option", { name: option }))
    }
    await user.click(screen.getByLabelText("Nhân sự thay thế"))
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Thay thế" }))
    expect(screen.getByRole("menuitemcheckbox", { name: "#9 (đã chọn)" })).toBeChecked()
    await user.keyboard("{Escape}")
    await user.type(screen.getByLabelText("Lý do thay đổi"), "Đổi phân công")
    await user.click(screen.getByRole("button", { name: "Lưu cấu hình nhiệt độ" }))
    await waitFor(() => expect(mock.save).toHaveBeenCalledTimes(1))
    expect(mock.save.mock.calls[0][0].args).toMatchObject({
      p_schedule_profile_id: "alternate",
      p_recording_method_code: "device",
      p_responsible_primary_user_id: 8,
      p_responsible_substitute_user_ids: [9],
    })
  })

  it("shows a failed save and allows retrying the same form", async () => {
    mock.save.mockRejectedValueOnce(new Error("unavailable"))
    const user = userEvent.setup()
    render(<EquipmentDetailTemperatureTab displayEquipment={{ id: 42 }} isEditing={false} />)
    await user.type(screen.getByLabelText("Lý do thay đổi"), "Thử lưu")
    await user.click(screen.getByRole("button", { name: "Lưu cấu hình nhiệt độ" }))
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/không lưu được cấu hình/i)
    )
    await user.click(screen.getByRole("button", { name: "Lưu cấu hình nhiệt độ" }))
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Đã lưu phiên bản cấu hình.")
    )
  })
})
