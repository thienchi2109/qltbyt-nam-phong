import type { ReactNode } from "react"
import { render, renderHook } from "@testing-library/react"
import { vi, type Mock } from "vitest"

import { useTechnicalConfigurationOptions } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationOptions"
import type {
  TechnicalConfigurationOptionWire,
  TechnicalConfigurationOptionsListWireResponse,
  TechnicalConfigurationSupplierWire,
  TechnicalConfigurationSuppliersListWireResponse,
} from "@/app/(app)/technical-configurations/supplier-option-types"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"

export type SupplierOptionRpcMocks = {
  listSuppliers: Mock
  createSupplier: Mock
  updateSupplier: Mock
  deleteSupplier: Mock
  listOptions: Mock
  createOption: Mock
  updateOption: Mock
  deleteOption: Mock
}

export const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy lọc thận",
  name: "Cấu hình máy lọc thận",
  description: null,
  revision: 3,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-23T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-23T00:00:00.000Z",
  updated_by: 1,
}

export function supplier(
  id: string,
  name: string,
  revision = dossier.revision
): TechnicalConfigurationSupplierWire {
  return {
    id,
    dossier_id: dossier.id,
    name,
    normalized_name: name.toLocaleLowerCase("vi"),
    created_at: "2026-07-23T00:00:00.000Z",
    created_by: 1,
    updated_at: "2026-07-23T01:00:00.000Z",
    updated_by: 1,
    revision,
  }
}

export function option({
  id,
  supplierId = "supplier-1",
  supplierName = "Công ty Thiết bị A",
  model = "Model A",
  optionName = null,
  revision = dossier.revision,
}: {
  id: string
  supplierId?: string
  supplierName?: string
  model?: string | null
  optionName?: string | null
  revision?: number
}): TechnicalConfigurationOptionWire {
  const identity = model ?? optionName ?? "Chưa đặt tên"
  return {
    id,
    dossier_id: dossier.id,
    supplier_id: supplierId,
    supplier_name: supplierName,
    model,
    manufacturer: "Hãng A",
    option_name: optionName,
    notes: null,
    display_label: `${supplierName} · ${identity}`,
    created_at: "2026-07-23T00:00:00.000Z",
    created_by: 1,
    updated_at: "2026-07-23T01:00:00.000Z",
    updated_by: 1,
    revision,
  }
}

export function suppliersResponse(
  data: TechnicalConfigurationSupplierWire[],
  revision = dossier.revision
): TechnicalConfigurationSuppliersListWireResponse {
  return {
    data,
    revision,
    total: data.length,
    page: 1,
    page_size: 100,
  }
}

export function optionsResponse(
  data: TechnicalConfigurationOptionWire[],
  revision = dossier.revision,
  total = data.length
): TechnicalConfigurationOptionsListWireResponse {
  return {
    data,
    revision,
    total,
    page: 1,
    page_size: 100,
  }
}

export function renderSupplierOptionsHook({
  dossierValue = dossier,
  onRevisionChange = vi.fn(),
  onNavigationBlockedChange = vi.fn(),
}: {
  dossierValue?: TechnicalConfigurationDossierWire
  onRevisionChange?: (revision: number) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
} = {}) {
  const queryClient = createTestQueryClient()
  const rendered = renderHook(
    () =>
      useTechnicalConfigurationOptions({
        dossier: dossierValue,
        onRevisionChange,
        onNavigationBlockedChange,
      }),
    { wrapper: createReactQueryWrapper(queryClient) }
  )

  return {
    ...rendered,
    queryClient,
    onRevisionChange,
    onNavigationBlockedChange,
  }
}

export function renderWithQueryClient(node: ReactNode) {
  const queryClient = createTestQueryClient()
  return {
    ...render(node, { wrapper: createReactQueryWrapper(queryClient) }),
    queryClient,
  }
}
