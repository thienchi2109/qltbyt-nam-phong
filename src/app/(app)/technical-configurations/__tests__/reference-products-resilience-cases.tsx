import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationReferenceProducts } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceProducts"
import {
  baselineVersion,
  dossier,
  listResponse,
  product,
  renderWithQueryClient,
  type BaselineVersionRpcMocks,
  type ReferenceProductRpcMocks,
} from "./reference-products-fixtures"

type RegisterReferenceProductResilienceTestsArgs = {
  baselineRpc: BaselineVersionRpcMocks
  referenceRpc: ReferenceProductRpcMocks
}

export function registerReferenceProductResilienceTests({
  baselineRpc,
  referenceRpc,
}: RegisterReferenceProductResilienceTestsArgs) {
  describe("technical configuration reference-product resilience", () => {
    beforeEach(() => {
      baselineRpc.listVersions.mockReset()
      baselineRpc.listVersions.mockResolvedValue({
        data: [baselineVersion],
        total: 1,
        page: 1,
        page_size: 20,
      })
      Object.values(referenceRpc).forEach((mock) => mock.mockReset())
    })

    it("disables authoring while the initial product load is pending", async () => {
      let resolveProducts: ((value: ReturnType<typeof listResponse>) => void) | undefined
      referenceRpc.listProducts.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveProducts = resolve
          })
      )

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      expect(await screen.findByRole("button", { name: "Thêm sản phẩm tham chiếu" })).toBeDisabled()
      expect(
        screen.queryByRole("region", { name: "Ma trận đối chiếu sản phẩm tham chiếu" })
      ).not.toBeInTheDocument()

      resolveProducts?.(listResponse([]))
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" })).toBeEnabled()
      )
    })

    it("offers retry after the initial product load fails", async () => {
      const user = userEvent.setup()
      referenceRpc.listProducts
        .mockRejectedValueOnce(new Error("products unavailable"))
        .mockResolvedValueOnce(listResponse([]))

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      expect(await screen.findByText("Không thể tải sản phẩm tham chiếu")).toBeInTheDocument()
      expect(screen.getByText("Vui lòng thử lại.")).toBeInTheDocument()
      expect(screen.queryByText("products unavailable")).not.toBeInTheDocument()
      expect(
        screen.queryByRole("region", { name: "Ma trận đối chiếu sản phẩm tham chiếu" })
      ).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" })).toBeDisabled()
      await user.click(screen.getByRole("button", { name: "Thử lại" }))

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" })).toBeEnabled()
      )
    })

    it("keeps saved products visible when background cache refresh fails", async () => {
      const user = userEvent.setup()
      const created = product("product-1", "Model đã lưu", 6)
      const refreshed = product("product-1", "Model từ máy chủ", 6)
      baselineRpc.listVersions
        .mockResolvedValueOnce({
          data: [baselineVersion],
          total: 1,
          page: 1,
          page_size: 20,
        })
        .mockRejectedValueOnce(new Error("versions unavailable"))
        .mockResolvedValueOnce({
          data: [baselineVersion],
          total: 1,
          page: 1,
          page_size: 20,
        })
      referenceRpc.listProducts
        .mockResolvedValueOnce(listResponse([]))
        .mockRejectedValueOnce(new Error("products unavailable"))
        .mockResolvedValueOnce(listResponse([refreshed]))
      referenceRpc.createProduct.mockResolvedValueOnce({ data: created })

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)
      expect(await screen.findByText("Chưa có sản phẩm tham chiếu.")).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" }))
      await user.type(screen.getByLabelText("Model"), "Model đã lưu")
      await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

      expect(await screen.findByText("Đã lưu sản phẩm tham chiếu.")).toBeInTheDocument()
      expect(
        screen.getByText("Đã lưu thay đổi nhưng không thể làm mới dữ liệu từ máy chủ.")
      ).toBeInTheDocument()
      expect(screen.getByDisplayValue("Model đã lưu")).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Tải lại dữ liệu" }))

      expect(await screen.findByDisplayValue("Model từ máy chủ")).toBeInTheDocument()
      expect(screen.queryByDisplayValue("Model đã lưu")).not.toBeInTheDocument()
      expect(
        screen.queryByText("Đã lưu thay đổi nhưng không thể làm mới dữ liệu từ máy chủ.")
      ).not.toBeInTheDocument()
    })

    it("blocks version and product navigation while version refresh is pending", async () => {
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
      let resolveVersions:
        | ((value: {
            data: Array<typeof baselineVersion>
            total: number
            page: number
            page_size: number
          }) => void)
        | undefined
      baselineRpc.listVersions
        .mockResolvedValueOnce({
          data: [baselineVersion],
          total: 1,
          page: 1,
          page_size: 20,
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveVersions = resolve
            })
        )
      referenceRpc.listProducts.mockResolvedValue(listResponse([]))

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)
      expect(await screen.findByText("Chưa có sản phẩm tham chiếu.")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" }))
      await user.type(screen.getByLabelText("Model"), "Model chưa lưu")
      await user.click(screen.getByRole("button", { name: "Tải lại dữ liệu" }))

      expect(screen.getByRole("combobox", { name: "Phiên bản cấu hình cơ sở" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" })).toBeDisabled()

      resolveVersions?.({
        data: [baselineVersion],
        total: 1,
        page: 1,
        page_size: 20,
      })
      await waitFor(() =>
        expect(screen.getByRole("combobox", { name: "Phiên bản cấu hình cơ sở" })).toBeEnabled()
      )
      confirm.mockRestore()
    })

    it("wires visible product update, response upsert, and delete through explicit save", async () => {
      const user = userEvent.setup()
      const first = product("product-1", "Model A")
      const removed = product("product-2", "Model B")
      const updated = { ...first, model: "Model A2", revision: 6 }
      const response = {
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
      referenceRpc.listProducts
        .mockResolvedValueOnce(listResponse([first, removed]))
        .mockResolvedValueOnce(listResponse([{ ...updated, responses: [response] }]))
      referenceRpc.updateProduct.mockResolvedValueOnce({ data: updated })
      referenceRpc.upsertResponse.mockResolvedValueOnce({ data: response })
      referenceRpc.deleteProduct.mockResolvedValueOnce({
        data: { id: removed.id, revision: 8 },
      })

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)
      const modelInputs = await screen.findAllByLabelText("Model")
      await user.clear(modelInputs[0]!)
      await user.type(modelInputs[0]!, "Model A2")
      await user.type(screen.getByLabelText("Phản hồi Model A2 cho TC-0001"), "Phản hồi cập nhật")
      await user.click(screen.getByRole("button", { name: "Xóa Model B" }))

      expect(referenceRpc.updateProduct).not.toHaveBeenCalled()
      expect(referenceRpc.upsertResponse).not.toHaveBeenCalled()
      expect(referenceRpc.deleteProduct).not.toHaveBeenCalled()

      await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))
      await waitFor(() => expect(referenceRpc.updateProduct).toHaveBeenCalledTimes(1))
      expect(referenceRpc.upsertResponse).toHaveBeenCalledTimes(1)
      expect(referenceRpc.deleteProduct).toHaveBeenCalledTimes(1)
      expect(screen.getByDisplayValue("Model A2")).toBeInTheDocument()
      expect(screen.getByDisplayValue("Phản hồi cập nhật")).toBeInTheDocument()
      expect(screen.queryByDisplayValue("Model B")).not.toBeInTheDocument()
    })
  })
}
