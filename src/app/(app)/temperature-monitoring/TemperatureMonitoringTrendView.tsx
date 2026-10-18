"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { DynamicLineChart } from "@/components/dynamic-chart"
import { useTemperatureTrend } from "@/hooks/use-temperature-trend"
import {
  axisTime,
  buildChartPoints,
  isAbnormal,
  slotIdentity,
  tableValues,
  TEMPERATURE_TREND_HEADERS as TABLE_HEADERS,
  trendPointAriaLabel,
  type TrendChartPoint,
  type TrendDotProps,
  unableReason,
  validDateRange,
} from "@/lib/temperature-trend"
import type { TemperatureSlot } from "@/types/temperature-monitoring"

const CHART_WINDOW_SIZE = 200
const TABLE_PAGE_SIZE = 50

function limitDot({ cx, cy, payload }: TrendDotProps) {
  const point = payload as TrendChartPoint | undefined
  return point?.thresholdBoundary && cx !== undefined && cy !== undefined ? (
    <circle cx={cx} cy={cy} r={3} fill="white" stroke="#b45309" strokeWidth={2} />
  ) : (
    <g />
  )
}

export interface TemperatureMonitoringTrendViewProps {
  args: Record<string, unknown>
  enabled?: boolean
  onOpenSlot?: (row: TemperatureSlot) => void
}

/** Show bounded raw temperature observations and a complete paginated history table. */
export function TemperatureMonitoringTrendView({
  args,
  enabled = true,
  onOpenSlot,
}: TemperatureMonitoringTrendViewProps) {
  const equipmentId = args.p_equipment_id
  const hasEquipment =
    typeof equipmentId === "number" && Number.isSafeInteger(equipmentId) && equipmentId > 0
  const validRange = validDateRange(args.p_from_date, args.p_to_date)
  const query = useTemperatureTrend(args, enabled && hasEquipment && validRange)
  const scopeKey = JSON.stringify({ ...args, p_cursor: undefined, p_limit: undefined })
  const previousScope = React.useRef(scopeKey)
  const [windowStart, setWindowStart] = React.useState(0)
  const [tablePage, setTablePage] = React.useState(0)
  const [abnormalOnly, setAbnormalOnly] = React.useState(false)
  const [selected, setSelected] = React.useState<{ scope: string; identity: string } | null>(null)
  const scopeChanged = previousScope.current !== scopeKey

  React.useEffect(() => {
    if (previousScope.current !== scopeKey) {
      previousScope.current = scopeKey
      setWindowStart(0)
      setTablePage(0)
      setAbnormalOnly(false)
      setSelected(null)
    }
  }, [scopeKey])

  const rows = query.data ?? []
  const maxWindowStart = Math.max(
    0,
    Math.ceil(rows.length / CHART_WINDOW_SIZE - 1) * CHART_WINDOW_SIZE
  )
  const currentWindowStart = Math.min(windowStart, maxWindowStart)
  const windowRows = rows.slice(currentWindowStart, currentWindowStart + CHART_WINDOW_SIZE)
  const outsideWindowAbnormalCount = rows.filter(
    (_, index) =>
      (index < currentWindowStart || index >= currentWindowStart + CHART_WINDOW_SIZE) &&
      isAbnormal(rows[index])
  ).length
  const abnormalRows = rows.filter(isAbnormal)
  const tableRows = abnormalOnly ? abnormalRows : rows
  const tablePageCount = Math.max(1, Math.ceil(tableRows.length / TABLE_PAGE_SIZE))
  const currentTablePage = Math.min(tablePage, tablePageCount - 1)
  const pageRows = tableRows.slice(
    currentTablePage * TABLE_PAGE_SIZE,
    (currentTablePage + 1) * TABLE_PAGE_SIZE
  )
  const chartPoints = buildChartPoints(windowRows)
  const numericCount = windowRows.filter((row) => row.value_c !== null).length
  const hasNumeric = rows.some((row) => row.value_c !== null)
  const hasUnable = rows.some((row) => unableReason(row) !== null)
  const activeSelected =
    selected?.scope === scopeKey
      ? (rows.find((row) => slotIdentity(row) === selected.identity) ?? null)
      : null
  const chartTimezone = windowRows[0]?.display_timezone ?? "Asia/Ho_Chi_Minh"
  const detailValues = activeSelected ? tableValues(activeSelected) : []
  const valueDot = React.useCallback(
    ({ cx, cy, payload }: TrendDotProps) => {
      const point = payload as TrendChartPoint | undefined
      const row = point?.slot
      if (!row || row.value_c === null || cx === undefined || cy === undefined) return <g />
      const select = () => setSelected({ scope: scopeKey, identity: slotIdentity(row) })
      const abnormal = isAbnormal(row)
      return (
        <g onMouseEnter={select} onFocus={select}>
          <circle
            cx={cx}
            cy={cy}
            r={22}
            fill="transparent"
            stroke="transparent"
            style={{ cursor: "pointer" }}
            role="button"
            tabIndex={0}
            aria-label={trendPointAriaLabel(row)}
            aria-expanded={selected?.scope === scopeKey && selected.identity === slotIdentity(row)}
            aria-controls="temperature-trend-point-details"
            onClick={select}
            onTouchStart={select}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                select()
              }
              if (event.key === "Escape") setSelected(null)
            }}
          />
          {abnormal ? (
            <rect
              x={cx - 4}
              y={cy - 4}
              width={8}
              height={8}
              transform={`rotate(45 ${cx} ${cy})`}
              fill="#b45309"
              stroke="white"
              strokeWidth={1}
              pointerEvents="none"
            />
          ) : (
            <circle
              cx={cx}
              cy={cy}
              r={4}
              fill="#0f766e"
              stroke="white"
              strokeWidth={1}
              pointerEvents="none"
            />
          )}
        </g>
      )
    },
    [scopeKey, selected]
  )

  if (!hasEquipment)
    return <p className="rounded border p-4 text-sm">Chọn một thiết bị để xem biểu đồ</p>
  if (!validRange)
    return (
      <p role="alert" className="rounded border p-4 text-sm">
        Chọn khoảng ngày hợp lệ, tối đa 90 ngày.
      </p>
    )
  if (query.isError) {
    return (
      <div role="alert" className="space-y-2 rounded border border-destructive/40 p-4 text-sm">
        <p>Không tải được dữ liệu nhiệt độ đầy đủ. Thử lại.</p>
        <Button type="button" className="min-h-11" onClick={() => void query.refetch()}>
          Thử lại
        </Button>
      </div>
    )
  }
  if (query.isPending || query.isPlaceholderData) {
    return (
      <p role="status" className="rounded border p-4 text-sm">
        {scopeChanged ? "Đang cập nhật thiết bị và bộ lọc…" : "Đang tải dữ liệu nhiệt độ…"}
      </p>
    )
  }

  return (
    <section
      aria-label="Xu hướng nhiệt độ"
      className="min-w-0 space-y-4 rounded-lg border p-3 sm:p-4"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">
          Từ {String(args.p_from_date)} đến {String(args.p_to_date)} · tối đa 90 ngày/lần
        </p>
        <p className="text-sm text-muted-foreground">Múi giờ hiển thị: {chartTimezone}</p>
        <p className="text-sm text-muted-foreground">
          Hiển thị các lần ghi nhận thủ công; đây không phải dòng giám sát liên tục.
        </p>
      </div>
      {rows.length === 0 ? <p>Không có dữ liệu trong khoảng thời gian này.</p> : null}
      {rows.length > 0 && !hasNumeric ? (
        <p role="status">
          {hasUnable
            ? "Không có số đo bằng số trong khoảng thời gian này; có lần ghi nhận không đo được."
            : "Không có số đo bằng số trong khoảng thời gian này; các ô chưa được ghi nhận."}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm" aria-live="polite">
              Đang vẽ {currentWindowStart + 1}–{currentWindowStart + windowRows.length}/
              {rows.length} điểm; {outsideWindowAbnormalCount} bất thường ngoài khung
            </p>
            <div className="flex gap-2">
              {(
                [
                  ["Trước", "Khung biểu đồ trước", currentWindowStart === 0],
                  [
                    "Tiếp",
                    "Khung biểu đồ tiếp theo",
                    currentWindowStart + windowRows.length >= rows.length,
                  ],
                ] as const
              ).map(([label, ariaLabel, disabled], index) => (
                <Button
                  key={ariaLabel}
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1 sm:flex-none"
                  disabled={disabled}
                  aria-label={ariaLabel}
                  onClick={() => {
                    setSelected(null)
                    setWindowStart(
                      Math.max(0, currentWindowStart + (index === 0 ? -1 : 1) * CHART_WINDOW_SIZE)
                    )
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          {numericCount > 0 ? (
            <div className="min-w-0 overflow-hidden">
              <DynamicLineChart
                data={chartPoints}
                height={320}
                xAxisKey="x"
                xAxisProps={{
                  type: "number",
                  scale: "time",
                  domain: ["dataMin", "dataMax"],
                  tickFormatter: (value) => axisTime(value, chartTimezone),
                }}
                showTooltip={false}
                showLegend
                lines={[
                  {
                    key: "value_c",
                    color: "#0f766e",
                    name: "Nhiệt độ (°C)",
                    type: "linear",
                    connectNulls: false,
                    dot: valueDot,
                  },
                  {
                    key: "lower_c",
                    color: "#b45309",
                    name: "Giới hạn dưới (°C)",
                    type: "linear",
                    connectNulls: false,
                    dot: limitDot,
                    strokeDasharray: "5 4",
                  },
                  {
                    key: "upper_c",
                    color: "#be123c",
                    name: "Giới hạn trên (°C)",
                    type: "linear",
                    connectNulls: false,
                    dot: limitDot,
                    strokeDasharray: "2 3",
                  },
                ]}
              />
            </div>
          ) : null}

          {activeSelected ? (
            <section
              id="temperature-trend-point-details"
              role="region"
              aria-live="polite"
              aria-label="Chi tiết điểm đo"
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSelected(null)
              }}
              className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">Chi tiết điểm đo</h3>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => setSelected(null)}
                >
                  Đóng chi tiết
                </Button>
              </div>
              <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {TABLE_HEADERS.map((header, index) => (
                  <div key={header}>
                    <dt className="font-medium">{header}</dt>
                    <dd>{detailValues[index]}</dd>
                  </div>
                ))}
              </dl>
              {onOpenSlot ? (
                <Button
                  type="button"
                  className="min-h-11"
                  onClick={() => onOpenSlot(activeSelected)}
                >
                  Xem chi tiết
                </Button>
              ) : null}
            </section>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {abnormalOnly
                ? `Đang xem ${abnormalRows.length} lần bất thường trong ${rows.length} quan sát.`
                : `${rows.length} quan sát đầy đủ.`}
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setSelected(null)
                setAbnormalOnly((current) => !current)
                setTablePage(0)
              }}
            >
              {abnormalOnly ? "Hiển thị tất cả" : "Chỉ xem bất thường"}
            </Button>
          </div>
        </>
      ) : null}
      <div
        role="region"
        aria-label="Bảng lịch sử nhiệt độ cuộn ngang"
        tabIndex={0}
        className="max-w-full overflow-x-auto rounded border"
      >
        <table
          aria-label="Bảng lịch sử nhiệt độ"
          className="w-full min-w-[980px] border-collapse text-left text-sm"
        >
          <thead>
            <tr className="border-b bg-muted/40">
              {TABLE_HEADERS.map((label) => (
                <th key={label} scope="col" className="p-2">
                  {label}
                </th>
              ))}
              {onOpenSlot ? (
                <th scope="col" className="p-2">
                  Thao tác
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={TABLE_HEADERS.length + (onOpenSlot ? 1 : 0)} className="p-2">
                  {rows.length === 0 ? "Không có quan sát." : "Không có lần bất thường."}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={slotIdentity(row)} className="border-b last:border-0">
                  {tableValues(row).map((value, index) => (
                    <td
                      key={TABLE_HEADERS[index]}
                      className={
                        index === 8 ? "max-w-56 whitespace-normal p-2" : "whitespace-nowrap p-2"
                      }
                    >
                      {value}
                    </td>
                  ))}
                  {onOpenSlot ? (
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => onOpenSlot(row)}
                      >
                        Xem chi tiết
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm" aria-live="polite">
            Bảng {tableRows.length === 0 ? 0 : currentTablePage * TABLE_PAGE_SIZE + 1}–
            {Math.min((currentTablePage + 1) * TABLE_PAGE_SIZE, tableRows.length)}/
            {tableRows.length}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              aria-label="Trang bảng trước"
              disabled={currentTablePage === 0}
              onClick={() => setTablePage(Math.max(0, currentTablePage - 1))}
            >
              Trước
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              aria-label="Trang bảng tiếp theo"
              disabled={currentTablePage + 1 >= tablePageCount}
              onClick={() => setTablePage(Math.min(tablePageCount - 1, currentTablePage + 1))}
            >
              Tiếp
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
