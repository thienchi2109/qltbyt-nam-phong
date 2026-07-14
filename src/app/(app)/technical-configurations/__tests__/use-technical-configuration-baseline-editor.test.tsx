import { act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"
import {
  dossier,
  draft,
  getBaselineEditorRpcMock,
  renderBaselineEditor,
} from "./use-technical-configuration-baseline-editor-fixtures"

const rpc = getBaselineEditorRpcMock()

describe("useTechnicalConfigurationBaselineEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDossier.mockResolvedValue({ data: dossier })
    rpc.getDraft.mockResolvedValue({ data: draft })
    rpc.listVersions.mockResolvedValue({
      data: [draft],
      total: 1,
      page: 1,
      page_size: 100,
    })
  })

  it("shows field validation only after an explicit save attempt", async () => {
    const { result } = renderBaselineEditor()

    await waitFor(() => expect(result.current.editorDraft).not.toBeNull())
    const currentDraft = result.current.editorDraft
    if (!currentDraft) throw new Error("Expected loaded editor draft")

    act(() => {
      result.current.onEditorChange({
        ...currentDraft,
        groups: currentDraft.groups.map((group) => ({
          ...group,
          name: " ",
          criteria: group.criteria.map((criterion) => ({
            ...criterion,
            requirementText: "\n ",
          })),
        })),
      })
    })

    expect(result.current.validation).toEqual({
      groupErrors: {},
      criterionErrors: {},
    })

    act(() => {
      result.current.onSave()
    })

    await waitFor(() =>
      expect(result.current.validation).toEqual({
        groupErrors: {
          "group-1": "Tên nhóm là bắt buộc.",
        },
        criterionErrors: {
          "criterion-1": "Nội dung yêu cầu là bắt buộc.",
        },
      })
    )
  })

  it("loads older version-history pages on demand", async () => {
    const versions = Array.from({ length: 101 }, (_, index) => ({
      ...draft,
      id: `version-${101 - index}`,
      version_number: 101 - index,
      status: "locked" as const,
      locked_at: "2026-07-14T08:30:00.000Z",
      locked_by: 42,
    }))
    rpc.listVersions.mockImplementation(({ p_page }: { p_page: number }) =>
      Promise.resolve(
        p_page === 1
          ? { data: versions.slice(0, 100), total: 101, page: 1, page_size: 100 }
          : { data: versions.slice(100), total: 101, page: 2, page_size: 100 }
      )
    )

    const { result } = renderBaselineEditor()

    await waitFor(() => expect(result.current.versions).toEqual(versions.slice(0, 100)))
    expect(result.current.hasMoreVersions).toBe(true)

    await act(async () => {
      await result.current.onLoadMoreVersions()
    })

    await waitFor(() => expect(result.current.versions).toEqual(versions))
    expect(result.current.hasMoreVersions).toBe(false)
    expect(rpc.listVersions).toHaveBeenLastCalledWith({
      p_dossier_id: dossier.id,
      p_page: 2,
      p_page_size: 100,
    })
  })

  it("recovers when a concurrent insert shifts offset pages during load more", async () => {
    const createVersions = (highestVersion: number, count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...draft,
        id: `version-${highestVersion - index}`,
        version_number: highestVersion - index,
        status: "locked" as const,
        locked_at: "2026-07-14T08:30:00.000Z",
        locked_by: 42,
      }))
    const initialFirstPage = createVersions(200, 100)
    const refreshedFirstPage = createVersions(201, 100)
    const shiftedSecondPage = createVersions(101, 100)
    const finalPage = createVersions(1, 1)
    let pageOneRequestCount = 0
    rpc.listVersions.mockImplementation(({ p_page }: { p_page: number }) => {
      if (p_page === 2) {
        return Promise.resolve({
          data: shiftedSecondPage,
          total: 201,
          page: 2,
          page_size: 100,
        })
      }
      if (p_page === 3) {
        return Promise.resolve({ data: finalPage, total: 201, page: 3, page_size: 100 })
      }
      pageOneRequestCount += 1
      return Promise.resolve({
        data: pageOneRequestCount === 1 ? initialFirstPage : refreshedFirstPage,
        total: pageOneRequestCount === 1 ? 200 : 201,
        page: 1,
        page_size: 100,
      })
    })
    const { result } = renderBaselineEditor()

    await waitFor(() => expect(result.current.versions).toHaveLength(100))
    await act(async () => {
      await result.current.onLoadMoreVersions()
    })
    await waitFor(() => expect(result.current.versions).toHaveLength(199))

    await act(async () => {
      await result.current.onLoadMoreVersions()
    })
    expect(result.current.versions).toHaveLength(199)
    expect(result.current.hasMoreVersions).toBe(true)

    await act(async () => {
      await result.current.onRetryQuery()
    })
    await waitFor(() => expect(result.current.versions).toHaveLength(200))
    expect(result.current.versions.map((version) => version.id)).toContain("version-201")

    await act(async () => {
      await result.current.onLoadMoreVersions()
    })
    await waitFor(() => expect(result.current.versions).toHaveLength(201))
    expect(result.current.hasMoreVersions).toBe(false)
  })

  it("keeps a selected page-2 locked version when refreshing page 1", async () => {
    const createVersion = (versionNumber: number) => ({
      ...draft,
      id: `version-${versionNumber}`,
      version_number: versionNumber,
      status: "locked" as const,
      locked_at: "2026-07-14T08:30:00.000Z",
      locked_by: 42,
    })
    const initialFirstPage = Array.from({ length: 100 }, (_, index) => createVersion(200 - index))
    const initialSecondPage = Array.from({ length: 100 }, (_, index) => createVersion(100 - index))
    const refreshedFirstPage = Array.from({ length: 100 }, (_, index) => createVersion(201 - index))
    const oldest = initialSecondPage.at(-1)
    if (!oldest) throw new Error("Expected oldest version")
    let pageOneRequestCount = 0
    rpc.listVersions.mockImplementation(({ p_page }: { p_page: number }) => {
      if (p_page === 2) {
        return Promise.resolve({
          data: initialSecondPage,
          total: 200,
          page: 2,
          page_size: 100,
        })
      }
      if (p_page === 3) {
        return Promise.resolve({
          data: [oldest],
          total: 201,
          page: 3,
          page_size: 100,
        })
      }
      pageOneRequestCount += 1
      return Promise.resolve({
        data: pageOneRequestCount === 1 ? initialFirstPage : refreshedFirstPage,
        total: pageOneRequestCount === 1 ? 200 : 201,
        page: 1,
        page_size: 100,
      })
    })

    const { result } = renderBaselineEditor()

    await waitFor(() => expect(result.current.versions).toHaveLength(100))
    await act(async () => {
      await result.current.onLoadMoreVersions()
    })
    await waitFor(() => expect(result.current.versions).toHaveLength(200))
    act(() => {
      result.current.onSelectVersion(oldest.id)
    })
    await waitFor(() => expect(result.current.selectedVersion?.id).toBe(oldest.id))

    await act(async () => {
      await result.current.onRefreshVersions()
    })

    expect(result.current.selectedVersion?.id).toBe(oldest.id)
    expect(result.current.versions.map((version) => version.id)).not.toContain(oldest.id)
    expect(result.current.hasMoreVersions).toBe(true)

    await act(async () => {
      await result.current.onLoadMoreVersions()
    })

    await waitFor(() =>
      expect(result.current.versions.map((version) => version.id)).toContain(oldest.id)
    )
    expect(result.current.selectedVersion?.id).toBe(oldest.id)
    expect(rpc.listVersions).toHaveBeenLastCalledWith({
      p_dossier_id: dossier.id,
      p_page: 3,
      p_page_size: 100,
    })
  })

  it("classifies stale draft creation as a recoverable conflict", async () => {
    const locked = {
      ...draft,
      id: "locked-1",
      status: "locked" as const,
      locked_at: "2026-07-14T08:30:00.000Z",
      locked_by: 42,
    }
    rpc.listVersions.mockResolvedValue({
      data: [locked],
      total: 1,
      page: 1,
      page_size: 100,
    })
    rpc.createDraft.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, { message: "stale_revision" })
    )

    const { result } = renderBaselineEditor()

    await waitFor(() => expect(result.current.selectedVersion?.id).toBe(locked.id))
    act(() => {
      result.current.onCreate()
    })

    await waitFor(() => expect(result.current.isConflict).toBe(true))
    expect(result.current.createError).toBe(
      "Dữ liệu hồ sơ đã thay đổi. Trạng thái mới đã được tải; vui lòng thử lại."
    )
    expect(result.current.lifecycleError).toBeNull()
  })

  it("surfaces a failed history refresh after stale draft creation", async () => {
    const locked = {
      ...draft,
      id: "locked-1",
      status: "locked" as const,
      locked_at: "2026-07-14T08:30:00.000Z",
      locked_by: 42,
    }
    rpc.listVersions
      .mockResolvedValueOnce({
        data: [locked],
        total: 1,
        page: 1,
        page_size: 100,
      })
      .mockRejectedValueOnce(new Error("network unavailable"))
    rpc.createDraft.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, { message: "draft_already_exists" })
    )

    const { result } = renderBaselineEditor()

    await waitFor(() => expect(result.current.selectedVersion?.id).toBe(locked.id))
    act(() => {
      result.current.onCreate()
    })

    await waitFor(() =>
      expect(result.current.createError).toBe("Không thể tải lại trạng thái hồ sơ.")
    )
    expect(result.current.lifecycleError).toBe("Không thể tải lại trạng thái hồ sơ.")
    expect(result.current.selectedVersion?.id).toBe(locked.id)
  })

  it("refreshes the dossier revision before retrying stale first-draft creation", async () => {
    rpc.listVersions.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      page_size: 100,
    })
    rpc.getDossier.mockResolvedValue({
      data: {
        ...dossier,
        revision: 4,
      },
    })
    rpc.createDraft
      .mockRejectedValueOnce(new TechnicalConfigurationRpcError(409, { message: "stale_revision" }))
      .mockResolvedValueOnce({
        data: {
          ...draft,
          dossier_revision: 5,
        },
      })

    const { result } = renderBaselineEditor()

    await waitFor(() => expect(result.current.isMissing).toBe(true))
    act(() => {
      result.current.onCreate()
    })

    await waitFor(() => expect(rpc.getDossier).toHaveBeenCalledWith(dossier.id))
    expect(result.current.createError).toBe(
      "Dữ liệu hồ sơ đã thay đổi. Trạng thái mới đã được tải; vui lòng thử lại."
    )

    act(() => {
      result.current.onCreate()
    })

    await waitFor(() => expect(rpc.createDraft).toHaveBeenCalledTimes(2))
    expect(rpc.createDraft).toHaveBeenLastCalledWith({
      p_dossier_id: dossier.id,
      p_expected_revision: 4,
    })
  })
})
