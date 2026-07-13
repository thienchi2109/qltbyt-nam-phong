"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, ClipboardPaste } from "lucide-react"

import type { TechnicalConfigurationBulkEntrySession } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import { hasTechnicalConfigurationBulkEntryInput } from "@/app/(app)/technical-configurations/bulk-entry-utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type TechnicalConfigurationBulkEntryWorkbenchProps = Readonly<{
  groupName: string
  existingCriterionCount: number
  session: TechnicalConfigurationBulkEntrySession
  disabled: boolean
  focusInputToken: number | null
  onInputChange: (input: string) => void
  onPreview: () => void
  onCancel: () => void
  onAccept: () => void
}>

/** Renders multiline entry and validation inline within the selected group surface. */
export function TechnicalConfigurationBulkEntryWorkbench({
  groupName,
  existingCriterionCount,
  session,
  disabled,
  focusInputToken,
  onInputChange,
  onPreview,
  onCancel,
  onAccept,
}: TechnicalConfigurationBulkEntryWorkbenchProps) {
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const previewErrorCount = session.preview?.rows.filter((row) => row.error !== null).length ?? 0
  const previewStatus = session.preview
    ? `${session.preview.rows.length} dòng, ${
        previewErrorCount > 0 ? `${previewErrorCount} dòng có lỗi.` : "không có lỗi."
      }`
    : ""
  const previewStatusId = "technical-configuration-bulk-preview-status"

  React.useEffect(() => {
    if (focusInputToken === null) return
    inputRef.current?.focus()
  }, [focusInputToken])

  return (
    <section aria-label={`Nhập nhiều dòng cho ${groupName}`} className="space-y-5 py-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-md border bg-muted">
          <ClipboardPaste className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-sm font-semibold">Nhập nhiều dòng</h3>
          <p className="text-sm text-muted-foreground">
            {existingCriterionCount} tiêu chí hiện có trong bản nháp
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="technical-configuration-bulk-input">
          Nội dung nhập nhanh
        </label>
        <Textarea
          ref={inputRef}
          id="technical-configuration-bulk-input"
          aria-label="Nội dung nhập nhanh"
          className="min-h-40 resize-y whitespace-pre-wrap"
          value={session.input}
          disabled={disabled}
          placeholder={"Nguồn điện ổn định\nÁp lực vận hành ≥ 3 bar"}
          onChange={(event) => onInputChange(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Mỗi dòng tạo một tiêu chí mới trong nhóm {groupName}.
        </p>
      </div>

      <p
        id={previewStatusId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={session.preview ? "text-sm font-medium" : "sr-only"}
      >
        {previewStatus}
      </p>

      {session.preview ? (
        <section aria-label="Xem trước tiêu chí" tabIndex={0} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Xem trước</h3>
            <span className="text-xs text-muted-foreground">
              {session.preview.rows.length} dòng
            </span>
          </div>
          <div className="max-h-72 overflow-auto border-y">
            <div className="min-w-[640px]">
              <div className="sticky top-0 grid grid-cols-[6rem_minmax(24rem,1fr)_11rem] border-b bg-muted/95 text-xs font-semibold text-muted-foreground">
                <span className="px-3 py-2">Dòng</span>
                <span className="px-3 py-2">Nội dung yêu cầu</span>
                <span className="px-3 py-2">Trạng thái</span>
              </div>
              <div className="divide-y">
                {session.preview.rows.map((row) => (
                  <div
                    key={row.sourceLine}
                    className="grid grid-cols-[6rem_minmax(24rem,1fr)_11rem] items-start"
                  >
                    <span className="px-3 py-3 text-sm">Dòng {row.sourceLine}</span>
                    <span className="whitespace-pre-wrap break-words px-3 py-3 text-sm">
                      {row.error ?? row.requirementText}
                    </span>
                    <span
                      className={`flex items-center gap-2 px-3 py-3 text-sm ${
                        row.error ? "text-destructive" : "text-emerald-700"
                      }`}
                    >
                      {row.error ? (
                        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                      )}
                      {row.error ? "Có lỗi" : "Hợp lệ"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={disabled} onClick={onCancel}>
          Hủy nhập
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || !hasTechnicalConfigurationBulkEntryInput(session.input)}
          onClick={onPreview}
        >
          Xem trước
        </Button>
        <Button
          type="button"
          aria-describedby={previewStatusId}
          disabled={disabled || !session.preview?.canAccept}
          onClick={onAccept}
        >
          Thêm vào bản nháp
        </Button>
      </div>
    </section>
  )
}
