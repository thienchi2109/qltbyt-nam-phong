import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  SUPPLIER_RPC_FUNCTION_NAMES,
  SUPPLIER_RPC_FUNCTIONS,
} from "@/lib/technical-configuration-supplier-option-rpcs"
import {
  createTechnicalConfigurationSupplier,
  deleteTechnicalConfigurationSupplier,
  listTechnicalConfigurationSuppliers,
  updateTechnicalConfigurationSupplier,
} from "../technical-configuration-supplier-option-rpc"
import type {
  TechnicalConfigurationSupplierDeleteWireResponse,
  TechnicalConfigurationSupplierMutationWireResponse,
  TechnicalConfigurationSuppliersListWireResponse,
} from "../supplier-option-types"

const callRpcMock = vi.fn()

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: (...args: unknown[]) => callRpcMock(...args),
}))

describe("P8A1 supplier RPC contract", () => {
  beforeEach(() => {
    callRpcMock.mockReset()
  })

  it("freezes exactly the four supplier RPC names", () => {
    expect(SUPPLIER_RPC_FUNCTIONS).toEqual({
      listSuppliers: "technical_configuration_suppliers_list",
      createSupplier: "technical_configuration_supplier_create",
      updateSupplier: "technical_configuration_supplier_update",
      deleteSupplier: "technical_configuration_supplier_delete",
    })
    expect(SUPPLIER_RPC_FUNCTION_NAMES).toEqual(Object.values(SUPPLIER_RPC_FUNCTIONS))
  })

  it("delegates list arguments and AbortSignal without remapping wire fields", async () => {
    const args = {
      p_dossier_id: "00000000-0000-0000-0000-000000000001",
      p_page: 2,
      p_page_size: 25,
    }
    const signal = new AbortController().signal
    const response: TechnicalConfigurationSuppliersListWireResponse = {
      data: [
        {
          id: "00000000-0000-0000-0000-000000000002",
          dossier_id: args.p_dossier_id,
          name: "Công ty Thiết bị A",
          normalized_name: "công ty thiết bị a",
          created_at: "2026-07-22T00:00:00Z",
          created_by: 1,
          updated_at: "2026-07-22T00:00:00Z",
          updated_by: 1,
          revision: 3,
        },
      ],
      revision: 3,
      total: 1,
      page: 2,
      page_size: 25,
    }
    callRpcMock.mockResolvedValueOnce(response)

    await expect(listTechnicalConfigurationSuppliers(args, signal)).resolves.toEqual(response)
    expect(callRpcMock).toHaveBeenCalledWith(SUPPLIER_RPC_FUNCTIONS.listSuppliers, args, {
      signal,
    })
  })

  it("routes create, update and delete through dossier-revision contracts", async () => {
    const mutationResponse: TechnicalConfigurationSupplierMutationWireResponse = {
      data: {
        id: "00000000-0000-0000-0000-000000000002",
        dossier_id: "00000000-0000-0000-0000-000000000001",
        name: "Nhà cung cấp A",
        normalized_name: "nhà cung cấp a",
        created_at: "2026-07-22T00:00:00Z",
        created_by: 1,
        updated_at: "2026-07-22T00:01:00Z",
        updated_by: 1,
        revision: 4,
      },
    }
    const deleteResponse: TechnicalConfigurationSupplierDeleteWireResponse = {
      data: {
        id: mutationResponse.data.id,
        revision: 5,
      },
    }
    const createArgs = {
      p_dossier_id: mutationResponse.data.dossier_id,
      p_name: "  Nhà   cung cấp A  ",
      p_expected_revision: 3,
    }
    const updateArgs = {
      p_supplier_id: mutationResponse.data.id,
      p_name: "Nhà cung cấp A",
      p_expected_revision: 4,
    }
    const deleteArgs = {
      p_supplier_id: mutationResponse.data.id,
      p_expected_revision: 4,
    }
    callRpcMock
      .mockResolvedValueOnce(mutationResponse)
      .mockResolvedValueOnce(mutationResponse)
      .mockResolvedValueOnce(deleteResponse)

    await expect(createTechnicalConfigurationSupplier(createArgs)).resolves.toEqual(
      mutationResponse
    )
    await expect(updateTechnicalConfigurationSupplier(updateArgs)).resolves.toEqual(
      mutationResponse
    )
    await expect(deleteTechnicalConfigurationSupplier(deleteArgs)).resolves.toEqual(deleteResponse)

    expect(callRpcMock.mock.calls).toEqual([
      [SUPPLIER_RPC_FUNCTIONS.createSupplier, createArgs, { signal: undefined }],
      [SUPPLIER_RPC_FUNCTIONS.updateSupplier, updateArgs, { signal: undefined }],
      [SUPPLIER_RPC_FUNCTIONS.deleteSupplier, deleteArgs, { signal: undefined }],
    ])
  })
})
