import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

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

type RegisterReferenceProductEditorWorkspaceTestsArgs = {
  baselineRpc: BaselineVersionRpcMocks
  referenceRpc: ReferenceProductRpcMocks
}

const originalHasPointerCapture = HTMLElement.prototype.hasPointerCapture
const originalSetPointerCapture = HTMLElement.prototype.setPointerCapture
const originalReleasePointerCapture = HTMLElement.prototype.releasePointerCapture
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false
  HTMLElement.prototype.setPointerCapture = () => undefined
  HTMLElement.prototype.releasePointerCapture = () => undefined
  HTMLElement.prototype.scrollIntoView = () => undefined
})

afterAll(() => {
  HTMLElement.prototype.hasPointerCapture = originalHasPointerCapture
  HTMLElement.prototype.setPointerCapture = originalSetPointerCapture
  HTMLElement.prototype.releasePointerCapture = originalReleasePointerCapture
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView
})

export function registerReferenceProductEditorWorkspaceTests({
  baselineRpc,
  referenceRpc,
}: RegisterReferenceProductEditorWorkspaceTestsArgs) {
  describe("technical configuration reference-product editor workspace", () => {
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

    it("renders one editor beside a compact navigator for many products", async () => {
      const products = Array.from({ length: 10 }, (_, index) =>
        product(`product-${index + 1}`, `Model ${index + 1}`)
      )
      referenceRpc.listProducts.mockResolvedValue(listResponse(products))

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      expect(
        await screen.findByRole("region", {
          name: "Không gian chỉnh sửa sản phẩm tham chiếu",
        })
      ).toBeInTheDocument()
      expect(screen.getAllByRole("button", { name: /^Chọn Model/ })).toHaveLength(10)
      expect(screen.getAllByLabelText("Model")).toHaveLength(1)
      expect(screen.getByDisplayValue("Model 1")).toBeInTheDocument()
      expect(screen.getByText("10 sản phẩm")).toBeInTheDocument()
      expect(
        screen.getByRole("region", { name: "Ma trận đối chiếu sản phẩm tham chiếu" })
      ).toBeInTheDocument()
    })

    it("preserves draft edits while switching the selected product", async () => {
      const user = userEvent.setup()
      referenceRpc.listProducts.mockResolvedValue(
        listResponse([product("product-1", "Model A"), product("product-2", "Model B")])
      )

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      const modelInput = await screen.findByDisplayValue("Model A")
      await user.clear(modelInput)
      await user.type(modelInput, "Model A2")
      await user.click(screen.getByRole("button", { name: "Chọn Model B, Hãng A" }))
      expect(screen.getByDisplayValue("Model B")).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Chọn Model A2, Hãng A" }))
      expect(screen.getByDisplayValue("Model A2")).toBeInTheDocument()
      expect(referenceRpc.updateProduct).not.toHaveBeenCalled()
      expect(referenceRpc.deleteProduct).not.toHaveBeenCalled()
    })

    it("selects a new draft and keeps it selected after save replaces its local id", async () => {
      const user = userEvent.setup()
      const existing = product("product-1", "Model A")
      const created = {
        ...product("product-2", "Model mới", baselineVersion.revision + 1),
        manufacturer: null,
      }
      referenceRpc.listProducts
        .mockResolvedValueOnce(listResponse([existing]))
        .mockResolvedValueOnce(listResponse([existing, created], created.revision))
      referenceRpc.createProduct.mockResolvedValueOnce({ data: created })

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      await screen.findByDisplayValue("Model A")
      await user.click(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" }))

      expect(
        screen.getByRole("button", {
          name: "Chọn Sản phẩm mới 2, thiếu thông tin",
        })
      ).toHaveAttribute("aria-current", "true")
      await user.type(screen.getByLabelText("Model"), "Model mới")
      await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

      await waitFor(() => expect(referenceRpc.createProduct).toHaveBeenCalledTimes(1))
      expect(await screen.findByDisplayValue("Model mới")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Chọn Model mới" })).toHaveAttribute(
        "aria-current",
        "true"
      )
    })

    it("filters products by model or manufacturer and handles an empty result", async () => {
      const user = userEvent.setup()
      referenceRpc.listProducts.mockResolvedValue(
        listResponse([
          { ...product("product-1", "4008S"), manufacturer: "Fresenius Medical Care" },
          { ...product("product-2", "Dialog +"), manufacturer: "B.Braun Avitum AG" },
          { ...product("product-3", "AK 98"), manufacturer: "Baxter" },
        ])
      )

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      const search = await screen.findByRole("searchbox", {
        name: "Tìm sản phẩm tham chiếu",
      })
      await user.type(search, "b.braun")

      expect(
        screen.getByRole("button", { name: "Chọn Dialog +, B.Braun Avitum AG" })
      ).toHaveAttribute("aria-current", "true")
      expect(screen.queryByRole("button", { name: /Chọn 4008S/ })).not.toBeInTheDocument()
      expect(screen.getByText("1/3 sản phẩm")).toBeInTheDocument()
      expect(screen.getByDisplayValue("Dialog +")).toBeInTheDocument()

      await user.clear(search)
      await user.type(search, "không có")
      expect(screen.getByText("Không tìm thấy sản phẩm phù hợp.")).toBeInTheDocument()
      expect(screen.getByDisplayValue("Dialog +")).toBeInTheDocument()
    })

    it("keeps the active editor mounted and hands focus to a visible row after filtered deletion", async () => {
      const user = userEvent.setup()
      referenceRpc.listProducts.mockResolvedValue(
        listResponse([
          { ...product("product-1", "Model A"), manufacturer: "Hãng A" },
          { ...product("product-2", "Model B"), manufacturer: "B.Braun Avitum AG" },
          { ...product("product-3", "Model C"), manufacturer: "B.Braun Medical" },
        ])
      )

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      const search = await screen.findByRole("searchbox", {
        name: "Tìm sản phẩm tham chiếu",
      })
      await user.type(search, "b.braun")
      const modelInput = screen.getByDisplayValue("Model B")
      const manufacturerInput = screen.getByDisplayValue("B.Braun Avitum AG")
      await user.clear(modelInput)
      await user.type(modelInput, "Model đổi tên")
      await user.clear(manufacturerInput)

      expect(screen.getByDisplayValue("Model đổi tên")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Xóa Model đổi tên" }))

      const nextProduct = screen.getByRole("button", {
        name: "Chọn Model C, B.Braun Medical",
      })
      expect(screen.getByDisplayValue("Model C")).toBeInTheDocument()
      await waitFor(() => expect(nextProduct).toHaveFocus())
    })

    it("keeps a manual navigator selection as the search fallback", async () => {
      const user = userEvent.setup()
      referenceRpc.listProducts.mockResolvedValue(
        listResponse([
          { ...product("product-1", "Model A"), manufacturer: "Hãng A" },
          { ...product("product-2", "Model B"), manufacturer: "B.Braun Avitum AG" },
          { ...product("product-3", "Model C"), manufacturer: "B.Braun Medical" },
        ])
      )

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      const search = await screen.findByRole("searchbox", {
        name: "Tìm sản phẩm tham chiếu",
      })
      await user.type(search, "b.braun")
      await user.click(screen.getByRole("button", { name: "Chọn Model C, B.Braun Medical" }))
      await user.type(search, " không có")

      expect(screen.getByText("Không tìm thấy sản phẩm phù hợp.")).toBeInTheDocument()
      expect(screen.getByRole("textbox", { name: "Model" })).toHaveValue("Model C")
    })

    it("clears the search when adding a draft so the selected row stays visible", async () => {
      const user = userEvent.setup()
      referenceRpc.listProducts.mockResolvedValue(
        listResponse([product("product-1", "Model A"), product("product-2", "Model B")])
      )

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      const search = await screen.findByRole("searchbox", {
        name: "Tìm sản phẩm tham chiếu",
      })
      await user.type(search, "Model B")
      await user.click(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" }))

      expect(search).toHaveValue("")
      expect(
        screen.getByRole("button", {
          name: "Chọn Sản phẩm mới 3, thiếu thông tin",
        })
      ).toHaveAttribute("aria-current", "true")
    })

    it("disambiguates accessible names for products with the same model and manufacturer", async () => {
      referenceRpc.listProducts.mockResolvedValue(
        listResponse([
          product("product-1", "Model A"),
          product("product-2", "Model A"),
          {
            ...product("product-3", "Model A"),
            manufacturer: "Hãng A, sản phẩm 1",
          },
        ])
      )

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      expect(
        await screen.findByRole("button", {
          name: "Chọn Model A, Hãng A, sản phẩm 1",
        })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", {
          name: "Chọn Model A, Hãng A, sản phẩm 2",
        })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", {
          name: "Chọn Model A, Hãng A, sản phẩm 1, mục 3",
        })
      ).toBeInTheDocument()
    })

    it("resets search and selection when returning to a baseline version", async () => {
      const user = userEvent.setup()
      const lockedVersion = {
        ...baselineVersion,
        id: "version-2",
        version_number: 2,
        status: "locked" as const,
        locked_at: "2026-07-18T00:00:00.000Z",
        locked_by: 1,
      }
      baselineRpc.listVersions.mockResolvedValueOnce({
        data: [baselineVersion, lockedVersion],
        total: 2,
        page: 1,
        page_size: 20,
      })
      referenceRpc.listProducts.mockImplementation(
        ({ p_baseline_version_id }: { p_baseline_version_id: string }) => {
          if (p_baseline_version_id === lockedVersion.id) {
            return Promise.resolve(
              listResponse([
                {
                  ...product("product-b1", "Model B1"),
                  baseline_version_id: lockedVersion.id,
                },
                {
                  ...product("product-b2", "Model B2"),
                  baseline_version_id: lockedVersion.id,
                },
              ])
            )
          }
          return Promise.resolve(
            listResponse([product("product-a1", "Model A1"), product("product-a2", "Model A2")])
          )
        }
      )

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      const search = await screen.findByRole("searchbox", {
        name: "Tìm sản phẩm tham chiếu",
      })
      await user.type(search, "Model A2")
      expect(screen.getByRole("textbox", { name: "Model" })).toHaveValue("Model A2")

      const versionPicker = screen.getByRole("combobox", {
        name: "Phiên bản cấu hình cơ sở",
      })
      await user.click(versionPicker)
      await user.click(await screen.findByRole("option", { name: "Phiên bản 2 · Đã khóa" }))
      expect(await screen.findByRole("textbox", { name: "Model" })).toHaveValue("Model B1")

      await user.click(versionPicker)
      await user.click(await screen.findByRole("option", { name: "Phiên bản 1 · Bản nháp" }))

      expect(await screen.findByRole("textbox", { name: "Model" })).toHaveValue("Model A1")
      expect(screen.getByRole("searchbox", { name: "Tìm sản phẩm tham chiếu" })).toHaveValue("")
    })

    it("gives blank drafts unique accessible names with validation status", async () => {
      const user = userEvent.setup()
      referenceRpc.listProducts.mockResolvedValue(listResponse([]))

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      const addProduct = await screen.findByRole("button", {
        name: "Thêm sản phẩm tham chiếu",
      })
      await user.click(addProduct)
      await user.click(addProduct)

      expect(
        screen.getByRole("button", {
          name: "Chọn Sản phẩm mới 1, thiếu thông tin",
        })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", {
          name: "Chọn Sản phẩm mới 2, thiếu thông tin",
        })
      ).toHaveAttribute("aria-current", "true")
    })

    it("selects the nearest product after removing the active draft", async () => {
      const user = userEvent.setup()
      referenceRpc.listProducts.mockResolvedValue(
        listResponse([
          product("product-1", "Model A"),
          product("product-2", "Model B"),
          product("product-3", "Model C"),
        ])
      )

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      const search = await screen.findByRole("searchbox", {
        name: "Tìm sản phẩm tham chiếu",
      })
      await user.click(await screen.findByRole("button", { name: "Chọn Model B, Hãng A" }))
      await user.click(screen.getByRole("button", { name: "Xóa Model B" }))
      expect(screen.getByDisplayValue("Model C")).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Xóa Model C" }))
      expect(screen.getByDisplayValue("Model A")).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Xóa Model A" }))
      expect(screen.getByText("Danh sách chưa có sản phẩm.")).toBeInTheDocument()
      expect(screen.queryByLabelText("Model")).not.toBeInTheDocument()
      await waitFor(() => expect(search).toHaveFocus())
    })
  })
}
