import React from "react"
import { render, act, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"

import { DeviceQuotaCategoryImportDialog } from "../_components/DeviceQuotaCategoryImportDialog"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"
import { readExcelFile, worksheetToJson } from "@/lib/excel-utils"
import { callRpc } from "@/lib/rpc-client"
import type { CategoryListItem } from "../_types/categories"

let capturedMutationOptions: {
  onSuccess?: (result: {
    success: boolean
    inserted: number
    failed: number
    total: number
    details: Array<{ ma_nhom: string; success: boolean; error?: string }>
  }) => Promise<void> | void
} | null = null

const mockInvalidateQueries = vi.fn()
const mockToast = vi.fn()

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query")

  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
    useMutation: (options: typeof capturedMutationOptions) => {
      capturedMutationOptions = options
      return {
        mutate: vi.fn(),
        isPending: false,
      }
    },
  }
})

vi.mock("../_hooks/useDeviceQuotaCategoryContext", () => ({
  useDeviceQuotaCategoryContext: vi.fn(),
}))

vi.mock("@/lib/excel-utils", () => ({
  readExcelFile: vi.fn(),
  worksheetToJson: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockUseContext = vi.mocked(useDeviceQuotaCategoryContext)
const mockCallRpc = vi.mocked(callRpc)
const mockReadExcelFile = vi.mocked(readExcelFile)
const mockWorksheetToJson = vi.mocked(worksheetToJson)

type DeviceQuotaCategoryContextValue = ReturnType<typeof useDeviceQuotaCategoryContext>

function createMockContextValue(
  overrides: Partial<DeviceQuotaCategoryContextValue> = {}
): DeviceQuotaCategoryContextValue {
  const allCategories: CategoryListItem[] = []

  return {
    user: null,
    donViId: 1,
    categories: [],
    allCategories,
    isLoading: false,
    searchTerm: "",
    setSearchTerm: vi.fn(),
    dialogState: { mode: "closed" },
    mutatingCategoryId: null,
    categoryToDelete: null,
    openCreateDialog: vi.fn(),
    openEditDialog: vi.fn(),
    closeDialog: vi.fn(),
    openDeleteDialog: vi.fn(),
    closeDeleteDialog: vi.fn(),
    createMutation: { isPending: false } as DeviceQuotaCategoryContextValue["createMutation"],
    updateMutation: { isPending: false } as DeviceQuotaCategoryContextValue["updateMutation"],
    deleteMutation: { isPending: false } as DeviceQuotaCategoryContextValue["deleteMutation"],
    isImportDialogOpen: true,
    openImportDialog: vi.fn(),
    closeImportDialog: vi.fn(),
    getDescendantIds: vi.fn(() => new Set<number>()),
    ...overrides,
  }
}

describe("DeviceQuotaCategoryImportDialog", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    capturedMutationOptions = null

    mockUseContext.mockReturnValue(createMockContextValue())
    mockCallRpc.mockResolvedValue({
      success: true,
      inserted: 0,
      failed: 0,
      total: 0,
      details: [],
    })
  })

  it("invalidates category queries after successful import", async () => {
    render(<DeviceQuotaCategoryImportDialog />)

    expect(capturedMutationOptions?.onSuccess).toBeTypeOf("function")

    await act(async () => {
      await capturedMutationOptions?.onSuccess?.({
        success: true,
        inserted: 1,
        failed: 0,
        total: 1,
        details: [],
      })
    })

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["dinh_muc_nhom_list"] })
    expect(mockInvalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["dinh_muc_nhom_list_paginated"] })
  })

  it("warns duplicate codes from the unpaginated category list with Vietnamese diacritics", async () => {
    mockUseContext.mockReturnValue(
      createMockContextValue({
        allCategories: [
          {
            id: 2,
            parent_id: null,
            ma_nhom: "DM02",
            ten_nhom: "Danh mục 2",
            phan_loai: "B",
            don_vi_tinh: "Cái",
            thu_tu_hien_thi: 0,
            level: 1,
            so_luong_hien_co: 0,
            so_luong_toi_da: null,
            so_luong_toi_thieu: null,
            mo_ta: null,
          },
        ],
      })
    )

    mockReadExcelFile.mockResolvedValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    } as Awaited<ReturnType<typeof readExcelFile>>)
    mockWorksheetToJson.mockResolvedValue([
      {
        "Ma nhom": "DM02",
        "Ten nhom": "Danh mục 2",
      },
    ])

    render(<DeviceQuotaCategoryImportDialog />)

    const file = new File(["dummy"], "categories.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    fireEvent.change(screen.getByLabelText("Chọn file Excel"), {
      target: { files: [file] },
    })

    await waitFor(() => {
      expect(screen.getByText(/đã tồn tại - sẽ bị bỏ qua/i)).toBeInTheDocument()
    })
  })

  it("shows the plain-object parse error message when Excel parsing fails", async () => {
    mockReadExcelFile.mockRejectedValueOnce({ message: "File bị hỏng" })

    render(<DeviceQuotaCategoryImportDialog />)

    const file = new File(["dummy"], "broken.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    fireEvent.change(screen.getByLabelText("Chọn file Excel"), {
      target: { files: [file] },
    })

    await waitFor(() => {
      expect(screen.getByText("File bị hỏng")).toBeInTheDocument()
    })
  })

  it("uses inserted quota count from dinh_muc_unified_import result in success message", async () => {
    mockReadExcelFile.mockResolvedValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    } as Awaited<ReturnType<typeof readExcelFile>>)
    mockWorksheetToJson.mockResolvedValue([
      {
        "Ma nhom": "DM001",
        "Ten nhom": "Danh mục 1",
        "Dinh muc": 10,
        "Toi thieu": 2,
      },
      {
        "Ma nhom": "DM002",
        "Ten nhom": "Danh mục 2",
        "Dinh muc": 5,
        "Toi thieu": 0,
      },
    ])

    // Quota import mock — consumed by callRpc inside onSuccess
    mockCallRpc.mockResolvedValueOnce({
      success: true,
      inserted: 1,
      failed: 1,
      total: 2,
      details: [],
    })

    render(<DeviceQuotaCategoryImportDialog />)

    const file = new File(["dummy"], "categories-with-quota.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    fireEvent.change(screen.getByLabelText("Chọn file Excel"), {
      target: { files: [file] },
    })

    await waitFor(() => {
      expect(screen.getByText(/sẵn sàng nhập/i)).toBeInTheDocument()
    })

    expect(capturedMutationOptions?.onSuccess).toBeTypeOf("function")

    // Simulate category import result: 2 new categories inserted
    await act(async () => {
      await capturedMutationOptions?.onSuccess?.({
        success: true,
        inserted: 2,
        failed: 0,
        total: 2,
        details: [
          { ma_nhom: "DM001", success: true },
          { ma_nhom: "DM002", success: true },
        ],
      })
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Nhập thành công",
        description:
          "Đã thêm 2 danh mục và 1 định mức (1 lỗi). Quyết định định mức nhập đã được tạo tự động.",
      })
    )
  })

  it("shows quota-only backfill message when 0 new categories inserted", async () => {
    mockReadExcelFile.mockResolvedValue({
      SheetNames: ["Sheet1"],
      Sheets: { Sheet1: {} },
    } as Awaited<ReturnType<typeof readExcelFile>>)
    mockWorksheetToJson.mockResolvedValue([
      {
        "Ma nhom": "DM001",
        "Ten nhom": "Danh mục 1",
        "Dinh muc": 10,
        "Toi thieu": 2,
      },
    ])

    // Quota import mock — consumed by callRpc inside onSuccess
    mockCallRpc.mockResolvedValueOnce({
      success: true,
      inserted: 1,
      failed: 0,
      total: 1,
      details: [],
    })

    render(<DeviceQuotaCategoryImportDialog />)

    const file = new File(["dummy"], "backfill-quotas.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    fireEvent.change(screen.getByLabelText("Chọn file Excel"), {
      target: { files: [file] },
    })

    await waitFor(() => {
      expect(screen.getByText(/sẵn sàng nhập/i)).toBeInTheDocument()
    })

    expect(capturedMutationOptions?.onSuccess).toBeTypeOf("function")

    await act(async () => {
      await capturedMutationOptions?.onSuccess?.({
        success: false,
        inserted: 0,
        failed: 1,
        total: 1,
        details: [{ ma_nhom: "DM001", success: false, error: "already exists" }],
      })
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Nhập thành công",
        description:
          "Đã nhập 1 định mức cho danh mục hiện có. Quyết định định mức nhập đã được tạo tự động.",
      })
    )
  })
})
