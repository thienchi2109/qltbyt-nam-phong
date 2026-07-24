"use client"

import * as React from "react"
import { Loader2, Save, Trash2 } from "lucide-react"

import type { TechnicalConfigurationOptionWire } from "../supplier-option-types"
import type {
  TechnicalConfigurationOptionDraft,
  TechnicalConfigurationOptionDraftPatch,
} from "../technical-configuration-supplier-option-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type TechnicalConfigurationOptionEditorProps = {
  supplierName: string
  draft: TechnicalConfigurationOptionDraft
  option: TechnicalConfigurationOptionWire | null
  mode: "create" | "edit"
  disabled: boolean
  isPending: boolean
  onChange: (patch: TechnicalConfigurationOptionDraftPatch) => void
  onSave: () => void
  onDelete: () => void
}

const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
})

function formatUpdatedAt(value: string): string {
  return UPDATED_AT_FORMATTER.format(new Date(value))
}

/** Renders the explicit option identity editor without baseline response fields. */
export function TechnicalConfigurationOptionEditor({
  supplierName,
  draft,
  option,
  mode,
  disabled,
  isPending,
  onChange,
  onSave,
  onDelete,
}: Readonly<TechnicalConfigurationOptionEditorProps>) {
  const isCreating = mode === "create"
  const displayLabel = option?.display_label ?? `${supplierName} · Phương án mới`

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-muted-foreground">Phương án đang chọn</p>
          <h3 className="mt-1 break-words text-lg font-semibold">{displayLabel}</h3>
          {option ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Cập nhật lần cuối: {formatUpdatedAt(option.updated_at)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onDelete}
            disabled={disabled || isCreating || !option}
            aria-label="Xóa phương án"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Xóa
          </Button>
          <Button type="button" onClick={onSave} disabled={disabled}>
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            Lưu phương án
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="technical-option-model">Model</Label>
          <Input
            id="technical-option-model"
            value={draft.model}
            onChange={(event) => onChange({ model: event.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="technical-option-name">Tên phương án</Label>
          <Input
            id="technical-option-name"
            value={draft.optionName}
            onChange={(event) => onChange({ optionName: event.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="technical-option-manufacturer">Hãng sản xuất</Label>
          <Input
            id="technical-option-manufacturer"
            value={draft.manufacturer}
            onChange={(event) => onChange({ manufacturer: event.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="technical-option-notes">Ghi chú</Label>
          <Textarea
            id="technical-option-notes"
            value={draft.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            disabled={disabled}
            rows={5}
          />
        </div>
      </div>
    </div>
  )
}
