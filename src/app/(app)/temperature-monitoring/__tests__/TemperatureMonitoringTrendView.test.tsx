import * as React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TemperatureSlot } from "@/types/temperature-monitoring"

const runtime = vi.hoisted(() => ({
  query: {
    data: undefined as TemperatureSlot[] | undefined,
    error: null as Error | null,
    isError: false,
    isFetching: false,
    isPending: true,
    refetch: vi.fn(),
  },
  hookArgs: undefined as Record<string, unknown> | undefined,
  hookEnabled: false,
  chart: undefined as
    | {
        data: Record<string, unknown>[]
        lines: {
          key: string
          type?: string
          connectNulls?: boolean
          dot?: React.ReactNode | ((props: Record<string, unknown>) => React.ReactNode)
        }[]
        xAxisProps?: {
          type?: string
          scale?: string
          domain?: [number | "dataMin", number | "dataMax"]
          tickFormatter?: (value: number | string) => string
        }
      }
    | undefined,
}))

vi.mock("@/hooks/use-temperature-trend", () => ({
  useTemperatureTrend: (args: Record<string, unknown>, enabled: boolean) => {
    runtime.hookArgs = args
    runtime.hookEnabled = enabled
    return runtime.query
  },
}))

vi.mock("@/components/dynamic-chart", () => ({
  DynamicLineChart: (props: typeof runtime.chart) => {
    runtime.chart = props ?? undefined
    const temperatureLine = props?.lines.find((line) => line.key === "value_c")
    const marker = temperatureLine?.dot
    return (
      <svg aria-label="Biểu đồ nhiệt độ">
        {props?.data.map((point, index) => (
          <React.Fragment key={index}>
            {typeof marker === "function"
              ? marker({ cx: 20 + index, cy: 30, payload: point })
              : React.isValidElement(marker)
                ? React.cloneElement(marker as React.ReactElement<Record<string, unknown>>, {
                    cx: 20 + index,
                    cy: 30,
                    payload: point,
                  })
                : null}
          </React.Fragment>
        ))}
      </svg>
    )
  },
}))

import { TemperatureMonitoringTrendView } from "../TemperatureMonitoringTrendView"

const observation = (index: number, overrides: Partial<TemperatureSlot> = {}): TemperatureSlot => ({
  equipment_id: 42,
  equipment_code: "FR-42",
  equipment_name: "Tủ lạnh vắc xin",
  monitoring_date: "2026-10-18",
  shift_id: "shift-" + index,
  shift_code: "Sáng",
  shift_name: "Ca sáng",
  slot_start: "2026-10-18T00:" + String(index % 60).padStart(2, "0") + ":00.000Z",
  slot_end: "2026-10-18T01:" + String(index % 60).padStart(2, "0") + ":00.000Z",
  display_timezone: "Asia/Ho_Chi_Minh",
  configuration_version_id: index >= 100 ? "config-2" : "config-1",
  lower_c: index >= 100 ? 3 : 2,
  upper_c: 8,
  recording_method_code: "manual",
  recording_method_name: "Nhập tay",
  status: "Đã ghi",
  reading_id: "reading-" + index,
  value_c: 5,
  captured_at: "2026-10-18T00:" + String(index % 60).padStart(2, "0") + ":30.000Z",
  created_at: "2026-10-18T00:00:40.000Z",
  operator_user_id: 17,
  proposal_author_user_id: null,
  revision: 0,
  state: null,
  deviation: null,
  note: "Ghi chú " + index,
  unable_reason: null,
  ...overrides,
})

const args = {
  p_equipment_id: 42,
  p_from_date: "2026-10-01",
  p_to_date: "2026-10-30",
  p_shift_codes: ["Sáng"],
  p_status: null,
  p_kind: "readings",
}

function setQuery(data: TemperatureSlot[], overrides: Partial<typeof runtime.query> = {}) {
  Object.assign(runtime.query, {
    data,
    error: null,
    isError: false,
    isFetching: false,
    isPending: false,
    ...overrides,
  })
}

describe("TemperatureMonitoringTrendView", () => {
  beforeEach(() => {
    runtime.query.refetch.mockReset()
    runtime.hookArgs = undefined
    runtime.hookEnabled = false
    runtime.chart = undefined
    setQuery([])
  })

  it("bounds the chronological chart window and keeps the full table paginated", () => {
    const rows = Array.from({ length: 201 }, (_, index) =>
      observation(
        index,
        index === 200
          ? {
              status: "Bất thường",
            }
          : index === 5
            ? {
                value_c: null,
                unable_reason: { reason: "Thiết bị đang bảo trì" },
                status: "Không đo được",
              }
            : {}
      )
    )
    setQuery(rows)

    render(<TemperatureMonitoringTrendView args={args} />)

    expect(runtime.hookEnabled).toBe(true)
    expect(runtime.hookArgs).toMatchObject(args)
    expect(screen.getByText("Đang vẽ 1–200/201 điểm; 1 bất thường ngoài khung")).toBeInTheDocument()
    expect(runtime.chart?.data.filter((point) => point.slot)).toHaveLength(200)
    expect(runtime.chart?.xAxisProps).toMatchObject({ type: "number", scale: "time" })
    expect(
      runtime.chart?.xAxisProps?.tickFormatter?.(Date.parse("2026-10-18T00:00:00.000Z"))
    ).toContain("07:00")
    expect(runtime.chart?.lines.find((line) => line.key === "value_c")).toMatchObject({
      type: "linear",
      connectNulls: false,
    })
    expect(runtime.chart?.data.some((point) => point.value_c === null)).toBe(true)
    expect(runtime.chart?.data.some((point) => point.slot === null && point.lower_c === null)).toBe(
      true
    )

    const table = screen.getByRole("table", { name: "Bảng lịch sử nhiệt độ" })
    expect(within(table).getAllByRole("row")).toHaveLength(51)
    expect(within(table).getByText("Ghi chú 0")).toBeInTheDocument()
    expect(within(table).queryByText("Ghi chú 50")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Trang bảng tiếp theo" }))
    expect(within(table).getByText("Ghi chú 50")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Chỉ xem bất thường" }))
    expect(within(table).getByText("Ghi chú 200")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Khung biểu đồ tiếp theo" }))
    expect(
      screen.getByText("Đang vẽ 201–201/201 điểm; 0 bất thường ngoài khung")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /trạng thái bất thường/ })).toBeInTheDocument()
    expect(
      screen.getByLabelText("Biểu đồ nhiệt độ").querySelector('rect[fill="#b45309"]')
    ).not.toBeNull()
  })

  it("opens and dismisses selected point details with keyboard, then opens the existing slot sheet", () => {
    const row = observation(0, {
      display_timezone: "UTC",
      captured_at: "2026-10-18T00:45:00.000Z",
      deviation: { id: "deviation-0", status: "Mở", severity: "Nghiêm trọng", revision: 1 },
    })
    setQuery([row])
    const onOpenSlot = vi.fn()

    render(<TemperatureMonitoringTrendView args={args} onOpenSlot={onOpenSlot} />)

    const point = screen.getByRole("button", { name: /bất thường liên kết với sai lệch/ })
    fireEvent.touchStart(point)
    const details = screen.getByRole("region", { name: "Chi tiết điểm đo" })
    expect(within(details).getByText("Ghi chú gốc")).toBeInTheDocument()
    expect(within(details).getByText("Ghi chú 0")).toBeInTheDocument()
    expect(details).toHaveTextContent(/00:45.*18\/10\/26 \(UTC\)/)
    expect(within(details).getByText(/deviation-0.*Mở.*Nghiêm trọng/i)).toBeInTheDocument()
    fireEvent.click(within(details).getByRole("button", { name: "Xem chi tiết" }))
    expect(onOpenSlot).toHaveBeenCalledWith(row)

    fireEvent.keyDown(details, { key: "Escape" })
    expect(screen.queryByRole("region", { name: "Chi tiết điểm đo" })).not.toBeInTheDocument()

    fireEvent.keyDown(point, { key: "Enter" })
    expect(point).toHaveAttribute("aria-expanded", "true")
    fireEvent.keyDown(point, { key: "Escape" })
    expect(screen.queryByRole("region", { name: "Chi tiết điểm đo" })).not.toBeInTheDocument()
    fireEvent.keyDown(point, { key: " " })
    expect(screen.getByRole("region", { name: "Chi tiết điểm đo" })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole("region", { name: "Chi tiết điểm đo" }), { key: "Escape" })
    expect(screen.queryByRole("region", { name: "Chi tiết điểm đo" })).not.toBeInTheDocument()
  })

  it("requires one positive safe equipment id", () => {
    setQuery([observation(0)], { isError: true, error: new Error("page failed") })

    render(
      <TemperatureMonitoringTrendView
        args={{ ...args, p_equipment_id: Number.MAX_SAFE_INTEGER + 1 }}
      />
    )

    expect(runtime.hookEnabled).toBe(false)
    expect(screen.getByText("Chọn một thiết bị để xem biểu đồ")).toBeInTheDocument()
    expect(screen.queryByText("Ghi chú 0")).not.toBeInTheDocument()
  })

  it("hides partial data on full-query failure and retries the complete query", () => {
    setQuery([observation(0)], { isError: true, error: new Error("page failed") })

    render(<TemperatureMonitoringTrendView args={args} />)

    expect(screen.getByRole("alert")).toHaveTextContent("Không tải được dữ liệu nhiệt độ đầy đủ.")
    expect(screen.queryByText("Ghi chú 0")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(runtime.query.refetch).toHaveBeenCalledOnce()
  })

  it("clears selected point details when the equipment filter scope changes", () => {
    setQuery([observation(0)])
    const { rerender } = render(<TemperatureMonitoringTrendView args={args} />)

    fireEvent.focus(screen.getByRole("button", { name: /trong giới hạn/ }))
    expect(screen.getByRole("region", { name: "Chi tiết điểm đo" })).toBeInTheDocument()

    setQuery([observation(1, { reading_id: "reading-next-scope" })])
    rerender(<TemperatureMonitoringTrendView args={{ ...args, p_shift_codes: ["Chiều"] }} />)

    expect(runtime.hookArgs).toMatchObject({ p_shift_codes: ["Chiều"] })
    expect(screen.queryByRole("region", { name: "Chi tiết điểm đo" })).not.toBeInTheDocument()
    expect(screen.getByText("Ghi chú 1")).toBeInTheDocument()
  })

  it("keeps unable and unrecorded rows in the table when no numeric values exist", () => {
    setQuery([
      observation(0, {
        value_c: null,
        unable_reason: { reason: "Không thể đọc màn hình" },
        status: "Không đo được",
      }),
      observation(1, {
        value_c: null,
        reading_id: null,
        note: null,
        status: "Chưa ghi",
        captured_at: null,
      }),
    ])

    render(<TemperatureMonitoringTrendView args={args} />)

    expect(screen.getByRole("status")).toHaveTextContent("có lần ghi nhận không đo được")
    const table = screen.getByRole("table", { name: "Bảng lịch sử nhiệt độ" })
    expect(within(table).getByText("Không đo được: Không thể đọc màn hình")).toBeInTheDocument()
    expect(within(table).getByText("Trạng thái ô")).toBeInTheDocument()
    expect(within(table).getAllByText("Chưa ghi", { selector: "td" })).toHaveLength(2)

    fireEvent.click(screen.getByRole("button", { name: "Chỉ xem bất thường" }))
    expect(
      within(table).queryByText("Không đo được: Không thể đọc màn hình")
    ).not.toBeInTheDocument()
    expect(within(table).queryAllByText("Chưa ghi", { selector: "td" })).toHaveLength(0)
    expect(screen.getByText("Đang xem 0 lần bất thường trong 2 quan sát.")).toBeInTheDocument()
  })

  it("keeps the named table available for a successful empty range", () => {
    setQuery([])

    render(<TemperatureMonitoringTrendView args={args} />)

    expect(screen.getByText("Không có dữ liệu trong khoảng thời gian này.")).toBeInTheDocument()
    const table = screen.getByRole("table", { name: "Bảng lịch sử nhiệt độ" })
    expect(within(table).getAllByRole("columnheader")).toHaveLength(10)
    expect(within(table).getByRole("cell", { name: "Không có quan sát." })).toBeInTheDocument()
    expect(within(table).queryAllByRole("row")).toHaveLength(2)
  })
})
