import fs from "node:fs"
import path from "node:path"

import * as React from "react"
import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  TechnicalConfigurationDossierListItemWire,
  TechnicalConfigurationDossierListWireResponse,
  TechnicalConfigurationDossierWire,
  TechnicalConfigurationDossierWireResponse,
} from "../types"
import * as clientModule from "../TechnicalConfigurationsClient"

const MODULE_ROOT = path.resolve(process.cwd(), "src/app/(app)/technical-configurations")

const mocks = vi.hoisted(() => ({
  listDossiers: vi.fn(),
  getDossier: vi.fn(),
  createDossier: vi.fn(),
  deleteDossier: vi.fn(),
  updateDossier: vi.fn(),
}))

vi.mock("../technical-configuration-rpc", () => ({
  listTechnicalConfigurationDossiers: (...args: unknown[]) => mocks.listDossiers(...args),
  getTechnicalConfigurationDossier: (...args: unknown[]) => mocks.getDossier(...args),
  createTechnicalConfigurationDossier: (...args: unknown[]) => mocks.createDossier(...args),
  deleteTechnicalConfigurationDossier: (...args: unknown[]) => mocks.deleteDossier(...args),
  updateTechnicalConfigurationDossier: (...args: unknown[]) => mocks.updateDossier(...args),
}))

type TechnicalConfigurationsClientContract = React.ComponentType<{
  role?: string | null
}>

const TechnicalConfigurationsClient = (
  clientModule as { TechnicalConfigurationsClient?: TechnicalConfigurationsClientContract }
).TechnicalConfigurationsClient

const dossierOne: TechnicalConfigurationDossierListItemWire = {
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

const dossierTwo: TechnicalConfigurationDossierListItemWire = {
  ...dossierOne,
  id: "dossier-2",
  device_type_name: "Máy X-quang",
  name: "Cấu hình máy X-quang",
  description: null,
  revision: 3,
}

const defaultList: TechnicalConfigurationDossierListWireResponse = {
  data: [dossierOne, dossierTwo],
  total: 2,
  page: 1,
  page_size: 20,
}
const STALE_REVISION_MESSAGE =
  "Hồ sơ đã được cập nhật ở phiên khác. Dữ liệu mới nhất đã được nạp; kiểm tra và lưu lại để thử lại."
const STALE_REVISION_REFRESH_FAILED_MESSAGE =
  "Không thể nạp dữ liệu hồ sơ mới nhất sau khi phát hiện xung đột. Kiểm tra kết nối và thử lại."

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderClient() {
  expect(TechnicalConfigurationsClient).toEqual(expect.any(Function))
  if (!TechnicalConfigurationsClient) {
    return null
  }

  const queryClient = createQueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <TechnicalConfigurationsClient role="global" />
    </QueryClientProvider>
  )

  return queryClient
}

async function openEditAction(
  user: ReturnType<typeof userEvent.setup>,
  dossier: TechnicalConfigurationDossierWire
) {
  await screen.findByText(dossier.name)
  await user.click(
    screen.getByRole("button", {
      name: `Sửa metadata ${dossier.name}`,
    })
  )
}

describe("technical configuration dossier actions", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.listDossiers.mockResolvedValue(defaultList)
  })

  it("keeps row actions and mutation state in focused module files", () => {
    expect(
      fs.existsSync(
        path.join(MODULE_ROOT, "_components/TechnicalConfigurationDossierRowActions.tsx")
      )
    ).toBe(true)
    expect(
      fs.existsSync(path.join(MODULE_ROOT, "_hooks/useTechnicalConfigurationDossierActions.ts"))
    ).toBe(true)
  })

  it("opens edit for the intended row and cancels without mutation", async () => {
    const user = userEvent.setup()
    renderClient()

    const createButton = await screen.findByRole("button", { name: "Tạo hồ sơ" })
    await openEditAction(user, dossierTwo)

    expect(screen.getByRole("heading", { name: "Sửa metadata hồ sơ" })).toBeInTheDocument()
    expect(screen.getByLabelText("Loại thiết bị")).toHaveValue("Máy X-quang")
    expect(screen.getByLabelText("Tên hồ sơ")).toHaveValue("Cấu hình máy X-quang")
    expect(createButton).toBeDisabled()
    expect(mocks.updateDossier).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Hủy" }))

    expect(mocks.updateDossier).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Sửa metadata hồ sơ" })).not.toBeInTheDocument()
    })
  })

  it("keeps metadata editing available when the dossier carries a locked baseline field", async () => {
    const user = userEvent.setup()
    const dossierWithLockedBaseline = {
      ...dossierOne,
      baseline_locked_at: "2026-08-05T00:00:00.000Z",
    }
    mocks.listDossiers.mockResolvedValueOnce({
      data: [dossierWithLockedBaseline],
      total: 1,
      page: 1,
      page_size: 20,
    })
    renderClient()

    await openEditAction(user, dossierWithLockedBaseline)

    expect(screen.getByRole("heading", { name: "Sửa metadata hồ sơ" })).toBeInTheDocument()
    expect(screen.getByLabelText("Tên hồ sơ")).toHaveValue(dossierOne.name)
    expect(mocks.updateDossier).not.toHaveBeenCalled()
  })

  it("keeps failed API edits visible without changing the dossier row", async () => {
    const user = userEvent.setup()
    mocks.updateDossier.mockRejectedValueOnce(new Error("Mất kết nối"))
    renderClient()

    await openEditAction(user, dossierOne)
    await user.clear(screen.getByLabelText("Tên hồ sơ"))
    await user.type(screen.getByLabelText("Tên hồ sơ"), "Tên chưa được lưu")
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

    expect(await screen.findByText("Mất kết nối")).toBeInTheDocument()
    expect(screen.getByLabelText("Tên hồ sơ")).toHaveValue("Tên chưa được lưu")
    expect(screen.getByText(dossierOne.name)).toBeInTheDocument()
    expect(mocks.updateDossier).toHaveBeenCalledTimes(1)
  })

  it("reports a stale refresh failure without claiming that latest data was loaded", async () => {
    const user = userEvent.setup()
    mocks.updateDossier.mockRejectedValueOnce(new Error("stale_revision"))
    mocks.getDossier.mockRejectedValueOnce(new Error("Mất kết nối"))
    renderClient()

    await openEditAction(user, dossierOne)
    await user.clear(screen.getByLabelText("Tên hồ sơ"))
    await user.type(screen.getByLabelText("Tên hồ sơ"), "Tên chưa được lưu")
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

    expect(await screen.findByText(STALE_REVISION_REFRESH_FAILED_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText(STALE_REVISION_MESSAGE)).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Sửa metadata hồ sơ" })).toBeInTheDocument()
    expect(screen.getByLabelText("Tên hồ sơ")).toHaveValue("Tên chưa được lưu")
    expect(mocks.getDossier).toHaveBeenCalledWith(dossierOne.id)
  })

  it("keeps edited values visible after stale revision and retries explicitly", async () => {
    const user = userEvent.setup()
    const refreshedDossier: TechnicalConfigurationDossierWire = {
      ...dossierOne,
      name: "Tên mới từ phiên làm việc khác",
      revision: 8,
    }
    const updatedDossier: TechnicalConfigurationDossierWire = {
      ...dossierOne,
      name: "Cấu hình đang sửa",
      revision: 9,
    }
    mocks.listDossiers
      .mockResolvedValueOnce({
        data: [dossierOne],
        total: 1,
        page: 1,
        page_size: 20,
      })
      .mockResolvedValue({
        data: [updatedDossier],
        total: 1,
        page: 1,
        page_size: 20,
      })
    mocks.getDossier.mockResolvedValue({ data: refreshedDossier })
    mocks.updateDossier
      .mockRejectedValueOnce(new Error("stale_revision"))
      .mockResolvedValueOnce({ data: updatedDossier })
    renderClient()

    await openEditAction(user, dossierOne)
    await user.clear(screen.getByLabelText("Tên hồ sơ"))
    await user.type(screen.getByLabelText("Tên hồ sơ"), updatedDossier.name)
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

    expect(await screen.findByText(STALE_REVISION_MESSAGE)).toBeInTheDocument()
    expect(mocks.getDossier).toHaveBeenCalledWith(dossierOne.id)
    expect(screen.getByLabelText("Tên hồ sơ")).toHaveValue(updatedDossier.name)
    expect(mocks.updateDossier).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

    await waitFor(() => expect(mocks.updateDossier).toHaveBeenCalledTimes(2))
    expect(mocks.updateDossier).toHaveBeenLastCalledWith(
      expect.objectContaining({
        p_id: dossierOne.id,
        p_name: updatedDossier.name,
        p_expected_revision: 8,
      })
    )
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Sửa metadata hồ sơ" })).not.toBeInTheDocument()
    })
  })

  it("adopts the refreshed row revision before cancel and reopen after a stale conflict", async () => {
    const user = userEvent.setup()
    const refreshedDossier: TechnicalConfigurationDossierWire = {
      ...dossierOne,
      name: "Tên mới từ phiên làm việc khác",
      revision: 8,
    }
    mocks.listDossiers.mockResolvedValueOnce({
      data: [dossierOne],
      total: 1,
      page: 1,
      page_size: 20,
    })
    mocks.getDossier.mockResolvedValue({ data: refreshedDossier })
    mocks.updateDossier.mockRejectedValueOnce(new Error("stale_revision")).mockResolvedValueOnce({
      data: {
        ...refreshedDossier,
        revision: 9,
      },
    })
    renderClient()

    await openEditAction(user, dossierOne)
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))
    expect(await screen.findByText(STALE_REVISION_MESSAGE)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Hủy" }))
    expect(await screen.findByText(refreshedDossier.name)).toBeInTheDocument()

    await openEditAction(user, refreshedDossier)
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

    await waitFor(() => expect(mocks.updateDossier).toHaveBeenCalledTimes(2))
    expect(mocks.updateDossier).toHaveBeenLastCalledWith(
      expect.objectContaining({
        p_id: dossierOne.id,
        p_name: refreshedDossier.name,
        p_expected_revision: 8,
      })
    )
  })

  it("locks edit dismissal while the update is pending", async () => {
    const user = userEvent.setup()
    let resolveUpdate: ((response: TechnicalConfigurationDossierWireResponse) => void) | undefined
    mocks.listDossiers
      .mockResolvedValueOnce({
        data: [dossierOne],
        total: 1,
        page: 1,
        page_size: 20,
      })
      .mockResolvedValue(defaultList)
    mocks.updateDossier.mockReturnValue(
      new Promise<TechnicalConfigurationDossierWireResponse>((resolve) => {
        resolveUpdate = resolve
      })
    )
    renderClient()

    await openEditAction(user, dossierOne)
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

    await waitFor(() => expect(mocks.updateDossier).toHaveBeenCalledTimes(1))
    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Đóng" })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Sửa metadata hồ sơ" })).toBeInTheDocument()

    await act(async () => {
      resolveUpdate?.({ data: { ...dossierOne, revision: 8 } })
    })

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Sửa metadata hồ sơ" })).not.toBeInTheDocument()
    })
  })
})
