import React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { downloadBlob } from "@/lib/excel-workbook"

import { useDeviceQuotaDraftCatalog } from "../../_hooks/useDeviceQuotaDraftCatalog"
import { isDeviceQuotaDraftCatalogRoleSupported } from "../../_hooks/deviceQuotaDraftCatalogAccess"
import { DeviceQuotaDraftCatalogPageClient } from "../_components/DeviceQuotaDraftCatalogPageClient"
import { serializeDeviceQuotaDraftCatalogWorkbook } from "../device-quota-draft-catalog-excel-export"
import { makeHookResult, makeSnapshot } from "./DeviceQuotaDraftCatalogExportTestSupport"
import { metadata } from "./DeviceQuotaDraftCatalogTestSupport"

vi.mock("@/hooks/use-tenant-branding", () => ({
  useTenantBranding: vi.fn(),
}))

vi.mock("@/lib/excel-workbook", () => ({
  downloadBlob: vi.fn(),
}))

vi.mock("../device-quota-draft-catalog-excel-export", async () => {
  const actual = await vi.importActual<typeof import("../device-quota-draft-catalog-excel-export")>(
    "../device-quota-draft-catalog-excel-export"
  )
  return {
    ...actual,
    serializeDeviceQuotaDraftCatalogWorkbook: vi.fn(),
  }
})

vi.mock("../../_hooks/useDeviceQuotaDraftCatalog", () => ({
  useDeviceQuotaDraftCatalog: vi.fn(),
}))

const mockUseDraftCatalog = vi.mocked(useDeviceQuotaDraftCatalog)
const mockUseTenantBranding = vi.mocked(useTenantBranding)
const mockSerializeWorkbook = vi.mocked(serializeDeviceQuotaDraftCatalogWorkbook)
const mockDownloadBlob = vi.mocked(downloadBlob)

type BrandingResult = ReturnType<typeof useTenantBranding>

function makeBrandingResult(overrides: Partial<BrandingResult> = {}): BrandingResult {
  return {
    data: {
      id: 23,
      name: "  Bệnh viện đa khoa tỉnh  ",
      logo_url: null,
      print_location: null,
    },
    isPending: false,
    isError: false,
    refetch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as BrandingResult
}

function renderPage(result = makeHookResult()) {
  mockUseDraftCatalog.mockReturnValue(result)
  const unitId = result.exportSnapshot?.unitId ?? result.donViId ?? 23
  mockUseTenantBranding.mockReturnValue(
    makeBrandingResult({
      data: {
        id: unitId,
        name: "  Bệnh viện đa khoa tỉnh  ",
        logo_url: null,
        print_location: null,
      },
    })
  )
  return render(<DeviceQuotaDraftCatalogPageClient />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSerializeWorkbook.mockResolvedValue(new Uint8Array([1, 2, 3]))
  mockDownloadBlob.mockImplementation(() => undefined)
})

describe("DeviceQuotaDraftCatalog export", () => {
  it.each(["global", "admin", "to_qltb"] as const)(
    "allows %s to export the current session unit once immediately before Save",
    async (role) => {
      const user = userEvent.setup()
      const hook = makeHookResult({
        canAccess: isDeviceQuotaDraftCatalogRoleSupported(role),
        donViId: 41,
        metadata: { ...metadata, unitId: 41 },
        exportSnapshot: makeSnapshot({ unitId: 41 }),
      })
      renderPage(hook)

      const toolbar = screen.getByTestId("device-quota-draft-catalog-toolbar")
      expect(
        within(toolbar)
          .getAllByRole("button")
          .map((button) => button.textContent)
      ).toEqual(["Xuất Excel", "Lưu"])

      await user.click(within(toolbar).getByRole("button", { name: "Xuất Excel" }))
      await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalledTimes(1))

      expect(mockSerializeWorkbook).toHaveBeenCalledTimes(1)
      expect(mockSerializeWorkbook).toHaveBeenCalledWith(
        expect.objectContaining({
          unitId: 41,
          unitName: "Bệnh viện đa khoa tỉnh",
          revision: 4,
          lastSavedAt: "2026-09-01T08:30:00.000Z",
          rows: hook.exportSnapshot?.rows,
        })
      )
      expect(hook.save).not.toHaveBeenCalled()
      expect(hook.retry).not.toHaveBeenCalled()
    }
  )

  it.each(["guest", "analyst"] as const)("hides export for unauthorized role %s", (role) => {
    expect(isDeviceQuotaDraftCatalogRoleSupported(role)).toBe(false)
    renderPage(
      makeHookResult({
        status: "blocked",
        canAccess: false,
        donViId: 23,
        metadata: null,
        exportSnapshot: null,
      })
    )

    expect(screen.queryByRole("button", { name: "Xuất Excel" })).not.toBeInTheDocument()
    expect(mockSerializeWorkbook).not.toHaveBeenCalled()
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })

  it("hides export in read-only mode without preparing a builder", () => {
    renderPage(makeHookResult({ isReadOnly: true }))

    expect(screen.queryByRole("button", { name: "Xuất Excel" })).not.toBeInTheDocument()
    expect(mockSerializeWorkbook).not.toHaveBeenCalled()
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })

  it.each([
    ["dirty", { isDirty: true }],
    ["saving", { isSaving: true }],
    ["excluding", { isExcluding: true }],
    ["restoring", { isRestoring: true }],
    ["recovering", { isRecovering: true }],
    ["missing snapshot", { exportSnapshot: null }],
  ] as const)("locks export while %s", (_state, overrides) => {
    renderPage(makeHookResult(overrides))

    const button = screen.getByRole("button", { name: "Xuất Excel" })
    expect(button).toBeDisabled()
    expect(mockSerializeWorkbook).not.toHaveBeenCalled()
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })

  it.each([
    ["missing", null],
    ["mismatched", { id: 99, name: "Đơn vị cũ" }],
    ["blank", { id: 23, name: "   " }],
  ] as const)("locks export for %s branding and offers retry", async (_state, branding) => {
    const user = userEvent.setup()
    const refetch = vi.fn().mockResolvedValue(undefined)
    mockUseDraftCatalog.mockReturnValue(makeHookResult())
    mockUseTenantBranding.mockReturnValue(makeBrandingResult({ data: branding, refetch }))
    render(<DeviceQuotaDraftCatalogPageClient />)

    expect(screen.getByRole("button", { name: "Xuất Excel" })).toBeDisabled()
    expect(
      screen.getByText("Thiếu hoặc không khớp thông tin đơn vị để xuất Excel.")
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Thử lại branding" }))
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(mockSerializeWorkbook).not.toHaveBeenCalled()
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })

  it("does not duplicate generation or download while export is pending", async () => {
    const user = userEvent.setup()
    let resolveWorkbook: (bytes: Uint8Array) => void = () => undefined
    mockSerializeWorkbook.mockImplementationOnce(
      () =>
        new Promise<Uint8Array>((resolve) => {
          resolveWorkbook = resolve
        })
    )
    renderPage()
    const button = screen.getByRole("button", { name: "Xuất Excel" })

    await user.click(button)
    expect(button).toBeDisabled()
    await user.click(button)
    expect(mockSerializeWorkbook).toHaveBeenCalledTimes(1)

    resolveWorkbook(new Uint8Array([1]))
    await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalledTimes(1))
  })

  it.each(["builder", "download"] as const)(
    "shows Vietnamese retry status for %s errors",
    async (kind) => {
      const user = userEvent.setup()
      if (kind === "builder") {
        mockSerializeWorkbook.mockRejectedValueOnce(new Error("builder failed"))
      } else {
        mockDownloadBlob.mockImplementationOnce(() => {
          throw new Error("download failed")
        })
      }
      const hook = makeHookResult()
      renderPage(hook)

      await user.click(screen.getByRole("button", { name: "Xuất Excel" }))
      await waitFor(() =>
        expect(screen.getByText("Không thể xuất file Excel. Vui lòng thử lại.")).toBeInTheDocument()
      )
      expect(screen.getByRole("button", { name: "Thử lại xuất Excel" })).toBeInTheDocument()
      expect(hook.save).not.toHaveBeenCalled()
      expect(hook.retry).not.toHaveBeenCalled()
      expect(mockDownloadBlob).toHaveBeenCalledTimes(kind === "download" ? 1 : 0)

      mockDownloadBlob.mockImplementation(() => undefined)
      await user.click(screen.getByRole("button", { name: "Thử lại xuất Excel" }))
      expect(mockSerializeWorkbook).toHaveBeenCalledTimes(2)
      await waitFor(() =>
        expect(mockDownloadBlob).toHaveBeenCalledTimes(kind === "download" ? 2 : 1)
      )
    }
  )

  it.each([
    ["user", { userId: "user-2" }],
    ["unit", { unitId: 99 }],
    ["snapshot", { revision: 5, lastSavedAt: "2026-09-01T09:30:00.000Z" }],
  ] as const)("aborts stale download when %s identity changes", async (_kind, change) => {
    const user = userEvent.setup()
    let resolveWorkbook: (bytes: Uint8Array) => void = () => undefined
    mockSerializeWorkbook.mockImplementationOnce(
      () =>
        new Promise<Uint8Array>((resolve) => {
          resolveWorkbook = resolve
        })
    )
    const first = makeHookResult()
    const { rerender } = renderPage(first)
    await user.click(screen.getByRole("button", { name: "Xuất Excel" }))

    const nextSnapshot = makeSnapshot({ ...change })
    mockUseDraftCatalog.mockReturnValue(
      makeHookResult({
        metadata: { ...metadata, unitId: nextSnapshot.unitId },
        exportSnapshot: nextSnapshot,
      })
    )
    rerender(<DeviceQuotaDraftCatalogPageClient />)
    resolveWorkbook(new Uint8Array([1]))

    await waitFor(() => expect(mockSerializeWorkbook).toHaveBeenCalledTimes(1))
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })

  it.each([
    ["missing userId", { canAccess: false, donViId: null, metadata: null }],
    ["invalid current unit", { canAccess: false, donViId: null, metadata: null }],
  ] as const)("does not prepare export for %s", (_state, overrides) => {
    renderPage(makeHookResult({ ...overrides, exportSnapshot: null }))

    expect(screen.queryByRole("button", { name: "Xuất Excel" })).not.toBeInTheDocument()
    expect(mockSerializeWorkbook).not.toHaveBeenCalled()
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })

  it("uses current_don_vi before don_vi for export identity", () => {
    const hook = makeHookResult({
      donViId: 41,
      metadata: { ...metadata, unitId: 41 },
      exportSnapshot: makeSnapshot({ unitId: 41 }),
    })
    renderPage(hook)

    expect(hook.exportSnapshot?.unitId).toBe(41)
    expect(mockUseTenantBranding).toHaveBeenCalledWith({
      formTenantId: 41,
      useFormContext: true,
    })
  })
})
