import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { vi } from "vitest"

import { TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT } from "../technical-configuration-query-keys"
import type {
  TechnicalConfigurationDossierListItemWire,
  TechnicalConfigurationDossierListRpcArgs,
  TechnicalConfigurationDossierListWireResponse,
  TechnicalConfigurationDossierUpdateRpcArgs,
  TechnicalConfigurationDossierWire,
} from "../types"

type DossierActionsOptions = {
  listQueryKey: readonly unknown[]
  page: number
  onPageChange: (page: number) => void
  onSelectedDossierChange: React.Dispatch<
    React.SetStateAction<TechnicalConfigurationDossierWire | null>
  >
}

type DossierActionsResult = {
  deleteError: unknown
  deleteTarget: TechnicalConfigurationDossierListItemWire | null
  editTarget: TechnicalConfigurationDossierWire | null
  openDelete: (dossier: TechnicalConfigurationDossierListItemWire) => void
  updateError: unknown
  openEdit: (dossier: TechnicalConfigurationDossierWire) => void
  submitDelete: () => Promise<void>
  submitEdit: (args: TechnicalConfigurationDossierUpdateRpcArgs) => Promise<void>
}

type DossierActionsModuleContract = {
  useTechnicalConfigurationDossierActions?: (options: DossierActionsOptions) => DossierActionsResult
}

export const dossier: TechnicalConfigurationDossierListItemWire = {
  id: "dossier-1",
  device_type_name: "Máy siêu âm",
  name: "Cấu hình máy siêu âm",
  description: "Cấu hình chuẩn",
  revision: 7,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-13T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-13T00:00:00.000Z",
  updated_by: 1,
  can_delete: true,
}

export function buildDossierListRow(id: string): TechnicalConfigurationDossierListItemWire {
  return { ...dossier, id, name: `Hồ sơ ${id}` }
}

export function buildDossierListPage(
  args: TechnicalConfigurationDossierListRpcArgs,
  rows: TechnicalConfigurationDossierListItemWire[],
  total: number
): TechnicalConfigurationDossierListWireResponse {
  return {
    data: rows,
    total,
    page: args.p_page ?? 1,
    page_size: args.p_page_size ?? 20,
  }
}

export async function flushQueryNotifications(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

export const listQueryKey = [
  ...TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
  { page: 1, pageSize: 20 },
] as const

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

export async function renderDossierActions(
  queryClient: QueryClient,
  options: {
    listQueryKey?: readonly unknown[]
    page?: number
    onPageChange?: (page: number) => void
  } = {}
) {
  const hookModule =
    (await import("../_hooks/useTechnicalConfigurationDossierActions")) as DossierActionsModuleContract
  const useDossierActions = hookModule.useTechnicalConfigurationDossierActions
  if (!useDossierActions) {
    throw new Error("useTechnicalConfigurationDossierActions is not available")
  }

  const actionListQueryKey = options.listQueryKey ?? listQueryKey
  const onPageChange = options.onPageChange ?? (() => undefined)
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return renderHook(
    () => {
      const [selectedDossier, setSelectedDossier] =
        React.useState<TechnicalConfigurationDossierWire | null>(dossier)
      const actions = useDossierActions({
        listQueryKey: actionListQueryKey,
        page: options.page ?? 1,
        onPageChange,
        onSelectedDossierChange: setSelectedDossier,
      })

      return { actions, selectedDossier }
    },
    { wrapper }
  )
}
