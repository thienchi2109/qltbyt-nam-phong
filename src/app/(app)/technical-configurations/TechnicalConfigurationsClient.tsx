"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ListChecks, Loader2, Plus, RefreshCw } from "lucide-react"

import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import { TechnicalConfigurationDossierForm } from "./_components/TechnicalConfigurationDossierForm"
import { TechnicalConfigurationDossierDeleteDialog } from "./_components/TechnicalConfigurationDossierDeleteDialog"
import {
  TechnicalConfigurationDossierTable,
  type TechnicalConfigurationDossierListState,
} from "./_components/TechnicalConfigurationDossierTable"
import { TechnicalConfigurationWorkspaceShell } from "./_components/TechnicalConfigurationWorkspaceShell"
import { useTechnicalConfigurationDossierList } from "./_hooks/useTechnicalConfigurationDossierList"
import {
  isStaleRevisionError,
  isStaleRevisionRefreshError,
  useTechnicalConfigurationDossierActions,
} from "./_hooks/useTechnicalConfigurationDossierActions"
import {
  createTechnicalConfigurationDossier,
  getTechnicalConfigurationDossier,
} from "./technical-configuration-rpc"
import {
  TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
  technicalConfigurationDossierDetailQueryKey,
} from "./technical-configuration-query-keys"
import { TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_MAX_LENGTH } from "./technical-configuration-dossier-search"
import type {
  TechnicalConfigurationDossierCreateRpcArgs,
  TechnicalConfigurationDossierWire,
} from "./types"

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function getDossierUpdateErrorMessage(error: unknown): string {
  if (isStaleRevisionRefreshError(error)) {
    return "Không thể nạp dữ liệu hồ sơ mới nhất sau khi phát hiện xung đột. Kiểm tra kết nối và thử lại."
  }

  if (isStaleRevisionError(error)) {
    return "Hồ sơ đã được cập nhật ở phiên khác. Dữ liệu mới nhất đã được nạp; kiểm tra và lưu lại để thử lại."
  }

  return getErrorMessage(error, "Không thể cập nhật hồ sơ.")
}

function getDossierDeleteErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Không thể xóa hồ sơ."
  }

  switch (error.message) {
    case "locked_dossier":
      return "Hồ sơ đã có baseline khóa nên được bảo toàn vĩnh viễn."
    case "stale_revision":
      return "Hồ sơ đã được cập nhật ở phiên khác. Đóng xác nhận, tải lại danh sách và thử lại."
    case "archived_dossier":
      return "Hồ sơ đã được lưu trữ nên không thể xóa vĩnh viễn."
    case "not_found":
      return "Không còn tìm thấy hồ sơ này."
    default:
      return getErrorMessage(error, "Không thể xóa hồ sơ.")
  }
}

/** Orchestrates dossier listing, lifecycle actions, and workspace selection. */
export function TechnicalConfigurationsClient() {
  const queryClient = useQueryClient()
  const dossierList = useTechnicalConfigurationDossierList()
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [openingDossierId, setOpeningDossierId] = React.useState<string | null>(null)
  const [openDossierError, setOpenDossierError] = React.useState<unknown>(null)
  const [selectedDossier, setSelectedDossier] =
    React.useState<TechnicalConfigurationDossierWire | null>(null)

  const dossierActions = useTechnicalConfigurationDossierActions({
    listQueryKey: dossierList.visibleListQueryKey,
    page: dossierList.visiblePage,
    onPageChange: dossierList.handlePageChange,
    onSelectedDossierChange: setSelectedDossier,
  })

  const createDossierMutation = useMutation({
    mutationFn: createTechnicalConfigurationDossier,
    onSuccess: async (response) => {
      setOpenDossierError(null)
      setSelectedDossier(response.data)
      setIsCreateOpen(false)
      await queryClient.invalidateQueries({
        queryKey: TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
      })
    },
  })

  const handleCreateOpenChange = React.useCallback(
    (open: boolean) => {
      if (open && (openingDossierId || dossierActions.editTarget)) {
        return
      }

      if (open) {
        createDossierMutation.reset()
      }
      setIsCreateOpen(open)
    },
    [createDossierMutation, dossierActions.editTarget, openingDossierId]
  )

  const handleCreate = React.useCallback(
    async (args: TechnicalConfigurationDossierCreateRpcArgs) => {
      await createDossierMutation.mutateAsync(args)
    },
    [createDossierMutation]
  )

  const handleOpen = React.useCallback(
    async (id: string) => {
      if (openingDossierId) {
        return
      }

      setOpeningDossierId(id)
      setOpenDossierError(null)

      try {
        const response = await queryClient.fetchQuery({
          queryKey: technicalConfigurationDossierDetailQueryKey(id),
          queryFn: () => getTechnicalConfigurationDossier(id),
          staleTime: 30_000,
        })
        setSelectedDossier(response.data)
      } catch (error) {
        setOpenDossierError(error)
      } finally {
        setOpeningDossierId(null)
      }
    },
    [openingDossierId, queryClient]
  )

  if (selectedDossier) {
    return (
      <TechnicalConfigurationWorkspaceShell
        dossier={selectedDossier}
        onBack={() => setSelectedDossier(null)}
      />
    )
  }

  const listError = dossierList.isError
    ? getErrorMessage(dossierList.error, "Không thể tải danh sách hồ sơ.")
    : null
  const openError = openDossierError
    ? getErrorMessage(openDossierError, "Không thể mở hồ sơ.")
    : null
  let dossierListState: TechnicalConfigurationDossierListState = "ready"
  if (dossierList.isLoading) {
    dossierListState = "loading"
  } else if (dossierList.isSearchPending) {
    dossierListState = "pending"
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted">
              <ListChecks className="size-5 text-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold">Cấu hình kỹ thuật</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Quản lý hồ sơ cấu hình độc lập theo từng loại thiết bị.
              </p>
            </div>
          </div>
        </div>
        <Button
          className="w-full sm:w-auto"
          disabled={
            openingDossierId !== null ||
            dossierActions.isDeleting ||
            dossierActions.isUpdating ||
            dossierActions.deleteTarget !== null ||
            dossierActions.editTarget !== null
          }
          onClick={() => handleCreateOpenChange(true)}
        >
          <Plus className="size-4" aria-hidden="true" />
          Tạo hồ sơ
        </Button>
      </header>

      <section
        className="mt-6 min-h-0 flex-1 space-y-4 overflow-y-auto"
        aria-label="Danh sách hồ sơ cấu hình"
      >
        <ListFilterSearchCard
          surface="plain"
          searchValue={dossierList.searchText}
          onSearchChange={dossierList.handleSearchTextChange}
          searchPlaceholder="Tìm theo loại thiết bị hoặc tên hồ sơ..."
          searchMaxLength={TECHNICAL_CONFIGURATION_DOSSIER_SEARCH_MAX_LENGTH}
          searchEndAddon={
            dossierList.isSearchPending ? (
              <span className="flex items-center" role="status" aria-label="Đang tìm kiếm hồ sơ">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              </span>
            ) : undefined
          }
        />

        {listError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Không thể tải dữ liệu</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{listError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void dossierList.refetch()}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                Thử lại
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {openError ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Không thể mở hồ sơ</AlertTitle>
            <AlertDescription>{openError}</AlertDescription>
          </Alert>
        ) : null}

        {!listError ? (
          <TechnicalConfigurationDossierTable
            dossiers={dossierList.dossiers}
            emptySearchText={
              dossierList.hasVisibleActiveSearch ? dossierList.visibleSearchText : undefined
            }
            isActionPending={dossierActions.isDeleting || dossierActions.isUpdating}
            listState={dossierListState}
            openingDossierId={openingDossierId}
            pagination={{
              page: dossierList.page,
              pageCount: dossierList.pageCount,
              canPreviousPage: dossierList.canPreviousPage,
              canNextPage: dossierList.canNextPage,
              onPageChange: dossierList.handlePageChange,
            }}
            onDelete={dossierActions.openDelete}
            onEdit={dossierActions.openEdit}
            onOpen={(id) => void handleOpen(id)}
          />
        ) : null}
      </section>

      <TechnicalConfigurationDossierForm
        mode="create"
        open={isCreateOpen}
        isSubmitting={createDossierMutation.isPending}
        errorMessage={
          createDossierMutation.isError
            ? getErrorMessage(createDossierMutation.error, "Không thể tạo hồ sơ.")
            : null
        }
        onOpenChange={handleCreateOpenChange}
        onSubmit={handleCreate}
      />
      {dossierActions.editTarget ? (
        <TechnicalConfigurationDossierForm
          mode="edit"
          dossier={dossierActions.editTarget}
          open
          isSubmitting={dossierActions.isUpdating}
          errorMessage={
            dossierActions.updateError
              ? getDossierUpdateErrorMessage(dossierActions.updateError)
              : null
          }
          onOpenChange={dossierActions.handleEditOpenChange}
          onSubmit={dossierActions.submitEdit}
        />
      ) : null}
      <TechnicalConfigurationDossierDeleteDialog
        dossier={dossierActions.deleteTarget}
        isPending={dossierActions.isDeleting}
        errorMessage={
          dossierActions.deleteError
            ? getDossierDeleteErrorMessage(dossierActions.deleteError)
            : null
        }
        onOpenChange={dossierActions.handleDeleteOpenChange}
        onConfirm={() => {
          void dossierActions.submitDelete().catch(() => undefined)
        }}
      />
    </div>
  )
}
