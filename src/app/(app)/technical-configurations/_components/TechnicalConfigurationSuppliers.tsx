"use client"

import * as React from "react"
import { AlertCircle, Loader2, PackagePlus, Plus, RefreshCw } from "lucide-react"

import { useTechnicalConfigurationDiscardConfirmation } from "../_hooks/useTechnicalConfigurationDiscardConfirmation"
import { useTechnicalConfigurationOptions } from "../_hooks/useTechnicalConfigurationOptions"
import type { TechnicalConfigurationDossierWire } from "../types"
import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import { TechnicalConfigurationOptionEditor } from "./TechnicalConfigurationOptionEditor"
import { TechnicalConfigurationOptionResponses } from "./TechnicalConfigurationOptionResponses"
import { TechnicalConfigurationSupplierSelector } from "./TechnicalConfigurationSupplierSelector"

type TechnicalConfigurationSuppliersProps = {
  dossier: TechnicalConfigurationDossierWire
  onDirtyChange?: (dirty: boolean) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
  onRevisionChange?: (revision: number) => void
}

type PendingDelete =
  | { kind: "option"; id: string; label: string }
  | { kind: "supplier"; id: string; name: string; optionCount: number }

/** Renders grouped supplier/option selection and identity-only editing. */
export function TechnicalConfigurationSuppliers({
  dossier,
  onDirtyChange,
  onNavigationBlockedChange,
  onRevisionChange,
}: Readonly<TechnicalConfigurationSuppliersProps>) {
  const [isIdentityNavigationBlocked, setIsIdentityNavigationBlocked] = React.useState(false)
  const [isResponseDirty, setIsResponseDirty] = React.useState(false)
  const [isResponseNavigationBlocked, setIsResponseNavigationBlocked] = React.useState(false)
  const state = useTechnicalConfigurationOptions({
    dossier,
    onRevisionChange,
    onNavigationBlockedChange: setIsIdentityNavigationBlocked,
  })
  const { discardConfirmationDialog, requestDiscardConfirmation } =
    useTechnicalConfigurationDiscardConfirmation()
  const [pendingDelete, setPendingDelete] = React.useState<PendingDelete | null>(null)
  const [isLoadingDeleteCount, setIsLoadingDeleteCount] = React.useState(false)
  const [deleteCountError, setDeleteCountError] = React.useState<string | null>(null)
  const selectedSupplier = state.selectedSupplierSnapshot
  const selectedOption = state.selectedOptionSnapshot
  const hasInitialError =
    (state.suppliersQuery.isError && !state.suppliersQuery.data) ||
    (state.optionsQuery.isError && !state.optionsQuery.data)
  const isInitialLoading = state.suppliersQuery.isLoading || state.optionsQuery.isLoading
  const isDirty = state.isDirty || isResponseDirty
  const isNavigationBlocked = isIdentityNavigationBlocked || isResponseNavigationBlocked

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-prop-callback-in-effect, react-doctor/no-pass-data-to-parent, react-doctor/no-pass-live-state-to-parent -- WorkspaceShell owns cross-tab dirty navigation while this component owns supplier/option drafts.
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  React.useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-prop-callback-in-effect, react-doctor/no-pass-data-to-parent, react-doctor/no-pass-live-state-to-parent -- Identity and response mutations share one cross-tab navigation block.
    onNavigationBlockedChange?.(isNavigationBlocked)
  }, [isNavigationBlocked, onNavigationBlockedChange])

  React.useEffect(
    () => () => {
      onDirtyChange?.(false)
      onNavigationBlockedChange?.(false)
    },
    [onDirtyChange, onNavigationBlockedChange]
  )

  const requestIdentityChange = React.useCallback(
    (description: React.ReactNode, action: () => void) => {
      if (isNavigationBlocked) return
      setDeleteCountError(null)
      if (!isDirty) {
        action()
        return
      }
      requestDiscardConfirmation(description, action)
    },
    [isDirty, isNavigationBlocked, requestDiscardConfirmation]
  )

  const handleSupplierDeleteRequest = React.useCallback(async () => {
    if (!selectedSupplier || state.isPending || state.isConflict) return
    const supplier = selectedSupplier
    setDeleteCountError(null)
    setIsLoadingDeleteCount(true)
    try {
      const optionCount = await state.loadSupplierOptionCount(supplier.id)
      setPendingDelete({
        kind: "supplier",
        id: supplier.id,
        name: supplier.name,
        optionCount,
      })
    } catch {
      setDeleteCountError("Không thể tải số phương án của nhà cung cấp.")
    } finally {
      setIsLoadingDeleteCount(false)
    }
  }, [selectedSupplier, state])

  const handleConfirmDelete = React.useCallback(() => {
    if (!pendingDelete) return
    const action =
      pendingDelete.kind === "option"
        ? () => state.deleteOption(pendingDelete.id)
        : () => state.deleteSupplier(pendingDelete.id)
    void action().finally(() => setPendingDelete(null))
  }, [pendingDelete, state.deleteOption, state.deleteSupplier])

  if (isInitialLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        Đang tải nhà cung cấp và phương án...
      </div>
    )
  }

  if (hasInitialError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden="true" />
        <AlertTitle>Không thể tải dữ liệu phương án</AlertTitle>
        <AlertDescription className="mt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => void state.reload()}
            disabled={state.isPending}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Thử lại
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Nhà cung cấp · Model hoặc tên phương án</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý danh tính phương án trong hồ sơ, không bao gồm phản hồi cấu hình cơ sở.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            requestIdentityChange(
              "Thay đổi nhà cung cấp hiện tại chưa được lưu.",
              state.startSupplierCreate
            )
          }
          disabled={state.isReadOnly || state.isPending || state.isConflict || isLoadingDeleteCount}
        >
          <Plus className="size-4" aria-hidden="true" />
          Thêm nhà cung cấp
        </Button>
      </div>

      {state.isReadOnly ? (
        <Alert>
          <AlertTitle>Hồ sơ đã lưu trữ</AlertTitle>
          <AlertDescription>
            Thông tin nhà cung cấp và phương án chỉ được xem trong hồ sơ này.
          </AlertDescription>
        </Alert>
      ) : null}

      {state.isConflict ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Dữ liệu đã thay đổi trên máy chủ</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <p>Bản nhập cục bộ vẫn được giữ. Tải lại rõ ràng trước khi tiếp tục chỉnh sửa.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void state.reload()}
              disabled={state.isPending}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Tải lại dữ liệu
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!state.isConflict && (state.validationError || deleteCountError || state.operationError) ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Không thể hoàn tất thao tác</AlertTitle>
          <AlertDescription>
            {state.validationError ?? deleteCountError ?? state.operationError}
          </AlertDescription>
        </Alert>
      ) : null}

      {state.refreshWarning ? (
        <Alert>
          <AlertTitle>Đã lưu nhưng chưa làm mới</AlertTitle>
          <AlertDescription>{state.refreshWarning}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.5fr)]">
        <TechnicalConfigurationSupplierSelector
          state={state}
          selectedSupplier={selectedSupplier}
          isLoadingDeleteCount={isLoadingDeleteCount}
          requestIdentityChange={requestIdentityChange}
          onDeleteSupplier={() => void handleSupplierDeleteRequest()}
        />

        <main className="min-w-0">
          {selectedSupplier && !selectedOption && !state.isCreatingOption ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 border-y text-center">
              <p className="text-sm text-muted-foreground">
                Chưa có phương án cho nhà cung cấp này.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => state.startOptionCreate(selectedSupplier.id)}
                disabled={
                  state.isReadOnly ||
                  state.isPending ||
                  state.isConflict ||
                  isLoadingDeleteCount ||
                  isResponseNavigationBlocked
                }
              >
                <PackagePlus className="size-4" aria-hidden="true" />
                Thêm phương án
              </Button>
            </div>
          ) : null}

          {selectedSupplier && (selectedOption || state.isCreatingOption) ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    requestIdentityChange("Thay đổi phương án hiện tại chưa được lưu.", () =>
                      state.startOptionCreate(selectedSupplier.id)
                    )
                  }
                  disabled={
                    state.isReadOnly ||
                    state.isPending ||
                    state.isConflict ||
                    isLoadingDeleteCount ||
                    isResponseNavigationBlocked
                  }
                >
                  <PackagePlus className="size-4" aria-hidden="true" />
                  Thêm phương án
                </Button>
              </div>
              <TechnicalConfigurationOptionEditor
                supplierName={selectedSupplier.name}
                draft={state.optionDraft}
                option={selectedOption}
                mode={state.isCreatingOption ? "create" : "edit"}
                disabled={
                  state.isReadOnly ||
                  state.isPending ||
                  state.isConflict ||
                  isLoadingDeleteCount ||
                  isResponseNavigationBlocked
                }
                isPending={state.isPending}
                onChange={state.updateOptionDraft}
                onSave={() => void state.saveOption()}
                onDelete={() =>
                  selectedOption
                    ? setPendingDelete({
                        kind: "option",
                        id: selectedOption.id,
                        label: selectedOption.display_label,
                      })
                    : undefined
                }
              />
              {selectedOption ? (
                <TechnicalConfigurationOptionResponses
                  key={selectedOption.id}
                  dossier={dossier}
                  option={selectedOption}
                  onDirtyChange={setIsResponseDirty}
                  onNavigationBlockedChange={setIsResponseNavigationBlocked}
                  onRevisionChange={onRevisionChange}
                />
              ) : null}
            </div>
          ) : null}
        </main>
      </div>

      {discardConfirmationDialog}
      <DestructiveConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={pendingDelete?.kind === "supplier" ? "Xóa nhà cung cấp?" : "Xóa phương án?"}
        description={
          pendingDelete?.kind === "supplier"
            ? `Nhà cung cấp ${pendingDelete.name} có ${pendingDelete.optionCount} phương án. Thao tác này xóa dây chuyền toàn bộ phương án và response datasets phụ thuộc.`
            : `${pendingDelete?.label ?? ""}. Các response datasets phụ thuộc của phương án cũng sẽ bị xóa.`
        }
        confirmLabel={pendingDelete?.kind === "supplier" ? "Xóa nhà cung cấp" : "Xóa phương án"}
        isPending={state.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
