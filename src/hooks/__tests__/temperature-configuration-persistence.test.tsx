import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query"
import { beforeEach, expect, it, vi } from "vitest"
import { EquipmentDetailTemperatureTab } from "@/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailTemperatureTab"
import { EquipmentDetailDialog } from "@/app/(app)/equipment/_components/EquipmentDetailDialog"
import type { TemperatureChoices } from "@/types/temperature-monitoring"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"

const { callRpc, session, dialogOpenChange } = vi.hoisted(() => ({
  callRpc: vi.fn(),
  session: { role: "to_qltb" },
  dialogOpenChange: vi.fn(),
}))
vi.mock("@/lib/rpc-client", () => ({ callRpc }))
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "302", role: session.role, don_vi: 17 } } }),
}))
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/components/equipment/equipment-table-columns", () => ({ columnLabels: {} }))
vi.mock("@/app/(app)/equipment/_hooks/useEquipmentContext", () => ({
  useEquipmentContext: () => ({ openDeleteDialog: vi.fn() }),
}))
vi.mock("@/hooks/use-equipment-status-catalog", async () => {
  const { readyStatusCatalog } = await import("@/hooks/__tests__/equipment-status-catalog-fixtures")
  return { useEquipmentStatusCatalog: () => readyStatusCatalog }
})
vi.mock(
  "@/app/(app)/equipment/_components/EquipmentDetailDialog/hooks/useEquipmentHistory",
  () => ({
    useEquipmentHistory: () => ({ history: [], isLoading: false }),
  })
)
vi.mock(
  "@/app/(app)/equipment/_components/EquipmentDetailDialog/hooks/useEquipmentAttachments",
  () => ({
    useEquipmentAttachments: () => ({
      attachments: [],
      isLoading: false,
      addAttachment: vi.fn(),
      deleteAttachment: vi.fn(),
      isAdding: false,
      isDeleting: false,
    }),
  })
)

// configuration_get LEFT JOINs the currently effective version; future-only
// versions leave these columns null, even though the configuration row exists.
const scheduledConfiguration: NonNullable<TemperatureChoices["configuration"]> = {
  monitoring_enabled: false,
  lower_c: null,
  upper_c: null,
  schedule_profile_id: null,
  display_timezone: null,
  recording_method_code: null,
  responsible_primary_user_id: null,
  responsible_substitute_user_ids: null,
}

beforeEach(() => {
  session.role = "to_qltb"
  dialogOpenChange.mockClear()
})

function detailDialog() {
  return (
    <EquipmentDetailDialog
      equipment={{ id: 3779, ten_thiet_bi: "Ngân hàng máu, 180 túi", ma_thiet_bi: "TB-3779" }}
      open
      onOpenChange={dialogOpenChange}
      user={{ id: 302, role: session.role, khoa_phong: null }}
      isRegionalLeader={false}
      equipmentDataset="regular"
      onGenerateProfileSheet={vi.fn()}
      onGenerateDeviceLabel={vi.fn()}
      onEquipmentUpdated={vi.fn()}
    />
  )
}

it.each([
  { state: "future-only", enabled: false, lower: null, upper: null },
  { state: "enabled without an effective version", enabled: true, lower: null, upper: null },
  { state: "missing the lower bound", enabled: true, lower: null, upper: 8 },
  { state: "missing the upper bound", enabled: true, lower: 2, upper: null },
  { state: "zero lower bound", enabled: true, lower: 0, upper: 8 },
  { state: "zero upper bound", enabled: true, lower: -2, upper: 0 },
])(
  "lazily opens the temperature tab and displays a safe summary when $state",
  async ({ enabled, lower, upper }) => {
    const configuration = {
      ...scheduledConfiguration,
      monitoring_enabled: enabled,
      lower_c: lower,
      upper_c: upper,
    }
    const expectedSummary =
      lower === null || upper === null
        ? "Chưa bật theo dõi nhiệt độ"
        : `${lower}–${upper} °C · manual · Asia/Ho_Chi_Minh`
    if (lower !== null && upper !== null) {
      configuration.recording_method_code = "manual"
      configuration.display_timezone = "Asia/Ho_Chi_Minh"
    }
    callRpc.mockReset()
    callRpc.mockImplementation(async ({ fn }: { fn: string }) => {
      if (fn === "temperature_monitoring_configuration_choices") {
        return {
          configuration,
          methods: [],
          profiles: [],
          server_now: "2026-10-27T03:00:00Z",
          suggested_effective_from: null,
        }
      }
      if (fn === "temperature_monitoring_staff_choices") return { items: [], next_cursor: null }
      throw new Error(`unexpected RPC ${fn}`)
    })
    const user = userEvent.setup()
    const client = createTestQueryClient()
    const view = render(detailDialog(), { wrapper: createReactQueryWrapper(client) })
    try {
      const dialog = within(screen.getByRole("dialog"))
      const details = dialog.getByRole("tab", { name: "Thông tin chi tiết" })
      const config = dialog.getByRole("tab", { name: "Cấu hình & Phụ kiện" })
      const temperature = dialog.getByRole("tab", { name: "Sổ theo dõi nhiệt độ" })
      const tabs = dialog.getAllByRole("tab")
      expect(tabs[tabs.indexOf(config) + 1]).toBe(temperature)
      expect(details).toHaveAttribute("aria-selected", "true")
      expect(dialog.queryByRole("checkbox", { name: "Bật theo dõi nhiệt độ" })).toBeNull()
      expect(callRpc).not.toHaveBeenCalled()

      await user.click(config)
      expect(config).toHaveAttribute("aria-selected", "true")
      expect(dialog.queryByRole("checkbox", { name: "Bật theo dõi nhiệt độ" })).toBeNull()
      expect(callRpc).not.toHaveBeenCalled()

      await user.keyboard("{ArrowRight}")
      expect(temperature).toHaveAttribute("aria-selected", "true")
      const panel = within(dialog.getByRole("tabpanel", { name: "Sổ theo dõi nhiệt độ" }))
      expect(await panel.findByRole("checkbox", { name: "Bật theo dõi nhiệt độ" })).toHaveProperty(
        "checked",
        enabled
      )
      expect(panel.getByText(expectedSummary)).toBeInTheDocument()
      expect(panel.getByRole("button", { name: "Lưu cấu hình nhiệt độ" })).toBeDisabled()

      await user.click(details)
      await user.click(temperature)
      expect(temperature).toHaveAttribute("aria-selected", "true")
      expect(await dialog.findByRole("checkbox", { name: "Bật theo dõi nhiệt độ" })).toHaveProperty(
        "checked",
        enabled
      )
      expect(dialog.getByText(expectedSummary)).toBeInTheDocument()
      expect(
        callRpc.mock.calls.filter(
          ([request]) => request.fn === "temperature_monitoring_configuration_upsert"
        )
      ).toHaveLength(0)
    } finally {
      view.unmount()
      client.clear()
    }
  }
)

it.each([
  { state: "currently effective", effective: true },
  { state: "scheduled for a future boundary", effective: false },
])("keeps saving and reopening safe when the configuration is $state", async ({ effective }) => {
  callRpc.mockReset()
  let finishWrite!: () => void
  let finishRefetch!: () => void
  const write = new Promise<void>((resolve) => {
    finishWrite = resolve
  })
  const refetch = new Promise<void>((resolve) => {
    finishRefetch = resolve
  })
  let saved = false
  const configuration: NonNullable<TemperatureChoices["configuration"]> = {
    monitoring_enabled: true,
    lower_c: 2,
    upper_c: 8,
    schedule_profile_id: "profile",
    display_timezone: "Asia/Ho_Chi_Minh",
    recording_method_code: "manual",
    responsible_primary_user_id: 252,
    responsible_substitute_user_ids: [],
  }
  const savedConfiguration = effective ? configuration : scheduledConfiguration
  const nextBoundary = effective ? "2026-10-25T17:00:00Z" : null
  callRpc.mockImplementation(async ({ fn }: { fn: string }) => {
    if (fn === "temperature_monitoring_configuration_upsert") {
      await write
      saved = true
      return {}
    }
    if (fn === "temperature_monitoring_configuration_choices") {
      return {
        methods: [{ code: "manual", name: "Nhập tay" }],
        profiles: [{ id: "profile", code: "default", name: "Bốn ca" }],
        server_now: saved ? "2026-10-24T17:00:00Z" : "2026-10-24T16:59:59Z",
        suggested_effective_from: saved ? nextBoundary : "2026-10-24T17:00:00Z",
        configuration: saved ? savedConfiguration : null,
      }
    }
    if (fn === "temperature_monitoring_staff_choices") {
      return { items: [{ id: 252, full_name: "Khoa Xét Nghiệm" }], next_cursor: null }
    }
    throw new Error(`unexpected RPC ${fn}`)
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const equipmentKey = ["equipment_list_enhanced", { donVi: 17, page: 0, size: 20 }]
  const pageQuery = vi.fn(async () => {
    if (saved) await refetch
    return { data: [{ id: 3779, temperature_monitoring_enabled: saved && effective }] }
  })
  const observer = new QueryObserver(client, { queryKey: equipmentKey, queryFn: pageQuery })
  const unsubscribe = observer.subscribe(() => {})
  const user = userEvent.setup()
  const detail = () => <QueryClientProvider client={client}>{detailDialog()}</QueryClientProvider>
  const view = render(detail())
  try {
    await user.click(screen.getByRole("tab", { name: "Sổ theo dõi nhiệt độ" }))
    await user.click(await screen.findByRole("checkbox", { name: "Bật theo dõi nhiệt độ" }))
    await user.type(screen.getByLabelText("Ngưỡng dưới °C"), "2")
    await user.type(screen.getByLabelText("Ngưỡng trên °C"), "8")
    await user.click(screen.getByRole("combobox", { name: "Phụ trách chính" }))
    await user.click(await screen.findByRole("option", { name: "Khoa Xét Nghiệm" }))
    await user.type(screen.getByLabelText("Lý do thay đổi"), "Bật theo dõi nhiệt độ")
    const primary = screen.getByRole("combobox", { name: "Phụ trách chính" })
    await user.click(primary)
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("listbox")).toBeNull()
    expect(primary).toHaveFocus()
    expect(dialogOpenChange).not.toHaveBeenCalledWith(false)
    const substitutes = screen.getByLabelText("Nhân sự thay thế")
    await user.click(substitutes)
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Khoa Xét Nghiệm" }))
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("menu")).toBeNull()
    expect(substitutes).toHaveFocus()
    expect(dialogOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByLabelText("Lý do thay đổi")).toHaveValue("Bật theo dõi nhiệt độ")
    await user.click(screen.getByRole("button", { name: "Lưu cấu hình nhiệt độ" }))

    const saving = await screen.findByRole("button", { name: "Đang lưu…" })
    expect(saving).toBeDisabled()
    expect(saving).toHaveAttribute("aria-busy", "true")
    expect(saving.querySelector("svg.animate-spin")).toHaveAttribute("aria-hidden", "true")
    await user.click(saving)
    expect(
      callRpc.mock.calls.filter(
        ([request]) => request.fn === "temperature_monitoring_configuration_upsert"
      )
    ).toHaveLength(1)
    expect(callRpc).toHaveBeenCalledWith({
      fn: "temperature_monitoring_configuration_upsert",
      args: expect.objectContaining({
        p_monitoring_enabled: true,
        p_effective_from: "2026-10-24T17:00:00Z",
      }),
    })
    expect(client.getQueryData(equipmentKey)).toEqual({
      data: [{ id: 3779, temperature_monitoring_enabled: false }],
    })

    await act(async () => {
      finishWrite()
    })
    await waitFor(() => expect(pageQuery).toHaveBeenCalledTimes(2))
    expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled()
    expect(screen.getByRole("status")).not.toHaveTextContent("Đã lưu phiên bản cấu hình.")

    await act(async () => {
      finishRefetch()
    })
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Đã lưu phiên bản cấu hình.")
    )
    expect(screen.getByRole("button", { name: "Lưu cấu hình nhiệt độ" })).toHaveProperty(
      "disabled",
      !effective
    )
    expect(client.getQueryData(equipmentKey)).toEqual({
      data: [{ id: 3779, temperature_monitoring_enabled: effective }],
    })

    await user.click(screen.getByRole("tab", { name: "Thông tin chi tiết" }))
    await user.click(screen.getByRole("tab", { name: "Sổ theo dõi nhiệt độ" }))
    expect(await screen.findByRole("checkbox", { name: "Bật theo dõi nhiệt độ" })).toHaveProperty(
      "checked",
      effective
    )
    view.rerender(<QueryClientProvider client={client}>{null}</QueryClientProvider>)
    view.rerender(detail())
    await user.click(screen.getByRole("tab", { name: "Sổ theo dõi nhiệt độ" }))
    const checkbox = await screen.findByRole("checkbox", { name: "Bật theo dõi nhiệt độ" })
    expect(checkbox).toHaveProperty("checked", effective)
    expect(screen.getByLabelText("Ngưỡng dưới °C")).toHaveValue(effective ? 2 : null)
    await user.keyboard("{Escape}")
    expect(dialogOpenChange).toHaveBeenCalledWith(false)
  } finally {
    view.unmount()
    unsubscribe()
    client.clear()
  }
})

it.each(["admin", "global", "to_qltb", "user"])(
  "keeps the temperature tab visible and scopes configuration controls for %s",
  async (role) => {
    session.role = role
    const manager = role !== "user"
    callRpc.mockReset()
    callRpc.mockImplementation(async ({ fn }: { fn: string }) => {
      if (fn === "temperature_monitoring_configuration_choices")
        return {
          configuration: null,
          methods: [{ code: "manual", name: "Nhập tay" }],
          profiles: [{ id: "profile", code: "default", name: "Bốn ca" }],
          server_now: "2026-10-27T03:00:00Z",
          suggested_effective_from: "2026-10-27T17:00:00Z",
        }
      if (fn === "temperature_monitoring_staff_choices") return { items: [], next_cursor: null }
      if (fn === "temperature_monitoring_configuration_get")
        return [
          {
            ...scheduledConfiguration,
            monitoring_enabled: true,
            lower_c: 0,
            upper_c: 8,
            recording_method_code: "manual",
            display_timezone: "Asia/Ho_Chi_Minh",
          },
        ]
      throw new Error(`unexpected RPC ${fn}`)
    })
    const client = createTestQueryClient()
    const user = userEvent.setup()
    const view = render(detailDialog(), { wrapper: createReactQueryWrapper(client) })
    try {
      await user.click(screen.getByRole("tab", { name: "Sổ theo dõi nhiệt độ" }))
      if (manager) {
        expect(await screen.findByRole("button", { name: "Lưu cấu hình nhiệt độ" })).toBeEnabled()
        expect(screen.getByRole("checkbox", { name: "Bật theo dõi nhiệt độ" })).not.toBeChecked()
        expect(callRpc).toHaveBeenCalledWith(
          expect.objectContaining({
            fn: "temperature_monitoring_configuration_choices",
            args: { p_equipment_id: 3779 },
          })
        )
      } else {
        expect(await screen.findByText("0–8 °C · manual · Asia/Ho_Chi_Minh")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Lưu cấu hình nhiệt độ" })).toBeNull()
        expect(screen.queryByRole("combobox")).toBeNull()
        expect(screen.getByRole("link", { name: "Mở sổ nhiệt độ" })).toHaveAttribute(
          "href",
          "/temperature-monitoring?equipment=3779"
        )
        expect(callRpc.mock.calls.map(([request]) => request.fn)).toEqual([
          "temperature_monitoring_configuration_get",
        ])
      }
    } finally {
      view.unmount()
      client.clear()
    }
  }
)

it("does not query or render temperature configuration while equipment editing", () => {
  callRpc.mockReset()
  const client = createTestQueryClient()
  const view = render(<EquipmentDetailTemperatureTab displayEquipment={{ id: 3779 }} isEditing />, {
    wrapper: createReactQueryWrapper(client),
  })
  expect(callRpc).not.toHaveBeenCalled()
  expect(screen.queryByRole("button", { name: "Lưu cấu hình nhiệt độ" })).toBeNull()
  view.unmount()
  client.clear()
})
