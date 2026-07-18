import fs from "node:fs"
import path from "node:path"

import * as React from "react"
import "@testing-library/jest-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  TechnicalConfigurationDossierListWireResponse,
  TechnicalConfigurationDossierWire,
  TechnicalConfigurationDossierWireResponse,
} from "../types"
import * as clientModule from "../TechnicalConfigurationsClient"
import * as pageModule from "../page"
import { TechnicalConfigurationDossierForm } from "../_components/TechnicalConfigurationDossierForm"
import { TechnicalConfigurationDossierTable } from "../_components/TechnicalConfigurationDossierTable"

const P3A_FILES = [
  "page.tsx",
  "TechnicalConfigurationsClient.tsx",
  "_components/TechnicalConfigurationWorkspaceShell.tsx",
  "_components/TechnicalConfigurationDossierTable.tsx",
  "_components/TechnicalConfigurationDossierForm.tsx",
] as const

const mocks = vi.hoisted(() => ({
  listDossiers: vi.fn(),
  getDossier: vi.fn(),
  createDossier: vi.fn(),
  pageRole: "global",
}))

vi.mock("@/app/(app)/_components/AuthenticatedPageBoundary", () => ({
  AuthenticatedPageBoundary: ({
    children,
  }: {
    children: (user: { role: string }) => React.ReactNode
  }) => <>{children({ role: mocks.pageRole })}</>,
}))

vi.mock("@/app/(app)/_components/AuthenticatedPageFallbacks", () => ({
  AuthenticatedPageSkeletonFallback: () => <div>Loading auth</div>,
}))

vi.mock("../technical-configuration-rpc", () => ({
  listTechnicalConfigurationDossiers: (...args: unknown[]) => mocks.listDossiers(...args),
  getTechnicalConfigurationDossier: (...args: unknown[]) => mocks.getDossier(...args),
  createTechnicalConfigurationDossier: (...args: unknown[]) => mocks.createDossier(...args),
}))

type TechnicalConfigurationsClientContract = React.ComponentType<{
  role?: string | null
}>

const TechnicalConfigurationsClient = (
  clientModule as { TechnicalConfigurationsClient?: TechnicalConfigurationsClientContract }
).TechnicalConfigurationsClient

const TechnicalConfigurationsPage = (pageModule as { default?: React.ComponentType }).default

const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy siêu âm",
  name: "Cấu hình máy siêu âm",
  description: "Cấu hình chuẩn",
  revision: 1,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-13T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-13T00:00:00.000Z",
  updated_by: 1,
}

const emptyList: TechnicalConfigurationDossierListWireResponse = {
  data: [],
  total: 0,
  page: 1,
  page_size: 20,
}

function renderWithQueryClient(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>)

  return queryClient
}

function renderClient(role: string) {
  expect(TechnicalConfigurationsClient).toEqual(expect.any(Function))
  if (!TechnicalConfigurationsClient) return

  return renderWithQueryClient(<TechnicalConfigurationsClient role={role} />)
}

describe("technical configuration dossier shell", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pageRole = "global"
    mocks.listDossiers.mockResolvedValue(emptyList)
  })

  it("keeps the P3A route, orchestrator and views in separate files", () => {
    const moduleRoot = path.resolve(process.cwd(), "src/app/(app)/technical-configurations")

    expect(P3A_FILES.map((file) => fs.existsSync(path.join(moduleRoot, file)))).toEqual(
      P3A_FILES.map(() => true)
    )
  })

  it("uses the shared auth boundary and isGlobalRole without a direct global comparison", () => {
    const moduleRoot = path.resolve(process.cwd(), "src/app/(app)/technical-configurations")
    const pageSource = fs.readFileSync(path.join(moduleRoot, "page.tsx"), "utf8")
    const clientSource = fs.readFileSync(
      path.join(moduleRoot, "TechnicalConfigurationsClient.tsx"),
      "utf8"
    )

    expect(pageSource).toMatch(/^"use client"/)
    expect(pageSource).toContain("AuthenticatedPageBoundary")
    expect(clientSource).toContain("isGlobalRole")
    expect(clientSource).not.toMatch(/role\s*===\s*["']global["']/)
  })

  it("forwards the authenticated route role into the module boundary", () => {
    expect(TechnicalConfigurationsPage).toEqual(expect.any(Function))
    if (!TechnicalConfigurationsPage) return

    mocks.pageRole = "regional_leader"
    renderWithQueryClient(<TechnicalConfigurationsPage />)

    expect(screen.getByRole("heading", { name: "Truy cập bị hạn chế" })).toBeInTheDocument()
    expect(mocks.listDossiers).not.toHaveBeenCalled()
  })

  it.each(["global", "admin"])("loads the dossier list for %s", async (role) => {
    renderClient(role)

    expect(await screen.findByRole("heading", { name: "Cấu hình kỹ thuật" })).toBeInTheDocument()
    await waitFor(() => expect(mocks.listDossiers).toHaveBeenCalledTimes(1))
    expect(await screen.findByText("Chưa có hồ sơ cấu hình")).toBeInTheDocument()
  })

  it("shows an unauthorized state without loading data for a denied role", () => {
    renderClient("regional_leader")

    expect(screen.getByRole("heading", { name: "Truy cập bị hạn chế" })).toBeInTheDocument()
    expect(mocks.listDossiers).not.toHaveBeenCalled()
  })

  it("shows a stable loading state while the dossier list is pending", () => {
    mocks.listDossiers.mockReturnValue(new Promise(() => undefined))

    renderClient("global")

    expect(screen.getByLabelText("Đang tải hồ sơ cấu hình")).toBeInTheDocument()
  })

  it("creates only after explicit save and opens the created dossier shell", async () => {
    const user = userEvent.setup()
    const createResponse: TechnicalConfigurationDossierWireResponse = { data: dossier }
    mocks.createDossier.mockResolvedValue(createResponse)

    renderClient("global")

    await user.click(await screen.findByRole("button", { name: "Tạo hồ sơ" }))
    await user.type(screen.getByLabelText("Loại thiết bị"), dossier.device_type_name)
    await user.type(screen.getByLabelText("Tên hồ sơ"), dossier.name)
    await user.type(screen.getByLabelText("Mô tả"), dossier.description ?? "")

    expect(mocks.createDossier).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }))

    await waitFor(() =>
      expect(mocks.createDossier).toHaveBeenCalledWith({
        p_device_type_name: dossier.device_type_name,
        p_name: dossier.name,
        p_description: dossier.description,
        p_expected_revision: 0,
      })
    )

    expect(await screen.findByRole("heading", { name: dossier.name })).toBeInTheDocument()
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent?.trim())).toEqual([
      "Cấu hình cơ sở",
      "Tài liệu & trích dẫn",
      "Sản phẩm tham chiếu",
      "Phương án",
      "So sánh & đánh giá",
    ])
    expect(screen.getByRole("tab", { name: "Phương án" })).toBeDisabled()
    expect(screen.getByRole("tab", { name: "So sánh & đánh giá" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Thêm nhóm" })).not.toBeInTheDocument()
  })

  it("gets the selected dossier before opening its workspace", async () => {
    const user = userEvent.setup()
    mocks.listDossiers.mockResolvedValue({
      data: [dossier],
      total: 1,
      page: 1,
      page_size: 20,
    } satisfies TechnicalConfigurationDossierListWireResponse)
    mocks.getDossier.mockResolvedValue({
      data: dossier,
    } satisfies TechnicalConfigurationDossierWireResponse)

    const queryClient = renderClient("admin")

    await user.click(await screen.findByRole("button", { name: `Mở ${dossier.name}` }))

    await waitFor(() => expect(mocks.getDossier).toHaveBeenCalledWith(dossier.id))
    expect(await screen.findByRole("heading", { name: dossier.name })).toBeInTheDocument()
    expect(
      queryClient?.getQueryData(["technical-configurations", "dossiers", "detail", dossier.id])
    ).toEqual({ data: dossier })
  })

  it("does not restore an earlier open error after create and back", async () => {
    const user = userEvent.setup()
    const createdDossier = { ...dossier, id: "dossier-created", name: "Hồ sơ mới" }
    mocks.listDossiers.mockResolvedValue({ ...emptyList, data: [dossier], total: 1 })
    mocks.getDossier.mockRejectedValue(new Error("Hồ sơ cũ không thể mở"))
    mocks.createDossier.mockResolvedValue({ data: createdDossier })

    renderClient("global")

    await user.click(await screen.findByRole("button", { name: `Mở ${dossier.name}` }))
    expect(await screen.findByText("Hồ sơ cũ không thể mở")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Tạo hồ sơ" }))
    await user.type(screen.getByLabelText("Loại thiết bị"), createdDossier.device_type_name)
    await user.type(screen.getByLabelText("Tên hồ sơ"), createdDossier.name)
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }))
    await user.click(await screen.findByRole("button", { name: "Danh sách hồ sơ" }))

    expect(screen.queryByText("Hồ sơ cũ không thể mở")).not.toBeInTheDocument()
  })

  it("blocks a second dossier open while the first request is pending", async () => {
    const user = userEvent.setup()
    const secondDossier = {
      ...dossier,
      id: "dossier-2",
      name: "Cấu hình máy X-quang",
    }
    mocks.listDossiers.mockResolvedValue({
      data: [dossier, secondDossier],
      total: 2,
      page: 1,
      page_size: 20,
    } satisfies TechnicalConfigurationDossierListWireResponse)
    mocks.getDossier.mockReturnValue(new Promise(() => undefined))

    renderClient("global")

    const firstOpenButton = await screen.findByRole("button", { name: `Mở ${dossier.name}` })
    const secondOpenButton = screen.getByRole("button", { name: `Mở ${secondDossier.name}` })
    await user.click(firstOpenButton)

    expect(firstOpenButton).toBeDisabled()
    expect(secondOpenButton).toBeDisabled()
    expect(screen.getByRole("button", { name: "Tạo hồ sơ" })).toBeDisabled()
  })

  it("keeps create form values visible when explicit save fails", async () => {
    const user = userEvent.setup()
    mocks.createDossier.mockRejectedValue(new Error("Tên hồ sơ đã tồn tại"))

    renderClient("global")

    await user.click(await screen.findByRole("button", { name: "Tạo hồ sơ" }))
    await user.type(screen.getByLabelText("Loại thiết bị"), dossier.device_type_name)
    await user.type(screen.getByLabelText("Tên hồ sơ"), dossier.name)
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }))

    expect(await screen.findByText("Tên hồ sơ đã tồn tại")).toBeInTheDocument()
    expect(screen.getByLabelText("Tên hồ sơ")).toHaveValue(dossier.name)
  })

  it("keeps the create dialog open when dismiss is requested during save", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <TechnicalConfigurationDossierForm
        open
        isSubmitting
        errorMessage={null}
        onOpenChange={onOpenChange}
        onSubmit={vi.fn()}
      />
    )

    await user.keyboard("{Escape}")

    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("offers a way back when a now-empty later page is returned", async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()

    render(
      <TechnicalConfigurationDossierTable
        dossiers={[]}
        isLoading={false}
        openingDossierId={null}
        page={2}
        pageSize={20}
        total={1}
        onOpen={vi.fn()}
        onPageChange={onPageChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Quay lại trang trước" }))

    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it("keeps the route and client orchestrators below the extraction threshold", () => {
    const moduleRoot = path.resolve(process.cwd(), "src/app/(app)/technical-configurations")

    for (const file of [
      "page.tsx",
      "TechnicalConfigurationsClient.tsx",
      "_components/TechnicalConfigurationWorkspaceShell.tsx",
    ]) {
      const lineCount = fs.readFileSync(path.join(moduleRoot, file), "utf8").split("\n").length
      expect(lineCount).toBeLessThan(350)
    }
  })
})
