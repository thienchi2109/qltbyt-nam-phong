import { z } from "zod"
import { temperatureDeviationFields } from "./temperature-monitoring"

const text = z.string().max(2000, "Nhập tối đa 2000 ký tự.")

/** Preserve numeric strings while enforcing the input's bounds and tenth-degree step. */
export const temperatureFormValueSchema = z.string().refine((value) => {
  if (value === "") return true
  const number = Number(value)
  return (
    Number.isFinite(number) &&
    number >= -200 &&
    number <= 300 &&
    Math.abs(number * 10 - Math.round(number * 10)) < 1e-9
  )
}, "Nhập nhiệt độ từ -200 đến 300 °C theo bước 0,1.")

/** Validate a registered observation draft before its contextual capture checks. */
export const temperatureMeasurementFormSchema = z
  .object({
    value: temperatureFormValueSchema,
    unable: z.boolean(),
    captured: z.string().min(1, "Chọn giờ đo thực tế."),
    reason: text,
    note: text,
  })
  .superRefine((values, ctx) => {
    if (values.unable ? !values.reason.trim() : !values.value.trim()) {
      ctx.addIssue({
        code: "custom",
        path: [values.unable ? "reason" : "value"],
        message: "Nhập nhiệt độ hoặc lý do không đo được.",
      })
    }
  })

/** Require review rationale and validate proposal fields only for amendments. */
export const temperatureReviewFormSchema = z
  .object({
    action: z.string(),
    value: z.string(),
    unable: z.boolean(),
    unableReason: text,
    reason: text.refine((value) => !!value.trim(), "Nhập lý do thao tác."),
  })
  .superRefine((values, ctx) => {
    if (values.action !== "amend") return
    const numeric = temperatureFormValueSchema.safeParse(values.value)
    if (!numeric.success) {
      for (const issue of numeric.error.issues) ctx.addIssue({ ...issue, path: ["value"] })
    }
    if (values.unable ? !values.unableReason.trim() : !values.value.trim()) {
      ctx.addIssue({
        code: "custom",
        path: [values.unable ? "unableReason" : "value"],
        message: "Nhập số đo đề xuất hoặc chọn không đo được.",
      })
    }
  })

/** Validate only the selected operation's fields; contextual reassignment stays in the hook. */
export const temperatureDeviationFormSchema = z.record(z.string()).superRefine((values, ctx) => {
  const fields = [
    ...temperatureDeviationFields(undefined, values.action),
    {
      name: "reason",
      type: "textarea",
      required: ["severity", "cancel"].includes(values.action),
    },
  ]
  for (const field of fields) {
    const value = values[field.name] ?? ""
    if (field.required && !value.trim()) {
      ctx.addIssue({
        code: "custom",
        path: [field.name],
        message: field.name === "reason" ? "Nhập lý do thao tác." : "Nhập nội dung bắt buộc.",
      })
    } else if (field.type === "textarea") {
      const parsed = text.safeParse(value)
      if (!parsed.success)
        for (const issue of parsed.error.issues) ctx.addIssue({ ...issue, path: [field.name] })
    }
  }
})

export type TemperatureMeasurementFields = z.infer<typeof temperatureMeasurementFormSchema>
export type TemperatureReviewFields = z.infer<typeof temperatureReviewFormSchema>
