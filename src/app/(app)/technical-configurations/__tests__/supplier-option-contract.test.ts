import { beforeEach, describe, expect, it, vi } from "vitest"
import * as supplierOptionRpcManifest from "@/lib/technical-configuration-supplier-option-rpcs"
import * as supplierOptionRpcAdapter from "../technical-configuration-supplier-option-rpc"
import type {
  TechnicalConfigurationComparisonSetGetOrCreateRpcArgs,
  TechnicalConfigurationComparisonSetWireResponse,
  TechnicalConfigurationOptionCreateRpcArgs,
  TechnicalConfigurationOptionDeleteRpcArgs,
  TechnicalConfigurationOptionDeleteWireResponse,
  TechnicalConfigurationOptionMutationWireResponse,
  TechnicalConfigurationOptionResponseUpsertRpcArgs,
  TechnicalConfigurationOptionResponseWireResponse,
  TechnicalConfigurationOptionsListRpcArgs,
  TechnicalConfigurationOptionsListWireResponse,
  TechnicalConfigurationOptionUpdateRpcArgs,
  TechnicalConfigurationSupplierDeleteWireResponse,
  TechnicalConfigurationSupplierMutationWireResponse,
  TechnicalConfigurationSuppliersListWireResponse,
} from "../supplier-option-types"

const {
  OPTION_RESPONSE_RPC_FUNCTION_NAMES,
  OPTION_RESPONSE_RPC_FUNCTIONS,
  OPTION_RPC_FUNCTION_NAMES,
  OPTION_RPC_FUNCTIONS,
  SUPPLIER_RPC_FUNCTION_NAMES,
  SUPPLIER_RPC_FUNCTIONS,
} = supplierOptionRpcManifest
const {
  createTechnicalConfigurationOption,
  createTechnicalConfigurationSupplier,
  deleteTechnicalConfigurationOption,
  deleteTechnicalConfigurationSupplier,
  getOrCreateTechnicalConfigurationComparisonSet,
  listTechnicalConfigurationOptions,
  listTechnicalConfigurationSuppliers,
  upsertTechnicalConfigurationOptionResponse,
  updateTechnicalConfigurationOption,
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

  it("freezes exactly the four option RPC names", () => {
    expect(OPTION_RPC_FUNCTIONS).toEqual({
      listOptions: "technical_configuration_options_list",
      createOption: "technical_configuration_option_create",
      updateOption: "technical_configuration_option_update",
      deleteOption: "technical_configuration_option_delete",
    })
    expect(OPTION_RPC_FUNCTION_NAMES).toEqual(Object.values(OPTION_RPC_FUNCTIONS))
  })

  it("delegates dossier list filtering and preserves the complete option wire shape", async () => {
    const args: TechnicalConfigurationOptionsListRpcArgs = {
      p_dossier_id: "00000000-0000-0000-0000-000000000001",
      p_supplier_id: "00000000-0000-0000-0000-000000000002",
      p_page: 2,
      p_page_size: 25,
    }
    const signal = new AbortController().signal
    const response: TechnicalConfigurationOptionsListWireResponse = {
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

    await expect(listTechnicalConfigurationOptions(args, signal)).resolves.toEqual(response)
    expect(callRpcMock).toHaveBeenCalledWith(OPTION_RPC_FUNCTIONS.listOptions, args, { signal })
  })

  it("routes create, update and delete through nullable identity and dossier revision", async () => {
    const optionId = "00000000-0000-0000-0000-000000000003"
    const supplierId = "00000000-0000-0000-0000-000000000002"
    const mutationResponse: TechnicalConfigurationOptionMutationWireResponse = {
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
    const deleteResponse: TechnicalConfigurationOptionDeleteWireResponse = {
      data: { id: optionId, revision: 6 },
    }
    const createArgs: TechnicalConfigurationOptionCreateRpcArgs = {
      p_supplier_id: supplierId,
      p_model: null,
      p_manufacturer: "  Hãng   A  ",
      p_option_name: "  Phương   án A  ",
      p_notes: null,
      p_expected_revision: 4,
    }
    const updateArgs: TechnicalConfigurationOptionUpdateRpcArgs = {
      p_option_id: optionId,
      p_model: "Model A",
      p_manufacturer: "Hãng A",
      p_option_name: null,
      p_notes: "Ghi chú",
      p_expected_revision: 4,
    }
    const deleteArgs: TechnicalConfigurationOptionDeleteRpcArgs = {
      p_option_id: optionId,
      p_expected_revision: 5,
    }
    callRpcMock
      .mockResolvedValueOnce(mutationResponse)
      .mockResolvedValueOnce(mutationResponse)
      .mockResolvedValueOnce(deleteResponse)

    await expect(createTechnicalConfigurationOption(createArgs)).resolves.toEqual(mutationResponse)
    await expect(updateTechnicalConfigurationOption(updateArgs)).resolves.toEqual(mutationResponse)
    await expect(deleteTechnicalConfigurationOption(deleteArgs)).resolves.toEqual(deleteResponse)

    expect(callRpcMock.mock.calls).toEqual([
      [OPTION_RPC_FUNCTIONS.createOption, createArgs, { signal: undefined }],
      [OPTION_RPC_FUNCTIONS.updateOption, updateArgs, { signal: undefined }],
      [OPTION_RPC_FUNCTIONS.deleteOption, deleteArgs, { signal: undefined }],
    ])
  })
})

describe("P8A3 exact-baseline option response RPC contract", () => {
  beforeEach(() => {
    callRpcMock.mockReset()
  })

  it("freezes exactly the two option-response RPC names", () => {
    expect(OPTION_RESPONSE_RPC_FUNCTIONS).toEqual({
      getOrCreateComparisonSet: "technical_configuration_comparison_set_get_or_create",
      upsertOptionResponse: "technical_configuration_option_response_upsert",
    })
    expect(OPTION_RESPONSE_RPC_FUNCTION_NAMES).toEqual(Object.values(OPTION_RESPONSE_RPC_FUNCTIONS))
  })

  it("delegates exact baseline ownership and preserves complete multiline wire fields", async () => {
    const comparisonSetId = "00000000-0000-0000-0000-000000000004"
    const baselineVersionId = "00000000-0000-0000-0000-000000000005"
    const criterionId = "00000000-0000-0000-0000-000000000006"
    const responseRow = {
      id: "00000000-0000-0000-0000-000000000007",
      comparison_set_id: comparisonSetId,
      baseline_version_id: baselineVersionId,
      criterion_id: criterionId,
      response_text: "Dòng 1\nDòng 2",
      supplementary_information: "Tài liệu A\nTài liệu B",
      created_at: "2026-07-22T00:00:00Z",
      created_by: 1,
      updated_at: "2026-07-22T00:01:00Z",
      updated_by: 1,
      revision: 2,
    }
    const comparisonSetResponse: TechnicalConfigurationComparisonSetWireResponse = {
      data: {
        id: comparisonSetId,
        dossier_id: "00000000-0000-0000-0000-000000000001",
        option_id: "00000000-0000-0000-0000-000000000003",
        baseline_version_id: baselineVersionId,
        created_at: "2026-07-22T00:00:00Z",
        created_by: 1,
        updated_at: "2026-07-22T00:00:00Z",
        updated_by: 1,
        revision: 5,
        responses: [responseRow],
      },
    }
    const upsertResponse: TechnicalConfigurationOptionResponseWireResponse = {
      data: responseRow,
    }
    const getOrCreateArgs: TechnicalConfigurationComparisonSetGetOrCreateRpcArgs = {
      p_option_id: comparisonSetResponse.data.option_id,
      p_baseline_version_id: baselineVersionId,
      p_expected_revision: 4,
    }
    const upsertArgs: TechnicalConfigurationOptionResponseUpsertRpcArgs = {
      p_comparison_set_id: comparisonSetId,
      p_criterion_id: criterionId,
      p_response_text: responseRow.response_text,
      p_supplementary_information: responseRow.supplementary_information,
      p_expected_revision: 5,
    }
    const signal = new AbortController().signal
    callRpcMock.mockResolvedValueOnce(comparisonSetResponse).mockResolvedValueOnce(upsertResponse)

    await expect(
      getOrCreateTechnicalConfigurationComparisonSet(getOrCreateArgs, signal)
    ).resolves.toEqual(comparisonSetResponse)
    await expect(upsertTechnicalConfigurationOptionResponse(upsertArgs)).resolves.toEqual(
      upsertResponse
    )

    expect(callRpcMock.mock.calls).toEqual([
      [OPTION_RESPONSE_RPC_FUNCTIONS.getOrCreateComparisonSet, getOrCreateArgs, { signal }],
      [OPTION_RESPONSE_RPC_FUNCTIONS.upsertOptionResponse, upsertArgs, { signal: undefined }],
    ])
  })
})
