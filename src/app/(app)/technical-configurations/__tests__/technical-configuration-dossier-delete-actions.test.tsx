import * as React from "react"
import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  TechnicalConfigurationDossierDeleteWireResponse,
  TechnicalConfigurationDossierListItemWire,
  TechnicalConfigurationDossierListWireResponse,
} from "../types"
import { TechnicalConfigurationsClient } from "../TechnicalConfigurationsClient"

const LOCKED_DELETE_REASON = "Hồ sơ có baseline đã khóa nên được bảo toàn vĩnh viễn."

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

vi.mock("@/components/ui/tooltip", async () => {
  const { tooltipMockModule } = await import("@/test-utils/tooltip-mock-module")
  return tooltipMockModule
})

const deletableDossier: TechnicalConfigurationDossierListItemWire = {
  id: "dossier-1",
  device_type_name: "Máy siêu âm",
  name: "Cấu hình máy siêu âm",
  description: "Cấu hình chuẩn",
  revision: 7,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-13T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-13T00:00:00.000Z",
  updated_by: 1,
  can_delete: true,
}

const retainedDossier: TechnicalConfigurationDossierListItemWire = {
  ...deletableDossier,
  id: "dossier-2",
  name: "Cấu hình máy X-quang",
  revision: 3,
}

const defaultList: TechnicalConfigurationDossierListWireResponse = {
  data: [deletableDossier, retainedDossier],
  total: 2,
  page: 1,
  page_size: 20,
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderClient() {
  const queryClient = createQueryClient()

  render(
    <QueryClientProvider client={queryClient}>
      <TechnicalConfigurationsClient />
    </QueryClientProvider>
  )

  return queryClient
}

async function openDeleteDialog(
  user: ReturnType<typeof userEvent.setup>,
  dossier: TechnicalConfigurationDossierListItemWire
) {
  await screen.findByText(dossier.name)
  await user.click(
    screen.getByRole("button", {
      name: `Xóa vĩnh viễn ${dossier.name}`,
    })
  )
}

describe("technical configuration dossier delete actions", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.listDossiers.mockResolvedValue(defaultList)
  })

  it("shows open, edit and delete as always-visible icon actions with tooltips", async () => {
    const user = userEvent.setup()
    renderClient()

    await screen.findByText(deletableDossier.name)
    const openAction = screen.getByRole("button", {
      name: `Mở ${deletableDossier.name}`,
    })
    const editAction = screen.getByRole("button", {
      name: `Sửa metadata ${deletableDossier.name}`,
    })
    const deleteAction = screen.getByRole("button", {
      name: `Xóa vĩnh viễn ${deletableDossier.name}`,
    })

    expect(
      screen.queryByRole("button", {
        name: `Hành động cho ${deletableDossier.name}`,
      })
    ).not.toBeInTheDocument()
    expect(openAction).toHaveTextContent("")
    expect(editAction).toHaveTextContent("")
    expect(deleteAction).toHaveTextContent("")

    await user.hover(openAction)
    expect(await screen.findByRole("tooltip", { name: "Mở hồ sơ" })).toBeInTheDocument()

    await user.hover(editAction)
    expect(await screen.findByRole("tooltip", { name: "Sửa metadata" })).toBeInTheDocument()

    await user.hover(deleteAction)
    expect(await screen.findByRole("tooltip", { name: "Xóa vĩnh viễn" })).toBeInTheDocument()
  })

  it("keeps an ineligible delete visible with an accessible reason and leaves edit available", async () => {
    const user = userEvent.setup()
    const lockedDossier = {
      ...deletableDossier,
      can_delete: false,
    }
    mocks.listDossiers.mockResolvedValueOnce({
      data: [lockedDossier],
      total: 1,
      page: 1,
      page_size: 20,
    })
    renderClient()

    await screen.findByText(lockedDossier.name)
    const deleteAction = screen.getByRole("button", {
      name: `Xóa vĩnh viễn ${lockedDossier.name}`,
    })
    await user.click(deleteAction)
    expect(deleteAction).toHaveFocus()
    expect(deleteAction).toHaveAttribute("aria-disabled", "true")
    expect(deleteAction).toHaveAccessibleDescription(LOCKED_DELETE_REASON)

    expect(await screen.findByRole("tooltip", { name: LOCKED_DELETE_REASON })).toBeInTheDocument()
    await user.keyboard("{Enter}")
    await user.keyboard(" ")

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(mocks.deleteDossier).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole("button", {
        name: `Sửa metadata ${lockedDossier.name}`,
      })
    )
    expect(screen.getByRole("heading", { name: "Sửa metadata hồ sơ" })).toBeInTheDocument()
  })

  it("does not mutate before confirmation and sends the current row revision", async () => {
    const user = userEvent.setup()
    mocks.listDossiers.mockResolvedValueOnce(defaultList).mockResolvedValue({
      data: [retainedDossier],
      total: 1,
      page: 1,
      page_size: 20,
    })
    mocks.deleteDossier.mockResolvedValue({
      data: { id: deletableDossier.id },
    } satisfies TechnicalConfigurationDossierDeleteWireResponse)
    renderClient()

    await openDeleteDialog(user, deletableDossier)

    expect(mocks.deleteDossier).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toHaveTextContent(deletableDossier.name)

    await user.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }))

    expect(mocks.deleteDossier).toHaveBeenCalledWith({
      p_id: deletableDossier.id,
      p_expected_revision: deletableDossier.revision,
    })
    await waitFor(() => {
      expect(screen.queryByText(deletableDossier.name)).not.toBeInTheDocument()
    })
    expect(screen.getByText(retainedDossier.name)).toBeInTheDocument()
  })

  it.each([
    ["locked_dossier", "Hồ sơ đã có baseline khóa nên được bảo toàn vĩnh viễn."],
    [
      "stale_revision",
      "Hồ sơ đã được cập nhật ở phiên khác. Đóng xác nhận, tải lại danh sách và thử lại.",
    ],
    ["archived_dossier", "Hồ sơ đã được lưu trữ nên không thể xóa vĩnh viễn."],
    ["not_found", "Không còn tìm thấy hồ sơ này."],
    ["Mất kết nối", "Mất kết nối"],
  ])("keeps state unchanged when delete fails with %s", async (errorMessage, expectedMessage) => {
    const user = userEvent.setup()
    mocks.listDossiers.mockResolvedValueOnce({
      data: [deletableDossier],
      total: 1,
      page: 1,
      page_size: 20,
    })
    mocks.deleteDossier.mockRejectedValueOnce(new Error(errorMessage))
    renderClient()

    await openDeleteDialog(user, deletableDossier)
    await user.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage)
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByRole("table", { hidden: true })).toHaveTextContent(deletableDossier.name)
    expect(mocks.deleteDossier).toHaveBeenCalledTimes(1)
  })

  it("locks competing actions while the confirmed delete is pending", async () => {
    const user = userEvent.setup()
    let resolveDelete:
      ((response: TechnicalConfigurationDossierDeleteWireResponse) => void) | undefined
    mocks.listDossiers.mockResolvedValueOnce(defaultList).mockResolvedValue({
      data: [retainedDossier],
      total: 1,
      page: 1,
      page_size: 20,
    })
    mocks.deleteDossier.mockReturnValue(
      new Promise<TechnicalConfigurationDossierDeleteWireResponse>((resolve) => {
        resolveDelete = resolve
      })
    )
    renderClient()

    await openDeleteDialog(user, deletableDossier)
    await user.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }))

    await waitFor(() => expect(mocks.deleteDossier).toHaveBeenCalledTimes(1))
    expect(screen.getByRole("button", { name: "Xóa vĩnh viễn" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }))
    expect(mocks.deleteDossier).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveDelete?.({ data: { id: deletableDossier.id } })
    })

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    })
  })
})
