"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface UrlDocumentFormProps {
  name: string
  url: string
  onNameChange: (value: string) => void
  onUrlChange: (value: string) => void
  onSubmit: () => void | Promise<void>
  isPending?: boolean
  disabled?: boolean
  validationError?: string | null
  submitLabel?: string
}

/** Renders controlled document alias and URL fields without owning workflow side effects. */
export function UrlDocumentForm({
  name,
  url,
  onNameChange,
  onUrlChange,
  onSubmit,
  isPending = false,
  disabled = false,
  validationError = null,
  submitLabel = "Lưu liên kết",
}: UrlDocumentFormProps) {
  const formId = React.useId()
  const nameInputId = `${formId}-name`
  const urlInputId = `${formId}-url`
  const validationErrorId = `${formId}-error`
  const controlsDisabled = disabled || isPending

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSubmit()
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <Label htmlFor={nameInputId}>Tên tài liệu</Label>
        <Input
          id={nameInputId}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          required
          disabled={controlsDisabled}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={urlInputId}>Đường dẫn (URL)</Label>
        <Input
          id={urlInputId}
          type="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          required
          disabled={controlsDisabled}
          aria-invalid={validationError ? true : undefined}
          aria-describedby={validationError ? validationErrorId : undefined}
        />
        {validationError ? (
          <p id={validationErrorId} role="alert" className="text-sm text-destructive">
            {validationError}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={controlsDisabled}>
        {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  )
}
