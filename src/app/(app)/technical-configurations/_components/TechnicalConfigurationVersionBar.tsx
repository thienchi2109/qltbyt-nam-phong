import { ChevronDown, Copy, FilePlus2, History, LockKeyhole } from "lucide-react"

import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  }
  onSelectVersion: (versionId: string) => void
  onLoadMoreVersions: () => void
  onRequestLock: () => void
  onCreateBlank: () => void
  onCopy: () => void
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
  } = status
  const areActionsDisabled = isNavigationDisabled
  const hasLockMetadata =
    selectedVersion.status === "locked" &&
    Boolean(selectedVersion.locked_at || selectedVersion.locked_by)
  const hasLineage = Boolean(selectedVersion.source_version_number)
  const selectableVersions = versions.some((version) => version.id === selectedVersion.id)
    ? versions
    : [...versions, selectedVersion].toSorted(
        (left, right) => right.version_number - left.version_number
      )

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

          <select
            value={selectedVersion.id}
            aria-label="Lịch sử phiên bản"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-[280px]"
            disabled={isNavigationDisabled}
            onChange={(event) => onSelectVersion(event.target.value)}
          >
            {selectableVersions.map((version) => (
              <option key={version.id} value={version.id}>
                Phiên bản {version.version_number} ·{" "}
                {version.status === "locked" ? "Đã khóa" : "Bản nháp"}
              </option>
            ))}
          </select>
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
              <Button
                type="button"
                variant="destructive"
                disabled={areActionsDisabled || Boolean(lockBlockedReason)}
                onClick={onRequestLock}
              >
                <LockKeyhole className="size-4" aria-hidden="true" />
                {isLocking ? "Đang khóa..." : "Khóa phiên bản"}
              </Button>
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
