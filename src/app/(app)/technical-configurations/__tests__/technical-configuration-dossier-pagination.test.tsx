import fs from "node:fs"
import path from "node:path"

import * as React from "react"
import "@testing-library/jest-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  TechnicalConfigurationDossierListItemWire,
  TechnicalConfigurationDossierListRpcArgs,
  TechnicalConfigurationDossierListWireResponse,
} from "@/app/(app)/technical-configurations/types"
import { TechnicalConfigurationsClient } from "@/app/(app)/technical-configurations/TechnicalConfigurationsClient"
import {
  createQueryClient,
  dossier as baseDossier,
} from "./technical-configuration-dossier-actions-test-harness"

const mocks = vi.hoisted(() => ({
  listDossiers: vi.fn(),
  getDossier: vi.fn(),
  createDossier: vi.fn(),
  updateDossier: vi.fn(),
  deleteDossier: vi.fn(),
}))

vi.mock("../technical-configuration-rpc", () => ({
  listTechnicalConfigurationDossiers: (...args: unknown[]) => mocks.listDossiers(...args),
  getTechnicalConfigurationDossier: (...args: unknown[]) => mocks.getDossier(...args),
  createTechnicalConfigurationDossier: (...args: unknown[]) => mocks.createDossier(...args),
  updateTechnicalConfigurationDossier: (...args: unknown[]) => mocks.updateDossier(...args),
  deleteTechnicalConfigurationDossier: (...args: unknown[]) => mocks.deleteDossier(...args),
}))

const pageDossiers: Record<number, TechnicalConfigurationDossierListItemWire> = {
  1: {
    ...baseDossier,
    id: "dossier-page-1",
    name: "Hồ sơ trang 1",
  },
  2: {
    ...baseDossier,
    id: "dossier-page-2",
    name: "Hồ sơ trang 2",
  },
  3: {
    ...baseDossier,
    id: "dossier-page-3",
    name: "Hồ sơ trang 3",
  },
}

function renderClient(): void {
  const queryClient = createQueryClient()

  render(
    <QueryClientProvider client={queryClient}>
      <TechnicalConfigurationsClient role="global" />
    </QueryClientProvider>
  )
}

function expectListCall(call: number, page: number): void {
  expect(mocks.listDossiers).toHaveBeenNthCalledWith(
    call,
    {
      p_page: page,
      p_page_size: 20,
      p_include_archived: false,
    },
    expect.anything()
  )
}

describe("technical configuration dossier pagination", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.listDossiers.mockImplementation(
      ({ p_page = 1 }: TechnicalConfigurationDossierListRpcArgs) =>
        Promise.resolve({
          data: [pageDossiers[p_page]],
          total: 60,
          page: p_page,
          page_size: 20,
        } satisfies TechnicalConfigurationDossierListWireResponse)
    )
  })

  it("navigates through shared previous, next, first and last controls with isolated RPC pages", async () => {
    const user = userEvent.setup()
    renderClient()

    expect(await screen.findByText(pageDossiers[1].name)).toBeInTheDocument()
    expectListCall(1, 1)

    await user.click(screen.getByRole("button", { name: "Trang tiếp" }))
    expect(await screen.findByText(pageDossiers[2].name)).toBeInTheDocument()
    expectListCall(2, 2)

    await user.click(screen.getByRole("button", { name: "Đến trang cuối" }))
    expect(await screen.findByText(pageDossiers[3].name)).toBeInTheDocument()
    expectListCall(3, 3)

    await user.click(screen.getByRole("button", { name: "Trang trước" }))
    expect(await screen.findByText(pageDossiers[2].name)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Đến trang đầu" }))
    expect(await screen.findByText(pageDossiers[1].name)).toBeInTheDocument()
    await waitFor(() => expect(mocks.listDossiers).toHaveBeenCalledTimes(3))
  })

  it("returns to the previous page after deleting the last row on a later page", async () => {
    const user = userEvent.setup()
    let isDeleted = false
    mocks.listDossiers.mockImplementation(
      ({ p_page = 1 }: TechnicalConfigurationDossierListRpcArgs) =>
        Promise.resolve({
          data: p_page === 2 && isDeleted ? [] : [pageDossiers[p_page]],
          total: isDeleted ? 20 : 21,
          page: p_page,
          page_size: 20,
        } satisfies TechnicalConfigurationDossierListWireResponse)
    )
    mocks.deleteDossier.mockImplementation(async () => {
      isDeleted = true
      return { data: { id: pageDossiers[2].id } }
    })
    renderClient()

    expect(await screen.findByText(pageDossiers[1].name)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Trang tiếp" }))
    expect(await screen.findByText(pageDossiers[2].name)).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", {
        name: `Hành động cho ${pageDossiers[2].name}`,
      })
    )
    await user.click(await screen.findByRole("menuitem", { name: "Xóa vĩnh viễn" }))
    await user.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }))

    expect(mocks.deleteDossier).toHaveBeenCalledWith({
      p_id: pageDossiers[2].id,
      p_expected_revision: pageDossiers[2].revision,
    })
    expect(await screen.findByText(pageDossiers[1].name)).toBeInTheDocument()
    await waitFor(() => {
      expect(
        mocks.listDossiers.mock.calls
          .slice(2)
          .some(([args]) => (args as TechnicalConfigurationDossierListRpcArgs).p_page === 1)
      ).toBe(true)
    })
  })

  it("uses the shared navigation and server pagination contracts without local page math", () => {
    const moduleRoot = path.resolve(process.cwd(), "src/app/(app)/technical-configurations")
    const tableSource = fs.readFileSync(
      path.join(moduleRoot, "_components/TechnicalConfigurationDossierTable.tsx"),
      "utf8"
    )
    const clientSource = fs.readFileSync(
      path.join(moduleRoot, "TechnicalConfigurationsClient.tsx"),
      "utf8"
    )

    expect(tableSource).toContain("DataTablePagination.Navigation")
    expect(tableSource).not.toMatch(/\bChevron(?:Left|Right)\b/)
    expect(tableSource).not.toContain("Math.ceil")
    expect(clientSource).toContain("useServerPagination")
    expect(clientSource).toContain("p_page: dossierPagination.page")
    expect(clientSource).toContain("p_page_size: dossierPagination.pageSize")
  })
})
