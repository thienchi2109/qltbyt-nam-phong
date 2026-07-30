"use client"

import * as React from "react"
import { AlertCircle, Loader2, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import { useTechnicalConfigurationBaselineVersionSelection } from "../../_hooks/useTechnicalConfigurationBaselineVersionSelection"
import { useTechnicalConfigurationBeforeUnloadGuard } from "../../_hooks/useTechnicalConfigurationBeforeUnloadGuard"
import { useTechnicalConfigurationOptionListQuery } from "../../_hooks/useTechnicalConfigurationOptionListQuery"
import type { TechnicalConfigurationOptionWire } from "../../supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "../../types"
import { TechnicalConfigurationEvaluationActiveWorkspace } from "./TechnicalConfigurationEvaluationActiveWorkspace"

type TechnicalConfigurationEvaluationWorkspaceProps = {
  dossier: TechnicalConfigurationDossierWire
  onDirtyChange?: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
  onRevisionChange?: (revision: number) => void
}

const EMPTY_OPTIONS: TechnicalConfigurationOptionWire[] = []

/** Activates one option-at-a-time manual assessment over canonical comparison pages. */
export function TechnicalConfigurationEvaluationWorkspace({
  dossier,
  onDirtyChange,
  onNavigationBlockedChange,
  onRevisionChange,
}: Readonly<TechnicalConfigurationEvaluationWorkspaceProps>) {
  const [isDirty, setIsDirty] = React.useState(false)
  const [isNavigationBlocked, setIsNavigationBlocked] = React.useState(false)
  const selection = useTechnicalConfigurationBaselineVersionSelection(dossier.id)
  const { synchronizeVersion } = selection
  const { optionsQuery } = useTechnicalConfigurationOptionListQuery(dossier.id)
  const options = optionsQuery.data?.options ?? EMPTY_OPTIONS

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent -- Async baseline refresh must preserve the active assessment draft.
    synchronizeVersion(isDirty || isNavigationBlocked)
  }, [isDirty, isNavigationBlocked, synchronizeVersion])
  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- WorkspaceShell owns top-level guards while this workspace owns assessment state.
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])
  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent, react-doctor/no-prop-callback-in-effect -- Pending saves block mode, tab and dossier navigation.
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

  if (selection.versionState.versionsQuery.isLoading || optionsQuery.isLoading) {
    return (
      <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Đang tải không gian đánh giá...
      </div>
    )
  }

  if (selection.versionState.versionsQuery.isError && !selection.selectedVersion) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        <AlertTitle>Không thể tải cấu hình cơ sở</AlertTitle>
        <AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selection.versionState.retryVersions}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Thử lại
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!selection.selectedVersion) {
    return (
      <Alert>
        <AlertTitle>Chưa có cấu hình cơ sở</AlertTitle>
        <AlertDescription>Khóa một phiên bản cấu hình trước khi đánh giá.</AlertDescription>
      </Alert>
    )
  }

  if (optionsQuery.isError && options.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        <AlertTitle>Không thể tải phương án</AlertTitle>
        <AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void optionsQuery.refetch()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Thử lại
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (options.length === 0) {
    return (
      <Alert>
        <AlertTitle>Chưa có phương án</AlertTitle>
        <AlertDescription>Tạo phương án nhà cung cấp trước khi đánh giá.</AlertDescription>
      </Alert>
    )
  }

  return (
    <TechnicalConfigurationEvaluationActiveWorkspace
      dossier={dossier}
      baselineVersionId={selection.selectedVersion.id}
      options={options}
      onDirtyChange={setIsDirty}
      onNavigationBlockedChange={setIsNavigationBlocked}
      onRevisionChange={onRevisionChange}
    />
  )
}
