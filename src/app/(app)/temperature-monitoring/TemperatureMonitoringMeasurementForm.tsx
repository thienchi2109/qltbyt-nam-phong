"use client"

import { useId } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { temperatureFormData } from "@/lib/temperature-monitoring"
import {
  temperatureMeasurementFormSchema,
  type TemperatureMeasurementFields,
} from "@/lib/temperature-monitoring-form-schemas"
import type { TemperatureSlot } from "@/types/temperature-monitoring"
import type { useTemperatureLogbook } from "@/hooks/use-temperature-logbook"

/** Register one slot's draft and retain it until the authoritative save transitions the sheet. */
export function TemperatureMonitoringMeasurementForm({
  w,
  slot,
}: {
  w: ReturnType<typeof useTemperatureLogbook>
  slot: TemperatureSlot
}) {
  const errorId = useId()
  const form = useForm<TemperatureMeasurementFields>({
    resolver: zodResolver(temperatureMeasurementFormSchema),
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
          {...form.register("value")}
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
          {...form.register("captured")}
          aria-invalid={!!form.formState.errors.captured}
          aria-describedby={form.formState.errors.captured ? `${errorId}-captured` : undefined}
        />
      </label>
      {w.readingTextFields.map((field) => (
        <label key={field.name}>
          {field.label}
          <Textarea
            {...form.register(field.name as "reason" | "note")}
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
