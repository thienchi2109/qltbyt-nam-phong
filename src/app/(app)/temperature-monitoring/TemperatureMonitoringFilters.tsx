"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import type { useTemperatureLogbook } from "@/hooks/use-temperature-logbook"
import { useTemperatureExport } from "@/hooks/use-temperature-export"

/** Compose the existing current/history controls without changing server filters. */
export function TemperatureMonitoringFilters({
  w,
}: {
  w: ReturnType<typeof useTemperatureLogbook>
}) {
  const exporter = useTemperatureExport(w.range)
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
          {w.tab === "history" && (
            <fieldset
              className="col-span-full flex min-w-0 flex-wrap items-end gap-3 rounded border p-3"
              disabled={exporter.phase !== "idle"}
            >
              <legend className="px-1 font-medium">Xuất Excel — bản ghi đã nhập</legend>
              <p className="w-full text-sm text-muted-foreground">
                Xem trên màn hình: tối đa 90 ngày. Xuất trong cùng một năm; các năm khác xuất riêng.
                Không gồm ca chưa ghi/quá hạn. Dùng thiết bị và ca đang chọn.
              </p>
              <label>
                Xuất từ
                <Input
                  type="date"
                  value={exporter.range.from}
                  onChange={(e) => exporter.setRange({ ...exporter.range, from: e.target.value })}
                />
              </label>
              <label>
                Xuất đến
                <Input
                  type="date"
                  value={exporter.range.to}
                  onChange={(e) => exporter.setRange({ ...exporter.range, to: e.target.value })}
                />
              </label>
              <label>
                Trạng thái xuất
                <select
                  className="h-11 rounded border px-2"
                  value={exporter.status}
                  onChange={(e) => exporter.setStatus(e.target.value)}
                >
                  <option value="">Tất cả bản ghi</option>
                  {["Đã ghi", "Chờ xác nhận", "Bất thường"].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                disabled={!exporter.valid}
                onClick={() => void exporter.download(w.workspaceArgs.p_equipment_id, w.shift)}
              >
                Xuất Excel
              </Button>
            </fieldset>
          )}
          {w.tab === "history" && (
            <div className="col-span-full" role="status" aria-live="polite">
              {exporter.phase === "preparing"
                ? "Đang chuẩn bị Excel…"
                : exporter.phase === "downloading"
                  ? "Đang tải file Excel…"
                  : exporter.message ||
                    (!exporter.valid
                      ? "Chọn ngày hợp lệ trong cùng một năm; các năm khác xuất riêng."
                      : "")}
              {exporter.phase !== "idle" && (
                <Button type="button" variant="outline" onClick={exporter.cancel}>
                  Hủy xuất
                </Button>
              )}
            </div>
          )}
        </>
      }
    />
  )
}
