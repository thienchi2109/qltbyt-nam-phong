"use client"

import { useId } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { temperatureFormData } from "@/lib/temperature-monitoring"
import type { TemperatureDeviation } from "@/types/temperature-monitoring"
import type { useTemperatureLogbook } from "@/hooks/use-temperature-logbook"

/** Register only the visible operation's fields, keeping retries on the same case intact. */
export function TemperatureMonitoringDeviationSection({
  w,
  deviation,
}: {
  w: ReturnType<typeof useTemperatureLogbook>
  deviation: TemperatureDeviation
}) {
  const errorId = useId()
  const form = useForm<Record<string, string>>({ shouldUnregister: true })
  return (
    <>
      <h2 className="font-semibold">Xử lý sai lệch · {deviation.status}</h2>
      <p>
        {deviation.severity} · {deviation.immediate_action ?? "Chưa ghi xử lý ngay"}
      </p>
      {w.writer && !["Đã đóng", "Đã hủy"].includes(deviation.status) && (
        <form
          onSubmit={form.handleSubmit(async (values) => {
            await w.submitDeviation(temperatureFormData({ ...values, action: w.deviationAction }))
          })}
          className="space-y-3"
        >
          <label>
            Thao tác
            <select
              {...form.register("action", {
                onChange: (e) => w.setDeviationAction(e.target.value),
              })}
              className="w-full h-11 rounded border px-2"
              value={w.deviationAction}
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
                  {...form.register(field.name, {
                    required: field.required ? "Nhập nội dung bắt buộc." : false,
                    maxLength: { value: 2000, message: "Nhập tối đa 2000 ký tự." },
                  })}
                  aria-invalid={!!form.formState.errors[field.name]}
                  aria-describedby={
                    form.formState.errors[field.name] ? `${errorId}-${field.name}` : undefined
                  }
                  defaultValue={field.value}
                  required={field.required}
                  maxLength={2000}
                />
              ) : (
                <Input
                  {...form.register(field.name, {
                    required: field.required ? "Nhập nội dung bắt buộc." : false,
                  })}
                  aria-invalid={!!form.formState.errors[field.name]}
                  aria-describedby={
                    form.formState.errors[field.name] ? `${errorId}-${field.name}` : undefined
                  }
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
                {...form.register("owner")}
                className="w-full h-11 rounded border px-2"
                defaultValue={deviation.owner_user_id ?? ""}
              >
                <option value="">Chưa phân công</option>
                {deviation.owner_user_id && (
                  <option value={deviation.owner_user_id}>Phụ trách hiện tại</option>
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
                {...form.register("severity")}
                className="w-full h-11 rounded border px-2"
                defaultValue={deviation.severity}
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
              {...form.register("reason", {
                required: ["severity", "cancel"].includes(w.deviationAction)
                  ? "Nhập lý do thao tác."
                  : false,
                maxLength: { value: 2000, message: "Nhập tối đa 2000 ký tự." },
              })}
              aria-invalid={!!form.formState.errors.reason}
              aria-describedby={form.formState.errors.reason ? `${errorId}-reason` : undefined}
              required={["severity", "cancel"].includes(w.deviationAction)}
              maxLength={2000}
            />
          </label>
          {Object.entries(form.formState.errors).map(([name, error]) => (
            <p role="alert" id={`${errorId}-${name}`} key={name}>
              {error?.message}
            </p>
          ))}
          <Button type="submit" disabled={w.mutation.isPending || form.formState.isSubmitting}>
            Lưu xử lý
          </Button>
        </form>
      )}
    </>
  )
}
