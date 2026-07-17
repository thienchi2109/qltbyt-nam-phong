import { act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import {
  baselineVersion,
  listResponse,
  product,
  renderReferenceProductsHook,
  type ReferenceProductRpcMocks,
} from "./reference-products-fixtures"

export function registerReferenceProductConflictTests(referenceRpc: ReferenceProductRpcMocks) {
  describe("technical configuration reference-product conflict recovery", () => {
    beforeEach(() => {
      Object.values(referenceRpc).forEach((mock) => mock.mockReset())
    })

    it("preserves the local response draft when a stale revision interrupts save", async () => {
      const first = product("product-1", "Model A")
      referenceRpc.listProducts.mockResolvedValue(listResponse([first]))
      referenceRpc.upsertResponse.mockRejectedValue(
        new TechnicalConfigurationRpcError(409, { message: "stale_revision" })
      )

      const { result } = renderReferenceProductsHook()
      await waitFor(() => expect(result.current.products).toHaveLength(1))

      act(() => {
        result.current.updateResponse(first.id, "criterion-1", "Phản hồi giữ lại")
      })
      await act(async () => {
        await result.current.save()
      })

      expect(result.current.isConflict).toBe(true)
      expect(result.current.isDirty).toBe(true)
      expect(result.current.products[0]?.responses["criterion-1"]).toBe("Phản hồi giữ lại")
      expect(result.current.saveError).toMatch(/được giữ lại/i)
      expect(referenceRpc.listProducts).toHaveBeenCalledTimes(1)
    })

    it("preserves the conflicted draft when reload fails", async () => {
      const first = product("product-1", "Model A")
      referenceRpc.listProducts
        .mockResolvedValueOnce(listResponse([first]))
        .mockRejectedValueOnce(new Error("network unavailable"))
      referenceRpc.updateProduct.mockRejectedValue(
        new TechnicalConfigurationRpcError(409, { message: "stale_revision" })
      )

      const { result } = renderReferenceProductsHook()
      await waitFor(() => expect(result.current.products).toHaveLength(1))

      act(() => {
        result.current.updateProduct(first.id, { model: "Model giữ lại" })
      })
      await act(async () => {
        await result.current.save()
        await result.current.reload()
      })

      expect(result.current.isConflict).toBe(true)
      expect(result.current.isDirty).toBe(true)
      expect(result.current.products[0]?.model).toBe("Model giữ lại")
      expect(result.current.saveError).toBe("Không thể tải lại sản phẩm tham chiếu.")
    })

    it("replaces a conflicted response draft after a successful reload", async () => {
      const first = product("product-1", "Model A")
      const refreshed = product("product-1", "Model A", 6)
      refreshed.responses = [
        {
          id: "response-1",
          baseline_version_id: baselineVersion.id,
          reference_product_id: first.id,
          criterion_id: "criterion-1",
          response_text: "Phản hồi máy chủ",
          created_at: "2026-07-17T00:00:00.000Z",
          created_by: 1,
          updated_at: "2026-07-17T00:00:00.000Z",
          updated_by: 1,
          revision: 6,
        },
      ]
      referenceRpc.listProducts
        .mockResolvedValueOnce(listResponse([first]))
        .mockResolvedValueOnce(listResponse([refreshed]))
      referenceRpc.upsertResponse.mockRejectedValue(
        new TechnicalConfigurationRpcError(409, { message: "stale_revision" })
      )

      const { result } = renderReferenceProductsHook()
      await waitFor(() => expect(result.current.products).toHaveLength(1))

      act(() => {
        result.current.updateResponse(first.id, "criterion-1", "Phản hồi giữ lại")
      })
      await act(async () => {
        await result.current.save()
      })
      expect(result.current.isConflict).toBe(true)
      expect(result.current.products[0]?.responses["criterion-1"]).toBe("Phản hồi giữ lại")

      await act(async () => {
        await result.current.reload()
      })
      expect(result.current.isConflict).toBe(false)
      expect(result.current.isDirty).toBe(false)
      expect(result.current.products[0]?.responses["criterion-1"]).toBe("Phản hồi máy chủ")
    })
  })
}
