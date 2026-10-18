"use client"

import { useId } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { temperatureFormData, temperatureValueValidation } from "@/lib/temperature-monitoring"
import type { TemperatureSlot } from "@/types/temperature-monitoring"
import type { useTemperatureLogbook } from "@/hooks/use-temperature-logbook"

type ReadingFields = {
  value: string
  unable: boolean
  captured: string
  reason: string
  note: string
}

/** Register one slot's draft and retain it until the authoritative save transitions the sheet. */
export function TemperatureMonitoringMeasurementForm({
  w,
  slot,
}: {
  w: ReturnType<typeof useTemperatureLogbook>
  slot: TemperatureSlot
}) {
  const errorId = useId()
  const form = useForm<ReadingFields>({
    defaultValues: { value: "", unable: false, captured: w.captureDefault, reason: "", note: "" },
  })
  return (
    <form
      onSubmit={form.handleSubmit((values) => w.submitReading(temperatureFormData(values)))}
      className="space-y-3"
    >
      <label>
        Nhiệt độ (°C)
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
        Không đo được
      </label>
      <label>
        Giờ đo thực tế ({slot.display_timezone})
        <Input
          {...w.captureInput}
          {...form.register("captured", { required: "Chọn giờ đo thực tế." })}
          aria-invalid={!!form.formState.errors.captured}
          aria-describedby={form.formState.errors.captured ? `${errorId}-captured` : undefined}
        />
      </label>
      {w.readingTextFields.map((field) => (
        <label key={field.name}>
          {field.label}
          <Textarea
            {...form.register(field.name as "reason" | "note", {
              maxLength: { value: 2000, message: "Nhập tối đa 2000 ký tự." },
            })}
            aria-invalid={!!form.formState.errors[field.name as "reason" | "note"]}
            aria-describedby={
              form.formState.errors[field.name as "reason" | "note"]
                ? `${errorId}-${field.name}`
                : undefined
            }
            maxLength={2000}
          />
        </label>
      ))}
      {Object.entries(form.formState.errors).map(([name, error]) => (
        <p role="alert" id={`${errorId}-${name}`} key={name}>
          {error.message}
        </p>
      ))}
      <Button type="submit" disabled={w.mutation.isPending || form.formState.isSubmitting}>
        Lưu số đo
      </Button>
    </form>
  )
}
