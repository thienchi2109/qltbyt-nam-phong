"use client"

import { Button } from "@/components/ui/button"
import { SideSheetShell } from "@/components/shared/SideSheetShell"
import { TemperatureMonitoringMeasurementForm } from "./TemperatureMonitoringMeasurementForm"
import { TemperatureMonitoringReviewSection } from "./TemperatureMonitoringReviewSection"
import { TemperatureMonitoringDeviationSection } from "./TemperatureMonitoringDeviationSection"
import type { useTemperatureLogbook } from "@/hooks/use-temperature-logbook"

/** Compose the selected slot and preserve the existing sheet focus/close lifecycle. */
export function TemperatureMonitoringSlotSheet({
  w,
}: {
  w: ReturnType<typeof useTemperatureLogbook>
}) {
  return (
    <SideSheetShell
      open={!!w.slot}
      onOpenChange={(open) => {
        if (!open) w.closeSheet()
      }}
      onCloseAutoFocus={w.restoreFocus}
      side={w.mobile ? "bottom" : "right"}
      title={w.slot?.equipment_name}
      description={w.slot ? `${w.slot.monitoring_date} · ${w.slot.shift_name}` : undefined}
      contentClassName={w.mobile ? "h-[90dvh]" : "h-full sm:max-w-xl"}
      bodyClassName="overflow-y-auto p-4 space-y-4"
    >
      {w.slot && (
        <div ref={w.sheetRef} className="space-y-4" onInput={w.markDirty}>
          <p className="text-sm">
            {w.timestamp(w.slot.slot_start)} – {w.timestamp(w.slot.slot_end)} (
            {w.slot.display_timezone})
          </p>
          <p>
            {w.slot.lower_c}–{w.slot.upper_c} °C · {w.slot.recording_method_name}
          </p>
          <p role="status" aria-live="polite">
            {w.message || (w.selectedLoading && "Đang tải số đo và sai lệch…")}
          </p>
          {w.queryErrors
            .filter((item) => item.query.error)
            .map((item) => (
              <p role="alert" key={item.label}>
                Không tải được {item.label}.
                <Button onClick={() => void item.query.refetch()}>Thử lại</Button>
              </p>
            ))}
          {!w.slot.reading_id && w.writer && (
            <TemperatureMonitoringMeasurementForm
              key={`${w.slot.equipment_id}-${w.slot.monitoring_date}-${w.slot.shift_id}`}
              w={w}
              slot={w.slot}
            />
          )}
          {w.reading && (
            <TemperatureMonitoringReviewSection key={w.slot.reading_id} w={w} reading={w.reading} />
          )}
          {w.deviation && (
            <TemperatureMonitoringDeviationSection
              key={w.deviation.id}
              w={w}
              deviation={w.deviation}
            />
          )}
          {w.slot.reading_id && (
            <>
              <Button variant="outline" onClick={w.closeSheet}>
                {w.deviation ? "Để sau" : "Hoàn tất"}
              </Button>
              <Button variant="outline" onClick={() => w.setShowEvents(!w.showEvents)}>
                Nhật ký thay đổi
              </Button>
            </>
          )}
          {w.showEvents && (
            <>
              {w.events.data?.events.map((event) => (
                <p key={event.id} className="text-sm">
                  {w.timestamp(event.created_at)} ·{" "}
                  {w.eventLabels[event.event_type] ?? "Thay đổi số đo"} · #{event.actor_user_id}{" "}
                  {event.reason}
                </p>
              ))}
              {w.events.data?.next_cursor && (
                <Button onClick={() => w.setEventCursor(w.events.data?.next_cursor ?? null)}>
                  Thay đổi cũ hơn
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </SideSheetShell>
  )
}
