import "@testing-library/jest-dom"

import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  baselineVersionsResponse,
  createDraft,
  dossier,
  getBaselineRpcMock,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const rpc = getBaselineRpcMock()

describe("technical configuration hierarchy import production isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDossier.mockResolvedValue({ data: dossier })
    rpc.listVersions.mockResolvedValue(baselineVersionsResponse([createDraft()]))
  })

  it("keeps the dormant workflow unreachable from the production baseline tab", async () => {
    renderTab()

    expect(await screen.findByRole("button", { name: "Tải template Excel" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tải cấu hình hiện tại" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tải mẫu trống" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Nhập cấu hình phân cấp" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Thêm nhóm con/i })).not.toBeInTheDocument()
    expect(
      screen.queryByRole("dialog", { name: "Nhập cấu hình phân cấp từ Excel" })
    ).not.toBeInTheDocument()
    expect(rpc.previewHierarchyImport).not.toHaveBeenCalled()
    expect(rpc.applyHierarchyImport).not.toHaveBeenCalled()
  })
})
