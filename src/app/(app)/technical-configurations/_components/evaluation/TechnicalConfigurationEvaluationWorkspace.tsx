"use client"

import * as React from "react"
import { AlertCircle, Loader2, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import { useTechnicalConfigurationBeforeUnloadGuard } from "../../_hooks/useTechnicalConfigurationBeforeUnloadGuard"
import { useTechnicalConfigurationComparisonMatrix } from "../../_hooks/useTechnicalConfigurationComparisonMatrix"
import type { TechnicalConfigurationDossierWire } from "../../types"
import { TechnicalConfigurationEvaluationActiveWorkspace } from "./TechnicalConfigurationEvaluationActiveWorkspace"
import { TechnicalConfigurationEvaluationMatrixToolbar } from "./TechnicalConfigurationEvaluationMatrixToolbar"
import { TechnicalConfigurationOptionReferenceRanking } from "./TechnicalConfigurationOptionReferenceRanking"

type TechnicalConfigurationEvaluationWorkspaceProps = {
  dossier: TechnicalConfigurationDossierWire
  onDirtyChange?: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
  onRevisionChange?: (revision: number) => void
}

/** Hosts the unified matrix while preserving assessment navigation and unload guards. */
export function TechnicalConfigurationEvaluationWorkspace({
  dossier,
  onDirtyChange,
  onNavigationBlockedChange,
  onRevisionChange,
}: Readonly<TechnicalConfigurationEvaluationWorkspaceProps>) {
  const matrix = useTechnicalConfigurationComparisonMatrix(dossier.id)
  const [isDirty, setIsDirty] = React.useState(false)
  const [isNavigationBlocked, setIsNavigationBlocked] = React.useState(false)
  const runImmediateContextChange = React.useCallback((change: () => void) => change(), [])
  const selectedVersion =
    matrix.versions.find((version) => version.id === matrix.baselineVersionId) ?? null
  const displayedOptionIds = new Set(
    matrix.focusedOptionId ? [matrix.focusedOptionId] : matrix.visibleOptionIds
  )
  const evaluationOptions = matrix.selectedOptions.filter((option) =>
    displayedOptionIds.has(option.id)
  )

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- WorkspaceShell owns top-level guards while this workspace owns assessment state.
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])
  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- Pending saves block tab and dossier navigation.
    onNavigationBlockedChange?.(isNavigationBlocked)
  }, [isNavigationBlocked, onNavigationBlockedChange])
  React.useEffect(
    () => () => {
      onDirtyChange?.(false)
      onNavigationBlockedChange?.(false)
    },
    [onDirtyChange, onNavigationBlockedChange]
  )
  useTechnicalConfigurationBeforeUnloadGuard(isDirty || isNavigationBlocked)

  if (selectedVersion && evaluationOptions.length > 0) {
    return (
      <div className="min-w-0 space-y-6">
        <TechnicalConfigurationEvaluationActiveWorkspace
          dossier={dossier}
          baselineVersionId={selectedVersion.id}
          baselineGroups={selectedVersion.groups}
          options={evaluationOptions}
          matrix={matrix}
          onDirtyChange={setIsDirty}
          onNavigationBlockedChange={setIsNavigationBlocked}
          onRevisionChange={onRevisionChange}
        />
        <TechnicalConfigurationOptionReferenceRanking
          dossierId={dossier.id}
          baselineVersionId={selectedVersion.id}
        />
      </div>
    )
  }

  return (
    <section className="min-w-0 space-y-4" aria-label="Không gian đánh giá cấu hình kỹ thuật">
      <TechnicalConfigurationEvaluationMatrixToolbar
        matrix={matrix}
        activeOptionId=""
        navigationBlocked={false}
        runContextChange={runImmediateContextChange}
      />

      {matrix.versionsQuery.isLoading || matrix.optionsQuery.isLoading ? (
        <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tải không gian đánh giá...
        </div>
      ) : null}
      {matrix.versionsQuery.isError && !selectedVersion ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>Không thể tải cấu hình cơ sở</AlertTitle>
          <AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void matrix.retryVersions()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {!matrix.versionsQuery.isLoading && !matrix.versionsQuery.isError && !selectedVersion ? (
        <Alert>
          <AlertTitle>Chưa chọn cấu hình cơ sở</AlertTitle>
          <AlertDescription>Chọn một phiên bản cấu hình để bắt đầu đánh giá.</AlertDescription>
        </Alert>
      ) : null}
      {selectedVersion &&
      matrix.options.length > 0 &&
      evaluationOptions.length === 0 &&
      !matrix.optionsQuery.isLoading &&
      !matrix.optionsQuery.isError ? (
        <Alert>
          <AlertTitle>Chưa chọn phương án hiển thị</AlertTitle>
          <AlertDescription>
            Chọn và hiển thị ít nhất một phương án trong ma trận để bắt đầu đánh giá.
          </AlertDescription>
        </Alert>
      ) : null}
      {matrix.optionsQuery.isError && matrix.options.length === 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>Không thể tải phương án</AlertTitle>
          <AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void matrix.optionsQuery.refetch()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Thử lại
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {!matrix.optionsQuery.isLoading &&
      !matrix.optionsQuery.isError &&
      matrix.options.length === 0 ? (
        <Alert>
          <AlertTitle>Chưa có phương án</AlertTitle>
          <AlertDescription>Tạo phương án nhà cung cấp trước khi đánh giá.</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
