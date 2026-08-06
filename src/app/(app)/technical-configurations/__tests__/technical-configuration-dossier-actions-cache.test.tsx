import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
  technicalConfigurationDossierDetailQueryKey,
} from "../technical-configuration-query-keys"
import type {
  TechnicalConfigurationDossierListWireResponse,
  TechnicalConfigurationDossierUpdateRpcArgs,
  TechnicalConfigurationDossierWire,
  TechnicalConfigurationDossierWireResponse,
} from "../types"

const mocks = vi.hoisted(() => ({
  getDossier: vi.fn(),
  updateDossier: vi.fn(),
}))

vi.mock("../technical-configuration-rpc", () => ({
  getTechnicalConfigurationDossier: (...args: unknown[]) => mocks.getDossier(...args),
  updateTechnicalConfigurationDossier: (...args: unknown[]) => mocks.updateDossier(...args),
}))

type DossierActionsOptions = {
  listQueryKey: readonly unknown[]
  onSelectedDossierChange: React.Dispatch<
    React.SetStateAction<TechnicalConfigurationDossierWire | null>
  >
}

type DossierActionsResult = {
  submitEdit: (args: TechnicalConfigurationDossierUpdateRpcArgs) => Promise<void>
}

type DossierActionsModuleContract = {
  useTechnicalConfigurationDossierActions?: (options: DossierActionsOptions) => DossierActionsResult
}

const dossier: TechnicalConfigurationDossierWire = {
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
}

describe("technical configuration dossier action cache", () => {
  it("adopts the server revision in list, detail and selected state without dropping fields", async () => {
    const listQueryKey = [
      ...TECHNICAL_CONFIGURATION_DOSSIER_QUERY_ROOT,
      { page: 1, pageSize: 20 },
    ] as const
    const listItem = {
      ...dossier,
      future_list_only_field: "keep-list",
    }
    const detailItem = {
      ...dossier,
      future_detail_only_field: "keep-detail",
    }
    const updatedDossier: TechnicalConfigurationDossierWire = {
      ...dossier,
      name: "Cấu hình máy siêu âm tim",
      description: "Metadata đã cập nhật",
      revision: 8,
    }
    const updateArgs: TechnicalConfigurationDossierUpdateRpcArgs = {
      p_id: dossier.id,
      p_device_type_name: dossier.device_type_name,
      p_name: updatedDossier.name,
      p_description: updatedDossier.description,
      p_expected_revision: dossier.revision,
    }
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(listQueryKey, {
      data: [listItem],
      total: 1,
      page: 1,
      page_size: 20,
    })
    queryClient.setQueryData(technicalConfigurationDossierDetailQueryKey(dossier.id), {
      data: detailItem,
    })
    mocks.updateDossier.mockResolvedValue({ data: updatedDossier })

    const hookModule =
      (await import("../_hooks/useTechnicalConfigurationDossierActions")) as DossierActionsModuleContract
    expect(hookModule.useTechnicalConfigurationDossierActions).toEqual(expect.any(Function))
    if (!hookModule.useTechnicalConfigurationDossierActions) return

    const useDossierActions = hookModule.useTechnicalConfigurationDossierActions
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(
      () => {
        const [selectedDossier, setSelectedDossier] =
          React.useState<TechnicalConfigurationDossierWire | null>(dossier)
        const actions = useDossierActions({
          listQueryKey,
          onSelectedDossierChange: setSelectedDossier,
        })

        return { actions, selectedDossier }
      },
      { wrapper }
    )

    await act(async () => {
      await result.current.actions.submitEdit(updateArgs)
    })

    expect(mocks.updateDossier).toHaveBeenCalledTimes(1)
    expect(mocks.updateDossier).toHaveBeenCalledWith(updateArgs)
    expect(
      queryClient.getQueryData<TechnicalConfigurationDossierListWireResponse>(listQueryKey)
    ).toMatchObject({
      data: [
        {
          id: dossier.id,
          name: updatedDossier.name,
          revision: 8,
          future_list_only_field: "keep-list",
        },
      ],
    })
    expect(
      queryClient.getQueryData<TechnicalConfigurationDossierWireResponse>(
        technicalConfigurationDossierDetailQueryKey(dossier.id)
      )
    ).toMatchObject({
      data: {
        id: dossier.id,
        name: updatedDossier.name,
        revision: 8,
        future_detail_only_field: "keep-detail",
      },
    })
    expect(result.current.selectedDossier).toMatchObject({
      id: dossier.id,
      name: updatedDossier.name,
      revision: 8,
    })
  })
})
