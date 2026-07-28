"use client"

import * as React from "react"
import { ChevronDown, RefreshCw, X } from "lucide-react"

import type { TechnicalConfigurationBaselineDraftWire } from "../../baseline-types"
import type { TechnicalConfigurationOptionWire } from "../../supplier-option-types"
import { FacetedMultiSelectFilter } from "@/components/shared/table-filters/FacetedMultiSelectFilter"
import { Button } from "@/components/ui/button"
import { SingleSelect } from "@/components/ui/heroui/SingleSelect"

type VersionsQueryState = {
  isLoading: boolean
  isError: boolean
  error?: Error | null
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
}

type OptionsQueryState = {
  isLoading: boolean
  isError: boolean
  error?: Error | null
}

type TechnicalConfigurationMatrixToolbarProps = {
  baselineVersionId: string | null
  versions: TechnicalConfigurationBaselineDraftWire[]
  versionsQuery: VersionsQueryState
  options: TechnicalConfigurationOptionWire[]
  optionsQuery: OptionsQueryState
  selectedOptions: TechnicalConfigurationOptionWire[]
  isSelectionLimitReached: boolean
  onSelectBaselineVersion: (versionId: string) => void
  onLoadMoreVersions: () => void
  onRetryVersions: () => void
  onRetryOptions: () => void
  onAddOption: (optionId: string) => void
  onRemoveOption: (optionId: string) => void
}

function getVersionLabel(version: TechnicalConfigurationBaselineDraftWire) {
  return `Phiên bản ${version.version_number} · ${
    version.status === "locked" ? "Đã khóa" : "Bản nháp"
  }`
}

/** Renders the desktop request controls while preserving ordered option selection. */
export function TechnicalConfigurationMatrixToolbar({
  baselineVersionId,
  versions,
  versionsQuery,
  options,
  optionsQuery,
  selectedOptions,
  isSelectionLimitReached,
  onSelectBaselineVersion,
  onLoadMoreVersions,
  onRetryVersions,
  onRetryOptions,
  onAddOption,
  onRemoveOption,
}: Readonly<TechnicalConfigurationMatrixToolbarProps>) {
  const selectedOptionIds = React.useMemo(
    () => selectedOptions.map((option) => option.id),
    [selectedOptions]
  )
  const selectedOptionIdSet = React.useMemo(() => new Set(selectedOptionIds), [selectedOptionIds])
  const versionOptions = React.useMemo(
    () =>
      versions.map((version) => ({
        value: version.id,
        label: getVersionLabel(version),
      })),
    [versions]
  )
  const optionChoices = React.useMemo(
    () =>
      options.map((option) => ({
        value: option.id,
        label: option.display_label,
      })),
    [options]
  )

  const handleOptionSelectionChange = React.useCallback(
    (nextOptionIds: string[]) => {
      const nextOptionIdSet = new Set(nextOptionIds)

      for (const optionId of selectedOptionIds) {
        if (!nextOptionIdSet.has(optionId)) onRemoveOption(optionId)
      }
      for (const optionId of nextOptionIds) {
        if (!selectedOptionIdSet.has(optionId)) onAddOption(optionId)
      }
    },
    [onAddOption, onRemoveOption, selectedOptionIdSet, selectedOptionIds]
  )

  return (
    <section className="border-y" aria-label="Thiết lập ma trận so sánh">
      <div className="grid min-w-[760px] grid-cols-[360px_minmax(0,1fr)] divide-x">
        <div className="space-y-3 p-4">
          <div className="flex min-h-10 items-start">
            <h2 className="text-sm font-semibold">Phiên bản cơ sở</h2>
          </div>

          <SingleSelect
            value={baselineVersionId}
            ariaLabel="Chọn phiên bản cấu hình cơ sở"
            disabled={versionsQuery.isLoading || versions.length === 0}
            onValueChange={onSelectBaselineVersion}
            options={versionOptions}
            placeholder={versionsQuery.isLoading ? "Đang tải phiên bản..." : "Chọn phiên bản"}
          />

          {versionsQuery.isError ? (
            <div className="flex min-h-9 items-center justify-between gap-3 text-xs" role="alert">
              <span className="text-destructive">
                {versionsQuery.error?.message || "Không thể tải lịch sử phiên bản."}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={onRetryVersions}>
                <RefreshCw aria-hidden="true" />
                Thử lại
              </Button>
            </div>
          ) : versionsQuery.hasNextPage ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={versionsQuery.isFetchingNextPage}
              onClick={onLoadMoreVersions}
            >
              <ChevronDown aria-hidden="true" />
              {versionsQuery.isFetchingNextPage ? "Đang tải..." : "Tải thêm phiên bản"}
            </Button>
          ) : null}
        </div>

        <div className="min-w-0 space-y-3 p-4">
          <div className="flex min-h-10 items-start justify-between gap-4">
            <h2 className="text-sm font-semibold">Phương án so sánh</h2>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {selectedOptions.length}/8 phương án
            </span>
          </div>

          {optionsQuery.isError ? (
            <div className="flex min-h-9 items-center justify-between gap-3 text-xs" role="alert">
              <span className="text-destructive">
                {optionsQuery.error?.message || "Không thể tải danh sách phương án."}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={onRetryOptions}>
                <RefreshCw aria-hidden="true" />
                Thử lại
              </Button>
            </div>
          ) : optionsQuery.isLoading ? (
            <div className="flex h-9 items-center text-sm text-muted-foreground" role="status">
              Đang tải phương án...
            </div>
          ) : (
            <FacetedMultiSelectFilter<unknown, string>
              title="Chọn phương án"
              options={optionChoices}
              value={selectedOptionIds}
              onChange={handleOptionSelectionChange}
              searchPlaceholder="Tìm nhà cung cấp, model hoặc phương án..."
              emptySearchMessage={
                isSelectionLimitReached
                  ? "Đã đạt giới hạn 8 phương án"
                  : "Không tìm thấy phương án phù hợp"
              }
              contentClassName="w-[420px]"
            />
          )}

          <div className="min-h-10">
            {selectedOptions.length > 0 ? (
              <ol className="flex flex-wrap gap-2" aria-label="Thứ tự phương án đã chọn">
                {selectedOptions.map((option, index) => (
                  <li
                    key={option.id}
                    className="flex h-9 max-w-[320px] items-center gap-2 border bg-muted/40 pl-3 pr-1 text-sm"
                  >
                    <span data-testid="selected-option-label" className="truncate">
                      {index + 1}. {option.display_label}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label={`Bỏ phương án ${index + 1}: ${option.display_label}`}
                      onClick={() => onRemoveOption(option.id)}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="flex h-10 items-center text-sm text-muted-foreground">
                Chưa chọn phương án.
              </p>
            )}
          </div>

          {isSelectionLimitReached ? (
            <p className="text-xs font-medium text-foreground" role="status">
              Đã đạt giới hạn 8 phương án. Bỏ một phương án để chọn phương án khác.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
