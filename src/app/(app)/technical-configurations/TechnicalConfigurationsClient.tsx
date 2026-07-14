"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, ListChecks, Plus, RefreshCw, ShieldAlert } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { isGlobalRole } from "@/lib/rbac"

import { TechnicalConfigurationDossierForm } from "./_components/TechnicalConfigurationDossierForm"
import { TechnicalConfigurationDossierTable } from "./_components/TechnicalConfigurationDossierTable"
import { TechnicalConfigurationWorkspaceShell } from "./_components/TechnicalConfigurationWorkspaceShell"
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

/** Orchestrates dossier listing, creation, and workspace selection for global roles. */
export function TechnicalConfigurationsClient({
  role,
}: Readonly<TechnicalConfigurationsClientProps>) {
  const queryClient = useQueryClient()
  const canAccess = isGlobalRole(role)
  const [page, setPage] = React.useState(1)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [openingDossierId, setOpeningDossierId] = React.useState<string | null>(null)
  const [openDossierError, setOpenDossierError] = React.useState<unknown>(null)
  const [selectedDossier, setSelectedDossier] =
    React.useState<TechnicalConfigurationDossierWire | null>(null)

  const dossierListQuery = useQuery({
    queryKey: [
      ...TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
      { page, pageSize: DOSSIER_PAGE_SIZE },
    ],
    queryFn: ({ signal }) =>
      listTechnicalConfigurationDossiers(
        {
          p_page: page,
          p_page_size: DOSSIER_PAGE_SIZE,
          p_include_archived: false,
        },
        signal
      ),
    enabled: canAccess,
    staleTime: 30_000,
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
      if (open && openingDossierId) {
        return
      }

      if (open) {
        createDossierMutation.reset()
      }
      setIsCreateOpen(open)
    },
    [createDossierMutation, openingDossierId]
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
          disabled={openingDossierId !== null}
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
            openingDossierId={openingDossierId}
            page={dossierListQuery.data?.page ?? page}
            pageSize={dossierListQuery.data?.page_size ?? DOSSIER_PAGE_SIZE}
            total={dossierListQuery.data?.total ?? 0}
            onOpen={(id) => void handleOpen(id)}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      <TechnicalConfigurationDossierForm
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
    </div>
  )
}
