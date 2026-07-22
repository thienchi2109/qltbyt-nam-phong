import { beforeEach, describe, expect, it, vi } from "vitest"
import * as supplierOptionRpcManifest from "@/lib/technical-configuration-supplier-option-rpcs"
import * as supplierOptionRpcAdapter from "../technical-configuration-supplier-option-rpc"
import type {
  TechnicalConfigurationSupplierDeleteWireResponse,
  TechnicalConfigurationSupplierMutationWireResponse,
  TechnicalConfigurationSuppliersListWireResponse,
} from "../supplier-option-types"

const { SUPPLIER_RPC_FUNCTION_NAMES, SUPPLIER_RPC_FUNCTIONS } = supplierOptionRpcManifest
const {
  createTechnicalConfigurationSupplier,
  deleteTechnicalConfigurationSupplier,
  listTechnicalConfigurationSuppliers,
  updateTechnicalConfigurationSupplier,
} = supplierOptionRpcAdapter

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

describe("P8A2 option RPC contract", () => {
  beforeEach(() => {
    callRpcMock.mockReset()
  })

  function getManifestValue(name: string): unknown {
    return (supplierOptionRpcManifest as Record<string, unknown>)[name]
  }

  function getAdapter(
    name: string
  ): (args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown> {
    const adapter = (supplierOptionRpcAdapter as Record<string, unknown>)[name]
    expect(adapter).toBeTypeOf("function")
    return adapter as (args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>
  }

  it("freezes exactly the four option RPC names", () => {
    const optionFunctions = getManifestValue("OPTION_RPC_FUNCTIONS")

    expect(optionFunctions).toEqual({
      listOptions: "technical_configuration_options_list",
      createOption: "technical_configuration_option_create",
      updateOption: "technical_configuration_option_update",
      deleteOption: "technical_configuration_option_delete",
    })
    expect(getManifestValue("OPTION_RPC_FUNCTION_NAMES")).toEqual(
      Object.values(optionFunctions as Record<string, string>)
    )
  })

  it("delegates dossier list filtering and preserves the complete option wire shape", async () => {
    const listOptions = getAdapter("listTechnicalConfigurationOptions")
    const args = {
      p_dossier_id: "00000000-0000-0000-0000-000000000001",
      p_supplier_id: "00000000-0000-0000-0000-000000000002",
      p_page: 2,
      p_page_size: 25,
    }
    const signal = new AbortController().signal
    const response = {
      data: [
        {
          id: "00000000-0000-0000-0000-000000000003",
          dossier_id: args.p_dossier_id,
          supplier_id: args.p_supplier_id,
          supplier_name: "Công ty Thiết bị A",
          model: "Model A",
          manufacturer: "Hãng A",
          option_name: null,
          notes: "Ghi chú\nnhiều dòng",
          display_label: "Công ty Thiết bị A · Model A",
          created_at: "2026-07-22T00:00:00Z",
          created_by: 1,
          updated_at: "2026-07-22T00:01:00Z",
          updated_by: 1,
          revision: 4,
        },
      ],
      revision: 4,
      total: 1,
      page: 2,
      page_size: 25,
    }
    callRpcMock.mockResolvedValueOnce(response)

    await expect(listOptions(args, signal)).resolves.toEqual(response)
    expect(callRpcMock).toHaveBeenCalledWith("technical_configuration_options_list", args, {
      signal,
    })
  })

  it("routes create, update and delete through nullable identity and dossier revision", async () => {
    const createOption = getAdapter("createTechnicalConfigurationOption")
    const updateOption = getAdapter("updateTechnicalConfigurationOption")
    const deleteOption = getAdapter("deleteTechnicalConfigurationOption")
    const optionId = "00000000-0000-0000-0000-000000000003"
    const supplierId = "00000000-0000-0000-0000-000000000002"
    const mutationResponse = {
      data: {
        id: optionId,
        dossier_id: "00000000-0000-0000-0000-000000000001",
        supplier_id: supplierId,
        supplier_name: "Công ty Thiết bị A",
        model: null,
        manufacturer: "Hãng A",
        option_name: "Phương án A",
        notes: null,
        display_label: "Công ty Thiết bị A · Phương án A",
        created_at: "2026-07-22T00:00:00Z",
        created_by: 1,
        updated_at: "2026-07-22T00:01:00Z",
        updated_by: 1,
        revision: 5,
      },
    }
    const deleteResponse = { data: { id: optionId, revision: 6 } }
    const createArgs = {
      p_supplier_id: supplierId,
      p_model: null,
      p_manufacturer: "  Hãng   A  ",
      p_option_name: "  Phương   án A  ",
      p_notes: null,
      p_expected_revision: 4,
    }
    const updateArgs = {
      p_option_id: optionId,
      p_model: "Model A",
      p_manufacturer: "Hãng A",
      p_option_name: null,
      p_notes: "Ghi chú",
      p_expected_revision: 4,
    }
    const deleteArgs = {
      p_option_id: optionId,
      p_expected_revision: 5,
    }
    callRpcMock
      .mockResolvedValueOnce(mutationResponse)
      .mockResolvedValueOnce(mutationResponse)
      .mockResolvedValueOnce(deleteResponse)

    await expect(createOption(createArgs)).resolves.toEqual(mutationResponse)
    await expect(updateOption(updateArgs)).resolves.toEqual(mutationResponse)
    await expect(deleteOption(deleteArgs)).resolves.toEqual(deleteResponse)

    expect(callRpcMock.mock.calls).toEqual([
      ["technical_configuration_option_create", createArgs, { signal: undefined }],
      ["technical_configuration_option_update", updateArgs, { signal: undefined }],
      ["technical_configuration_option_delete", deleteArgs, { signal: undefined }],
    ])
  })
})
