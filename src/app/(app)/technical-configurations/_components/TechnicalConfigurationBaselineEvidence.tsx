import * as React from "react"
import { AlertCircle, Loader2, RefreshCw } from "lucide-react"

import { TechnicalConfigurationBaselineDocuments } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineDocuments"
import { useTechnicalConfigurationBaselineVersionSelection } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineVersionSelection"
import { useTechnicalConfigurationBeforeUnloadGuard } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBeforeUnloadGuard"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type TechnicalConfigurationBaselineEvidenceProps = {
  dossier: TechnicalConfigurationDossierWire
  onDirtyChange?: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
}

/** Loads the current baseline version and composes its evidence workspace outside the editor. */
export function TechnicalConfigurationBaselineEvidence({
  dossier,
  onDirtyChange,
  onNavigationBlockedChange,
}: Readonly<TechnicalConfigurationBaselineEvidenceProps>): React.JSX.Element {
  const [isDirty, setIsDirty] = React.useState(false)
  const selection = useTechnicalConfigurationBaselineVersionSelection(dossier.id)
  const {
    handleRevisionChange,
    selectedVersion: baselineVersion,
    synchronizeVersion,
    versionState,
  } = selection

  React.useEffect(() => {
    synchronizeVersion(isDirty)
  }, [isDirty, synchronizeVersion])

  React.useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])
  useTechnicalConfigurationBeforeUnloadGuard(isDirty)

  const handleDirtyChange = React.useCallback(
    (dirty: boolean) => {
      setIsDirty(dirty)
      onDirtyChange?.(dirty)
    },
    [onDirtyChange]
  )

  if (versionState.versionsQuery.isLoading) {
    return (
      <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Đang tải phiên bản cấu hình...
      </div>
    )
  }

  if (versionState.versionsQuery.isError && versionState.versions.length === 0) {
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

  if (!baselineVersion) {
    return (
      <Alert>
        <AlertTitle>Chưa có cấu hình cơ sở</AlertTitle>
        <AlertDescription>
          Tạo cấu hình cơ sở trước khi bổ sung tài liệu và trích dẫn.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <TechnicalConfigurationBaselineDocuments
      baselineVersion={baselineVersion}
      ownerType="baseline"
      ownerId={baselineVersion.id}
      readOnly={Boolean(dossier.archived_at)}
      onRevisionChange={handleRevisionChange}
      onDirtyChange={handleDirtyChange}
      onNavigationBlockedChange={onNavigationBlockedChange}
    />
  )
}
