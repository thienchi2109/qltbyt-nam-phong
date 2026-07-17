import { beforeEach, describe, expect, it, vi } from "vitest"
import { REFERENCE_PRODUCT_RPC_FUNCTIONS } from "@/lib/technical-configuration-reference-rpcs"
import { callTechnicalConfigurationRpc } from "../technical-configuration-rpc"
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
})
