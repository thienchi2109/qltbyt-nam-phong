import "@testing-library/jest-dom"

import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi } from "vitest"

import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import {
  createAuthoritativeHierarchyPreview,
  createHierarchyDraft,
  createHierarchyImportFile,
  createV2ParseResult,
  HierarchyImportHarness,
} from "./technical-configuration-baseline-hierarchy-import-fixtures"

const hierarchyImportRpc = vi.hoisted(() => ({
  previewHierarchyImport: vi.fn(),
  applyHierarchyImport: vi.fn(),
}))

const compatibleParser = vi.hoisted(() => ({
  parseFile: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

vi.mock("@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline", () => ({
  useTechnicalConfigurationBaseline: () => hierarchyImportRpc,
}))

vi.mock("@/lib/technical-configuration-baseline-excel-v2-parse", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/technical-configuration-baseline-excel-v2-parse")>()
  return {
    ...actual,
    parseTechnicalConfigurationBaselineWorkbookFile: compatibleParser.parseFile,
  }
})

async function prepareConfirmedPreview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))
  await user.upload(
    screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
    createHierarchyImportFile()
  )
  await screen.findByRole("group", { name: "Xác nhận thay thế toàn bộ cấu hình" })
  await user.click(
    screen.getByRole("checkbox", {
      name: "Tôi hiểu các mục bị thiếu trong workbook sẽ bị xóa",
    })
  )
}

describe("technical configuration hierarchy import review regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    compatibleParser.parseFile.mockResolvedValue(createV2ParseResult())
    hierarchyImportRpc.previewHierarchyImport.mockResolvedValue(
      createAuthoritativeHierarchyPreview()
    )
    hierarchyImportRpc.applyHierarchyImport.mockResolvedValue({
      data: createHierarchyDraft({ revision: 12 }),
    })
  })

  it("keeps preview-conflict evidence until the replacement preview succeeds", async () => {
    const user = userEvent.setup()
    const onConflict = vi.fn().mockResolvedValue(undefined)
    const replacementParsed = createV2ParseResult()
    replacementParsed.metadata.baseline_revision = 12
    const replacementPreview = createAuthoritativeHierarchyPreview()
    replacementPreview.data.metadata = replacementParsed.metadata
    const pendingPreview = deferred<typeof replacementPreview>()
    hierarchyImportRpc.previewHierarchyImport
      .mockRejectedValueOnce(
        new TechnicalConfigurationRpcError(409, {
          code: "PT409",
          message: "stale_revision",
        })
      )
      .mockReturnValueOnce(pendingPreview.promise)
    const { rerender } = render(
      <HierarchyImportHarness version={createHierarchyDraft()} onConflict={onConflict} />
    )

    await user.click(screen.getByRole("button", { name: "Nhập cấu hình phân cấp" }))
    await user.upload(
      screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
      createHierarchyImportFile()
    )
    await waitFor(() => expect(onConflict).toHaveBeenCalledWith("draft-1"))
    expect(screen.getByText("baseline-v2.xlsx")).toBeInTheDocument()

    rerender(
      <HierarchyImportHarness
        version={createHierarchyDraft({ revision: 12 })}
        onConflict={onConflict}
      />
    )
    compatibleParser.parseFile.mockResolvedValueOnce(replacementParsed)
    await user.upload(
      screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
      createHierarchyImportFile("baseline-revision-12.xlsx")
    )
    await waitFor(() => expect(hierarchyImportRpc.previewHierarchyImport).toHaveBeenCalledTimes(2))

    expect(screen.getByText("baseline-v2.xlsx")).toBeInTheDocument()
    expect(screen.queryByText("baseline-revision-12.xlsx")).not.toBeInTheDocument()

    await act(async () => {
      pendingPreview.resolve(replacementPreview)
      await pendingPreview.promise
    })

    expect(await screen.findByText("baseline-revision-12.xlsx")).toBeInTheDocument()
    expect(screen.queryByText("baseline-v2.xlsx")).not.toBeInTheDocument()
  })

  it("keeps stale evidence when a replacement preview has validation errors", async () => {
    const user = userEvent.setup()
    const onConflict = vi.fn().mockResolvedValue(undefined)
    hierarchyImportRpc.applyHierarchyImport.mockRejectedValueOnce(
      new TechnicalConfigurationRpcError(409, {
        code: "PT409",
        message: "stale_revision",
      })
    )
    const { rerender } = render(
      <HierarchyImportHarness version={createHierarchyDraft()} onConflict={onConflict} />
    )

    await prepareConfirmedPreview(user)
    await user.click(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" }))
    await waitFor(() => expect(onConflict).toHaveBeenCalledWith("draft-1"))
    rerender(
      <HierarchyImportHarness
        version={createHierarchyDraft({ revision: 12 })}
        onConflict={onConflict}
      />
    )

    const replacementParsed = createV2ParseResult()
    replacementParsed.metadata.baseline_revision = 12
    const invalidPreview = createAuthoritativeHierarchyPreview()
    invalidPreview.data.metadata = replacementParsed.metadata
    invalidPreview.data.effects = null
    invalidPreview.errors = [
      {
        row: 27,
        code: "empty_content",
        column: "content",
        message: "Nội dung bắt buộc không được để trống.",
      },
    ]
    compatibleParser.parseFile.mockResolvedValueOnce(replacementParsed)
    hierarchyImportRpc.previewHierarchyImport.mockResolvedValueOnce(invalidPreview)

    await user.upload(
      screen.getByLabelText("Chọn workbook cấu hình phân cấp"),
      createHierarchyImportFile("invalid-replacement.xlsx")
    )

    expect(
      await screen.findByRole("alert", { name: "Lỗi nhập cấu hình phân cấp" })
    ).toHaveTextContent("Dòng 27 · content: Nội dung bắt buộc không được để trống.")
    expect(screen.getByText("baseline-v2.xlsx")).toBeInTheDocument()
    expect(screen.getByText("Mục chính từ máy chủ")).toBeInTheDocument()
    expect(screen.queryByText("invalid-replacement.xlsx")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" })).toBeDisabled()
  })

  it("announces the destructive apply operation separately from previewing", async () => {
    const user = userEvent.setup()
    hierarchyImportRpc.applyHierarchyImport.mockReturnValueOnce(new Promise(() => undefined))
    render(<HierarchyImportHarness />)

    await prepareConfirmedPreview(user)
    await user.click(screen.getByRole("button", { name: "Áp dụng thay thế toàn bộ" }))

    expect(
      screen.getByRole("status", { name: "Trạng thái nhập cấu hình phân cấp" })
    ).toHaveTextContent("Đang áp dụng thay thế toàn bộ cấu hình...")
  })
})
