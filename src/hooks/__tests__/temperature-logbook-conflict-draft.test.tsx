import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { useLayoutEffect } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TemperatureMonitoringPageClient } from "@/app/(app)/temperature-monitoring/TemperatureMonitoringPageClient"
import { useTemperatureLogbook } from "../use-temperature-logbook"

vi.mock("@/components/shared/SideSheetShell", () => ({
  SideSheetShell: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode
    open: boolean
    onOpenChange: (open: boolean) => void
  }) =>
    open ? (
      <section>
        <button type="button" onClick={() => onOpenChange(false)}>
          Đóng sổ
        </button>
        {children}
      </section>
    ) : null,
}))

const mock = vi.hoisted(() => ({
  mutate: vi.fn(),
  query: vi.fn(),
  rows: [] as Record<string, unknown>[],
  workspace: vi.fn(),
  toast: vi.fn(),
  dismiss: vi.fn(),
}))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("equipment=42") }))
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: 7, role: "user" } } }),
}))
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }))
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mock.toast, dismiss: mock.dismiss }),
}))
vi.mock("@/hooks/use-temperature-monitoring", () => ({
  useTemperatureMutation: () => ({ mutateAsync: mock.mutate, isPending: false }),
  useTemperatureQuery: (...args: unknown[]) => mock.query(...args),
  useTemperatureWorkspace: (args: unknown) => {
    mock.workspace(args)
    return {
      data: { items: mock.rows, server_now: "2026-07-02T16:00:00Z" },
      dataUpdatedAt: Date.now(),
    }
  },
}))

const slot = {
  equipment_id: 42,
  equipment_code: "TM-42",
  equipment_name: "Tủ lạnh",
  monitoring_date: "2026-07-02",
  shift_id: "night",
  shift_code: "dem",
  shift_name: "Đêm",
  slot_start: "2026-07-02T15:00:00Z",
  slot_end: "2026-07-02T23:00:00Z",
  display_timezone: "Asia/Ho_Chi_Minh",
  configuration_version_id: "config-1",
  lower_c: 2,
  upper_c: 8,
  recording_method_code: "manual",
  recording_method_name: "Nhập tay",
  status: "Chưa ghi",
  reading_id: null,
  value_c: null,
}

describe("temperature measurement conflict drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.toast.mockReturnValue({ id: "prompt-1", dismiss: mock.dismiss })
    mock.rows = [slot]
    mock.query.mockReturnValue({})
  })

  it("keeps the unsaved form mounted while viewing a conflict and proposing an amendment", async () => {
    mock.query.mockImplementation((fn: string, args: { p_reading_id?: string }) =>
      fn === "temperature_monitoring_reading_get" && args.p_reading_id === "existing-reading"
        ? {
            data: {
              reading: {
                id: "existing-reading",
                captured_at: "2026-07-02T16:00:00Z",
                created_at: "2026-07-02T16:01:00Z",
                operator_user_id: 8,
                value_c: 7,
                unable_reason: null,
              },
              effective: { value_c: 7, unable_reason: null, author_user_id: 8 },
              review_required: false,
              review_state: "confirmed",
              pending_amendment_id: null,
              pending_amendment: null,
              revision: 1,
            },
          }
        : {}
    )
    mock.mutate.mockResolvedValueOnce({
      outcome: "conflict",
      reading: { id: "existing-reading" },
      next_action: "amendment",
    })
    const view = render(<TemperatureMonitoringPageClient />)
    fireEvent.change(screen.getByLabelText("Nhiệt độ (°C)"), { target: { value: "5" } })
    fireEvent.change(screen.getByLabelText(/Giờ đo thực tế/), {
      target: { value: "2026-07-02T22:30" },
    })
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "Bản nháp chưa lưu" } })
    fireEvent.submit(screen.getByRole("button", { name: "Lưu số đo" }).closest("form")!)
    await waitFor(() =>
      expect(
        screen.getByText(
          "Bản nháp chưa được lưu. Xem bản ghi hiện tại trước khi đề xuất điều chỉnh."
        )
      ).toBeInTheDocument()
    )

    mock.rows = [{ ...slot, reading_id: "existing-reading", value_c: 7 }]
    view.rerender(<TemperatureMonitoringPageClient />)
    expect(screen.getByLabelText("Nhiệt độ (°C)")).toHaveValue(5)
    expect(screen.getByLabelText(/Giờ đo thực tế/)).toHaveValue("2026-07-02T22:30")
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Bản nháp chưa lưu")
    fireEvent.click(screen.getByRole("button", { name: "Xem bản ghi hiện tại" }))
    await waitFor(() =>
      expect(mock.query).toHaveBeenCalledWith(
        "temperature_monitoring_reading_get",
        { p_reading_id: "existing-reading" },
        true
      )
    )
    expect(screen.getByLabelText("Nhiệt độ (°C)")).toHaveValue(5)
    expect(screen.getByLabelText(/Giờ đo thực tế/)).toHaveValue("2026-07-02T22:30")
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Bản nháp chưa lưu")
    expect(screen.getByLabelText("Thao tác")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Thao tác"), { target: { value: "amend" } })
    fireEvent.change(screen.getByLabelText("Số đo đề xuất"), { target: { value: "6" } })
    fireEvent.change(screen.getByLabelText("Lý do thao tác"), { target: { value: "Đọc lại" } })
    fireEvent.submit(screen.getByRole("button", { name: "Gửi thao tác" }).closest("form")!)
    await waitFor(() => expect(mock.mutate).toHaveBeenCalledTimes(2))
    expect(mock.mutate.mock.calls[1][0]).toMatchObject({
      fn: "temperature_monitoring_amendment_create",
      args: { p_reading_id: "existing-reading", p_value_c: 6, p_reason: "Đọc lại" },
    })
    expect(mock.mutate.mock.calls[1][0].args).not.toHaveProperty("p_captured_at")
    expect(mock.mutate.mock.calls[1][0].args).not.toHaveProperty("p_note")
    expect(screen.getByLabelText("Nhiệt độ (°C)")).toHaveValue(5)
    expect(screen.getByLabelText(/Giờ đo thực tế/)).toHaveValue("2026-07-02T22:30")
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Bản nháp chưa lưu")
  })

  it("keeps a dirty sheet until the explicit toast action and rechecks pending saves", async () => {
    let finish!: (value: Record<string, unknown>) => void
    mock.mutate.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const { result } = renderHook(() => useTemperatureLogbook())
    act(() => {
      result.current.openSlot(slot as never)
      result.current.markDirty()
      result.current.closeSheet()
    })
    expect(mock.toast).toHaveBeenCalledTimes(1)
    expect(result.current.slot).not.toBeNull()
    const prompt = mock.toast.mock.calls[0][0]
    const action = prompt.action as React.ReactElement<{ onClick: () => void }>
    expect(prompt.description).toMatch(/chưa lưu/i)
    await act(async () => action.props.onClick())
    expect(result.current.slot).toBeNull()

    act(() => {
      result.current.openSlot(slot as never)
      result.current.markDirty()
      result.current.closeSheet()
    })
    const form = new FormData()
    form.set("value", "5")
    form.set("captured", "2026-07-02T16:00Z")
    let saving!: Promise<void>
    act(() => {
      saving = result.current.submitReading(form)
    })
    act(() => result.current.closeSheet())
    const pendingPrompt = mock.toast.mock.calls.at(-1)?.[0]
    const pendingAction = pendingPrompt.action as React.ReactElement<{ onClick: () => void }>
    await act(async () => pendingAction.props.onClick())
    expect(result.current.message).toBe("Đang lưu, vui lòng đợi.")
    expect(result.current.slot).not.toBeNull()
    await act(async () => {
      finish({ reading: { id: "reading-42" }, outcome: "created" })
      await saving
    })
    await act(async () => pendingAction.props.onClick())
    expect(result.current.slot?.reading_id).toBe("reading-42")
  })

  it("recreates a discarded toast action after replacement without losing the draft", () => {
    render(<TemperatureMonitoringPageClient />)
    fireEvent.click(screen.getByRole("button", { name: /Mở sổ Tủ lạnh/ }))
    fireEvent.input(screen.getByLabelText("Nhiệt độ (°C)"), { target: { value: "5" } })
    fireEvent.input(screen.getByLabelText(/Giờ đo thực tế/), {
      target: { value: "2026-07-02T22:30" },
    })
    fireEvent.input(screen.getByLabelText("Ghi chú"), { target: { value: "Bản nháp chưa lưu" } })
    fireEvent.click(screen.getByRole("button", { name: "Đóng sổ" }))

    const firstPrompt = mock.toast.mock.calls[0][0]
    const firstAction = (firstPrompt.action as React.ReactPortal).children as React.ReactElement<{
      onClick: () => void
    }>

    // ADD_TOAST keeps only the latest toast and does not notify the removed toast.
    mock.toast({ title: "Thông báo khác" })
    expect(screen.getByLabelText("Nhiệt độ (°C)")).toHaveValue(5)
    expect(screen.getByLabelText(/Giờ đo thực tế/)).toHaveValue("2026-07-02T22:30")
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Bản nháp chưa lưu")

    fireEvent.click(screen.getByRole("button", { name: "Đóng sổ" }))
    expect(mock.toast).toHaveBeenCalledTimes(3)

    const retryPrompt = mock.toast.mock.calls[2][0]
    const retryAction = (retryPrompt.action as React.ReactPortal).children as React.ReactElement<{
      onClick: () => void
    }>
    act(() => firstAction.props.onClick())
    expect(screen.getByLabelText("Nhiệt độ (°C)")).toHaveValue(5)
    expect(screen.getByLabelText(/Giờ đo thực tế/)).toHaveValue("2026-07-02T22:30")
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Bản nháp chưa lưu")

    act(() => retryAction.props.onClick())
    expect(screen.queryByLabelText("Nhiệt độ (°C)")).not.toBeInTheDocument()
  })

  it("ignores a stale discard action after the active slot changes", () => {
    const staleAction: { current: (() => void) | null } = { current: null }
    const { result } = renderHook(() => {
      const logbook = useTemperatureLogbook()
      useLayoutEffect(() => {
        if (logbook.slot?.shift_id === "day") staleAction.current?.()
      }, [logbook.slot?.shift_id])
      return logbook
    })
    act(() => {
      result.current.openSlot(slot as never)
      result.current.markDirty()
      result.current.closeSheet()
    })
    const prompt = mock.toast.mock.calls[0][0]
    const action = prompt.action as React.ReactElement<{ onClick: () => void }>
    const nextSlot = { ...slot, shift_id: "day", monitoring_date: "2026-07-03" }

    staleAction.current = action.props.onClick
    act(() => result.current.setSelected(nextSlot as never))

    expect(result.current.slot?.shift_id).toBe("day")
    act(() => result.current.closeSheet())
    expect(mock.toast).toHaveBeenCalledTimes(2)
    expect(result.current.slot?.shift_id).toBe("day")
  })
})
