import { act, renderHook, render, screen, fireEvent, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TemperatureMonitoringPageClient } from "@/app/(app)/temperature-monitoring/TemperatureMonitoringPageClient"
import { useTemperatureLogbook } from "../use-temperature-logbook"

vi.mock("@/components/shared/SideSheetShell", () => ({
  SideSheetShell: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <section>{children}</section> : null,
}))

const mock = vi.hoisted(() => ({
  mutate: vi.fn(),
  query: vi.fn(),
  rows: [] as Record<string, unknown>[],
  role: "user",
  searchParams: "equipment=42",
  workspace: vi.fn(),
  toast: vi.fn(),
  dismiss: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mock.searchParams),
}))
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: 7, role: mock.role } } }),
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
  shift_id: "night",
  monitoring_date: "2026-07-02",
  slot_start: "2026-07-02T15:00:00Z",
  slot_end: "2026-07-02T23:00:00Z",
  lower_c: 2,
  upper_c: 8,
  reading_id: null,
}

describe("per-device persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.searchParams = "equipment=42"
    mock.toast.mockReturnValue({ id: "prompt-1", dismiss: mock.dismiss })
    mock.rows = [slot]
    mock.role = "user"
    mock.query.mockReturnValue({ data: undefined })
  })
  it("saves the abnormal observation first, then preserves it when corrective action fails", async () => {
    mock.mutate.mockResolvedValueOnce({
      reading: { id: "reading-42" },
      effective: { value_c: 9 },
      outcome: "created",
    })
    const { result } = renderHook(() => useTemperatureLogbook())
    const observation = new FormData()
    observation.set("value", "9")
    observation.set("captured", "2026-07-02T16:00:00Z")
    await act(() => result.current.submitReading(observation))
    expect(mock.mutate).toHaveBeenCalledTimes(1)
    expect(mock.mutate.mock.calls[0][0].fn).toBe("temperature_monitoring_measurement_create")
    expect(result.current.slot?.reading_id).toBe("reading-42")
    expect(result.current.message).toContain("Đã lưu số đo bất thường")
    expect(result.current.captureDefault).toBe("2026-07-02T23:00:00")
    mock.query.mockImplementation((fn: string) =>
      fn === "temperature_monitoring_deviation_get"
        ? { data: { deviation: { id: "case-42", revision: 0 } } }
        : {}
    )
    mock.mutate.mockRejectedValue(new Error("corrective save failed"))
    act(() => result.current.setShowEvents(true))
    const action = new FormData()
    action.set("action", "update_action")
    action.set("immediate", "Kiểm tra nguồn")
    await act(() => result.current.submitDeviation(action))
    expect(result.current.slot?.reading_id).toBe("reading-42")
    expect(result.current.message).toContain("dữ liệu nhập vẫn còn")
    expect(result.current.message).not.toContain("corrective save failed")
    const request = mock.mutate.mock.calls[1][0].args.p_request_id
    await act(() => result.current.submitDeviation(action))
    expect(mock.mutate.mock.calls[2][0].args.p_request_id).toBe(request)
  })
  it("does not auto-select an ambiguous current slot or persist without explicit capture", async () => {
    mock.rows = [slot, { ...slot, shift_id: "overlap" }]
    const { result } = renderHook(() => useTemperatureLogbook())
    expect(result.current.slot).toBeNull()
    act(() => result.current.setSelected(slot as never))
    const container = document.createElement("div")
    container.innerHTML = '<input name="captured" />'
    document.body.append(container)
    result.current.sheetRef.current = container
    const form = new FormData()
    form.set("value", "5")
    await act(() => result.current.submitReading(form))
    expect(mock.mutate).not.toHaveBeenCalled()
    expect(result.current.message).toContain("Chọn giờ đo thực tế")
    expect(document.activeElement).toBe(container.firstChild)
    expect((container.firstChild as HTMLInputElement).validationMessage).toContain(
      "Chọn giờ đo thực tế"
    )
    act(() => result.current.markDirty())
    expect((container.firstChild as HTMLInputElement).validationMessage).toBe("")
    container.remove()
  })
  it("requires reasons for severity, cancellation, and reassignment while allowing unchanged assignment", async () => {
    mock.query.mockImplementation((fn: string) =>
      fn === "temperature_monitoring_deviation_get"
        ? { data: { deviation: { id: "case-42", revision: 0, owner_user_id: 8 } } }
        : {}
    )
    mock.mutate.mockResolvedValue({})
    const { result } = renderHook(() => useTemperatureLogbook())
    for (const action of ["severity", "cancel", "assign"]) {
      const form = new FormData()
      form.set("action", action)
      form.set("owner", "9")
      await act(() => result.current.submitDeviation(form))
      expect(mock.mutate).not.toHaveBeenCalled()
      expect(result.current.message).toBe("Nhập lý do thao tác.")
    }
    const form = new FormData()
    form.set("action", "assign")
    form.set("owner", "8")
    await act(() => result.current.submitDeviation(form))
    expect(mock.mutate).toHaveBeenCalledTimes(1)
    form.set("owner", "9")
    form.set("reason", "Thay ca")
    await act(() => result.current.submitDeviation(form))
    expect(mock.mutate).toHaveBeenCalledTimes(2)
  })
  it("offers only legal state transitions and returns focus to the opened device card", () => {
    mock.role = "to_qltb"
    let status = "Mở"
    mock.query.mockImplementation((fn: string) =>
      fn === "temperature_monitoring_deviation_get"
        ? { data: { deviation: { id: "case-42", revision: 0, status } } }
        : {}
    )
    const { result, rerender } = renderHook(() => useTemperatureLogbook())
    for (const [state, allowed, denied] of [
      ["Mở", "start", "close"],
      ["Đang xử lý", "submit_verification", "start"],
      ["Chờ xác minh", "close", "cancel"],
    ]) {
      status = state
      rerender()
      expect(result.current.deviationActions.map((action) => action.value)).toContain(allowed)
      expect(result.current.deviationActions.map((action) => action.value)).not.toContain(denied)
    }
    act(() => result.current.setDeviationAction("close"))
    status = "Mở"
    rerender()
    expect(result.current.deviationAction).toBe("update_action")
    const card = document.createElement("button")
    document.body.append(card)
    card.focus()
    act(() => result.current.openSlot(slot as never))
    card.blur()
    act(() => result.current.closeSheet())
    result.current.restoreFocus(new Event("close", { cancelable: true }))
    expect(document.activeElement).toBe(card)
    card.remove()
  })
  it("keeps history lifecycle filters separate and falls back to the list heading", () => {
    const { result } = renderHook(() => useTemperatureLogbook())
    act(() => result.current.setTab("history"))
    act(() => result.current.historyFilters[0].set("deviations"))
    act(() => result.current.historyFilters[1].set("Chờ xác minh"))
    expect(mock.workspace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        p_kind: "deviations",
        p_deviation_status: "Chờ xác minh",
        p_status: null,
      })
    )
    act(() => result.current.setTab("current"))
    expect(mock.workspace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        p_kind: "readings",
        p_deviation_status: null,
        p_status: "current",
      })
    )
    act(() => result.current.setTab("history"))
    expect(result.current.historyFilters[1].value).toBe("Chờ xác minh")
    const heading = document.createElement("h1")
    heading.tabIndex = -1
    document.body.append(heading)
    result.current.headingRef.current = heading
    result.current.restoreFocus(new Event("close", { cancelable: true }))
    expect(document.activeElement).toBe(heading)
    heading.remove()
  })
  it("retains measurement draft and edits made while a failed save is pending", async () => {
    let reject!: (error: Error) => void
    mock.mutate.mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail
        })
    )
    render(<TemperatureMonitoringPageClient />)
    fireEvent.change(screen.getByLabelText("Nhiệt độ (°C)"), { target: { value: "5" } })
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "draft" } })
    fireEvent.submit(screen.getByRole("button", { name: "Lưu số đo" }).closest("form")!)
    await waitFor(() => expect(mock.mutate).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "edited while saving" } })
    await act(async () => reject(new Error("RPC unavailable")))
    await waitFor(() => expect(screen.getByText(/Không lưu được/)).toBeInTheDocument())
    expect(screen.getByLabelText("Nhiệt độ (°C)")).toHaveValue(5)
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("edited while saving")
    expect(screen.getByLabelText(/Giờ đo thực tế/)).toHaveValue("2026-07-02T23:00")
  })
  it("rejects temperature boundaries and off-step values before sending the measurement", async () => {
    render(<TemperatureMonitoringPageClient />)
    const value = screen.getByLabelText("Nhiệt độ (°C)")
    const form = screen.getByRole("button", { name: "Lưu số đo" }).closest("form")!
    for (const invalid of ["-200.1", "300.1", "5.25"]) {
      fireEvent.change(value, { target: { value: invalid } })
      await act(async () => {
        fireEvent.submit(form)
      })
      expect(mock.mutate).not.toHaveBeenCalled()
      expect(value).toHaveValue(Number(invalid))
      expect(value).toHaveAttribute("aria-invalid", "true")
      expect(document.getElementById(value.getAttribute("aria-describedby")!)).toHaveAttribute(
        "role",
        "alert"
      )
    }
  })
  it("keeps same-slot drafts on refetch and starts a fresh draft in the next device timezone", async () => {
    const view = render(<TemperatureMonitoringPageClient />)
    fireEvent.change(screen.getByLabelText("Nhiệt độ (°C)"), { target: { value: "-200" } })
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "Thiết bị trước" } })
    view.rerender(<TemperatureMonitoringPageClient />)
    expect(screen.getByLabelText("Nhiệt độ (°C)")).toHaveValue(-200)
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Thiết bị trước")
    mock.rows = [{ ...slot, equipment_id: 43, display_timezone: "Asia/Tokyo" }]
    view.rerender(<TemperatureMonitoringPageClient />)
    expect(screen.getByLabelText("Nhiệt độ (°C)")).toHaveValue(null)
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("")
    expect(screen.getByLabelText(/Giờ đo thực tế/)).toHaveValue("2026-07-03T01:00")
    fireEvent.click(screen.getByLabelText("Không đo được"))
    fireEvent.change(screen.getByLabelText("Lý do không đo được"), {
      target: { value: "Mất điện" },
    })
    mock.mutate.mockResolvedValueOnce({
      reading: { id: "new-reading" },
      effective: { value_c: null },
    })
    fireEvent.submit(screen.getByRole("button", { name: "Lưu số đo" }).closest("form")!)
    await waitFor(() => expect(mock.mutate).toHaveBeenCalledTimes(1))
    expect(mock.mutate.mock.calls[0][0].args).toMatchObject({
      p_equipment_id: 43,
      p_value_c: null,
      p_unable_reason: "Mất điện",
      p_captured_at: "2026-07-02T16:00:00.000Z",
    })
  })
  it("registers the selected deviation operation and resets drafts only when the case changes", async () => {
    let deviation = {
      id: "case-42",
      revision: 0,
      status: "Mở",
      severity: "Nhẹ",
      immediate_action: "Đã kiểm tra",
      owner_user_id: null,
    }
    mock.rows = [{ ...slot, reading_id: "reading-42" }]
    mock.query.mockImplementation((fn: string) =>
      fn === "temperature_monitoring_deviation_get" ? { data: { deviation } } : {}
    )
    mock.mutate.mockResolvedValue({ outcome: "updated" })
    const view = render(<TemperatureMonitoringPageClient />)
    fireEvent.change(screen.getByLabelText("Xử lý ngay"), { target: { value: "Nháp chưa lưu" } })
    view.rerender(<TemperatureMonitoringPageClient />)
    expect(screen.getByLabelText("Xử lý ngay")).toHaveValue("Nháp chưa lưu")
    fireEvent.change(screen.getByLabelText("Thao tác"), { target: { value: "start" } })
    fireEvent.submit(screen.getByRole("button", { name: "Lưu xử lý" }).closest("form")!)
    await waitFor(() => expect(mock.mutate).toHaveBeenCalledTimes(1))
    expect(mock.mutate.mock.calls[0][0].args).toMatchObject({
      p_deviation_id: "case-42",
      p_action: "start",
    })
    expect(mock.mutate.mock.calls[0][0].args).not.toHaveProperty("p_immediate_action")
    deviation = { ...deviation, status: "Đang xử lý", revision: 1 }
    view.rerender(<TemperatureMonitoringPageClient />)
    expect(screen.getByLabelText("Thao tác")).toHaveValue("update_action")
    fireEvent.change(screen.getByLabelText("Xử lý ngay"), { target: { value: "Theo dõi tiếp" } })
    fireEvent.submit(screen.getByRole("button", { name: "Lưu xử lý" }).closest("form")!)
    await waitFor(() => expect(mock.mutate).toHaveBeenCalledTimes(2))
    expect(mock.mutate.mock.calls[1][0].args).toMatchObject({
      p_action: "update_action",
      p_immediate_action: "Theo dõi tiếp",
      p_expected_revision: 1,
    })
    deviation = { ...deviation, id: "case-43", immediate_action: "Thiết bị mới" }
    view.rerender(<TemperatureMonitoringPageClient />)
    fireEvent.change(screen.getByLabelText("Thao tác"), { target: { value: "update_action" } })
    expect(screen.getByLabelText("Xử lý ngay")).toHaveValue("Thiết bị mới")
  })
  it("keeps review operation, proposed value and reason after validation, RPC failure and conflict", async () => {
    let revision = 0
    let pending: { id: string; author_user_id: number } | undefined
    mock.role = "global"
    mock.rows = [{ ...slot, reading_id: "reading-42" }]
    mock.query.mockImplementation((fn: string) =>
      fn === "temperature_monitoring_reading_get"
        ? {
            data: {
              reading: {
                id: "reading-42",
                value_c: 5,
                captured_at: "2026-07-02T16:00Z",
                created_at: "2026-07-02T16:01Z",
                operator_user_id: 8,
              },
              effective: { value_c: 5, author_user_id: 8 },
              pending_amendment: pending,
              revision,
              review_required: true,
            },
          }
        : {}
    )
    const view = render(<TemperatureMonitoringPageClient />)
    const reason = screen.getByLabelText("Lý do thao tác")
    const value = screen.getByLabelText("Số đo đề xuất")
    const action = screen.getByLabelText("Thao tác")
    const submit = screen.getByRole("button", { name: "Gửi thao tác" }).closest("form")!
    fireEvent.change(reason, { target: { value: "Kiểm tra lại" } })
    fireEvent.submit(submit)
    await waitFor(() =>
      expect(screen.getByText("Nhập số đo đề xuất hoặc chọn không đo được.")).toBeInTheDocument()
    )
    expect(mock.mutate).not.toHaveBeenCalled()
    expect(reason).toHaveValue("Kiểm tra lại")
    expect(value).toHaveFocus()
    fireEvent.change(value, { target: { value: "6" } })
    let reject!: (error: Error) => void
    mock.mutate.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail
        })
    )
    fireEvent.submit(submit)
    await waitFor(() => expect(mock.mutate).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tất" }))
    expect(screen.getByText("Đang lưu, vui lòng đợi.")).toBeInTheDocument()
    fireEvent.change(reason, { target: { value: "Bổ sung khi đang lưu" } })
    await act(async () => reject(new Error("unavailable")))
    await waitFor(() => expect(screen.getByText(/Không lưu được/)).toBeInTheDocument())
    expect(value).toHaveValue(6)
    expect(reason).toHaveValue("Bổ sung khi đang lưu")
    expect(action).toHaveValue("amend")
    revision = 1
    view.rerender(<TemperatureMonitoringPageClient />)
    expect(value).toHaveValue(6)
    expect(reason).toHaveValue("Bổ sung khi đang lưu")
    mock.mutate.mockResolvedValueOnce({ outcome: "conflict" })
    fireEvent.submit(submit)
    await waitFor(() => expect(screen.getByText(/Dữ liệu đã thay đổi/)).toBeInTheDocument())
    expect(value).toHaveValue(6)
    expect(reason).toHaveValue("Bổ sung khi đang lưu")
    expect(action).toHaveValue("amend")
    expect(mock.mutate.mock.calls[1][0].args.p_expected_revision).toBe(1)
    pending = { id: "amendment-42", author_user_id: 9 }
    view.rerender(<TemperatureMonitoringPageClient />)
    expect(action).toHaveValue("approve_amendment")
    expect(value).toHaveValue(6)
    expect(reason).toHaveValue("Bổ sung khi đang lưu")
    mock.mutate.mockResolvedValueOnce({ outcome: "conflict" })
    fireEvent.submit(submit)
    await waitFor(() => expect(mock.mutate).toHaveBeenCalledTimes(3))
    expect(mock.mutate.mock.calls[2][0].args.p_amendment_id).toBe("amendment-42")
    expect(mock.mutate.mock.calls[2][0].args.p_action).toBe("approve_amendment")
  })

  it("prompts for one equipment before showing a trend in Lịch sử", () => {
    mock.searchParams = "date=2026-10-18"
    render(<TemperatureMonitoringPageClient />)
    expect(screen.getByRole("tab", { name: "Lịch sử" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Chọn một thiết bị để xem biểu đồ")).toBeInTheDocument()
  })
})
