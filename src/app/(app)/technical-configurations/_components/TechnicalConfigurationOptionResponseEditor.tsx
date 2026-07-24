"use client"

import * as React from "react"
import { AlertCircle, Archive, Loader2, RefreshCw, Save } from "lucide-react"

import { useTechnicalConfigurationOptionResponses } from "../_hooks/useTechnicalConfigurationOptionResponses"
import type { TechnicalConfigurationBaselineDraftWire } from "../baseline-types"
import type { TechnicalConfigurationOptionWire } from "../supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "../types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatVietnamDateTime } from "@/lib/vietnam-date-format"

type TechnicalConfigurationOptionResponseEditorProps = {
  dossier: TechnicalConfigurationDossierWire
  option: TechnicalConfigurationOptionWire
  baselineVersion: TechnicalConfigurationBaselineDraftWire
  onDirtyChange?: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
  onRevisionChange?: (revision: number) => void
  requestDiscardConfirmation: (description: React.ReactNode, action: () => void) => void
}

/** Renders one exact-baseline criterion navigator and explicit response editor. */
export function TechnicalConfigurationOptionResponseEditor({
  dossier,
  option,
  baselineVersion,
  onDirtyChange,
  onNavigationBlockedChange,
  onRevisionChange,
  requestDiscardConfirmation,
}: Readonly<TechnicalConfigurationOptionResponseEditorProps>) {
  const state = useTechnicalConfigurationOptionResponses({
    dossier,
    option,
    baselineVersion,
    onRevisionChange,
    onNavigationBlockedChange,
  })

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-prop-callback-in-effect, react-doctor/no-pass-data-to-parent, react-doctor/no-pass-live-state-to-parent -- The response hook owns the draft while the supplier workspace combines cross-surface dirty state.
    onDirtyChange?.(state.isDirty)
  }, [onDirtyChange, state.isDirty])

  React.useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const handleCriterionChange = React.useCallback(
    (criterionId: string) => {
      if (state.isDirty) {
        requestDiscardConfirmation("Chuyển tiêu chí sẽ bỏ phản hồi chưa lưu. Tiếp tục?", () =>
          state.selectCriterion(criterionId)
        )
        return
      }
      state.selectCriterion(criterionId)
    },
    [requestDiscardConfirmation, state]
  )
  const hasInitialError = state.responseQuery.isError && state.responseQuery.data === undefined
  const isUnavailable = state.responseQuery.isLoading || hasInitialError

  return (
    <div className="space-y-4">
      {dossier.archived_at ? (
        <Alert>
          <Archive className="size-4" aria-hidden="true" />
          <AlertTitle>Chế độ chỉ đọc</AlertTitle>
          <AlertDescription>Hồ sơ đã lưu trữ. Phản hồi phương án chỉ được xem.</AlertDescription>
        </Alert>
      ) : null}

      {hasInitialError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>Không thể tải phản hồi phương án</AlertTitle>
          <AlertDescription>
            <Button type="button" variant="outline" size="sm" onClick={() => void state.reload()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {state.validationError || state.operationError ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>{state.isConflict ? "Dữ liệu đã thay đổi" : "Không thể lưu"}</AlertTitle>
          <AlertDescription>{state.validationError ?? state.operationError}</AlertDescription>
        </Alert>
      ) : null}

      <div
        data-testid="option-response-workspace"
        className="grid min-w-0 gap-5 lg:grid-cols-[minmax(12rem,0.45fr)_minmax(0,1fr)]"
      >
        <nav aria-label="Tiêu chí cấu hình cơ sở" className="min-w-0 border-y py-3">
          <p className="mb-2 text-sm font-medium">Tiêu chí</p>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {state.criteria.map((criterion) => (
              <Button
                key={criterion.id}
                type="button"
                variant={criterion.id === state.selectedCriterionId ? "secondary" : "ghost"}
                className="h-auto min-w-44 justify-start whitespace-normal text-left lg:min-w-0"
                disabled={state.isPending}
                onClick={() => handleCriterionChange(criterion.id)}
              >
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">
                    {criterion.criterion_code}
                  </span>
                  <span className="block break-words">
                    {criterion.title ?? criterion.requirement_text}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        </nav>

        <section className="min-w-0 space-y-4">
          {state.responseQuery.isLoading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Đang tải phản hồi...
            </div>
          ) : null}

          {!isUnavailable && !state.selectedCriterion ? (
            <Alert>
              <AlertTitle>Phiên bản chưa có tiêu chí</AlertTitle>
              <AlertDescription>
                Thêm tiêu chí cấu hình cơ sở trước khi nhập phản hồi.
              </AlertDescription>
            </Alert>
          ) : null}

          {!isUnavailable && state.selectedCriterion ? (
            <>
              <div className="border-b pb-3">
                <p className="text-sm font-medium">
                  {state.selectedCriterion.criterion_code} ·{" "}
                  {state.selectedCriterion.title ?? "Không có tiêu đề"}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {state.selectedCriterion.requirement_text}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Cập nhật phản hồi gần nhất: {formatVietnamDateTime(state.updatedAt)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="technical-option-response-text">Phản hồi tiêu chí</Label>
                <Textarea
                  id="technical-option-response-text"
                  value={state.draft.responseText}
                  rows={7}
                  disabled={state.isReadOnly || state.isPending}
                  onChange={(event) => state.updateDraft({ responseText: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="technical-option-supplementary-information">
                  Thông tin bổ sung
                </Label>
                <Textarea
                  id="technical-option-supplementary-information"
                  value={state.draft.supplementaryInformation}
                  rows={5}
                  disabled={state.isReadOnly || state.isPending}
                  onChange={(event) =>
                    state.updateDraft({ supplementaryInformation: event.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Thông tin bổ sung không dùng để chấm điểm.
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={state.isPending}
                  onClick={() => void state.reload()}
                >
                  <RefreshCw
                    className={`size-4 ${state.isReloading ? "animate-spin" : ""}`}
                    aria-hidden="true"
                  />
                  Tải lại dữ liệu
                </Button>
                {!state.isReadOnly ? (
                  <Button
                    type="button"
                    disabled={!state.isDirty || state.isPending || state.isConflict}
                    onClick={() => void state.save()}
                  >
                    {state.isSaving ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    Lưu phản hồi
                  </Button>
                ) : null}
              </div>
              {state.saveStatus === "saved" ? (
                <p role="status" className="text-sm text-emerald-700">
                  Đã lưu phản hồi phương án.
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </div>
  )
}
