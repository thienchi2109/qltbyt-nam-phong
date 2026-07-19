import { ChevronDown, Copy, Download, FilePlus2, History, LockKeyhole, Upload } from "lucide-react"

import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SingleSelect } from "@/components/ui/heroui/SingleSelect"
import { formatVietnamDateTime } from "@/lib/date-utils"

type TechnicalConfigurationVersionBarProps = {
  versions: TechnicalConfigurationBaselineDraftWire[]
  selectedVersion: TechnicalConfigurationBaselineDraftWire
  lockBlockedReason: string | null
  status: {
    hasDraft: boolean
    isCreating: boolean
    isLocking: boolean
    isCopying: boolean
    isLoadingMoreVersions: boolean
    hasLoadMoreError: boolean
    isNavigationDisabled: boolean
    hasMoreVersions: boolean
    isDownloadingTemplate: boolean
    isImportBusy: boolean
    isImportBlocked: boolean
  }
  onSelectVersion: (versionId: string) => void
  onLoadMoreVersions: () => void
  onRequestLock: () => void
  onCreateBlank: () => void
  onCopy: () => void
  onDownloadTemplate: () => void
  onRequestImport: () => void
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
  onDownloadTemplate,
  onRequestImport,
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
    isDownloadingTemplate,
    isImportBusy,
    isImportBlocked,
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
    <section className="border-y py-4" aria-label="Lịch sử phiên bản cấu hình cơ sở">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <History className="size-4 text-muted-foreground" aria-hidden="true" />
            <strong className="text-sm font-semibold">
              Phiên bản {selectedVersion.version_number}
            </strong>
            <Badge variant={selectedVersion.status === "locked" ? "secondary" : "outline"}>
              {selectedVersion.status === "locked" ? "Đã khóa" : "Bản nháp"}
            </Badge>
          </div>

          <SingleSelect
            value={selectedVersion.id}
            ariaLabel="Lịch sử phiên bản"
            className="w-full sm:w-[280px]"
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
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
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

        <div className="flex flex-col items-start gap-2 lg:items-end">
          {selectedVersion.status === "draft" ? (
            <>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={areActionsDisabled || isImportBlocked || isDownloadingTemplate}
                  onClick={onDownloadTemplate}
                >
                  <Download className="size-4" aria-hidden="true" />
                  {isDownloadingTemplate ? "Đang tạo template..." : "Tải template Excel"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={areActionsDisabled || isImportBlocked}
                  onClick={onRequestImport}
                >
                  <Upload className="size-4" aria-hidden="true" />
                  Nhập từ Excel
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
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
