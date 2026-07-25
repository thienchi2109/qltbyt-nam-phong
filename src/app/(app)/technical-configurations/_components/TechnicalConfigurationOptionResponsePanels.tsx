"use client"

import { ArrowRight, Copy, Loader2, RefreshCw, Save } from "lucide-react"

import type { TechnicalConfigurationBaselineCriterionWire } from "../baseline-types"
import type { TechnicalConfigurationOptionResponseDraft } from "../technical-configuration-option-response-state"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatVietnamDateTime } from "@/lib/vietnam-date-format"

type TechnicalConfigurationOptionResponsePanelsProps = {
  criterion: TechnicalConfigurationBaselineCriterionWire
  draft: TechnicalConfigurationOptionResponseDraft
  updatedAt: string
  mode: "editable" | "read-only"
  draftState: "clean" | "dirty" | "conflict"
  operation: "idle" | "saving" | "reloading"
  saveStatus: "idle" | "saved"
  hasNextCriterion: boolean
  onResponseChange: (value: string) => void
  onSupplementaryChange: (value: string) => void
  onCopyRequirement: () => void
  onReload: () => void
  onSave: () => void
  onSaveNext: () => void
}

/** Shows the selected baseline criterion beside its editable supplier response. */
export function TechnicalConfigurationOptionResponsePanels({
  criterion,
  draft,
  updatedAt,
  mode,
  draftState,
  operation,
  saveStatus,
  hasNextCriterion,
  onResponseChange,
  onSupplementaryChange,
  onCopyRequirement,
  onReload,
  onSave,
  onSaveNext,
}: Readonly<TechnicalConfigurationOptionResponsePanelsProps>) {
  const isReadOnly = mode === "read-only"
  const isDirty = draftState === "dirty"
  const isConflict = draftState === "conflict"
  const isSaving = operation === "saving"
  const isReloading = operation === "reloading"
  const isPending = operation !== "idle"
  const isSaveDisabled = isReadOnly || !isDirty || isPending || isConflict

  return (
    <div
      data-testid="selected-criterion-response-panels"
      className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
    >
      <section
        aria-label="Cấu hình cơ bản"
        className="min-w-0 border-y py-4 xl:border-y-0 xl:border-r xl:py-0 xl:pr-6"
      >
        <p className="text-xs font-medium text-muted-foreground">Cấu hình cơ bản</p>
        <h3 className="mt-2 text-base font-semibold">
          {criterion.criterion_code} · {criterion.title ?? "Không có tiêu đề"}
        </h3>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
          {criterion.requirement_text}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          disabled={isReadOnly || isPending}
          onClick={onCopyRequirement}
        >
          <Copy className="size-4" aria-hidden="true" />
          Sao chép từ cấu hình cơ bản
        </Button>
      </section>

      <section aria-label="Phản hồi phương án" className="min-w-0 space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Phản hồi phương án</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cập nhật phản hồi gần nhất: {formatVietnamDateTime(updatedAt)}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="technical-option-response-text">Phản hồi tiêu chí</Label>
          <Textarea
            id="technical-option-response-text"
            value={draft.responseText}
            rows={9}
            disabled={isReadOnly || isPending}
            onChange={(event) => onResponseChange(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="technical-option-supplementary-information">Thông tin bổ sung</Label>
          <Textarea
            id="technical-option-supplementary-information"
            value={draft.supplementaryInformation}
            rows={6}
            disabled={isReadOnly || isPending}
            onChange={(event) => onSupplementaryChange(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Thông tin bổ sung không dùng để chấm điểm.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onReload}>
            <RefreshCw
              className={`size-4 ${isReloading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Tải lại dữ liệu
          </Button>
          <Button type="button" variant="outline" disabled={isSaveDisabled} onClick={onSave}>
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            Lưu
          </Button>
          {hasNextCriterion ? (
            <Button type="button" disabled={isSaveDisabled} onClick={onSaveNext}>
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRight className="size-4" aria-hidden="true" />
              )}
              Lưu & tiếp theo
            </Button>
          ) : null}
        </div>
        {saveStatus === "saved" ? (
          <p role="status" className="text-sm text-emerald-700">
            Đã lưu phản hồi phương án.
          </p>
        ) : null}
      </section>
    </div>
  )
}
