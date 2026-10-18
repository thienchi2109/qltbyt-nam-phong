"use client"

import { Input } from "@/components/ui/input"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import type { useTemperatureLogbook } from "@/hooks/use-temperature-logbook"

/** Compose the existing current/history controls without changing server filters. */
export function TemperatureMonitoringFilters({
  w,
}: {
  w: ReturnType<typeof useTemperatureLogbook>
}) {
  return (
    <ListFilterSearchCard
      title={w.tab === "current" ? "Ca đang diễn ra" : "Lịch sử nhiệt độ"}
      description={
        w.tab === "current"
          ? "Ca được xác định theo giờ máy chủ và cấu hình từng thiết bị. Chọn ca nếu có nhiều lựa chọn."
          : `Từ ${w.range.from} đến ${w.range.to} · tối đa 90 ngày/lần`
      }
      filterControls={
        <>
          {w.tab === "current" && (
            <label>
              Ngày ghi
              <Input
                type="date"
                value={w.entryDate || w.slot?.monitoring_date || ""}
                onChange={(e) => {
                  w.setEntryDate(e.target.value)
                  w.resetPage()
                }}
              />
            </label>
          )}
          {w.tab === "history" && (
            <>
              <label>
                Khoảng thời gian
                <select
                  className="h-10 rounded border px-2"
                  defaultValue="30"
                  onChange={(e) => w.setPreset(e.target.value)}
                >
                  <option value="7">7 ngày</option>
                  <option value="30">30 ngày</option>
                  <option value="90">90 ngày</option>
                  <option value="custom">Tùy chọn</option>
                </select>
              </label>
              <label>
                Từ
                <Input
                  type="date"
                  value={w.range.from}
                  onChange={(e) => {
                    w.setRange({ ...w.range, from: e.target.value })
                    w.resetPage()
                  }}
                />
              </label>
              <label>
                Đến
                <Input
                  type="date"
                  value={w.range.to}
                  onChange={(e) => {
                    w.setRange({ ...w.range, to: e.target.value })
                    w.resetPage()
                  }}
                />
              </label>
              {w.historyFilters.map((filter) => (
                <label key={filter.label}>
                  {filter.label}
                  <select
                    className="h-10 rounded border px-2"
                    value={filter.value}
                    onChange={(e) => {
                      filter.set(e.target.value)
                      w.resetPage()
                    }}
                  >
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </>
          )}
          <label>
            Ca
            <select
              value={w.shift || w.slot?.shift_code || ""}
              className="h-11 rounded border px-2"
              onChange={(e) => {
                w.setShift(e.target.value)
                w.resetPage()
              }}
            >
              <option value="">Tất cả ca</option>
              {w.query.data?.shift_choices?.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </>
      }
    />
  )
}
