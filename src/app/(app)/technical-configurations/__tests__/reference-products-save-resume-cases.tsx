import { act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import {
  baselineVersion,
  listResponse,
  product,
  renderReferenceProductsHook,
  type ReferenceProductRpcMocks,
} from "./reference-products-fixtures"

export function registerReferenceProductSaveResumeTests(referenceRpc: ReferenceProductRpcMocks) {
  describe("technical configuration reference-product partial-save recovery", () => {
    beforeEach(() => {
      Object.values(referenceRpc).forEach((mock) => mock.mockReset())
    })

    it("resumes a partial update save without replaying completed writes", async () => {
      const first = product("product-1", "Model A")
      const updated = product(first.id, "Model A2", 6)
      const savedResponse = {
        id: "response-1",
        baseline_version_id: baselineVersion.id,
        reference_product_id: first.id,
        criterion_id: "criterion-1",
        response_text: "Phản hồi cập nhật",
        created_at: "2026-07-17T00:00:00.000Z",
        created_by: 1,
        updated_at: "2026-07-17T00:00:00.000Z",
        updated_by: 1,
        revision: 7,
      }
      const refreshed = product(first.id, "Model A2", 7)
      refreshed.responses = [savedResponse]
      referenceRpc.listProducts
        .mockResolvedValueOnce(listResponse([first]))
        .mockResolvedValueOnce(listResponse([refreshed]))
      referenceRpc.updateProduct.mockResolvedValue({ data: updated })
      referenceRpc.upsertResponse
        .mockRejectedValueOnce(new Error("response write failed"))
        .mockResolvedValueOnce({ data: savedResponse })

      const { result, onRevisionChange } = renderReferenceProductsHook()
      await waitFor(() => expect(result.current.products).toHaveLength(1))

      act(() => {
        result.current.updateProduct(first.id, { model: "Model A2" })
        result.current.updateResponse(first.id, "criterion-1", "Phản hồi cập nhật")
      })
      await act(async () => {
        await result.current.save()
      })

      expect(onRevisionChange).toHaveBeenLastCalledWith(6)
      expect(result.current.products[0]).toMatchObject({
        model: "Model A2",
        responses: { "criterion-1": "Phản hồi cập nhật" },
      })
      expect(result.current.isDirty).toBe(true)

      await act(async () => {
        await result.current.save()
      })

      expect(referenceRpc.updateProduct).toHaveBeenCalledTimes(1)
      expect(referenceRpc.upsertResponse).toHaveBeenNthCalledWith(2, {
        p_reference_product_id: first.id,
        p_criterion_id: "criterion-1",
        p_response_text: "Phản hồi cập nhật",
        p_expected_revision: 6,
      })
      expect(onRevisionChange).toHaveBeenLastCalledWith(7)
      await waitFor(() => expect(result.current.isDirty).toBe(false))
    })

    it("resumes a partial create save with the persisted product id", async () => {
      const created = product("product-1", "Model A", 6)
      const savedResponse = {
        id: "response-1",
        baseline_version_id: baselineVersion.id,
        reference_product_id: created.id,
        criterion_id: "criterion-1",
        response_text: "Phản hồi sản phẩm mới",
        created_at: "2026-07-17T00:00:00.000Z",
        created_by: 1,
        updated_at: "2026-07-17T00:00:00.000Z",
        updated_by: 1,
        revision: 7,
      }
      const refreshed = product(created.id, created.model ?? "", 7)
      refreshed.responses = [savedResponse]
      referenceRpc.listProducts
        .mockResolvedValueOnce(listResponse([]))
        .mockResolvedValueOnce(listResponse([refreshed]))
      referenceRpc.createProduct.mockResolvedValue({ data: created })
      referenceRpc.upsertResponse
        .mockRejectedValueOnce(new Error("response write failed"))
        .mockResolvedValueOnce({ data: savedResponse })

      const { result, onRevisionChange } = renderReferenceProductsHook()
      await waitFor(() => expect(result.current.productsQuery.isSuccess).toBe(true))

      let localId = ""
      act(() => {
        localId = result.current.addProduct()
        result.current.updateProduct(localId, { model: "Model A" })
        result.current.updateResponse(localId, "criterion-1", "Phản hồi sản phẩm mới")
      })
      await act(async () => {
        await result.current.save()
      })

      expect(onRevisionChange).toHaveBeenLastCalledWith(6)
      expect(result.current.products[0]).toMatchObject({
        id: created.id,
        persistedId: created.id,
        responses: { "criterion-1": "Phản hồi sản phẩm mới" },
      })
      expect(result.current.isDirty).toBe(true)

      await act(async () => {
        await result.current.save()
      })

      expect(referenceRpc.createProduct).toHaveBeenCalledTimes(1)
      expect(referenceRpc.upsertResponse).toHaveBeenNthCalledWith(2, {
        p_reference_product_id: created.id,
        p_criterion_id: "criterion-1",
        p_response_text: "Phản hồi sản phẩm mới",
        p_expected_revision: 6,
      })
      expect(onRevisionChange).toHaveBeenLastCalledWith(7)
      await waitFor(() => expect(result.current.isDirty).toBe(false))
    })

    it("does not expose raw non-conflict save errors", async () => {
      referenceRpc.listProducts.mockResolvedValue(listResponse([]))
      referenceRpc.createProduct.mockRejectedValue(
        new Error("rpc_internal: relation details must stay private")
      )

      const { result } = renderReferenceProductsHook()
      await waitFor(() => expect(result.current.productsQuery.isSuccess).toBe(true))

      act(() => {
        const localId = result.current.addProduct()
        result.current.updateProduct(localId, { model: "Model A" })
      })
      await act(async () => {
        await result.current.save()
      })

      expect(result.current.saveError).toBe("Không thể lưu sản phẩm tham chiếu.")
      expect(result.current.saveError).not.toMatch(/relation details/i)
    })
  })
}
