import "@testing-library/jest-dom"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationBaselineDownloadActions } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineDownloadActions"
import type { TechnicalConfigurationBaselineDecodedDraft } from "@/app/(app)/technical-configurations/baseline-types"

import {
  createHierarchicalDraft,
  readBlobBytes,
} from "./technical-configuration-baseline-download-actions-fixtures"
import {
  baselineVersionsResponse,
  createDraft,
  deferred,
  dossier,
  getBaselineRpcMock,
  renderTab,
} from "./technical-configuration-baseline-tab-fixtures"

const workbookCodec = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  serializeWorkbook: vi.fn(),
}))

vi.mock("@/lib/technical-configuration-baseline-excel-v2-export", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/technical-configuration-baseline-excel-v2-export")>()
  return {
    ...actual,
    serializeTechnicalConfigurationBaselineWorkbookV2: workbookCodec.serializeWorkbook,
  }
})

vi.mock("@/lib/excel-workbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/excel-workbook")>()
  return {
    ...actual,
    downloadBlob: workbookCodec.downloadBlob,
  }
})

const rpc = getBaselineRpcMock()

function renderActions({
  version = createHierarchicalDraft(),
  dirty = false,
  conflict = false,
  disabled = false,
  disabledMessage = null,
}: {
  version?: TechnicalConfigurationBaselineDecodedDraft
  dirty?: boolean
  conflict?: boolean
  disabled?: boolean
  disabledMessage?: string | null
} = {}) {
  return render(
    <TechnicalConfigurationBaselineDownloadActions
      version={version}
      dirty={dirty}
      conflict={conflict}
      disabled={disabled}
      disabledMessage={disabledMessage}
    />
  )
}

describe("technical configuration baseline download actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.listVersions.mockReset()
    rpc.getDossier.mockResolvedValue({ data: dossier })
    rpc.listVersions.mockResolvedValue(baselineVersionsResponse([createDraft()]))
    workbookCodec.serializeWorkbook.mockResolvedValue(new Uint8Array([1, 2, 3]))
  })

  it("downloads the complete current hierarchy with stable hidden identity", async () => {
    const user = userEvent.setup()
    renderActions()

    await user.click(screen.getByRole("button", { name: "Tải cấu hình hiện tại" }))

    await waitFor(() => expect(workbookCodec.serializeWorkbook).toHaveBeenCalledTimes(1))
    const model = workbookCodec.serializeWorkbook.mock.calls[0]?.[0]
    expect(model).toMatchObject({
      intent: "current-data",
      sheets: [
        {
          kind: "configuration",
          columns: [
            { key: "stt", hidden: false },
            { key: "content", hidden: false },
            { key: "main_section_id", hidden: true },
            { key: "subgroup_id", hidden: true },
            { key: "criterion_id", hidden: true },
            { key: "criterion_code", hidden: true },
            { key: "criterion_title", hidden: true },
          ],
          rows: [
            {
              kind: "section",
              stt: "I",
              content: "Yêu cầu chung",
              main_section_id: "group-1",
            },
            {
              kind: "criterion",
              stt: null,
              content: "Dòng 1\nDòng 2",
              main_section_id: "group-1",
              subgroup_id: null,
              criterion_id: "criterion-1",
              criterion_code: "TC-0001",
              criterion_title: "Nguồn điện",
            },
            {
              kind: "subgroup",
              stt: "1",
              content: "Điều kiện vận hành",
              main_section_id: "group-1",
              subgroup_id: "subgroup-1",
            },
            {
              kind: "criterion",
              stt: null,
              content: "Hoạt động ổn định ở 18-30°C",
              main_section_id: "group-1",
              subgroup_id: "subgroup-1",
              criterion_id: "criterion-2",
              criterion_code: "TC-0002",
              criterion_title: "Nhiệt độ",
            },
            {
              kind: "section",
              stt: "II",
              content: "Yêu cầu cấu hình cung cấp",
              main_section_id: "group-2",
            },
            {
              kind: "section",
              stt: "III",
              content: "Yêu cầu kỹ thuật",
              main_section_id: "group-3",
            },
            {
              kind: "section",
              stt: "IV",
              content: "Yêu cầu khác",
              main_section_id: "group-4",
            },
          ],
        },
        { kind: "instructions" },
        {
          kind: "meta",
          state: "hidden",
          metadata: {
            dossier_id: "dossier-1",
            baseline_version_id: "draft-1",
            baseline_revision: 11,
            generated_at: expect.any(String),
          },
        },
      ],
    })
    expect(workbookCodec.downloadBlob).toHaveBeenCalledTimes(1)
    expect(workbookCodec.downloadBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "Cau_Hinh_Co_So_Hien_Tai_Phien_Ban_7.xlsx"
    )
    const downloadedBlob = workbookCodec.downloadBlob.mock.calls[0]?.[0] as Blob
    await expect(readBlobBytes(downloadedBlob)).resolves.toEqual([1, 2, 3])
  })

  it("downloads a blank input sheet with examples only on the instruction sheet", async () => {
    const user = userEvent.setup()
    renderActions()

    await user.click(screen.getByRole("button", { name: "Tải mẫu trống" }))

    await waitFor(() => expect(workbookCodec.serializeWorkbook).toHaveBeenCalledTimes(1))
    const model = workbookCodec.serializeWorkbook.mock.calls[0]?.[0]
    expect(model).toMatchObject({
      intent: "blank-template",
      sheets: [
        {
          kind: "configuration",
          rows: [],
        },
        {
          kind: "instructions",
          rows: expect.arrayContaining([
            expect.objectContaining({
              kind: "example-criterion",
            }),
          ]),
        },
        {
          kind: "meta",
          state: "hidden",
          metadata: {
            dossier_id: "dossier-1",
            baseline_version_id: "draft-1",
            baseline_revision: 11,
          },
        },
      ],
    })
    expect(workbookCodec.downloadBlob).toHaveBeenCalledTimes(1)
    expect(workbookCodec.downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      "Mau_Cau_Hinh_Co_So_Trong_Phien_Ban_7.xlsx"
    )
    const downloadedBlob = workbookCodec.downloadBlob.mock.calls[0]?.[0] as Blob
    await expect(readBlobBytes(downloadedBlob)).resolves.toEqual([1, 2, 3])
  })

  it("serializes only one delegated download at a time and recovers after failure", async () => {
    const user = userEvent.setup()
    const firstDownload = deferred<Uint8Array>()
    const retryDownload = deferred<Uint8Array>()
    workbookCodec.serializeWorkbook
      .mockReturnValueOnce(firstDownload.promise)
      .mockReturnValueOnce(retryDownload.promise)
    renderActions()

    const currentDownload = screen.getByRole("button", { name: "Tải cấu hình hiện tại" })
    const blankDownload = screen.getByRole("button", { name: "Tải mẫu trống" })
    act(() => {
      currentDownload.click()
      blankDownload.click()
    })

    expect(workbookCodec.serializeWorkbook).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Đang tải cấu hình..." })).toBeDisabled()
    expect(blankDownload).toBeDisabled()

    await act(async () => {
      firstDownload.reject(new Error("serialize_failed"))
      await firstDownload.promise.catch(() => undefined)
    })

    expect(screen.getByRole("alert")).toHaveTextContent("Không thể tạo tệp Excel cấu hình cơ sở.")
    expect(screen.getByRole("button", { name: "Tải cấu hình hiện tại" })).toBeEnabled()
    expect(blankDownload).toBeEnabled()

    await user.click(blankDownload)
    expect(workbookCodec.serializeWorkbook).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("button", { name: "Đang tải mẫu..." })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Tải cấu hình hiện tại" })).toBeDisabled()

    act(() => {
      currentDownload.click()
    })
    expect(workbookCodec.serializeWorkbook).toHaveBeenCalledTimes(2)

    await act(async () => {
      retryDownload.resolve(new Uint8Array([1, 2, 3]))
      await retryDownload.promise
    })

    expect(workbookCodec.downloadBlob).toHaveBeenCalledTimes(1)
    expect(workbookCodec.downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      "Mau_Cau_Hinh_Co_So_Trong_Phien_Ban_7.xlsx"
    )
  })

  it.each([
    { dirty: true, conflict: false, guard: "dirty" },
    { dirty: false, conflict: true, guard: "conflict" },
  ])(
    "keeps both actions disabled while the $guard guard is active",
    async ({ dirty, conflict }) => {
      const user = userEvent.setup()
      renderActions({ dirty, conflict })

      const currentDownload = screen.getByRole("button", { name: "Tải cấu hình hiện tại" })
      const blankDownload = screen.getByRole("button", { name: "Tải mẫu trống" })
      expect(currentDownload).toBeDisabled()
      expect(blankDownload).toBeDisabled()

      await user.click(currentDownload)
      await user.click(blankDownload)
      expect(workbookCodec.serializeWorkbook).not.toHaveBeenCalled()
      expect(workbookCodec.downloadBlob).not.toHaveBeenCalled()
    }
  )

  it("renders the supplied explanation while external state disables both actions", () => {
    const disabledMessage = "Hoàn tất hoặc hủy nội dung nhập nhanh trước khi dùng công cụ Excel."

    renderActions({ disabled: true, disabledMessage })

    expect(screen.getByRole("button", { name: "Tải cấu hình hiện tại" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Tải mẫu trống" })).toBeDisabled()
    expect(screen.getByText(disabledMessage)).toBeInTheDocument()
  })

  it("explains lifecycle blocking when no specific external message is available", () => {
    renderActions({ disabled: true })

    expect(screen.getByRole("button", { name: "Tải cấu hình hiện tại" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Tải mẫu trống" })).toBeDisabled()
    expect(
      screen.getByText("Chờ thao tác hiện tại hoàn tất trước khi dùng công cụ Excel.")
    ).toBeInTheDocument()
  })

  it("does not render download actions for a locked baseline", () => {
    renderActions({
      version: createHierarchicalDraft({
        status: "locked",
        locked_at: "2026-08-10T00:00:00.000Z",
        locked_by: 42,
      }),
    })

    expect(screen.queryByRole("button", { name: "Tải cấu hình hiện tại" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tải mẫu trống" })).not.toBeInTheDocument()
  })

  it("mounts both XLSX v2 actions on the production baseline screen", async () => {
    renderTab()

    expect(await screen.findByRole("button", { name: "Tải template Excel" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Công cụ cấu hình phân cấp" })).toHaveClass(
      "flex-wrap"
    )
    expect(screen.getByRole("button", { name: "Tải cấu hình hiện tại" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Tải mẫu trống" })).toBeEnabled()
  })
})
