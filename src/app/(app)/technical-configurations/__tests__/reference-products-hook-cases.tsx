import { act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  baselineVersion,
  listResponse,
  product,
  renderReferenceProductsHook,
  type ReferenceProductRpcMocks,
} from "./reference-products-fixtures"

export function registerReferenceProductHookTests(referenceRpc: ReferenceProductRpcMocks) {
  describe("useTechnicalConfigurationReferenceProducts", () => {
    beforeEach(() => {
      Object.values(referenceRpc).forEach((mock) => mock.mockReset())
    })

    it("loads the exact baseline-version aggregate through the P7A1 list wrapper", async () => {
      referenceRpc.listProducts.mockResolvedValue(listResponse([product("product-1", "Model A")]))

      const { result } = renderReferenceProductsHook()

      await waitFor(() => expect(result.current.products).toHaveLength(1))

      expect(referenceRpc.listProducts).toHaveBeenCalledWith(
        {
          p_baseline_version_id: baselineVersion.id,
          p_page: 1,
          p_page_size: 100,
        },
        expect.any(AbortSignal)
      )
      expect(result.current.products[0]?.model).toBe("Model A")
      expect(result.current.isDirty).toBe(false)
    })

    it("loads every reference-product page for the selected baseline version", async () => {
      const firstPage = Array.from({ length: 100 }, (_, index) =>
        product(`product-${index + 1}`, `Model ${index + 1}`)
      )
      const lastProduct = product("product-101", "Model 101")
      referenceRpc.listProducts
        .mockResolvedValueOnce({
          data: firstPage,
          total: 101,
          page: 1,
          page_size: 100,
        })
        .mockResolvedValueOnce({
          data: [lastProduct],
          total: 101,
          page: 2,
          page_size: 100,
        })

      const { result } = renderReferenceProductsHook()

      await waitFor(() => expect(result.current.products).toHaveLength(101))
      expect(referenceRpc.listProducts).toHaveBeenNthCalledWith(
        2,
        {
          p_baseline_version_id: baselineVersion.id,
          p_page: 2,
          p_page_size: 100,
        },
        expect.any(AbortSignal)
      )
      expect(result.current.products.at(-1)?.model).toBe("Model 101")
    })

    it("reports navigation blocking while reload is in flight", async () => {
      let resolveReload: ((value: ReturnType<typeof listResponse>) => void) | undefined
      referenceRpc.listProducts
        .mockResolvedValueOnce(listResponse([product("product-1", "Model A")]))
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveReload = resolve
            })
        )

      const { result, onNavigationBlockedChange } = renderReferenceProductsHook()
      await waitFor(() => expect(result.current.products).toHaveLength(1))

      let reloadPromise: Promise<void> | undefined
      act(() => {
        reloadPromise = result.current.reload()
      })
      expect(onNavigationBlockedChange).toHaveBeenLastCalledWith(true)

      await act(async () => {
        resolveReload?.(listResponse([product("product-1", "Model A")]))
        await reloadPromise
      })
      expect(onNavigationBlockedChange).toHaveBeenLastCalledWith(false)
    })

    it("defers create, update, delete, and response mutations until explicit save", async () => {
      const first = product("product-1", "Model A")
      const removed = product("product-2", "Model B")
      const refreshed = product("product-1", "Model A2", 10)
      refreshed.responses = [
        {
          id: "response-1",
          baseline_version_id: baselineVersion.id,
          reference_product_id: first.id,
          criterion_id: "criterion-1",
          response_text: "Đáp ứng ổn định",
          created_at: "2026-07-17T00:00:00.000Z",
          created_by: 1,
          updated_at: "2026-07-17T00:00:00.000Z",
          updated_by: 1,
          revision: 7,
        },
      ]
      const created = product("product-3", "Model C", 8)
      const finalResponse = listResponse([refreshed, created])
      referenceRpc.listProducts
        .mockResolvedValueOnce(listResponse([first, removed]))
        .mockResolvedValueOnce(finalResponse)
      referenceRpc.updateProduct.mockResolvedValueOnce({
        data: { ...first, model: "Model A2", revision: 6 },
      })
      referenceRpc.upsertResponse
        .mockResolvedValueOnce({ data: refreshed.responses[0] })
        .mockResolvedValueOnce({
          data: {
            ...refreshed.responses[0],
            id: "response-2",
            reference_product_id: created.id,
            response_text: "Thông số tham chiếu C",
            revision: 9,
          },
        })
      referenceRpc.createProduct.mockResolvedValueOnce({ data: created })
      referenceRpc.deleteProduct.mockResolvedValueOnce({
        data: { id: removed.id, revision: 10 },
      })

      const { result, onRevisionChange } = renderReferenceProductsHook()
      await waitFor(() => expect(result.current.products).toHaveLength(2))

      let newProductId = ""
      act(() => {
        result.current.updateProduct(first.id, { model: "Model A2" })
        result.current.updateResponse(first.id, "criterion-1", "Đáp ứng ổn định")
        result.current.removeProduct(removed.id)
        newProductId = result.current.addProduct()
        result.current.updateProduct(newProductId, { model: "Model C" })
        result.current.updateResponse(newProductId, "criterion-1", "Thông số tham chiếu C")
      })

      expect(result.current.isDirty).toBe(true)
      expect(referenceRpc.createProduct).not.toHaveBeenCalled()
      expect(referenceRpc.updateProduct).not.toHaveBeenCalled()
      expect(referenceRpc.deleteProduct).not.toHaveBeenCalled()
      expect(referenceRpc.upsertResponse).not.toHaveBeenCalled()

      await act(async () => {
        await result.current.save()
      })

      expect(referenceRpc.updateProduct).toHaveBeenCalledWith({
        p_reference_product_id: first.id,
        p_model: "Model A2",
        p_manufacturer: "Hãng A",
        p_description: null,
        p_notes: null,
        p_expected_revision: 5,
      })
      expect(referenceRpc.upsertResponse).toHaveBeenNthCalledWith(1, {
        p_reference_product_id: first.id,
        p_criterion_id: "criterion-1",
        p_response_text: "Đáp ứng ổn định",
        p_expected_revision: 6,
      })
      expect(referenceRpc.createProduct).toHaveBeenCalledWith({
        p_baseline_version_id: baselineVersion.id,
        p_model: "Model C",
        p_manufacturer: null,
        p_description: null,
        p_notes: null,
        p_expected_revision: 7,
      })
      expect(referenceRpc.upsertResponse).toHaveBeenNthCalledWith(2, {
        p_reference_product_id: created.id,
        p_criterion_id: "criterion-1",
        p_response_text: "Thông số tham chiếu C",
        p_expected_revision: 8,
      })
      expect(referenceRpc.deleteProduct).toHaveBeenCalledWith({
        p_reference_product_id: removed.id,
        p_expected_revision: 9,
      })
      expect(onRevisionChange).toHaveBeenLastCalledWith(10)
      await waitFor(() => expect(result.current.isDirty).toBe(false))
    })

    it("does not replay completed writes when cache refresh fails", async () => {
      const created = product("product-1", "Model A", 6)
      referenceRpc.listProducts.mockResolvedValue(listResponse([]))
      referenceRpc.createProduct.mockResolvedValue({ data: created })
      referenceRpc.updateProduct.mockResolvedValue({
        data: { ...created, model: "Model B", revision: 7 },
      })

      const { result, queryClient } = renderReferenceProductsHook()
      await waitFor(() => expect(result.current.productsQuery.isSuccess).toBe(true))
      const invalidateQueries = vi
        .spyOn(queryClient, "invalidateQueries")
        .mockRejectedValue(new Error("cache unavailable"))

      let localId = ""
      act(() => {
        localId = result.current.addProduct()
        result.current.updateProduct(localId, { model: "Model A" })
      })
      await act(async () => {
        await result.current.save()
      })

      expect(referenceRpc.createProduct).toHaveBeenCalledTimes(1)
      expect(result.current.products[0]).toMatchObject({
        id: created.id,
        persistedId: created.id,
        model: "Model A",
      })
      expect(result.current.isDirty).toBe(false)
      expect(result.current.saveStatus).toBe("saved")
      expect(result.current.saveError).toBeNull()
      expect(result.current.refreshWarning).toBe(
        "Đã lưu thay đổi nhưng không thể làm mới dữ liệu từ máy chủ."
      )

      act(() => {
        result.current.updateProduct(created.id, { model: "Model B" })
      })
      await act(async () => {
        await result.current.save()
      })

      expect(referenceRpc.createProduct).toHaveBeenCalledTimes(1)
      expect(referenceRpc.updateProduct).toHaveBeenCalledWith({
        p_reference_product_id: created.id,
        p_model: "Model B",
        p_manufacturer: "Hãng A",
        p_description: null,
        p_notes: null,
        p_expected_revision: 6,
      })
      invalidateQueries.mockRestore()
    })

    it("blocks archived-dossier product and criterion-response authoring", async () => {
      const first = product("product-1", "Model A")
      referenceRpc.listProducts.mockResolvedValue(listResponse([first]))

      const { result } = renderReferenceProductsHook({ isArchived: true })
      await waitFor(() => expect(result.current.products).toHaveLength(1))

      act(() => {
        result.current.updateProduct(first.id, { model: "Không được lưu" })
        result.current.updateResponse(first.id, "criterion-1", "Không được lưu")
      })
      await act(async () => {
        await result.current.save()
      })

      expect(result.current.isReadOnly).toBe(true)
      expect(result.current.products[0]?.model).toBe("Model A")
      expect(referenceRpc.updateProduct).not.toHaveBeenCalled()
      expect(referenceRpc.upsertResponse).not.toHaveBeenCalled()
    })
  })
}
