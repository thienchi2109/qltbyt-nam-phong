import * as React from "react"

import { cn } from "@/lib/utils"

/** Renders one accessible native-radio row without adding a shared UI dependency. */
export function TechnicalConfigurationResultExportDialogChoice({
  id,
  name,
  value,
  checked,
  title,
  description,
  recommended = false,
  inputRef,
  onChange,
}: Readonly<{
  id: string
  name: string
  value: string
  checked: boolean
  title: string
  description?: string
  recommended?: boolean
  inputRef?: React.Ref<HTMLInputElement>
  onChange: () => void
}>) {
  const titleId = `${id}-title`
  const descriptionId = description ? `${id}-description` : null
  const recommendedId = recommended ? `${id}-recommended` : null
  const describedBy = [descriptionId, recommendedId].filter(Boolean).join(" ") || undefined

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 border px-3 py-3 transition-colors",
        checked ? "border-emerald-700 bg-emerald-50/60" : "border-border hover:bg-muted/40"
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        onChange={onChange}
        className="mt-0.5 size-4 shrink-0 accent-emerald-700"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
          <span id={titleId}>{title}</span>
          {recommended ? (
            <span id={recommendedId ?? undefined} className="text-xs font-medium text-emerald-700">
              Khuyên dùng
            </span>
          ) : null}
        </span>
        {description ? (
          <span
            id={descriptionId ?? undefined}
            className="mt-1 block text-sm text-muted-foreground"
          >
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
}
