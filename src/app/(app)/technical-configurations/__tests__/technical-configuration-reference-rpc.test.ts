import { beforeEach, describe, expect, it, vi } from "vitest"
import { REFERENCE_PRODUCT_RPC_FUNCTIONS } from "@/lib/technical-configuration-reference-rpcs"
import { callTechnicalConfigurationRpc } from "../technical-configuration-rpc"
import type {
  TechnicalConfigurationReferenceProductDeleteWireResponse,
  TechnicalConfigurationReferenceProductMutationWireResponse,
  TechnicalConfigurationReferenceProductsListWireResponse,
  TechnicalConfigurationReferenceResponseMutationWireResponse,
} from "../reference-product-types"
import {
  createTechnicalConfigurationReferenceProduct,
  deleteTechnicalConfigurationReferenceProduct,
  listTechnicalConfigurationReferenceProducts,
  updateTechnicalConfigurationReferenceProduct,
  upsertTechnicalConfigurationReferenceResponse,
} from "../technical-configuration-reference-rpc"

vi.mock("../technical-configuration-rpc", () => ({
  callTechnicalConfigurationRpc: vi.fn(),
}))

const callRpcMock = vi.mocked(callTechnicalConfigurationRpc)

describe("technical configuration reference-product RPC adapter", () => {
  beforeEach(() => {
    callRpcMock.mockReset()
    callRpcMock.mockResolvedValue({ data: [] })
  })

  it("passes paginated list arguments and abort signal through the shared helper", async () => {
    const controller = new AbortController()
    const args = {
      p_baseline_version_id: "version-1",
      p_page: 2,
      p_page_size: 25,
    }

    await listTechnicalConfigurationReferenceProducts(args, controller.signal)

    expect(callRpcMock).toHaveBeenCalledWith(REFERENCE_PRODUCT_RPC_FUNCTIONS.listProducts, args, {
      signal: controller.signal,
    })
  })

  it("returns the paginated list wire shape unchanged", async () => {
    const expectedResponse = {
      data: [
        {
          id: "product-1",
          baseline_version_id: "version-1",
          model: "Model A",
          manufacturer: "Hang A",
          description: "Mo ta",
          notes: null,
          created_at: "2026-07-17T00:00:00.000Z",
          created_by: 1,
          updated_at: "2026-07-17T00:00:00.000Z",
          updated_by: 1,
          revision: 3,
          responses: [
            {
              id: "response-1",
              baseline_version_id: "version-1",
              reference_product_id: "product-1",
              criterion_id: "criterion-1",
              response_text: "Dong 1\nDong 2",
              created_at: "2026-07-17T00:00:00.000Z",
              created_by: 1,
              updated_at: "2026-07-17T00:00:00.000Z",
              updated_by: 1,
              revision: 3,
            },
          ],
        },
      ],
      total: 1,
      page: 2,
      page_size: 25,
    } satisfies TechnicalConfigurationReferenceProductsListWireResponse
    callRpcMock.mockResolvedValueOnce(expectedResponse)

    const result = await listTechnicalConfigurationReferenceProducts({
      p_baseline_version_id: "version-1",
      p_page: 2,
      p_page_size: 25,
    })

    expect(result).toEqual(expectedResponse)
  })

  it("routes every mutation through its P7A1 RPC name without remapping wire fields", async () => {
    const createArgs = {
      p_baseline_version_id: "version-1",
      p_model: "Model A",
      p_manufacturer: "Hang A",
      p_description: "Mo ta",
      p_notes: null,
      p_expected_revision: 1,
    }
    const updateArgs = {
      p_reference_product_id: "product-1",
      p_model: "Model A2",
      p_manufacturer: "Hang A",
      p_description: "Mo ta moi",
      p_notes: null,
      p_expected_revision: 2,
    }
    const deleteArgs = {
      p_reference_product_id: "product-1",
      p_expected_revision: 3,
    }
    const responseArgs = {
      p_reference_product_id: "product-1",
      p_criterion_id: "criterion-1",
      p_response_text: "Dong 1\nDong 2",
      p_expected_revision: 4,
    }

    await createTechnicalConfigurationReferenceProduct(createArgs)
    await updateTechnicalConfigurationReferenceProduct(updateArgs)
    await deleteTechnicalConfigurationReferenceProduct(deleteArgs)
    await upsertTechnicalConfigurationReferenceResponse(responseArgs)

    expect(callRpcMock.mock.calls).toEqual([
      [REFERENCE_PRODUCT_RPC_FUNCTIONS.createProduct, createArgs, { signal: undefined }],
      [REFERENCE_PRODUCT_RPC_FUNCTIONS.updateProduct, updateArgs, { signal: undefined }],
      [REFERENCE_PRODUCT_RPC_FUNCTIONS.deleteProduct, deleteArgs, { signal: undefined }],
      [REFERENCE_PRODUCT_RPC_FUNCTIONS.upsertResponse, responseArgs, { signal: undefined }],
    ])
  })

  it("returns product, delete, and response mutation wire shapes unchanged", async () => {
    const productResponse = {
      data: {
        id: "product-1",
        baseline_version_id: "version-1",
        model: "Model A",
        manufacturer: "Hang A",
        description: "Mo ta",
        notes: null,
        created_at: "2026-07-17T00:00:00.000Z",
        created_by: 1,
        updated_at: "2026-07-17T00:00:00.000Z",
        updated_by: 1,
        revision: 2,
        responses: [],
      },
    } satisfies TechnicalConfigurationReferenceProductMutationWireResponse
    const deleteResponse = {
      data: {
        id: "product-1",
        revision: 4,
      },
    } satisfies TechnicalConfigurationReferenceProductDeleteWireResponse
    const responseMutation = {
      data: {
        id: "response-1",
        baseline_version_id: "version-1",
        reference_product_id: "product-1",
        criterion_id: "criterion-1",
        response_text: "Dong 1\nDong 2",
        created_at: "2026-07-17T00:00:00.000Z",
        created_by: 1,
        updated_at: "2026-07-17T00:00:00.000Z",
        updated_by: 1,
        revision: 5,
      },
    } satisfies TechnicalConfigurationReferenceResponseMutationWireResponse
    callRpcMock
      .mockResolvedValueOnce(productResponse)
      .mockResolvedValueOnce(productResponse)
      .mockResolvedValueOnce(deleteResponse)
      .mockResolvedValueOnce(responseMutation)

    const createResult = await createTechnicalConfigurationReferenceProduct({
      p_baseline_version_id: "version-1",
      p_model: "Model A",
      p_manufacturer: "Hang A",
      p_description: "Mo ta",
      p_notes: null,
      p_expected_revision: 1,
    })
    const updateResult = await updateTechnicalConfigurationReferenceProduct({
      p_reference_product_id: "product-1",
      p_model: "Model A",
      p_manufacturer: "Hang A",
      p_description: "Mo ta",
      p_notes: null,
      p_expected_revision: 2,
    })
    const deleteResult = await deleteTechnicalConfigurationReferenceProduct({
      p_reference_product_id: "product-1",
      p_expected_revision: 3,
    })
    const responseResult = await upsertTechnicalConfigurationReferenceResponse({
      p_reference_product_id: "product-1",
      p_criterion_id: "criterion-1",
      p_response_text: "Dong 1\nDong 2",
      p_expected_revision: 4,
    })

    expect(createResult).toEqual(productResponse)
    expect(updateResult).toEqual(productResponse)
    expect(deleteResult).toEqual(deleteResponse)
    expect(responseResult).toEqual(responseMutation)
  })
})
