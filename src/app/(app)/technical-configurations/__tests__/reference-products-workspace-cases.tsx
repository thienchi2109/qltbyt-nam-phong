import { act, fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationReferenceProducts } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceProducts"
import { TechnicalConfigurationWorkspaceShell } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell"
import { technicalConfigurationBaselineVersionsQueryKey } from "@/app/(app)/technical-configurations/technical-configuration-query-keys"
import {
  baselineVersion,
  dossier,
  listResponse,
  product,
  renderWithQueryClient,
  type BaselineVersionRpcMocks,
  type ReferenceProductRpcMocks,
} from "./reference-products-fixtures"

type RegisterReferenceProductWorkspaceTestsArgs = {
  baselineRpc: BaselineVersionRpcMocks
  referenceRpc: ReferenceProductRpcMocks
}

export function registerReferenceProductWorkspaceTests({
  baselineRpc,
  referenceRpc,
}: RegisterReferenceProductWorkspaceTestsArgs) {
  const originalScrollIntoView = Element.prototype.scrollIntoView

  beforeAll(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterAll(() => {
    if (originalScrollIntoView) {
      Object.defineProperty(Element.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      })
      return
    }
    Reflect.deleteProperty(Element.prototype, "scrollIntoView")
  })

  describe("technical configuration reference-product workspace", () => {
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

    it("renders the baseline-version picker with the shared shadcn select", async () => {
      referenceRpc.listProducts.mockResolvedValue(listResponse([]))

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      const versionPicker = await screen.findByRole("combobox", {
        name: "Phiên bản cấu hình cơ sở",
      })
      expect(versionPicker.tagName).toBe("BUTTON")
    })

    it("reloads a clean reference-product workspace on demand", async () => {
      const user = userEvent.setup()
      referenceRpc.listProducts
        .mockResolvedValueOnce(listResponse([]))
        .mockResolvedValueOnce(listResponse([product("product-1", "Model mới")]))

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      expect(await screen.findByText("Chưa có sản phẩm tham chiếu.")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Tải lại dữ liệu" }))

      expect(await screen.findByRole("columnheader", { name: "Model mới" })).toBeInTheDocument()
      expect(referenceRpc.listProducts).toHaveBeenCalledTimes(2)
    })

    it("loads later baseline-version pages from the shadcn select", async () => {
      const currentVersion = {
        ...baselineVersion,
        version_number: 101,
      }
      const firstPageVersions = Array.from({ length: 100 }, (_, index) =>
        index === 0
          ? currentVersion
          : {
              ...baselineVersion,
              id: `version-${101 - index}`,
              version_number: 101 - index,
              status: "locked" as const,
              locked_at: "2026-07-17T01:00:00.000Z",
              locked_by: 1,
            }
      )
      const olderVersion = {
        ...baselineVersion,
        id: "version-older",
        version_number: 1,
        status: "locked" as const,
        locked_at: "2026-07-17T01:00:00.000Z",
        locked_by: 1,
      }
      baselineRpc.listVersions
        .mockResolvedValueOnce({
          data: firstPageVersions,
          total: 101,
          page: 1,
          page_size: 100,
        })
        .mockResolvedValueOnce({
          data: [olderVersion],
          total: 101,
          page: 2,
          page_size: 100,
        })
      referenceRpc.listProducts.mockResolvedValue(listResponse([]))

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      const versionPicker = await screen.findByRole("combobox", {
        name: "Phiên bản cấu hình cơ sở",
      })
      versionPicker.focus()
      fireEvent.keyDown(versionPicker, { key: "ArrowDown" })
      fireEvent.click(await screen.findByRole("option", { name: "Tải thêm phiên bản" }))

      await waitFor(() =>
        expect(baselineRpc.listVersions).toHaveBeenLastCalledWith({
          p_dossier_id: dossier.id,
          p_page: 2,
          p_page_size: 100,
        })
      )
      if (!screen.queryByRole("listbox")) {
        fireEvent.keyDown(versionPicker, { key: "ArrowDown" })
      }
      expect(
        await screen.findByRole("option", { name: "Phiên bản 1 · Đã khóa" })
      ).toBeInTheDocument()
    })

    it("supports zero products, reload, and explicit save without premature mutations", async () => {
      const user = userEvent.setup()
      const onDirtyChange = vi.fn()
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
      const created = product("product-1", "Model lưu", 6)
      referenceRpc.listProducts
        .mockResolvedValueOnce(listResponse([]))
        .mockResolvedValueOnce(listResponse([]))
        .mockResolvedValueOnce(listResponse([created]))
      referenceRpc.createProduct.mockResolvedValueOnce({ data: created })

      renderWithQueryClient(
        <TechnicalConfigurationReferenceProducts dossier={dossier} onDirtyChange={onDirtyChange} />
      )
      expect(await screen.findByText("Chưa có sản phẩm tham chiếu.")).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" }))
      await user.type(screen.getByLabelText("Model"), "Model tạm")
      expect(referenceRpc.createProduct).not.toHaveBeenCalled()
      await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))

      await user.click(screen.getByRole("button", { name: "Tải lại dữ liệu" }))
      await waitFor(() => expect(screen.queryByDisplayValue("Model tạm")).not.toBeInTheDocument())

      await user.click(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" }))
      await user.type(screen.getByLabelText("Model"), "Model lưu")
      expect(referenceRpc.createProduct).not.toHaveBeenCalled()
      await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

      await waitFor(() =>
        expect(referenceRpc.createProduct).toHaveBeenCalledWith({
          p_baseline_version_id: baselineVersion.id,
          p_model: "Model lưu",
          p_manufacturer: null,
          p_description: null,
          p_notes: null,
          p_expected_revision: baselineVersion.revision,
        })
      )
      expect(await screen.findByRole("columnheader", { name: "Model lưu" })).toBeInTheDocument()
      confirm.mockRestore()
    })

    it("preserves a dirty draft when the versions query selects a newer draft", async () => {
      const user = userEvent.setup()
      const newerVersion = {
        ...baselineVersion,
        id: "version-2",
        version_number: 2,
        revision: baselineVersion.revision + 1,
      }
      referenceRpc.listProducts.mockResolvedValue(listResponse([]))
      const { queryClient } = renderWithQueryClient(
        <TechnicalConfigurationReferenceProducts dossier={dossier} />
      )
      expect(await screen.findByText("Chưa có sản phẩm tham chiếu.")).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" }))
      await user.type(screen.getByLabelText("Model"), "Model chưa lưu")
      baselineRpc.listVersions.mockResolvedValueOnce({
        data: [newerVersion],
        total: 1,
        page: 1,
        page_size: 20,
      })

      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: technicalConfigurationBaselineVersionsQueryKey(dossier.id),
          exact: true,
        })
      })

      await waitFor(() => expect(baselineRpc.listVersions).toHaveBeenCalledTimes(2))
      expect(screen.getByDisplayValue("Model chưa lưu")).toBeInTheDocument()
      expect(screen.getByRole("combobox", { name: "Phiên bản cấu hình cơ sở" })).toHaveTextContent(
        "Phiên bản 1"
      )
    })

    it("keeps the product snapshot revision when baseline history refreshes independently", async () => {
      const user = userEvent.setup()
      const refreshedVersion = {
        ...baselineVersion,
        revision: baselineVersion.revision + 4,
      }
      const created = product("product-1", "Model lưu", baselineVersion.revision + 1)
      referenceRpc.listProducts.mockResolvedValue(listResponse([], baselineVersion.revision))
      referenceRpc.createProduct.mockResolvedValueOnce({ data: created })
      const { queryClient } = renderWithQueryClient(
        <TechnicalConfigurationReferenceProducts dossier={dossier} />
      )
      expect(await screen.findByText("Chưa có sản phẩm tham chiếu.")).toBeInTheDocument()

      baselineRpc.listVersions.mockResolvedValueOnce({
        data: [refreshedVersion],
        total: 1,
        page: 1,
        page_size: 20,
      })
      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: technicalConfigurationBaselineVersionsQueryKey(dossier.id),
          exact: true,
        })
      })
      await waitFor(() => expect(baselineRpc.listVersions).toHaveBeenCalledTimes(2))

      await user.click(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" }))
      await user.type(screen.getByLabelText("Model"), "Model lưu")
      await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

      await waitFor(() =>
        expect(referenceRpc.createProduct).toHaveBeenCalledWith(
          expect.objectContaining({
            p_expected_revision: baselineVersion.revision,
          })
        )
      )
    })

    it("preserves a dirty draft when reload confirmation is rejected", async () => {
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
      referenceRpc.listProducts.mockResolvedValue(listResponse([]))

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)
      expect(await screen.findByText("Chưa có sản phẩm tham chiếu.")).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" }))
      await user.type(screen.getByLabelText("Model"), "Model chưa lưu")
      await user.click(screen.getByRole("button", { name: "Tải lại dữ liệu" }))

      expect(confirm).toHaveBeenCalledWith(
        "Tải lại từ máy chủ sẽ thay thế các thay đổi chưa lưu. Tiếp tục?"
      )
      expect(referenceRpc.listProducts).toHaveBeenCalledTimes(1)
      expect(screen.getByDisplayValue("Model chưa lưu")).toBeInTheDocument()
      confirm.mockRestore()
    })

    it("registers beforeunload protection while the reference draft is dirty", async () => {
      const user = userEvent.setup()
      referenceRpc.listProducts.mockResolvedValue(listResponse([]))

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)
      expect(await screen.findByText("Chưa có sản phẩm tham chiếu.")).toBeInTheDocument()

      const cleanEvent = new Event("beforeunload", { cancelable: true })
      window.dispatchEvent(cleanEvent)
      expect(cleanEvent.defaultPrevented).toBe(false)

      await user.click(screen.getByRole("button", { name: "Thêm sản phẩm tham chiếu" }))
      await user.type(screen.getByLabelText("Model"), "Model chưa lưu")

      const dirtyEvent = new Event("beforeunload", { cancelable: true })
      window.dispatchEvent(dirtyEvent)
      expect(dirtyEvent.defaultPrevented).toBe(true)
    })

    it("renders locked reference products read-only without mutation affordances", async () => {
      const lockedVersion = {
        ...baselineVersion,
        status: "locked" as const,
        revision: 6,
        locked_at: "2026-07-17T01:00:00.000Z",
        locked_by: 1,
      }
      baselineRpc.listVersions.mockResolvedValue({
        data: [lockedVersion],
        total: 1,
        page: 1,
        page_size: 20,
      })
      referenceRpc.listProducts.mockResolvedValue(
        listResponse([product("product-1", "Model A", 6)])
      )

      renderWithQueryClient(<TechnicalConfigurationReferenceProducts dossier={dossier} />)

      const modelInput = await screen.findByDisplayValue("Model A")
      expect(modelInput).toHaveAttribute("readonly")
      expect(modelInput).not.toBeDisabled()
      modelInput.focus()
      expect(modelInput).toHaveFocus()
      expect(
        screen.queryByRole("button", { name: "Thêm sản phẩm tham chiếu" })
      ).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Lưu thay đổi" })).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Xóa Model A" })).not.toBeInTheDocument()
      await userEvent.setup().click(screen.getByRole("button", { name: "Tải lại dữ liệu" }))
      await waitFor(() => expect(referenceRpc.listProducts).toHaveBeenCalledTimes(2))
      const response = screen.getByLabelText("Phản hồi Model A cho TC-0001")
      expect(response).toHaveAttribute("readonly")
      expect(response).not.toBeDisabled()
      response.focus()
      expect(response).toHaveFocus()
    })

    it("preserves a dirty reference draft when dossier-back navigation is rejected", async () => {
      const user = userEvent.setup()
      const onBack = vi.fn()
      const nativeConfirm = vi.spyOn(window, "confirm").mockReturnValue(false)
      referenceRpc.listProducts.mockResolvedValue(listResponse([]))

      try {
        renderWithQueryClient(
          <TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={onBack} />
        )
        await user.click(screen.getByRole("tab", { name: "Sản phẩm tham chiếu" }))
        await user.click(await screen.findByRole("button", { name: "Thêm sản phẩm tham chiếu" }))
        await user.type(screen.getByLabelText("Model"), "Model chưa lưu")
        await user.click(screen.getByRole("button", { name: "Danh sách hồ sơ" }))

        expect(nativeConfirm).not.toHaveBeenCalled()
        await user.click(
          within(await screen.findByRole("alertdialog")).getByRole("button", {
            name: "Tiếp tục chỉnh sửa",
          })
        )
        expect(onBack).not.toHaveBeenCalled()
        expect(screen.getByDisplayValue("Model chưa lưu")).toBeInTheDocument()
      } finally {
        nativeConfirm.mockRestore()
      }
    })
  })
}
