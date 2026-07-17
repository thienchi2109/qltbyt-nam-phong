import { act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import {
  listResponse,
  product,
  renderReferenceProductsHook,
  type ReferenceProductRpcMocks,
} from "./reference-products-fixtures"

export function registerReferenceProductOperationLockTests(referenceRpc: ReferenceProductRpcMocks) {
  describe("technical configuration reference-product operation locking", () => {
    beforeEach(() => {
      Object.values(referenceRpc).forEach((mock) => mock.mockReset())
    })

    it("blocks overlapping reloads, saves, and draft edits while reload is active", async () => {
      const initialProduct = product("product-1", "Model A")
      const refreshedProduct = product("product-1", "Model máy chủ", 6)
      let resolveReload: ((value: ReturnType<typeof listResponse>) => void) | undefined
      referenceRpc.listProducts
        .mockResolvedValueOnce(listResponse([initialProduct]))
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveReload = resolve
            })
        )

      const { result, onNavigationBlockedChange } = renderReferenceProductsHook()
      await waitFor(() => expect(result.current.products).toHaveLength(1))

      act(() => {
        result.current.updateProduct(initialProduct.id, { model: "Model chưa lưu" })
      })

      let firstReload: Promise<void> | undefined
      let secondReload: Promise<void> | undefined
      let saveDuringReload: Promise<void> | undefined
      let addedProductId: string | undefined
      act(() => {
        firstReload = result.current.reload()
        secondReload = result.current.reload()
        saveDuringReload = result.current.save()
        result.current.updateProduct(initialProduct.id, { model: "Model ghi đè" })
        result.current.updateResponse(initialProduct.id, "criterion-1", "Phản hồi ghi đè")
        result.current.removeProduct(initialProduct.id)
        addedProductId = result.current.addProduct()
      })

      expect(referenceRpc.listProducts).toHaveBeenCalledTimes(2)
      expect(referenceRpc.updateProduct).not.toHaveBeenCalled()
      expect(referenceRpc.upsertResponse).not.toHaveBeenCalled()
      expect(referenceRpc.deleteProduct).not.toHaveBeenCalled()
      expect(referenceRpc.createProduct).not.toHaveBeenCalled()
      expect(addedProductId).toBe("")
      expect(result.current.products).toEqual([
        expect.objectContaining({
          id: initialProduct.id,
          model: "Model chưa lưu",
          responses: {},
        }),
      ])

      await act(async () => {
        resolveReload?.(listResponse([refreshedProduct]))
        await Promise.all([firstReload, secondReload, saveDuringReload])
      })

      expect(result.current.products).toEqual([
        expect.objectContaining({
          id: refreshedProduct.id,
          model: "Model máy chủ",
        }),
      ])
      expect(onNavigationBlockedChange.mock.calls).toEqual([[true], [false]])
    })

    it("blocks reloads and draft edits while save is active", async () => {
      const initialProduct = product("product-1", "Model A")
      const savedProduct = product("product-1", "Model đã lưu", 6)
      let resolveSave: ((value: { data: typeof savedProduct }) => void) | undefined
      referenceRpc.listProducts
        .mockResolvedValueOnce(listResponse([initialProduct]))
        .mockResolvedValueOnce(listResponse([savedProduct]))
      referenceRpc.updateProduct.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSave = resolve
          })
      )

      const { result, onNavigationBlockedChange } = renderReferenceProductsHook()
      await waitFor(() => expect(result.current.products).toHaveLength(1))

      act(() => {
        result.current.updateProduct(initialProduct.id, { model: "Model đã lưu" })
      })

      let savePromise: Promise<void> | undefined
      let reloadDuringSave: Promise<void> | undefined
      let addedProductId: string | undefined
      act(() => {
        savePromise = result.current.save()
        reloadDuringSave = result.current.reload()
        result.current.updateProduct(initialProduct.id, { model: "Model ghi đè" })
        result.current.updateResponse(initialProduct.id, "criterion-1", "Phản hồi ghi đè")
        result.current.removeProduct(initialProduct.id)
        addedProductId = result.current.addProduct()
      })

      expect(referenceRpc.listProducts).toHaveBeenCalledTimes(1)
      expect(addedProductId).toBe("")
      expect(result.current.products).toEqual([
        expect.objectContaining({
          id: initialProduct.id,
          model: "Model đã lưu",
          responses: {},
        }),
      ])

      await act(async () => {
        resolveSave?.({ data: savedProduct })
        await Promise.all([savePromise, reloadDuringSave])
      })

      expect(referenceRpc.updateProduct).toHaveBeenCalledTimes(1)
      expect(referenceRpc.upsertResponse).not.toHaveBeenCalled()
      expect(referenceRpc.deleteProduct).not.toHaveBeenCalled()
      expect(referenceRpc.createProduct).not.toHaveBeenCalled()
      expect(result.current.products).toEqual([
        expect.objectContaining({
          id: savedProduct.id,
          model: "Model đã lưu",
        }),
      ])
      expect(onNavigationBlockedChange.mock.calls).toEqual([[true], [false]])
    })
  })
}
