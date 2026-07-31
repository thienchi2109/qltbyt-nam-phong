import { Loader2, Plus, RefreshCw, Save } from "lucide-react"

import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Sentinel option value that requests another page of baseline versions. */
export const LOAD_MORE_BASELINE_VERSIONS_VALUE = "__load-more-baseline-versions__"

type TechnicalConfigurationReferenceProductsToolbarProps = {
  selectedVersion: TechnicalConfigurationBaselineDraftWire
  versionOptions: TechnicalConfigurationBaselineDraftWire[]
  versionHistory: {
    hasMoreVersions: boolean
    hasHistoryRecoveryError: boolean
    isFetchingNextPage: boolean
  }
  workspaceStatus: {
    isNavigationBlocked: boolean
    isProductDataUnavailable: boolean
    isReadOnly: boolean
    isDirty: boolean
    isReloading: boolean
    isSaving: boolean
  }
  invalidProductCount: number
  onVersionSelect: (value: string) => void
  onReload: () => void
  onAddProduct: () => void
  onSave: () => void
}

/** Renders baseline-version selection and reference-product workspace actions. */
export function TechnicalConfigurationReferenceProductsToolbar({
  selectedVersion,
  versionOptions,
  versionHistory,
  workspaceStatus,
  invalidProductCount,
  onVersionSelect,
  onReload,
  onAddProduct,
  onSave,
}: Readonly<TechnicalConfigurationReferenceProductsToolbarProps>) {
  const { hasMoreVersions, hasHistoryRecoveryError, isFetchingNextPage } = versionHistory
  const {
    isNavigationBlocked,
    isProductDataUnavailable,
    isReadOnly,
    isDirty,
    isReloading,
    isSaving,
  } = workspaceStatus

  return (
    <section className="flex flex-col gap-4 border-y py-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <Label htmlFor="reference-baseline-version">Phiên bản cấu hình cơ sở</Label>
        <Select
          value={selectedVersion.id}
          disabled={isNavigationBlocked}
          onValueChange={onVersionSelect}
        >
          <SelectTrigger id="reference-baseline-version" className="mt-2 w-full sm:w-[300px]">
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
            {hasMoreVersions || hasHistoryRecoveryError ? (
              <SelectItem value={LOAD_MORE_BASELINE_VERSIONS_VALUE} disabled={isFetchingNextPage}>
                {isFetchingNextPage
                  ? "Đang tải phiên bản..."
                  : hasHistoryRecoveryError
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
          disabled={isNavigationBlocked || isProductDataUnavailable}
          onClick={onReload}
        >
          <RefreshCw className={`size-4 ${isReloading ? "animate-spin" : ""}`} aria-hidden="true" />
          Tải lại dữ liệu
        </Button>
        {!isReadOnly ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={isNavigationBlocked || isProductDataUnavailable}
              onClick={onAddProduct}
            >
              <Plus className="size-4" aria-hidden="true" />
              Thêm sản phẩm tham chiếu
            </Button>
            <Button
              type="button"
              disabled={
                !isDirty ||
                invalidProductCount > 0 ||
                isNavigationBlocked ||
                isProductDataUnavailable
              }
              onClick={onSave}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Lưu thay đổi
            </Button>
          </>
        ) : null}
      </div>
    </section>
  )
}
