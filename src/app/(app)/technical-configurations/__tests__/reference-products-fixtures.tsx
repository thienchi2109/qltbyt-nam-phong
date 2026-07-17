import type { ReactNode } from "react"
import { render, renderHook } from "@testing-library/react"
import { vi, type Mock } from "vitest"

import { useTechnicalConfigurationReferenceProducts } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationReferenceProducts"
import type { TechnicalConfigurationBaselineDraftWire } from "@/app/(app)/technical-configurations/baseline-types"
import type {
  TechnicalConfigurationReferenceProductWire,
  TechnicalConfigurationReferenceProductsListWireResponse,
} from "@/app/(app)/technical-configurations/reference-product-types"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"

export type ReferenceProductRpcMocks = {
  listProducts: Mock
  createProduct: Mock
  updateProduct: Mock
  deleteProduct: Mock
  upsertResponse: Mock
}

export type BaselineVersionRpcMocks = {
  listVersions: Mock
}

export const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy lọc thận",
  name: "Cấu hình máy lọc thận",
  description: null,
  revision: 3,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-17T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-17T00:00:00.000Z",
  updated_by: 1,
}

export const baselineVersion: TechnicalConfigurationBaselineDraftWire = {
  id: "version-1",
  dossier_id: dossier.id,
  version_number: 1,
  status: "draft",
  source_baseline_version_id: null,
  source_version_number: null,
  next_criterion_number: 2,
  revision: 5,
  locked_at: null,
  locked_by: null,
  created_at: "2026-07-17T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-17T00:00:00.000Z",
  updated_by: 1,
  groups: [
    {
      id: "group-1",
      baseline_version_id: "version-1",
      name: "Yêu cầu chung",
      sort_order: 1,
      created_at: "2026-07-17T00:00:00.000Z",
      created_by: 1,
      updated_at: "2026-07-17T00:00:00.000Z",
      updated_by: 1,
      criteria: [
        {
          id: "criterion-1",
          baseline_version_id: "version-1",
          group_id: "group-1",
          criterion_code: "TC-0001",
          title: "Nguồn điện",
          requirement_text: "Nguồn điện ổn định",
          sort_order: 1,
          source_criterion_id: null,
          created_at: "2026-07-17T00:00:00.000Z",
          created_by: 1,
          updated_at: "2026-07-17T00:00:00.000Z",
          updated_by: 1,
        },
      ],
    },
  ],
}

export function product(
  id: string,
  model: string,
  revision = baselineVersion.revision
): TechnicalConfigurationReferenceProductWire {
  return {
    id,
    baseline_version_id: baselineVersion.id,
    model,
    manufacturer: "Hãng A",
    description: null,
    notes: null,
    created_at: "2026-07-17T00:00:00.000Z",
    created_by: 1,
    updated_at: "2026-07-17T00:00:00.000Z",
    updated_by: 1,
    revision,
    responses: [],
  }
}

export function listResponse(
  data: TechnicalConfigurationReferenceProductWire[],
  revision = data[0]?.revision ?? baselineVersion.revision
): TechnicalConfigurationReferenceProductsListWireResponse {
  return {
    data,
    revision,
    total: data.length,
    page: 1,
    page_size: 100,
  }
}

export function renderReferenceProductsHook({
  onRevisionChange = vi.fn(),
  onNavigationBlockedChange = vi.fn(),
  isArchived = false,
}: {
  onRevisionChange?: (revision: number) => void
  onNavigationBlockedChange?: (blocked: boolean) => void
  isArchived?: boolean
} = {}) {
  const queryClient = createTestQueryClient()
  const rendered = renderHook(
    () =>
      useTechnicalConfigurationReferenceProducts({
        baselineVersion,
        isArchived,
        onRevisionChange,
        onNavigationBlockedChange,
      }),
    {
      wrapper: createReactQueryWrapper(queryClient),
    }
  )
  return { ...rendered, queryClient, onRevisionChange, onNavigationBlockedChange }
}

export function renderWithQueryClient(node: ReactNode) {
  const queryClient = createTestQueryClient()
  return {
    ...render(node, { wrapper: createReactQueryWrapper(queryClient) }),
    queryClient,
  }
}
