import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query"
import { expect, it, vi } from "vitest"
import { EquipmentDetailConfigTab } from "@/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailConfigTab"

const { callRpc } = vi.hoisted(() => ({ callRpc: vi.fn() }))
vi.mock("@/lib/rpc-client", () => ({ callRpc }))
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "302", role: "to_qltb", don_vi: 17 } } }),
}))
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/components/equipment/equipment-table-columns", () => ({ columnLabels: {} }))

it("keeps the existing mutation pending through page refetch and reopens with server configuration", async () => {
  let finishWrite!: () => void
  let finishRefetch!: () => void
  const write = new Promise<void>((resolve) => {
    finishWrite = resolve
  })
  const refetch = new Promise<void>((resolve) => {
    finishRefetch = resolve
  })
  let saved = false
  const configuration = {
    monitoring_enabled: true,
    lower_c: 2,
    upper_c: 8,
    schedule_profile_id: "profile",
    display_timezone: "Asia/Ho_Chi_Minh",
    recording_method_code: "manual",
    responsible_primary_user_id: 252,
    responsible_substitute_user_ids: [],
  }
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
        suggested_effective_from: saved ? "2026-10-25T17:00:00Z" : "2026-10-24T17:00:00Z",
        configuration: saved ? configuration : null,
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
    return { data: [{ id: 3779, temperature_monitoring_enabled: saved }] }
  })
  const observer = new QueryObserver(client, { queryKey: equipmentKey, queryFn: pageQuery })
  const unsubscribe = observer.subscribe(() => {})
  const user = userEvent.setup()
  const detail = () => (
    <QueryClientProvider client={client}>
      <EquipmentDetailConfigTab
        displayEquipment={{ id: 3779, ten_thiet_bi: "Ngân hàng máu, 180 túi" }}
        isEditing={false}
      />
    </QueryClientProvider>
  )
  const view = render(detail())
  try {
    await user.click(await screen.findByRole("checkbox", { name: "Bật theo dõi nhiệt độ" }))
    await user.type(screen.getByLabelText("Ngưỡng dưới °C"), "2")
    await user.type(screen.getByLabelText("Ngưỡng trên °C"), "8")
    await user.selectOptions(screen.getByLabelText("Phụ trách chính"), "252")
    await user.type(screen.getByLabelText("Lý do thay đổi"), "Bật theo dõi nhiệt độ")
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
    expect(screen.getByRole("button", { name: "Lưu cấu hình nhiệt độ" })).toBeEnabled()
    expect(client.getQueryData(equipmentKey)).toEqual({
      data: [{ id: 3779, temperature_monitoring_enabled: true }],
    })

    view.rerender(<QueryClientProvider client={client}>{null}</QueryClientProvider>)
    view.rerender(detail())
    expect(await screen.findByRole("checkbox", { name: "Bật theo dõi nhiệt độ" })).toBeChecked()
    expect(screen.getByLabelText("Ngưỡng dưới °C")).toHaveValue(2)
  } finally {
    view.unmount()
    unsubscribe()
    client.clear()
  }
})
