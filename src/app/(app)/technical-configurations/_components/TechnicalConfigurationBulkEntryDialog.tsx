"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, ClipboardPaste, ListChecks } from "lucide-react"

import type { TechnicalConfigurationBulkEntryPreview } from "@/app/(app)/technical-configurations/bulk-entry-utils"
import { parseTechnicalConfigurationBulkEntry } from "@/app/(app)/technical-configurations/bulk-entry-utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

type TechnicalConfigurationBulkEntryDialogProps = Readonly<{
  groupIndex: number
  groupName: string
  disabled: boolean
  onAccept: (requirementTexts: string[]) => void
}>

/** Previews pasted criteria and applies only validated rows to local editor state. */
export function TechnicalConfigurationBulkEntryDialog({
  groupIndex,
  groupName,
  disabled,
  onAccept,
}: TechnicalConfigurationBulkEntryDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [preview, setPreview] = React.useState<TechnicalConfigurationBulkEntryPreview | null>(null)
  const previewStatusId = `bulk-entry-preview-status-${groupIndex}`
  const previewErrorCount = preview?.rows.filter((row) => row.error !== null).length ?? 0
  const previewStatus = preview
    ? `${preview.rows.length} dòng, ${
        previewErrorCount > 0 ? `${previewErrorCount} dòng có lỗi.` : "không có lỗi."
      }`
    : ""

  const reset = React.useCallback(() => {
    setInput("")
    setPreview(null)
  }, [])

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) reset()
      setOpen(nextOpen)
    },
    [reset]
  )

  const handleAccept = () => {
    if (!preview?.canAccept) return

    onAccept(preview.rows.map((row) => row.requirementText))
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={`Nhập nhanh tiêu chí vào nhóm ${groupIndex}`}
        >
          <ClipboardPaste className="size-4" aria-hidden="true" />
          Nhập nhanh
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" closeLabel="Đóng">
        <DialogHeader>
          <DialogTitle>Nhập nhanh tiêu chí</DialogTitle>
          <DialogDescription>
            Mỗi dòng tạo một tiêu chí trong nhóm{" "}
            <span className="font-medium text-foreground">{groupName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor={`bulk-entry-${groupIndex}`}>
              Nội dung nhập nhanh
            </label>
            <Textarea
              id={`bulk-entry-${groupIndex}`}
              aria-label="Nội dung nhập nhanh"
              className="min-h-32 resize-y whitespace-pre-wrap"
              value={input}
              placeholder={"Nguồn điện ổn định\nÁp lực vận hành ≥ 3 bar"}
              onChange={(event) => {
                setInput(event.target.value)
                setPreview(null)
              }}
            />
          </div>

          <p
            id={previewStatusId}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {previewStatus}
          </p>

          {preview ? (
            <section aria-label="Xem trước tiêu chí" className="grid min-h-0 gap-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Xem trước</h3>
                <span className="text-xs text-muted-foreground">{preview.rows.length} dòng</span>
              </div>

              {preview.rows.length > 0 ? (
                <div
                  role="region"
                  aria-label="Danh sách xem trước tiêu chí"
                  tabIndex={0}
                  className="h-52 overflow-y-auto rounded-md border"
                >
                  <ul className="divide-y">
                    {preview.rows.map((row) => (
                      <li
                        key={row.sourceLine}
                        className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-3 py-3"
                      >
                        {row.error ? (
                          <AlertCircle
                            className="mt-0.5 size-4 text-destructive"
                            aria-hidden="true"
                          />
                        ) : (
                          <CheckCircle2
                            className="mt-0.5 size-4 text-emerald-600"
                            aria-hidden="true"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">
                            Dòng {row.sourceLine}
                          </p>
                          {row.error ? (
                            <p className="mt-1 text-sm text-destructive">{row.error}</p>
                          ) : (
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                              {row.requirementText}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex min-h-28 items-center justify-center gap-2 border-y text-sm text-muted-foreground">
                  <ListChecks className="size-4" aria-hidden="true" />
                  Chưa có tiêu chí để xem trước.
                </div>
              )}
            </section>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!input.trim()}
            onClick={() => setPreview(parseTechnicalConfigurationBulkEntry(input))}
          >
            Xem trước
          </Button>
          <Button
            type="button"
            aria-describedby={previewStatusId}
            disabled={!preview?.canAccept}
            onClick={handleAccept}
          >
            Thêm vào nhóm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
