/**
 * Configuration & Accessories tab for equipment detail dialog
 * Displays cau_hinh_thiet_bi and phu_kien_kem_theo fields
 * @module equipment/_components/EquipmentDetailDialog/EquipmentDetailConfigTab
 */

"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTemperatureQuery, useTemperatureMutation } from "@/hooks/use-temperature-monitoring"
import { isGlobalRole } from "@/lib/rbac"
import { temperatureInstant } from "@/lib/temperature-monitoring"
import type { TemperatureChoices, TemperatureStaff } from "@/types/temperature-monitoring"

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
  const { data: session } = useSession()
  const manager = isGlobalRole(session?.user?.role) || session?.user?.role === "to_qltb"
  const [staffSearch, setStaffSearch] = React.useState("")
  const [staffCursor, setStaffCursor] = React.useState<number | null>(null)
  const [message, setMessage] = React.useState("")
  const choices = useTemperatureQuery<TemperatureChoices>(
    "temperature_monitoring_configuration_choices",
    { p_equipment_id: displayEquipment.id },
    manager && !isEditing
  )
  const staff = useTemperatureQuery<TemperatureStaff>(
    "temperature_monitoring_staff_choices",
    { p_equipment_id: displayEquipment.id, p_query: staffSearch || null, p_cursor: staffCursor },
    manager && !isEditing
  )
  const mutation = useTemperatureMutation()
  const summary = useTemperatureQuery<NonNullable<TemperatureChoices["configuration"]>[]>(
    "temperature_monitoring_configuration_get",
    { p_equipment_id: displayEquipment.id },
    !manager && !isEditing
  )
  const current = choices.data?.configuration ?? summary.data?.[0]
  const [staffSelection, setStaffSelection] = React.useState<{
    equipment: number
    primary: number | ""
    substitutes: number[]
  } | null>(null)
  const selectedStaff: { equipment: number; primary: number | ""; substitutes: number[] } =
    staffSelection?.equipment === displayEquipment.id
      ? staffSelection
      : {
          equipment: displayEquipment.id,
          primary: current?.responsible_primary_user_id ?? "",
          substitutes: current?.responsible_substitute_user_ids ?? [],
        }
  const save = async (form: FormData) => {
    const enabled = form.get("enabled") === "on"
    const text = (name: string) => String(form.get(name) ?? "")
    setMessage("")
    try {
      await mutation.mutateAsync({
        fn: "temperature_monitoring_configuration_upsert",
        args: {
          p_equipment_id: displayEquipment.id,
          p_monitoring_enabled: enabled,
          p_effective_from: temperatureInstant(text("from"), text("timezone")),
          p_effective_to: text("to") ? temperatureInstant(text("to"), text("timezone")) : null,
          p_lower_c: enabled ? Number(text("lower")) : null,
          p_upper_c: enabled ? Number(text("upper")) : null,
          p_schedule_profile_id: enabled ? text("profile") : null,
          p_display_timezone: text("timezone"),
          p_responsible_primary_user_id: enabled ? Number(text("primary")) : null,
          p_responsible_substitute_user_ids: enabled ? form.getAll("substitutes").map(Number) : [],
          p_recording_method_code: enabled ? text("method") : null,
          p_change_reason: text("reason"),
        },
      })
      setMessage("Đã lưu phiên bản cấu hình.")
    } catch (error) {
      setMessage("Không lưu được cấu hình. Kiểm tra khoảng hiệu lực, quyền và dữ liệu rồi thử lại.")
    }
  }
  if (isEditing) return <ConfigEditForm />

  // View mode: display both fields with proper multiline formatting
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6 py-4">
        <LongTextField
          label={columnLabels.cau_hinh_thiet_bi}
          value={displayEquipment.cau_hinh_thiet_bi}
        />
        <LongTextField
          label={columnLabels.phu_kien_kem_theo}
          value={displayEquipment.phu_kien_kem_theo}
        />
        {summary.error && (
          <p role="alert">
            Không tải được tóm tắt nhiệt độ.
            <Button onClick={() => void summary.refetch()}>Thử lại</Button>
          </p>
        )}
        {(manager || summary.isSuccess) && (
          <section className="space-y-3 border-t pt-4">
            <h3 className="font-semibold">Theo dõi nhiệt độ</h3>
            <p>
              {current?.monitoring_enabled
                ? `${current.lower_c}–${current.upper_c} °C · ${current.recording_method_code} · ${current.display_timezone}`
                : "Chưa bật theo dõi nhiệt độ"}
            </p>
            {current?.monitoring_enabled && (
              <p>
                Phụ trách chính: #{current.responsible_primary_user_id} · Thay thế:{" "}
                {current.responsible_substitute_user_ids.map((id) => `#${id}`).join(", ") ||
                  "Không có"}
              </p>
            )}
            {current?.monitoring_enabled && (
              <Button variant="outline" asChild>
                <Link href={`/temperature-monitoring?equipment=${displayEquipment.id}`}>
                  Mở sổ nhiệt độ
                </Link>
              </Button>
            )}
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
                onSubmit={(event) => {
                  event.preventDefault()
                  void save(new FormData(event.currentTarget))
                }}
                className="space-y-3"
              >
                <label className="flex items-center gap-2">
                  <input
                    name="enabled"
                    type="checkbox"
                    defaultChecked={current?.monitoring_enabled}
                  />
                  Bật theo dõi nhiệt độ
                </label>
                <p className="text-sm text-muted-foreground">
                  Phiên bản mới có hiệu lực theo khoảng thời gian. Số đo cũ giữ nguyên cấu hình tại
                  đầu ca.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label>
                    Từ (giờ thiết bị)
                    <Input name="from" type="datetime-local" required />
                  </label>
                  <label>
                    Đến (tùy chọn)
                    <Input name="to" type="datetime-local" />
                  </label>
                  <label>
                    Ngưỡng dưới °C
                    <Input
                      name="lower"
                      type="number"
                      step="0.1"
                      defaultValue={current?.lower_c ?? ""}
                    />
                  </label>
                  <label>
                    Ngưỡng trên °C
                    <Input
                      name="upper"
                      type="number"
                      step="0.1"
                      defaultValue={current?.upper_c ?? ""}
                    />
                  </label>
                </div>
                <label>
                  Hồ sơ ca
                  <select
                    name="profile"
                    className="w-full h-11 rounded border px-2"
                    defaultValue={
                      current?.schedule_profile_id ??
                      choices.data.profiles.find((p) => p.code === "default")?.id
                    }
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
                  <Input
                    name="timezone"
                    readOnly
                    required
                    defaultValue={current?.display_timezone ?? "Asia/Ho_Chi_Minh"}
                  />
                </label>
                <label>
                  Cách ghi nhận
                  <select
                    name="method"
                    className="w-full h-11 rounded border px-2"
                    defaultValue={current?.recording_method_code ?? "manual"}
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
                    {selectedStaff.primary &&
                      !staff.data?.items.some((n) => n.id === selectedStaff.primary) && (
                        <option value={selectedStaff.primary}>
                          #{selectedStaff.primary} (hiện tại)
                        </option>
                      )}
                    {staff.data?.items.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.full_name}
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
                    {selectedStaff.substitutes
                      .filter((id) => !staff.data?.items.some((person) => person.id === id))
                      .map((id) => (
                        <option key={id} value={id}>
                          #{id} (đã chọn)
                        </option>
                      ))}
                    {staff.data?.items.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.full_name}
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
                <Button type="submit" disabled={mutation.isPending}>
                  Lưu cấu hình nhiệt độ
                </Button>
              </form>
            )}
            <p role="status" aria-live="polite">
              {message}
            </p>
          </section>
        )}
      </div>
    </ScrollArea>
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
