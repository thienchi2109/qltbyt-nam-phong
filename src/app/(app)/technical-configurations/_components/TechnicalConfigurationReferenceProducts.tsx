import * as React from "react"
import { AlertCircle, Archive, Loader2, LockKeyhole, RefreshCw } from "lucide-react"

import { TechnicalConfigurationReferenceProductsBody } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceProductsBody"
import {
  LOAD_MORE_BASELINE_VERSIONS_VALUE,
  TechnicalConfigurationReferenceProductsToolbar,
} from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceProductsToolbar"
import { useTechnicalConfigurationBaselineVersionSelection } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineVersionSelection"
import { useTechnicalConfigurationBeforeUnloadGuard } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBeforeUnloadGuard"
import { useTechnicalConfigurationDiscardConfirmation } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationDiscardConfirmation"
import { useTechnicalConfigurationReferenceProducts } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationReferenceProducts"
import { useTechnicalConfigurationReferenceProductSelection } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationReferenceProductSelection"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type TechnicalConfigurationReferenceProductsProps = {
  dossier: TechnicalConfigurationDossierWire
  onDirtyChange?: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
}

/** Renders reference-product management and its baseline-first comparison surface. */
export function TechnicalConfigurationReferenceProducts({
  dossier,
  onDirtyChange,
  onNavigationBlockedChange,
}: Readonly<TechnicalConfigurationReferenceProductsProps>) {
  const selection = useTechnicalConfigurationBaselineVersionSelection(dossier.id)
  const {
    adoptVersion,
    handleRevisionChange,
    selectedVersion,
    synchronizeVersion,
    versionOptions,
    versionState,
  } = selection
  const [isEvidenceDirty, setIsEvidenceDirty] = React.useState(false)
  const [isEvidenceNavigationBlocked, setIsEvidenceNavigationBlocked] = React.useState(false)
  const [isReferenceNavigationBlocked, setIsReferenceNavigationBlocked] = React.useState(false)
  const [referenceProductSearchRevision, setReferenceProductSearchRevision] = React.useState(0)
  const { discardConfirmationDialog, requestDiscardConfirmation } =
    useTechnicalConfigurationDiscardConfirmation()
  const evidenceNavigationBlockedRef = React.useRef(false)
  const referenceNavigationBlockedRef = React.useRef(false)
  const handleEvidenceNavigationBlockedChange = React.useCallback(
    (blocked: boolean) => {
      evidenceNavigationBlockedRef.current = blocked
      setIsEvidenceNavigationBlocked(blocked)
      onNavigationBlockedChange?.(blocked || referenceNavigationBlockedRef.current)
    },
    [onNavigationBlockedChange]
  )
  const handleReferenceNavigationBlockedChange = React.useCallback(
    (blocked: boolean) => {
      referenceNavigationBlockedRef.current = blocked
      setIsReferenceNavigationBlocked(blocked)
      onNavigationBlockedChange?.(blocked || evidenceNavigationBlockedRef.current)
    },
    [onNavigationBlockedChange]
  )
  const referenceState = useTechnicalConfigurationReferenceProducts({
    baselineVersion: selectedVersion,
    isArchived: Boolean(dossier.archived_at),
    onRevisionChange: handleRevisionChange,
    onNavigationBlockedChange: handleReferenceNavigationBlockedChange,
  })
  const productSelection = useTechnicalConfigurationReferenceProductSelection({
    scopeKey: selectedVersion?.id ?? "",
    products: referenceState.products,
  })
  const isDirty = referenceState.isDirty || isEvidenceDirty
  const isNavigationBlocked =
    isReferenceNavigationBlocked ||
    isEvidenceNavigationBlocked ||
    referenceState.isSaving ||
    referenceState.isReloading
  const hasInitialProductsError =
    referenceState.productsQuery.isError && referenceState.productsQuery.data === undefined
  const isProductDataUnavailable = referenceState.productsQuery.isLoading || hasInitialProductsError
  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-pass-data-to-parent -- Baseline history arrives asynchronously; the shared selector must preserve dirty reference and evidence drafts.
    synchronizeVersion(isDirty)
  }, [isDirty, synchronizeVersion])

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-pass-live-state-to-parent, react-doctor/no-prop-callback-in-effect, react-doctor/no-pass-data-to-parent -- The reference hook owns draft state while WorkspaceShell owns the cross-tab navigation guard.
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  React.useEffect(() => {
    return () => onDirtyChange?.(false)
  }, [onDirtyChange])

  useTechnicalConfigurationBeforeUnloadGuard(isDirty)

  const handleVersionChange = React.useCallback(
    (nextVersionId: string) => {
      const nextVersion = versionOptions.find((version) => version.id === nextVersionId)
      if (!nextVersion) return
      if (isDirty) {
        requestDiscardConfirmation(
          "Bạn có thay đổi chưa lưu. Chuyển phiên bản và bỏ các thay đổi?",
          () => adoptVersion(nextVersion)
        )
        return
      }
      adoptVersion(nextVersion)
    },
    [adoptVersion, isDirty, requestDiscardConfirmation, versionOptions]
  )

  const handleVersionSelect = React.useCallback(
    (nextValue: string) => {
      if (nextValue === LOAD_MORE_BASELINE_VERSIONS_VALUE) {
        void versionState.loadMoreVersions()
        return
      }
      handleVersionChange(nextValue)
    },
    [handleVersionChange, versionState.loadMoreVersions]
  )

  const reloadReferenceProducts = React.useCallback(async () => {
    if (!selectedVersion) return
    await referenceState.reload(async () => {
      const refreshedVersion = await versionState.refreshVersions(selectedVersion.id)
      if (refreshedVersion) {
        versionState.cacheVersion(refreshedVersion)
      }
    })
  }, [referenceState, selectedVersion, versionState])

  const handleReload = React.useCallback(() => {
    if (!selectedVersion) return
    if (isDirty) {
      requestDiscardConfirmation(
        "Tải lại từ máy chủ sẽ thay thế các thay đổi chưa lưu. Tiếp tục?",
        () => void reloadReferenceProducts()
      )
      return
    }
    void reloadReferenceProducts()
  }, [isDirty, reloadReferenceProducts, requestDiscardConfirmation, selectedVersion])

  const handleAddProduct = React.useCallback(() => {
    productSelection.selectAddedProduct(referenceState.addProduct())
    setReferenceProductSearchRevision((revision) => revision + 1)
  }, [productSelection.selectAddedProduct, referenceState.addProduct])

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

  if (!selectedVersion) {
    return (
      <Alert>
        <AlertTitle>Chưa có phiên bản cấu hình cơ sở</AlertTitle>
        <AlertDescription>
          Tạo bản nháp cấu hình cơ sở trước khi thêm sản phẩm tham chiếu.
        </AlertDescription>
      </Alert>
    )
  }

  const isArchived = Boolean(dossier.archived_at)
  const readOnlyMessage = isArchived
    ? "Hồ sơ đã lưu trữ. Sản phẩm tham chiếu chỉ được xem."
    : selectedVersion.status === "locked"
      ? "Phiên bản đã khóa. Sản phẩm tham chiếu chỉ được xem."
      : null

  return (
    <div className="space-y-6">
      <TechnicalConfigurationReferenceProductsToolbar
        selectedVersion={selectedVersion}
        versionOptions={versionOptions}
        versionHistory={{
          hasMoreVersions: Boolean(versionState.versionsQuery.hasNextPage),
          hasHistoryRecoveryError: versionState.hasHistoryRecoveryError,
          isFetchingNextPage: versionState.versionsQuery.isFetchingNextPage,
        }}
        workspaceStatus={{
          isNavigationBlocked,
          isProductDataUnavailable,
          isReadOnly: referenceState.isReadOnly,
          isDirty: referenceState.isDirty,
          isReloading: referenceState.isReloading,
          isSaving: referenceState.isSaving,
        }}
        invalidProductCount={referenceState.invalidProductIds.length}
        onVersionSelect={handleVersionSelect}
        onReload={handleReload}
        onAddProduct={handleAddProduct}
        onSave={referenceState.save}
      />

      {readOnlyMessage ? (
        <Alert>
          {isArchived ? (
            <Archive className="size-4" aria-hidden="true" />
          ) : (
            <LockKeyhole className="size-4" aria-hidden="true" />
          )}
          <AlertTitle>Chế độ chỉ đọc</AlertTitle>
          <AlertDescription>{readOnlyMessage}</AlertDescription>
        </Alert>
      ) : null}

      {referenceState.saveError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertTitle>
            {referenceState.isConflict ? "Dữ liệu đã thay đổi" : "Không thể lưu"}
          </AlertTitle>
          <AlertDescription>{referenceState.saveError}</AlertDescription>
        </Alert>
      ) : null}

      {referenceState.saveStatus === "saved" ? (
        <p role="status" className="text-sm text-emerald-700">
          Đã lưu sản phẩm tham chiếu.
        </p>
      ) : null}

      {referenceState.refreshWarning ? (
        <Alert>
          <RefreshCw className="size-4" aria-hidden="true" />
          <AlertTitle>Đã lưu nhưng chưa làm mới dữ liệu</AlertTitle>
          <AlertDescription>{referenceState.refreshWarning}</AlertDescription>
        </Alert>
      ) : null}

      <TechnicalConfigurationReferenceProductsBody
        key={selectedVersion.id}
        baselineVersion={selectedVersion}
        referenceState={referenceState}
        navigationBlocked={isNavigationBlocked}
        searchScopeKey={`${selectedVersion.id}:${referenceProductSearchRevision}`}
        selectedProductId={productSelection.selectedProductId}
        onSelectProduct={productSelection.selectProduct}
        onRevisionChange={handleRevisionChange}
        onEvidenceDirtyChange={setIsEvidenceDirty}
        onEvidenceNavigationBlockedChange={handleEvidenceNavigationBlockedChange}
      />

      {discardConfirmationDialog}
    </div>
  )
}
