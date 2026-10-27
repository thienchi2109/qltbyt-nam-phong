"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useTemperatureQuery, useTemperatureMutation } from "@/hooks/use-temperature-monitoring"
import { isGlobalRole } from "@/lib/rbac"
import { temperatureInstant, temperatureLocalTime } from "@/lib/temperature-monitoring"
import type { TemperatureChoices, TemperatureStaff } from "@/types/temperature-monitoring"

/** Preserve selected staff absent from the current scoped server page. */
function configurationStaffOptions(
  items: TemperatureStaff["items"] = [],
  selected: number[],
  suffix: string
) {
  return [
    ...selected
      .filter((id) => !items.some((person) => person.id === id))
      .map((id) => ({ id, full_name: `#${id} (${suffix})` })),
    ...items,
  ]
}

/** Apply display defaults without coupling the view to RPC optionality. */
function configurationDisplay(
  current: TemperatureChoices["configuration"] | undefined,
  profiles: TemperatureChoices["profiles"] = []
) {
  return {
    enabled: current?.monitoring_enabled,
    lower: current?.lower_c ?? "",
    upper: current?.upper_c ?? "",
    profile:
      current?.schedule_profile_id ?? profiles.find((profile) => profile.code === "default")?.id,
    timezone: current?.display_timezone ?? "Asia/Ho_Chi_Minh",
    method: current?.recording_method_code ?? "manual",
    summary: current?.monitoring_enabled
      ? `${current.lower_c}–${current.upper_c} °C · ${current.recording_method_code} · ${current.display_timezone}`
      : "Chưa bật theo dõi nhiệt độ",
    responsible: current
      ? `Phụ trách chính: #${current.responsible_primary_user_id} · Thay thế: ${(current.responsible_substitute_user_ids ?? []).map((id) => `#${id}`).join(", ") || "Không có"}`
      : "",
  }
}

/** Own equipment-scoped configuration queries, staff selection and persistence. */
export function useTemperatureConfiguration(equipmentId: number, isEditing: boolean) {
  const { data: session } = useSession()
  const manager = isGlobalRole(session?.user?.role) || session?.user?.role === "to_qltb"
  const [staffSearch, setStaffSearch] = React.useState("")
  const [staffCursor, setStaffCursor] = React.useState<number | null>(null)
  const [message, setMessage] = React.useState("")
  const choices = useTemperatureQuery<TemperatureChoices>(
    "temperature_monitoring_configuration_choices",
    { p_equipment_id: equipmentId },
    manager && !isEditing
  )
  const staff = useTemperatureQuery<TemperatureStaff>(
    "temperature_monitoring_staff_choices",
    { p_equipment_id: equipmentId, p_query: staffSearch || null, p_cursor: staffCursor },
    manager && !isEditing
  )
  const mutation = useTemperatureMutation()
  const summary = useTemperatureQuery<NonNullable<TemperatureChoices["configuration"]>[]>(
    "temperature_monitoring_configuration_get",
    { p_equipment_id: equipmentId },
    !manager && !isEditing
  )
  const current = choices.data?.configuration ?? summary.data?.[0]
  const suggestedEffectiveFrom = choices.data?.suggested_effective_from ?? null
  const suggestedEffectiveFromLocal = suggestedEffectiveFrom
    ? temperatureLocalTime(suggestedEffectiveFrom, current?.display_timezone ?? "Asia/Ho_Chi_Minh")
    : ""
  const [staffSelection, setStaffSelection] = React.useState<{
    equipment: number
    primary: number | ""
    substitutes: number[]
  } | null>(null)
  const selectedStaff: { equipment: number; primary: number | ""; substitutes: number[] } =
    staffSelection?.equipment === equipmentId
      ? staffSelection
      : {
          equipment: equipmentId,
          primary: current?.responsible_primary_user_id ?? "",
          substitutes: current?.responsible_substitute_user_ids ?? [],
        }
  const save = async (form: FormData) => {
    const enabled = form.get("enabled") === "on"
    const text = (name: string) => String(form.get(name) ?? "")
    setMessage("")
    if (!choices.data?.suggested_effective_from) {
      setMessage(
        "Chưa có ranh giới hiệu lực hợp lệ; phiên bản tương lai hiện có cần được giải quyết trước."
      )
      return
    }
    try {
      await mutation.mutateAsync({
        fn: "temperature_monitoring_configuration_upsert",
        args: {
          p_equipment_id: equipmentId,
          p_monitoring_enabled: enabled,
          p_effective_from: choices.data.suggested_effective_from,
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
  return {
    showSection: manager || summary.isSuccess,
    display: configurationDisplay(current, choices.data?.profiles),
    suggestedEffectiveFrom,
    suggestedEffectiveFromLocal,
    primaryChoices: configurationStaffOptions(
      staff.data?.items,
      selectedStaff.primary ? [selectedStaff.primary] : [],
      "hiện tại"
    ),
    substituteChoices: configurationStaffOptions(
      staff.data?.items,
      selectedStaff.substitutes,
      "đã chọn"
    ),
    manager,
    staffSearch,
    setStaffSearch,
    staffCursor,
    setStaffCursor,
    message,
    reportInvalid: () =>
      setMessage("Chưa lưu cấu hình: vui lòng điền các trường bắt buộc, gồm Lý do thay đổi."),
    choices,
    staff,
    mutation,
    summary,
    current,
    selectedStaff,
    setStaffSelection,
    save,
  }
}
