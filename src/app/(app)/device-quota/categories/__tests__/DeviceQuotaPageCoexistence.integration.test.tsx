import * as React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import DeviceQuotaCategoriesPage from "../page"
import { DeviceQuotaDraftCatalogPageClient } from "../draft-catalog/_components/DeviceQuotaDraftCatalogPageClient"
import { DeviceQuotaChiTietToolbar } from "@/app/(app)/device-quota/decisions/[id]/_components/DeviceQuotaChiTietToolbar"
import { readExcelFile, worksheetToJson } from "@/lib/excel-utils"
import { callRpc } from "@/lib/rpc-client"

const mockUseSession = vi.hoisted(() => vi.fn())
const mockUseTenantSelection = vi.hoisted(() => vi.fn())
const mockUseChiTietContext = vi.hoisted(() => vi.fn())
const mockUseSuggestMapping = vi.hoisted(() => vi.fn())
const mockReadExcelFile = vi.hoisted(() => vi.fn())
const mockWorksheetToJson = vi.hoisted(() => vi.fn())

vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }))
vi.mock("@/contexts/TenantSelectionContext", () => ({
  useTenantSelection: () => mockUseTenantSelection(),
}))
vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => <button type="button">Chọn đơn vị</button>,
}))
vi.mock("../../_hooks/useSuggestMapping", () => ({
  useSuggestMapping: (...args: unknown[]) => mockUseSuggestMapping(...args),
}))
vi.mock("@/lib/excel-utils", () => ({
  readExcelFile: mockReadExcelFile,
  worksheetToJson: mockWorksheetToJson,
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/lib/rpc-client", () => ({ callRpc: vi.fn() }))
vi.mock("@/app/(app)/device-quota/decisions/[id]/_hooks/useDeviceQuotaChiTietContext", () => ({
  useDeviceQuotaChiTietContext: mockUseChiTietContext,
}))

const mockCallRpc = vi.mocked(callRpc)
const mockReadExcelFileResult = {
  SheetNames: ["Sheet1"],
  Sheets: { Sheet1: {} },
} as Awaited<ReturnType<typeof readExcelFile>>

const category = {
  id: 1,
  parent_id: null,
  ma_nhom: "G1",
  ten_nhom: "Nhóm chẩn đoán hình ảnh",
  phan_loai: "A",
  don_vi_tinh: "Máy",
  thu_tu_hien_thi: 1,
  level: 1,
  so_luong_hien_co: 1,
  so_luong_toi_da: 10,
  so_luong_toi_thieu: null,
  mo_ta: null,
}

const draftItem = {
  id: "draft-item-1",
  regulatory_item_id: "reg-item-1",
  display_name_override: null,
  applied_unit: null,
  applied_quantity: null,
  notes: null,
  is_excluded: false,
  display_order: 1,
  source_identifier: "item-1",
  source_label: "1",
  regulatory_name: "Máy X quang",
  regulatory_unit: "Máy",
  regulatory_quota_lines: ["01 máy"],
  regulatory_rules: [{ line_order: 1, source_text: "01 máy" }],
}

const suggestedMappingResult = {
  groups: [
    {
      nhom_id: 1,
      nhom_label: "Nhóm chẩn đoán hình ảnh",
      nhom_code: "G1",
      phan_loai: "A",
      rrf_score: 0.95,
      device_names: ["Máy X quang"],
      device_ids: [101],
      device_name_to_ids: { "Máy X quang": [101] },
    },
  ],
  unmatched: [],
  totalDevices: 1,
  matchedDevices: 1,
}

const draftSnapshot = (revision: number, item = draftItem) => ({
  draft: {
    id: "draft-1",
    don_vi: 1,
    catalog_version_id: "00000000-0000-4000-8000-000000000001",
    status: "draft",
    revision,
    created_by: 7,
    updated_by: 7,
    created_at: "2026-09-01T08:00:00.000Z",
    updated_at: "2026-09-01T08:00:00.000Z",
  },
  items: [item],
})

const regulatoryCatalog = {
  document: {
    document_number: "10/2026/TT-BYT",
    document_title: "Thông tư 10/2026",
    appendix_title: "Phụ lục",
    document_version: "2026-06-19",
    issued_date: "2026-06-19",
    effective_date: "2026-07-01",
    source_pdf_path: "fixtures/source.pdf",
    source_pdf_sha256: "sha256",
  },
  catalog_version: {
    id: "00000000-0000-4000-8000-000000000001",
    artifact_id: "artifact-1",
    appendix_json_path: "fixtures/source.json",
    appendix_json_sha256: "json-sha256",
    appendix_markdown_path: "fixtures/source.md",
    appendix_markdown_sha256: "markdown-sha256",
    extraction_revision: "r1",
    import_status: "ready",
    is_canonical: true,
    source_pages: "1",
    source_note: "fixture",
  },
  completeness: {
    structural_rows: 1,
    section_rows: 0,
    equipment_item_rows: 1,
    source_declared_child_rows: 0,
    top_level_item_rows: 1,
    rule_lines: 1,
    footnotes: 0,
    items_with_source_pages: 1,
    items_with_source_references: 1,
    multiline_quota_items: 0,
  },
  rows: [
    {
      id: "item-1",
      type: "item",
      level: 0,
      tt: "1",
      parent: null,
      name: "Máy X quang",
      unit: "Máy",
      quota: ["01 máy"],
      source_pages: [1],
      source_ref: "Phụ lục, dòng 1",
    },
  ],
  footnotes: [],
}

const decisionToolbarContext = {
  decision: {
    id: 9,
    don_vi_id: 1,
    so_quyet_dinh: "QD-01",
    ngay_ban_hanh: "2026-09-01",
    ngay_hieu_luc: "2026-09-01",
    ngay_het_hieu_luc: null,
    nguoi_ky: "Người ký",
    chuc_vu_nguoi_ky: "Chức vụ",
    trang_thai: "draft" as const,
    ghi_chu: null,
    thay_the_cho_id: null,
    created_at: "2026-09-01T08:00:00.000Z",
    updated_at: "2026-09-01T08:00:00.000Z",
  },
  isDecisionLoading: false,
  leafCategories: [{ ma_nhom: "G1", ten_nhom: "Nhóm chẩn đoán hình ảnh", don_vi_tinh: "Máy" }],
  isCategoriesLoading: false,
  openImportDialog: vi.fn(),
}

function createWrapper(queryClient = new QueryClient()) {
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("Device quota page-level coexistence", () => {
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
    mockUseSuggestMapping.mockReset()
    mockUseTenantSelection.mockReturnValue({ selectedFacilityId: null, showSelector: false })
  })

  it("keeps active CRUD and both Excel entry points available through draft initialization, save, and reopen", async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient()
    let persistedDraft = draftSnapshot(1)
    const saveMappingBatch = vi.fn()

    mockUseSession.mockReturnValue({
      data: { user: { id: "7", username: "quota-manager", role: "admin", don_vi: "1" } },
      status: "authenticated",
    })
    mockUseChiTietContext.mockReturnValue(decisionToolbarContext)
    mockUseSuggestMapping.mockReturnValue({
      status: "done",
      result: suggestedMappingResult,
      error: null,
      canRetry: false,
      progress: 100,
      processedUniqueNames: 1,
      retryFailedJob: vi.fn(),
      reset: vi.fn(),
      saveBatch: saveMappingBatch,
      saveStatus: "idle",
      saveResult: null,
      saveError: null,
      totalUniqueNames: 1,
    })
    mockReadExcelFile.mockResolvedValue(mockReadExcelFileResult)
    mockWorksheetToJson.mockResolvedValue([
      {
        "Ma nhom": "G2",
        "Ten nhom": "Nhóm siêu âm",
        "Dinh muc": 5,
        "Toi thieu": 1,
      },
    ])
    mockCallRpc.mockImplementation(async ({ fn, args }) => {
      switch (fn) {
        case "dinh_muc_nhom_list":
          return [category]
        case "device_quota_unit_catalog_draft_create_or_open":
        case "device_quota_unit_catalog_draft_get":
          return persistedDraft
        case "device_quota_regulatory_catalog_get":
          return regulatoryCatalog
        case "dinh_muc_nhom_bulk_import":
          return { success: true, inserted: 1, failed: 0, total: 1, details: [] }
        case "dinh_muc_unified_import":
          return { success: true, inserted: 1, failed: 0, total: 1 }
        case "device_quota_unit_catalog_draft_save": {
          const saveArgs = args as {
            p_expected_revision: number
            p_items: Array<Record<string, unknown>>
          }
          persistedDraft = draftSnapshot(saveArgs.p_expected_revision + 1, {
            ...draftItem,
            applied_unit: saveArgs.p_items[0]?.applied_unit ?? null,
            applied_quantity: saveArgs.p_items[0]?.applied_quantity ?? null,
          })
          return persistedDraft
        }
        default:
          throw new Error(`Unexpected RPC in coexistence test: ${fn}`)
      }
    })

    const { rerender } = render(
      <>
        <DeviceQuotaCategoriesPage />
        <DeviceQuotaChiTietToolbar />
        <DeviceQuotaDraftCatalogPageClient />
      </>,
      { wrapper: createWrapper(queryClient) }
    )
    const assertManagerSurface = () => {
      expect(screen.getByRole("button", { name: "Tạo danh mục" })).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Mở menu danh mục Nhóm chẩn đoán hình ảnh" })
      ).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Tải mẫu Excel" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Nhập từ Excel" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Gợi ý phân loại hàng loạt" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "Soạn danh mục dự thảo" })).toHaveAttribute(
        "href",
        "/device-quota/categories/draft-catalog"
      )
      expect(
        screen.getByRole("button", { name: "Tải xuống file mẫu Excel định mức" })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Nhập định mức từ file Excel" })
      ).toBeInTheDocument()
    }

    await waitFor(
      () => {
        assertManagerSurface()
        expect(screen.getByText("Máy X quang")).toBeInTheDocument()
      },
      { timeout: 5000 }
    )
    await user.click(screen.getByRole("button", { name: "Gợi ý phân loại hàng loạt" }))
    const mappingDialog = await screen.findByRole("dialog")
    expect(within(mappingDialog).getByText("Gợi ý phân loại thiết bị")).toBeInTheDocument()
    await user.click(
      within(mappingDialog).getByRole("button", { name: "Áp dụng 1 gợi ý phân loại" })
    )
    expect(saveMappingBatch).toHaveBeenCalledWith([{ nhom_id: 1, thiet_bi_ids: [101] }])
    await user.click(within(mappingDialog).getByRole("button", { name: "Đóng" }))

    await user.click(
      screen.getByRole("button", { name: "Mở menu danh mục Nhóm chẩn đoán hình ảnh" })
    )
    expect(screen.getByRole("menuitem", { name: "Sửa" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Xóa" })).toBeInTheDocument()
    await user.keyboard("{Escape}")

    await user.click(screen.getByRole("button", { name: "Nhập từ Excel" }))
    expect(await screen.findByText("Nhập danh mục từ Excel")).toBeInTheDocument()
    const categoryFile = new File(["dummy"], "categories.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    await user.upload(screen.getByLabelText("Chọn file Excel"), categoryFile)
    await waitFor(() => expect(screen.getByText(/sẵn sàng nhập/i)).toBeInTheDocument())
    await user.click(screen.getByRole("button", { name: /Nhập \(1\)/i }))
    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "dinh_muc_nhom_bulk_import",
        args: {
          p_items: [
            {
              ma_nhom: "G2",
              ten_nhom: "Nhóm siêu âm",
              parent_ma_nhom: null,
              phan_loai: null,
              don_vi_tinh: null,
              thu_tu_hien_thi: null,
              mo_ta: null,
              dinh_muc_toi_da: 5,
              toi_thieu: 1,
            },
          ],
          p_don_vi: 1,
        },
      })
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "dinh_muc_unified_import",
        args: {
          p_items: [{ ma_nhom: "G2", so_luong_dinh_muc: 5, so_luong_toi_thieu: 1 }],
          p_don_vi: 1,
        },
      })
    })
    await user.click(screen.getByRole("button", { name: "Đóng" }))
    await user.click(screen.getByRole("button", { name: "Nhập định mức từ file Excel" }))
    expect(decisionToolbarContext.openImportDialog).toHaveBeenCalledTimes(1)

    const quantityInput = await screen.findByRole("spinbutton", {
      name: "SL đề xuất - Máy X quang",
    })
    await user.type(quantityInput, "3")
    await user.type(screen.getByRole("textbox", { name: "ĐVT áp dụng - Máy X quang" }), "Máy")
    await user.click(screen.getByRole("button", { name: "Lưu" }))
    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: "device_quota_unit_catalog_draft_save",
          args: {
            p_draft_id: "draft-1",
            p_expected_revision: 1,
            p_items: [
              {
                regulatory_item_id: "reg-item-1",
                display_name_override: null,
                applied_unit: "Máy",
                applied_quantity: 3,
                notes: null,
                is_excluded: false,
                display_order: 1,
              },
            ],
          },
        })
      )
      expect(screen.getByText("Đã lưu")).toBeInTheDocument()
    })
    assertManagerSurface()

    queryClient.clear()
    rerender(
      <>
        <DeviceQuotaCategoriesPage />
        <DeviceQuotaChiTietToolbar />
        <DeviceQuotaDraftCatalogPageClient key="reopened" />
      </>
    )
    expect(
      await screen.findByRole(
        "spinbutton",
        { name: "SL đề xuất - Máy X quang" },
        {
          timeout: 5000,
        }
      )
    ).toHaveValue(3)
    assertManagerSurface()
  })

  it("keeps manager-only controls and the draft route blocked for a non-manager", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "8", username: "viewer", role: "technician", don_vi: "1" } },
      status: "authenticated",
    })
    mockCallRpc.mockResolvedValue([category])

    render(
      <>
        <DeviceQuotaCategoriesPage />
        <DeviceQuotaDraftCatalogPageClient />
      </>,
      { wrapper: createWrapper() }
    )

    expect(await screen.findByTestId("device-quota-draft-catalog-blocked")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tạo danh mục" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tải mẫu Excel" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Nhập từ Excel" })).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Gợi ý phân loại hàng loạt" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Soạn danh mục dự thảo" })).not.toBeInTheDocument()
  })
})
