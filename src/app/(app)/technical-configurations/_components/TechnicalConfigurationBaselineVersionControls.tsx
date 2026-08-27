import type * as React from "react"

import type { TechnicalConfigurationBaselineDraftWire } from "../baseline-types"

import {
  TechnicalConfigurationVersionBar,
  type TechnicalConfigurationVersionBarStatus,
} from "./TechnicalConfigurationVersionBar"

type TechnicalConfigurationBaselineVersionControlsProps = Readonly<{
  dossierName: string
  isFocusMode: boolean
  compact?: boolean
  versions: TechnicalConfigurationBaselineDraftWire[]
  selectedVersion: TechnicalConfigurationBaselineDraftWire
  lockBlockedReason: string | null
  status: TechnicalConfigurationVersionBarStatus
  onSelectVersion: (versionId: string) => void
  onLoadMoreVersions: () => void
  onRequestLock: () => void
  onCreateBlank: () => void
  onCopy: () => void
  onCopyFromDossier: () => void
  isCopyFromDossierDisabled: boolean
  spreadsheetActions: React.ReactNode
}>

/** Renders the compact focus context or the full baseline version controls. */
export function TechnicalConfigurationBaselineVersionControls({
  dossierName,
  isFocusMode,
  compact = false,
  versions,
  selectedVersion,
  lockBlockedReason,
  status,
  onSelectVersion,
  onLoadMoreVersions,
  onRequestLock,
  onCreateBlank,
  onCopy,
  onCopyFromDossier,
  isCopyFromDossierDisabled,
  spreadsheetActions,
}: TechnicalConfigurationBaselineVersionControlsProps): React.JSX.Element {
  if (isFocusMode) {
    return (
      <section
        aria-label="Ngữ cảnh cấu hình đang chỉnh sửa"
        className="flex min-w-max items-center gap-3 text-sm"
      >
        <strong className="truncate font-semibold">{dossierName}</strong>
        <span className="text-muted-foreground">
          Phiên bản {selectedVersion.version_number} ·{" "}
          {selectedVersion.status === "locked" ? "Đã khóa" : "Bản nháp"}
        </span>
      </section>
    )
  }

  return (
    <TechnicalConfigurationVersionBar
      versions={versions}
      selectedVersion={selectedVersion}
      lockBlockedReason={lockBlockedReason}
      status={status}
      compact={compact}
      onSelectVersion={onSelectVersion}
      onLoadMoreVersions={onLoadMoreVersions}
      onRequestLock={onRequestLock}
      onCreateBlank={onCreateBlank}
      onCopy={onCopy}
      onCopyFromDossier={onCopyFromDossier}
      isCopyFromDossierDisabled={isCopyFromDossierDisabled}
      spreadsheetActions={spreadsheetActions}
    />
  )
}
