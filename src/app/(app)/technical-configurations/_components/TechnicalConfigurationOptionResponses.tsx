"use client"

import * as React from "react"
import { AlertCircle, Download, Loader2, RefreshCw, Upload } from "lucide-react"

import { useTechnicalConfigurationBaselineVersionSelection } from "../_hooks/useTechnicalConfigurationBaselineVersionSelection"
import { useTechnicalConfigurationDiscardConfirmation } from "../_hooks/useTechnicalConfigurationDiscardConfirmation"
import { useTechnicalConfigurationOptionImport } from "../_hooks/useTechnicalConfigurationOptionImport"
import type { TechnicalConfigurationOptionWire } from "../supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "../types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { TechnicalConfigurationOptionImportDialog } from "./TechnicalConfigurationOptionImportDialog"
import { TechnicalConfigurationOptionResponseEditor } from "./TechnicalConfigurationOptionResponseEditor"

type TechnicalConfigurationOptionResponsesProps = {
  dossier: TechnicalConfigurationDossierWire
  option: TechnicalConfigurationOptionWire
  onDirtyChange?: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
  onRevisionChange?: (revision: number) => void
}

const LOAD_MORE_BASELINE_VERSIONS_VALUE = "__load-more-option-response-baselines__"

/** Renders manual option responses bound to one exact baseline version. */
export function TechnicalConfigurationOptionResponses({
  dossier,
  option,
  onDirtyChange,
  onNavigationBlockedChange,
  onRevisionChange,
}: Readonly<TechnicalConfigurationOptionResponsesProps>) {
  const selection = useTechnicalConfigurationBaselineVersionSelection(dossier.id)
  const {
    adoptVersion,
    handleRevisionChange,
    selectedVersion,
    synchronizeVersion,
    versionOptions,
    versionState,
  } = selection
  const [isResponseDirty, setIsResponseDirty] = React.useState(false)
  const [isResponseNavigationBlocked, setIsResponseNavigationBlocked] = React.useState(false)
  const { discardConfirmationDialog, requestDiscardConfirmation } =
    useTechnicalConfigurationDiscardConfirmation()
  const handleResponseRevisionChange = React.useCallback(
    (revision: number) => {
      handleRevisionChange(revision)
      onRevisionChange?.(revision)
    },
    [handleRevisionChange, onRevisionChange]
  )
  const importWorkflow = useTechnicalConfigurationOptionImport({
    dossier,
    option,
    baselineVersion: selectedVersion,
    isBlocked: isResponseDirty || isResponseNavigationBlocked,
    onRevisionChange: handleResponseRevisionChange,
  })
  const isDirty = isResponseDirty || importWorkflow.isDirty
  const isNavigationBlocked = isResponseNavigationBlocked || importWorkflow.isNavigationBlocked

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent -- Baseline history refresh must not replace an exact-baseline response draft.
    synchronizeVersion(isDirty)
  }, [isDirty, synchronizeVersion])

  const handleDirtyChange = React.useCallback((dirty: boolean) => {
    setIsResponseDirty(dirty)
  }, [])
  const handleNavigationBlockedChange = React.useCallback((blocked: boolean) => {
    setIsResponseNavigationBlocked(blocked)
  }, [])
  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- Manual response drafts and transient import state share one workspace dirty contract.
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])
  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- Manual response operations and import lifecycle share one navigation block.
    onNavigationBlockedChange?.(isNavigationBlocked)
  }, [isNavigationBlocked, onNavigationBlockedChange])
  const handleVersionChange = React.useCallback(
    (versionId: string) => {
      const nextVersion = versionOptions.find((version) => version.id === versionId)
      if (!nextVersion) return
      if (isDirty) {
        requestDiscardConfirmation("Chuyển phiên bản sẽ bỏ phản hồi chưa lưu. Tiếp tục?", () =>
          adoptVersion(nextVersion)
        )
        return
      }
      adoptVersion(nextVersion)
    },
    [adoptVersion, isDirty, requestDiscardConfirmation, versionOptions]
  )
  const handleVersionSelect = React.useCallback(
    (value: string) => {
      if (value === LOAD_MORE_BASELINE_VERSIONS_VALUE) {
        void versionState.loadMoreVersions()
        return
      }
      handleVersionChange(value)
    },
    [handleVersionChange, versionState.loadMoreVersions]
  )

  React.useEffect(
    () => () => {
      onDirtyChange?.(false)
      onNavigationBlockedChange?.(false)
    },
    [onDirtyChange, onNavigationBlockedChange]
  )

  if (versionState.versionsQuery.isLoading) {
    return (
      <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Đang tải phiên bản cấu hình...
      </div>
    )
  }

  if (versionState.versionsQuery.isError && versionOptions.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        <AlertTitle>Không thể tải phiên bản cấu hình</AlertTitle>
        <AlertDescription>
          <Button type="button" variant="outline" size="sm" onClick={versionState.retryVersions}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Thử lại
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!selectedVersion) {
    return (
      <div className="border-y py-5">
        <p className="text-sm font-medium">Chưa có phiên bản cấu hình cơ sở</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tạo cấu hình cơ sở trước khi nhập phản hồi cho phương án.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Label htmlFor="option-response-baseline-version">Phiên bản cấu hình cơ sở</Label>
          <Select
            value={selectedVersion.id}
            disabled={isNavigationBlocked}
            onValueChange={handleVersionSelect}
          >
            <SelectTrigger
              id="option-response-baseline-version"
              aria-label="Phiên bản cấu hình cơ sở"
              className="mt-2 w-full sm:w-[320px]"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versionOptions
                .toSorted((left, right) => right.version_number - left.version_number)
                .map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    Phiên bản {version.version_number} ·{" "}
                    {version.status === "locked" ? "Đã khóa" : "Bản nháp"}
                  </SelectItem>
                ))}
              {versionState.versionsQuery.hasNextPage || versionState.hasHistoryRecoveryError ? (
                <SelectItem
                  value={LOAD_MORE_BASELINE_VERSIONS_VALUE}
                  disabled={versionState.versionsQuery.isFetchingNextPage}
                >
                  {versionState.versionsQuery.isFetchingNextPage
                    ? "Đang tải phiên bản..."
                    : versionState.hasHistoryRecoveryError
                      ? "Thử tải lại lịch sử phiên bản"
                      : "Tải thêm phiên bản"}
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!importWorkflow.canUseActions || importWorkflow.isDownloading}
            onClick={() => void importWorkflow.downloadTemplate()}
          >
            {importWorkflow.isDownloading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-4" aria-hidden="true" />
            )}
            Tải template phản hồi
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!importWorkflow.canUseActions}
            onClick={importWorkflow.openDialog}
          >
            <Upload className="size-4" aria-hidden="true" />
            Nhập phản hồi từ Excel
          </Button>
        </div>
      </div>

      <TechnicalConfigurationOptionResponseEditor
        key={`${option.id}:${selectedVersion.id}`}
        dossier={dossier}
        option={option}
        baselineVersion={selectedVersion}
        onDirtyChange={handleDirtyChange}
        onNavigationBlockedChange={handleNavigationBlockedChange}
        onRevisionChange={handleResponseRevisionChange}
        requestDiscardConfirmation={requestDiscardConfirmation}
        isExternalMutationBlocked={importWorkflow.isNavigationBlocked}
      />
      <TechnicalConfigurationOptionImportDialog workflow={importWorkflow} />
      {discardConfirmationDialog}
    </div>
  )
}
