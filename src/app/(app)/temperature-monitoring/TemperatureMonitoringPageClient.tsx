"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import { MobileCompactCard } from "@/components/shared/MobileCompactCard"
import { SideSheetShell } from "@/components/shared/SideSheetShell"
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
              <form
                key={`${w.slot.equipment_id}-${w.slot.shift_id}-${w.slot.monitoring_date}`}
                onSubmit={(event) => {
                  event.preventDefault()
                  void w.submitReading(new FormData(event.currentTarget))
                }}
                className="space-y-3"
              >
                <label>
                  Nhiệt độ (°C)
                  <Input name="value" type="number" step="0.1" min="-200" max="300" />
                </label>
                <label className="flex items-center gap-2">
                  <input name="unable" type="checkbox" />
                  Không đo được
                </label>
                <label>
                  Giờ đo thực tế ({w.slot.display_timezone})
                  <Input {...w.captureInput} />
                </label>
                {w.readingTextFields.map((field) => (
                  <label key={field.name}>
                    {field.label}
                    <Textarea name={field.name} maxLength={2000} />
                  </label>
                ))}
                <Button type="submit" disabled={w.mutation.isPending}>
                  Lưu số đo
                </Button>
              </form>
            )}
            {w.reading && (
              <>
                {w.readingDetails.map(([label, value]) => (
                  <p key={label}>
                    {label}: {value}
                  </p>
                ))}
                {w.manager && !w.independent && (
                  <p>
                    Bạn không thể tự duyệt số đo hoặc đề xuất của mình. Cần người quản lý độc lập.
                  </p>
                )}
                {w.writer && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      void w.submitReview(new FormData(event.currentTarget))
                    }}
                    className="space-y-3"
                  >
                    <label>
                      Thao tác
                      <select name="action" className="w-full h-11 rounded border px-2">
                        {w.reviewActions.map((action) => (
                          <option key={action.value} value={action.value}>
                            {action.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Số đo đề xuất
                      <Input name="value" type="number" step="0.1" min="-200" max="300" />
                    </label>
                    <label className="flex items-center gap-2">
                      <input name="unable" type="checkbox" />
                      Đề xuất không đo được
                    </label>
                    {w.reviewTextFields.map((field) => (
                      <label key={field.name}>
                        {field.label}
                        <Textarea name={field.name} required={field.required} maxLength={2000} />
                      </label>
                    ))}
                    <Button
                      type="submit"
                      disabled={
                        w.mutation.isPending || (!!w.reading.pending_amendment && !w.independent)
                      }
                    >
                      Gửi thao tác
                    </Button>
                  </form>
                )}
              </>
            )}
            {w.deviation && (
              <>
                <h2 className="font-semibold">Xử lý sai lệch · {w.deviation.status}</h2>
                <p>
                  {w.deviation.severity} · {w.deviation.immediate_action ?? "Chưa ghi xử lý ngay"}
                </p>
                {w.writer && !["Đã đóng", "Đã hủy"].includes(w.deviation.status) && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      void w.submitDeviation(new FormData(event.currentTarget))
                    }}
                    className="space-y-3"
                  >
                    <label>
                      Thao tác
                      <select
                        name="action"
                        className="w-full h-11 rounded border px-2"
                        value={w.deviationAction}
                        onChange={(e) => w.setDeviationAction(e.target.value)}
                      >
                        {w.deviationActions.map((action) => (
                          <option key={action.value} value={action.value}>
                            {action.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {w.deviationFields.map((field) => (
                      <label key={field.name}>
                        {field.label}
                        {field.type === "textarea" ? (
                          <Textarea
                            name={field.name}
                            defaultValue={field.value}
                            required={field.required}
                            maxLength={2000}
                          />
                        ) : (
                          <Input
                            name={field.name}
                            type={field.type}
                            defaultValue={field.value}
                            required={field.required}
                          />
                        )}
                      </label>
                    ))}
                    {w.manager && w.deviationAction === "assign" && (
                      <label>
                        Người phụ trách
                        <select
                          name="owner"
                          className="w-full h-11 rounded border px-2"
                          defaultValue={w.deviation.owner_user_id ?? ""}
                        >
                          <option value="">Chưa phân công</option>
                          {w.deviation.owner_user_id && (
                            <option value={w.deviation.owner_user_id}>Phụ trách hiện tại</option>
                          )}
                          {w.staff.data?.items.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.full_name}
                            </option>
                          ))}
                        </select>
                        {w.staff.data?.next_cursor && (
                          <Button
                            type="button"
                            onClick={() => w.setStaffCursor(w.staff.data?.next_cursor ?? null)}
                          >
                            Nhân sự tiếp
                          </Button>
                        )}
                      </label>
                    )}
                    {w.manager && w.deviationAction === "severity" && (
                      <label>
                        Mức độ
                        <select
                          name="severity"
                          className="w-full h-11 rounded border px-2"
                          defaultValue={w.deviation.severity}
                        >
                          {["Nhẹ", "Nghiêm trọng", "Khẩn cấp"].map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      Lý do thao tác
                      <Textarea
                        name="reason"
                        required={["severity", "cancel"].includes(w.deviationAction)}
                        maxLength={2000}
                      />
                    </label>
                    <Button type="submit" disabled={w.mutation.isPending}>
                      Lưu xử lý
                    </Button>
                  </form>
                )}
              </>
            )}
            {w.slot.reading_id && (
              <Button variant="outline" onClick={w.closeSheet}>
                {w.deviation ? "Để sau" : "Hoàn tất"}
              </Button>
            )}
            {w.slot.reading_id && (
              <Button variant="outline" onClick={() => w.setShowEvents(!w.showEvents)}>
                Nhật ký thay đổi
              </Button>
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
    </main>
  )
}
