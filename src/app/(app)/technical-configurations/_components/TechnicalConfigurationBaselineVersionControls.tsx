import type * as React from "react"

import type { TechnicalConfigurationBaselineDraftWire } from "../baseline-types"

import {
  TechnicalConfigurationVersionBar,
  type TechnicalConfigurationVersionBarStatus,
} from "./TechnicalConfigurationVersionBar"

type TechnicalConfigurationBaselineVersionControlsProps = Readonly<{
  dossierName: string
  isFocusMode: boolean
  versions: TechnicalConfigurationBaselineDraftWire[]
  selectedVersion: TechnicalConfigurationBaselineDraftWire
  lockBlockedReason: string | null
  status: TechnicalConfigurationVersionBarStatus
  onSelectVersion: (versionId: string) => void
  onLoadMoreVersions: () => void
  onRequestLock: () => void
  onCreateBlank: () => void
  onCopy: () => void
  onDownloadTemplate: () => void
  onRequestImport: () => void
}>

/** Renders the compact focus context or the full baseline version controls. */
export function TechnicalConfigurationBaselineVersionControls({
  dossierName,
  isFocusMode,
  versions,
  selectedVersion,
  lockBlockedReason,
  status,
  onSelectVersion,
  onLoadMoreVersions,
  onRequestLock,
  onCreateBlank,
  onCopy,
  onDownloadTemplate,
  onRequestImport,
}: TechnicalConfigurationBaselineVersionControlsProps): React.JSX.Element {
  if (isFocusMode) {
    return (
      <section
        aria-label="Ngữ cảnh cấu hình đang chỉnh sửa"
        className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2 text-sm"
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
      onSelectVersion={onSelectVersion}
      onLoadMoreVersions={onLoadMoreVersions}
      onRequestLock={onRequestLock}
      onCreateBlank={onCreateBlank}
      onCopy={onCopy}
      onDownloadTemplate={onDownloadTemplate}
      onRequestImport={onRequestImport}
    />
  )
}
