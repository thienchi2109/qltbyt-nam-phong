import type * as React from "react"
import { ChevronDown, Copy, FilePlus2, LockKeyhole } from "lucide-react"

import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import { Button } from "@/components/ui/button"
import { SingleSelect } from "@/components/ui/heroui/SingleSelect"
import { formatVietnamDateTime } from "@/lib/date-utils"

export type TechnicalConfigurationVersionBarStatus = Readonly<{
  hasDraft: boolean
  isCreating: boolean
  isLocking: boolean
  isCopying: boolean
  isLoadingMoreVersions: boolean
  hasLoadMoreError: boolean
  isNavigationDisabled: boolean
  hasMoreVersions: boolean
  isImportBusy: boolean
}>

type TechnicalConfigurationVersionBarProps = {
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
}

/** Renders baseline version selection, lifecycle metadata, and valid actions. */
export function TechnicalConfigurationVersionBar({
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
}: Readonly<TechnicalConfigurationVersionBarProps>) {
  const {
    hasDraft,
    isCreating,
    isLocking,
    isCopying,
    isLoadingMoreVersions,
    hasLoadMoreError,
    isNavigationDisabled,
    hasMoreVersions,
    isImportBusy,
  } = status
  const areActionsDisabled = isNavigationDisabled || isImportBusy
  const hasLockMetadata =
    selectedVersion.status === "locked" &&
    Boolean(selectedVersion.locked_at || selectedVersion.locked_by)
  const hasLineage = Boolean(selectedVersion.source_version_number)
  const selectableVersions = [
    selectedVersion,
    ...versions.filter((version) => version.id !== selectedVersion.id),
  ].toSorted((left, right) => right.version_number - left.version_number)
  const versionOptions = selectableVersions.map((version) => ({
    value: version.id,
    label: `Phiên bản ${version.version_number} · ${
      version.status === "locked" ? "Đã khóa" : "Bản nháp"
    }`,
  }))

  return (
    <section className="border-y py-2" aria-label="Lịch sử phiên bản cấu hình cơ sở">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center">
          <SingleSelect
            value={selectedVersion.id}
            ariaLabel="Lịch sử phiên bản"
            className="w-full shrink-0 sm:w-[280px]"
            disabled={isNavigationDisabled}
            onValueChange={onSelectVersion}
            options={versionOptions}
          />
          {hasMoreVersions ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isNavigationDisabled || isLoadingMoreVersions}
              onClick={onLoadMoreVersions}
            >
              <ChevronDown className="size-4" aria-hidden="true" />
              {isLoadingMoreVersions
                ? "Đang tải..."
                : hasLoadMoreError
                  ? "Tải lại lịch sử phiên bản"
                  : "Tải thêm phiên bản"}
            </Button>
          ) : null}

          {hasLockMetadata || hasLineage ? (
            <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {selectedVersion.status === "locked" && selectedVersion.locked_at ? (
                <span>Khóa lúc {formatVietnamDateTime(selectedVersion.locked_at)}</span>
              ) : null}
              {selectedVersion.status === "locked" && selectedVersion.locked_by ? (
                <span>Người khóa #{selectedVersion.locked_by}</span>
              ) : null}
              {selectedVersion.source_version_number ? (
                <span>Sao chép từ phiên bản {selectedVersion.source_version_number}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-start gap-1 xl:items-end">
          {selectedVersion.status === "draft" ? (
            <>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {spreadsheetActions}
                <Button
                  type="button"
                  variant="outline"
                  disabled={areActionsDisabled || isCopyFromDossierDisabled}
                  onClick={onCopyFromDossier}
                >
                  <Copy className="size-4" aria-hidden="true" />
                  Sao chép từ hồ sơ khác
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={areActionsDisabled || Boolean(lockBlockedReason)}
                  onClick={onRequestLock}
                >
                  <LockKeyhole className="size-4" aria-hidden="true" />
                  {isLocking ? "Đang khóa..." : "Khóa phiên bản"}
                </Button>
              </div>
              {lockBlockedReason ? (
                <p className="max-w-md text-sm text-muted-foreground">{lockBlockedReason}</p>
              ) : null}
            </>
          ) : !hasDraft ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={areActionsDisabled}
                onClick={onCreateBlank}
              >
                <FilePlus2 className="size-4" aria-hidden="true" />
                {isCreating ? "Đang tạo..." : "Tạo bản nháp trống"}
              </Button>
              <Button type="button" disabled={areActionsDisabled} onClick={onCopy}>
                <Copy className="size-4" aria-hidden="true" />
                {isCopying ? "Đang sao chép..." : "Sao chép thành bản nháp"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={areActionsDisabled || isCopyFromDossierDisabled}
                onClick={onCopyFromDossier}
              >
                <Copy className="size-4" aria-hidden="true" />
                Sao chép từ hồ sơ khác
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
