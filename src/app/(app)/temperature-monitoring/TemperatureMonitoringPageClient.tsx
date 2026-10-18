"use client"

import { TemperatureMonitoringFilters } from "./TemperatureMonitoringFilters"
import { TemperatureMonitoringSlotSheet } from "./TemperatureMonitoringSlotSheet"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MobileCompactCard } from "@/components/shared/MobileCompactCard"
import { useTemperatureLogbook } from "@/hooks/use-temperature-logbook"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"

/** Render scoped logbook cards and the selected-device sheet. */
export function TemperatureMonitoringPageClient() {
  const w = useTemperatureLogbook()
  return (
    <main className="space-y-4 p-3 md:p-6">
      <h1 ref={w.headingRef} tabIndex={-1} className="text-2xl font-semibold">
        Sổ nhiệt độ
      </h1>
      <Tabs
        value={w.tab}
        onValueChange={(value) => {
          w.setTab(value)
          w.resetPage()
        }}
      >
        <TabsList>
          <TabsTrigger value="current">Ghi theo ca</TabsTrigger>
          <TabsTrigger value="history">Lịch sử</TabsTrigger>
        </TabsList>
      </Tabs>
      <TemperatureMonitoringFilters w={w} />
      {w.tab === "history" && !w.validRange && (
        <p role="alert">Chọn khoảng ngày hợp lệ, tối đa 90 ngày.</p>
      )}
      {w.query.isPending && (
        <div role="status" aria-label="Đang tải ca" className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-32 w-full" />
          ))}
        </div>
      )}
      {w.query.error && (
        <p role="alert">
          Không tải được danh sách ca.
          <Button onClick={() => void w.query.refetch()}>Thử lại</Button>
        </p>
      )}
      {w.query.data && (
        <p className="text-sm text-muted-foreground">
          {w.query.data.total} ca · Giờ máy chủ:{" "}
          {w.timestamp(w.query.data.server_now, "Asia/Ho_Chi_Minh")}
        </p>
      )}
      {w.query.isSuccess && w.rows.length === 0 && <p>{w.emptyMessage}</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {w.rows.map((row) => (
          <MobileCompactCard
            key={`${row.equipment_id}-${row.monitoring_date}-${row.shift_id}`}
            title={row.equipment_name}
            eyebrow={row.equipment_code}
            subtitle={`${row.monitoring_date} · ${row.shift_name}`}
            topRight={<span>{row.status}</span>}
            meta={w.cardMeta(row)}
            actions={
              <Link className="p-3 underline" href={`/equipment?highlight=${row.equipment_id}`}>
                Hồ sơ thiết bị
              </Link>
            }
            activationLabel={`Mở sổ ${row.equipment_name}, ${row.monitoring_date}, ${row.shift_name}`}
            onActivate={() => w.openSlot(row)}
          >
            {row.deviation && (
              <p>
                Sai lệch: {row.deviation.status} · Mức độ: {row.deviation.severity}
              </p>
            )}
          </MobileCompactCard>
        ))}
      </div>
      {w.cursor && (
        <Button variant="outline" onClick={() => w.setCursor(null)}>
          Về đầu
        </Button>
      )}
      {w.query.data?.next_cursor && (
        <Button onClick={() => w.setCursor(w.query.data?.next_cursor ?? null)}>Trang tiếp</Button>
      )}
      <TemperatureMonitoringSlotSheet w={w} />
    </main>
  )
}
