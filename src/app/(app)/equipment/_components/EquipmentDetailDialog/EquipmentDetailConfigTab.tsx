/**
 * Configuration & Accessories tab for equipment detail dialog
 * Displays cau_hinh_thiet_bi and phu_kien_kem_theo fields
 * @module equipment/_components/EquipmentDetailDialog/EquipmentDetailConfigTab
 */

"use client"

import * as React from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTemperatureConfiguration } from "@/hooks/use-temperature-configuration"
import { Input } from "@/components/ui/input"

import { EquipmentEditTextareaField } from "@/components/equipment-edit/EquipmentEditFieldControls"
import { ScrollArea } from "@/components/ui/scroll-area"
import { columnLabels } from "@/components/equipment/equipment-table-columns"
import type { Equipment } from "@/types/database"

export interface EquipmentDetailConfigTabProps {
  /** Equipment data to display */
  displayEquipment: Equipment
  /** Whether the tab is in editing mode */
  isEditing: boolean
}

/**
 * Renders a single long-text field with proper formatting
 */
function LongTextField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}): React.ReactNode {
  return (
    <div className="border-b pb-4">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div className="font-medium whitespace-pre-wrap break-words min-h-[2rem]">
        {value ? value : <span className="italic text-muted-foreground">Chưa có dữ liệu</span>}
      </div>
    </div>
  )
}

/** Renders the equipment configuration tab in view or edit mode. */
export function EquipmentDetailConfigTab({
  displayEquipment,
  isEditing,
}: EquipmentDetailConfigTabProps): React.ReactNode {
  const configuration = useTemperatureConfiguration(displayEquipment.id, isEditing)
  const {
    showSection,
    display,
    suggestedEffectiveFromLocal,
    primaryChoices,
    substituteChoices,
    manager,
    staffSearch,
    setStaffSearch,
    staffCursor,
    setStaffCursor,
    message,
    reportInvalid,
    choices,
    staff,
    mutation,
    summary,
    selectedStaff,
    setStaffSelection,
    save,
  } = configuration
  if (isEditing) return <ConfigEditForm />

  const equipmentFields = (
    <>
      <LongTextField
        label={columnLabels.cau_hinh_thiet_bi}
        value={displayEquipment.cau_hinh_thiet_bi}
      />
      <LongTextField
        label={columnLabels.phu_kien_kem_theo}
        value={displayEquipment.phu_kien_kem_theo}
      />
    </>
  )
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6 py-4">
        {equipmentFields}
        {summary.error && (
          <p role="alert">
            Không tải được tóm tắt nhiệt độ.
            <Button onClick={() => void summary.refetch()}>Thử lại</Button>
          </p>
        )}
        {showSection && (
          <section className="space-y-3 border-t pt-4">
            <h3 className="font-semibold">Theo dõi nhiệt độ</h3>
            {renderTemperatureSummary(displayEquipment.id, display)}
            {manager && choices.isPending && <p role="status">Đang tải cấu hình…</p>}
            {manager && choices.error && (
              <p role="alert">
                Không tải được cấu hình.
                <Button onClick={() => void choices.refetch()}>Thử lại</Button>
              </p>
            )}
            {manager && choices.data && (
              <form
                key={`${displayEquipment.id}-${choices.data.server_now}`}
                onInvalid={reportInvalid}
                onSubmit={(event) => {
                  event.preventDefault()
                  void save(new FormData(event.currentTarget))
                }}
                className="space-y-3"
              >
                <label className="flex items-center gap-2">
                  <input name="enabled" type="checkbox" defaultChecked={display.enabled} />
                  Bật theo dõi nhiệt độ
                </label>
                <p className="text-sm text-muted-foreground">
                  Phiên bản mới có hiệu lực theo khoảng thời gian. Số đo cũ giữ nguyên cấu hình tại
                  đầu ca.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    Từ (giờ thiết bị)
                    <Input
                      type="datetime-local"
                      step={1}
                      value={suggestedEffectiveFromLocal}
                      readOnly
                    />
                  </label>
                  <label>
                    Đến (tùy chọn)
                    <Input name="to" type="datetime-local" />
                  </label>
                  <label>
                    Ngưỡng dưới °C
                    <Input name="lower" type="number" step="0.1" defaultValue={display.lower} />
                  </label>
                  <label>
                    Ngưỡng trên °C
                    <Input name="upper" type="number" step="0.1" defaultValue={display.upper} />
                  </label>
                </div>
                <label>
                  Hồ sơ ca
                  <select
                    name="profile"
                    className="w-full h-11 rounded border px-2"
                    defaultValue={display.profile}
                  >
                    {choices.data.profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Múi giờ
                  <Input name="timezone" readOnly required defaultValue={display.timezone} />
                </label>
                <label>
                  Cách ghi nhận
                  <select
                    name="method"
                    className="w-full h-11 rounded border px-2"
                    defaultValue={display.method}
                  >
                    {choices.data.methods.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tìm nhân sự
                  <Input
                    maxLength={200}
                    value={staffSearch}
                    onChange={(e) => {
                      setStaffSearch(e.target.value)
                      setStaffCursor(null)
                    }}
                  />
                </label>
                {staff.error && (
                  <p role="alert">
                    Không tải được nhân sự.
                    <Button type="button" onClick={() => void staff.refetch()}>
                      Thử lại
                    </Button>
                  </p>
                )}
                <label>
                  Phụ trách chính
                  <select
                    name="primary"
                    className="w-full h-11 rounded border px-2"
                    value={selectedStaff.primary}
                    onChange={(e) =>
                      setStaffSelection({
                        ...selectedStaff,
                        primary: e.target.value ? Number(e.target.value) : "",
                      })
                    }
                  >
                    <option value="">Chọn nhân sự</option>
                    {primaryChoices.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nhân sự thay thế
                  <select
                    name="substitutes"
                    multiple
                    className="w-full rounded border p-2"
                    value={selectedStaff.substitutes.map(String)}
                    onChange={(e) =>
                      setStaffSelection({
                        ...selectedStaff,
                        substitutes: Array.from(e.target.selectedOptions, (option) =>
                          Number(option.value)
                        ),
                      })
                    }
                  >
                    {substituteChoices.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                {staff.data?.next_cursor && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStaffCursor(staff.data?.next_cursor ?? null)}
                  >
                    Nhân sự tiếp
                  </Button>
                )}
                {staffCursor && (
                  <Button type="button" variant="outline" onClick={() => setStaffCursor(null)}>
                    Nhân sự đầu
                  </Button>
                )}
                <label>
                  Lý do thay đổi
                  <Input name="reason" required maxLength={2000} />
                </label>
                {!choices.data.suggested_effective_from && (
                  <p role="alert">
                    Chưa có ranh giới hiệu lực hợp lệ; phiên bản tương lai hiện có cần được giải
                    quyết trước.
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={mutation.isPending || !choices.data.suggested_effective_from}
                  aria-busy={mutation.isPending}
                >
                  <span hidden={!mutation.isPending}>
                    <Loader2 aria-hidden="true" className="mr-2 inline size-4 animate-spin" />
                    Đang lưu…
                  </span>
                  <span hidden={mutation.isPending}>Lưu cấu hình nhiệt độ</span>
                </Button>
              </form>
            )}
          </section>
        )}
        <p role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </ScrollArea>
  )
}

function renderTemperatureSummary(
  equipmentId: Equipment["id"],
  display: ReturnType<typeof useTemperatureConfiguration>["display"]
): React.ReactNode {
  return (
    <>
      <p>{display.summary}</p>
      {display.enabled && <p>{display.responsible}</p>}
      {display.enabled && (
        <Button variant="outline" asChild>
          <Link href={`/temperature-monitoring?equipment=${equipmentId}`}>Mở sổ nhiệt độ</Link>
        </Button>
      )}
    </>
  )
}

/**
 * Edit form for configuration fields
 * Uses useFormContext to access form from parent FormProvider
 */
function ConfigEditForm(): React.ReactNode {
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6 py-4">
        <EquipmentEditTextareaField
          name="cau_hinh_thiet_bi"
          label="Cấu hình thiết bị"
          rows={8}
          placeholder="Nhập cấu hình thiết bị…"
          className="resize-y min-h-[120px]"
        />

        <EquipmentEditTextareaField
          name="phu_kien_kem_theo"
          label="Phụ kiện kèm theo"
          rows={6}
          placeholder="Nhập phụ kiện kèm theo…"
          className="resize-y min-h-[100px]"
        />
      </div>
    </ScrollArea>
  )
}
