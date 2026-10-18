"use client"

import { useEffect, useId } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { temperatureFormData, temperatureValueValidation } from "@/lib/temperature-monitoring"
import type { TemperatureReading } from "@/types/temperature-monitoring"
import type { useTemperatureLogbook } from "@/hooks/use-temperature-logbook"

type ReviewFields = {
  action: string
  value: string
  unable: boolean
  unableReason: string
  reason: string
}

/** Keep review drafts independent from authoritative revisions and pending requests. */
export function TemperatureMonitoringReviewSection({
  w,
  reading,
}: {
  w: ReturnType<typeof useTemperatureLogbook>
  reading: TemperatureReading
}) {
  const errorId = useId()
  const form = useForm<ReviewFields>({
    defaultValues: {
      action: w.reviewActions[0]?.value ?? "",
      value: "",
      unable: false,
      unableReason: "",
      reason: "",
    },
  })
  useEffect(() => {
    if (!w.reviewActions.some((action) => action.value === form.getValues("action"))) {
      form.setValue("action", w.reviewActions[0]?.value ?? "")
    }
  }, [form, w.reviewActions])
  return (
    <>
      {w.readingDetails.map(([label, value]) => (
        <p key={label}>
          {label}: {value}
        </p>
      ))}
      {w.manager && !w.independent && (
        <p>Bạn không thể tự duyệt số đo hoặc đề xuất của mình. Cần người quản lý độc lập.</p>
      )}
      {w.writer && (
        <form
          onSubmit={form.handleSubmit(async (values) => {
            await w.submitReview(temperatureFormData(values))
          })}
          className="space-y-3"
        >
          <label>
            Thao tác
            <select {...form.register("action")} className="w-full h-11 rounded border px-2">
              {w.reviewActions.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Số đo đề xuất
            <Input
              {...form.register("value", { validate: temperatureValueValidation })}
              aria-invalid={!!form.formState.errors.value}
              aria-describedby={form.formState.errors.value ? `${errorId}-value` : undefined}
              type="number"
              step="0.1"
              min="-200"
              max="300"
            />
          </label>
          <label className="flex items-center gap-2">
            <input {...form.register("unable")} type="checkbox" />
            Đề xuất không đo được
          </label>
          {w.reviewTextFields.map((field) => (
            <label key={field.name}>
              {field.label}
              <Textarea
                {...form.register(field.name as "unableReason" | "reason", {
                  required: field.required ? "Nhập lý do thao tác." : false,
                  maxLength: { value: 2000, message: "Nhập tối đa 2000 ký tự." },
                })}
                aria-invalid={!!form.formState.errors[field.name as "unableReason" | "reason"]}
                aria-describedby={
                  form.formState.errors[field.name as "unableReason" | "reason"]
                    ? `${errorId}-${field.name}`
                    : undefined
                }
                required={field.required}
                maxLength={2000}
              />
            </label>
          ))}
          {Object.entries(form.formState.errors).map(([name, error]) => (
            <p role="alert" id={`${errorId}-${name}`} key={name}>
              {error.message}
            </p>
          ))}
          <Button
            type="submit"
            disabled={
              w.mutation.isPending ||
              form.formState.isSubmitting ||
              (!!reading.pending_amendment && !w.independent)
            }
          >
            Gửi thao tác
          </Button>
        </form>
      )}
    </>
  )
}
