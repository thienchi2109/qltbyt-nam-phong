import * as React from "react"
import "@testing-library/jest-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationsClient } from "../TechnicalConfigurationsClient"
import { technicalConfigurationDossierListQueryKey } from "../technical-configuration-query-keys"
import {
  createQueryClient,
  dossier,
  buildDossierListPage,
} from "./technical-configuration-dossier-actions-test-harness"
import type {
  TechnicalConfigurationDossierListRpcArgs,
  TechnicalConfigurationDossierSpecialtiesRpcArgs,
} from "../types"

const mocks = vi.hoisted(() => ({ list: vi.fn(), options: vi.fn() }))
vi.mock("../technical-configuration-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../technical-configuration-rpc")>()),
  listTechnicalConfigurationDossiers: (...args: unknown[]) => mocks.list(...args),
  listTechnicalConfigurationDossierSpecialties: (...args: unknown[]) => mocks.options(...args),
}))

function renderClient() {
  const queryClient = createQueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <TechnicalConfigurationsClient />
    </QueryClientProvider>
  )
  return queryClient
}

describe("dossier specialty UI", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockImplementation((args: TechnicalConfigurationDossierListRpcArgs) =>
      Promise.resolve(
        buildDossierListPage(
          args,
          [dossier, { ...dossier, id: "null", name: "Hồ sơ chưa phân loại", specialty: null }],
          40
        )
      )
    )
    mocks.options.mockImplementation((args: TechnicalConfigurationDossierSpecialtiesRpcArgs) =>
      Promise.resolve({
        data: args.p_page === 1 ? ["Tim mạch"] : ["Thần kinh", "Tất cả", "Chưa phân loại"],
        total: 4,
        page: args.p_page,
        page_size: 100,
      })
    )
  })

  it("renders specialty cells and saved suggestions beyond the first options page", async () => {
    const user = userEvent.setup()
    renderClient()
    expect(await screen.findByRole("columnheader", { name: "Chuyên khoa" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "Chưa phân loại" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "Tim mạch" })).toBeInTheDocument()
    await waitFor(() =>
      expect(mocks.options).toHaveBeenCalledWith(
        expect.objectContaining({ p_page: 2 }),
        expect.any(AbortSignal)
      )
    )
    await user.click(screen.getByRole("button", { name: "Tạo hồ sơ" }))
    const input = screen.getByLabelText("Chuyên khoa")
    const suggestions = document.getElementById(input.getAttribute("list") ?? "")
    expect(suggestions?.querySelector('option[value="Thần kinh"]')).toBeInTheDocument()
  })

  it("filters on the server, replaces selection, resets page and preserves search when clearing", async () => {
    const user = userEvent.setup()
    const queryClient = renderClient()
    const search = screen.getByPlaceholderText("Tìm theo loại thiết bị hoặc tên hồ sơ...")
    await user.type(search, "siêu âm")
    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith(
        expect.objectContaining({ p_search: "sieu am" }),
        expect.any(AbortSignal)
      )
    )
    await user.click(screen.getByRole("button", { name: "Trang tiếp" }))
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ p_page: 2 }),
        expect.any(AbortSignal)
      )
    )
    await user.click(screen.getByRole("button", { name: "Chuyên khoa" }))
    await user.click(await screen.findByRole("button", { name: "Thần kinh", exact: true }))
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          p_page: 1,
          p_search: "sieu am",
          p_filter_specialty: true,
          p_specialty: "Thần kinh",
        }),
        expect.any(AbortSignal)
      )
    )
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Chuyên khoa1")
    await user.click(screen.getByRole("button", { name: "Chưa phân loại", exact: true }))
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ p_filter_specialty: true, p_specialty: null }),
        expect.any(AbortSignal)
      )
    )
    expect(screen.getByRole("button", { name: "Thần kinh", exact: true })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    await user.click(screen.getByRole("button", { name: "Xóa bộ lọc" }))
    await waitFor(() =>
      expect(
        queryClient
          .getQueryCache()
          .find({
            queryKey: technicalConfigurationDossierListQueryKey({
              page: 1,
              pageSize: 20,
              normalizedSearch: "sieu am",
            }),
            exact: true,
          })
          ?.isActive()
      ).toBe(true)
    )
    expect(search).toHaveValue("siêu âm")
    await user.click(screen.getByRole("button", { name: "Tim mạch", exact: true }))
    await user.click(screen.getByRole("button", { name: "Tất cả", exact: true }))
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveAccessibleName("Chuyên khoa"))
  })

  it("keeps literal labels separate from synthetic all and null choices", async () => {
    const user = userEvent.setup()
    renderClient()
    await user.click(screen.getByRole("button", { name: "Chuyên khoa" }))
    await user.click(
      await screen.findByRole("button", { name: "Chưa phân loại (nhãn)", exact: true })
    )
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ p_specialty: "Chưa phân loại", p_filter_specialty: true }),
        expect.any(AbortSignal)
      )
    )
    await user.click(screen.getByRole("button", { name: "Tất cả (nhãn)", exact: true }))
    await waitFor(() =>
      expect(mocks.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ p_specialty: "Tất cả", p_filter_specialty: true }),
        expect.any(AbortSignal)
      )
    )
  })

  it("reports failed suggestions and retries without preventing free text entry", async () => {
    const user = userEvent.setup()
    mocks.options.mockRejectedValueOnce(new Error("offline"))
    renderClient()
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Không thể tải gợi ý chuyên khoa")
    await user.click(within(alert).getByRole("button", { name: "Thử lại chuyên khoa" }))
    await waitFor(() =>
      expect(screen.queryByText("Không thể tải gợi ý chuyên khoa.")).not.toBeInTheDocument()
    )
    await user.click(screen.getByRole("button", { name: "Tạo hồ sơ" }))
    await user.type(screen.getByLabelText("Chuyên khoa"), "Nhãn mới")
    expect(screen.getByLabelText("Chuyên khoa")).toHaveValue("Nhãn mới")
  })
})
