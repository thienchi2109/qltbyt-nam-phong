"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ListChecks, Plus, RefreshCw, ShieldAlert } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useServerPagination } from "@/hooks/useServerPagination"
import { isGlobalRole } from "@/lib/rbac"

import { TechnicalConfigurationDossierForm } from "./_components/TechnicalConfigurationDossierForm"
import { TechnicalConfigurationDossierDeleteDialog } from "./_components/TechnicalConfigurationDossierDeleteDialog"
import { TechnicalConfigurationDossierTable } from "./_components/TechnicalConfigurationDossierTable"
import { TechnicalConfigurationWorkspaceShell } from "./_components/TechnicalConfigurationWorkspaceShell"
import {
  isStaleRevisionError,
  isStaleRevisionRefreshError,
  useTechnicalConfigurationDossierActions,
} from "./_hooks/useTechnicalConfigurationDossierActions"
import {
  createTechnicalConfigurationDossier,
  getTechnicalConfigurationDossier,
  listTechnicalConfigurationDossiers,
} from "./technical-configuration-rpc"
import {
  TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
  technicalConfigurationDossierDetailQueryKey,
} from "./technical-configuration-query-keys"
import type {
  TechnicalConfigurationDossierCreateRpcArgs,
  TechnicalConfigurationDossierWire,
} from "./types"

const DOSSIER_PAGE_SIZE = 20

type TechnicalConfigurationsClientProps = {
  role?: string | null
}

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

/** Orchestrates dossier listing, lifecycle actions, and workspace selection for global roles. */
export function TechnicalConfigurationsClient({
  role,
}: Readonly<TechnicalConfigurationsClientProps>) {
  const queryClient = useQueryClient()
  const canAccess = isGlobalRole(role)
  const [dossierTotalCount, setDossierTotalCount] = React.useState(0)
  const dossierPagination = useServerPagination({
    totalCount: dossierTotalCount,
    initialPageSize: DOSSIER_PAGE_SIZE,
  })
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [openingDossierId, setOpeningDossierId] = React.useState<string | null>(null)
  const [openDossierError, setOpenDossierError] = React.useState<unknown>(null)
  const [selectedDossier, setSelectedDossier] =
    React.useState<TechnicalConfigurationDossierWire | null>(null)
  const handleDossierPageChange = React.useCallback(
    (nextPage: number) => {
      dossierPagination.setPagination((current) => ({
        ...current,
        pageIndex: Math.max(0, nextPage - 1),
      }))
    },
    [dossierPagination.setPagination]
  )
  const dossierListQueryKey = [
    ...TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
    { page: dossierPagination.page, pageSize: dossierPagination.pageSize },
  ] as const

  const dossierListQuery = useQuery({
    queryKey: dossierListQueryKey,
    queryFn: ({ signal }) =>
      listTechnicalConfigurationDossiers(
        {
          p_page: dossierPagination.page,
          p_page_size: dossierPagination.pageSize,
          p_include_archived: false,
        },
        signal
      ),
    enabled: canAccess,
    staleTime: 30_000,
  })
  const resolvedDossierTotal = dossierListQuery.data?.total
  React.useEffect(() => {
    if (resolvedDossierTotal === undefined) return
    setDossierTotalCount(resolvedDossierTotal)
  }, [resolvedDossierTotal])

  const dossierActions = useTechnicalConfigurationDossierActions({
    listQueryKey: dossierListQueryKey,
    page: dossierPagination.page,
    onPageChange: handleDossierPageChange,
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

  if (!canAccess) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-4 py-10 sm:px-6">
        <section className="w-full border-y py-10 text-center">
          <ShieldAlert className="mx-auto size-9 text-destructive" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold">Truy cập bị hạn chế</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Khu vực cấu hình kỹ thuật chỉ dành cho quản trị viên hệ thống.
          </p>
        </section>
      </main>
    )
  }

  if (selectedDossier) {
    return (
      <TechnicalConfigurationWorkspaceShell
        dossier={selectedDossier}
        onBack={() => setSelectedDossier(null)}
      />
    )
  }

  const listError = dossierListQuery.isError
    ? getErrorMessage(dossierListQuery.error, "Không thể tải danh sách hồ sơ.")
    : null
  const openError = openDossierError
    ? getErrorMessage(openDossierError, "Không thể mở hồ sơ.")
    : null

  return (
    <div className="w-full">
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

      <section className="mt-6 space-y-4" aria-label="Danh sách hồ sơ cấu hình">
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
                onClick={() => void dossierListQuery.refetch()}
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
            dossiers={dossierListQuery.data?.data ?? []}
            isLoading={dossierListQuery.isLoading}
            isActionPending={dossierActions.isDeleting || dossierActions.isUpdating}
            openingDossierId={openingDossierId}
            pagination={{
              page: dossierPagination.page,
              pageCount: dossierPagination.pageCount,
              canPreviousPage: dossierPagination.canPreviousPage,
              canNextPage: dossierPagination.canNextPage,
              onPageChange: handleDossierPageChange,
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
