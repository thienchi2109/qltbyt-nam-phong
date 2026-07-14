import { act, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"
import { TechnicalConfigurationRpcError } from "@/app/(app)/technical-configurations/technical-configuration-rpc"

import {
  dossier,
  draft,
  getBaselineEditorRpcMock,
  renderBaselineEditor,
} from "./use-technical-configuration-baseline-editor-fixtures"

const rpc = getBaselineEditorRpcMock()
const locked = {
  ...draft,
  id: "locked-1",
  version_number: 2,
  status: "locked" as const,
  locked_at: "2026-07-14T08:30:00.000Z",
  locked_by: 42,
}

function baselineVersionsResponse(data: (typeof draft)[]) {
  return { data, total: data.length, page: 1, page_size: 100 }
}

function editRequirement(
  currentDraft: TechnicalConfigurationBaselineEditorDraft,
  requirementText: string
) {
  return {
    ...currentDraft,
    groups: currentDraft.groups.map((group) => ({
      ...group,
      criteria: group.criteria.map((criterion) => ({
        ...criterion,
        requirementText,
      })),
    })),
  }
}

describe("useTechnicalConfigurationBaselineEditor lifecycle safety", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.getDossier.mockResolvedValue({ data: dossier })
    rpc.getDraft.mockResolvedValue({ data: draft })
    rpc.listVersions.mockResolvedValue(baselineVersionsResponse([draft]))
  })

  it("keeps unsaved editor state visible when a cached history refetch fails", async () => {
    rpc.listVersions
      .mockResolvedValueOnce(baselineVersionsResponse([draft]))
      .mockRejectedValueOnce(new Error("network unavailable"))
    const { result } = renderBaselineEditor()

    await waitFor(() => expect(result.current.editorDraft).not.toBeNull())
    const currentDraft = result.current.editorDraft
    if (!currentDraft) throw new Error("Expected loaded editor draft")

    act(() => {
      result.current.onEditorChange(editRequirement(currentDraft, "Nguồn điện dự phòng"))
    })
    await act(async () => {
      await result.current.onRetryQuery()
    })

    expect(result.current.queryError).toBeNull()
    expect(result.current.editorDraft?.groups[0]?.criteria[0]?.requirementText).toBe(
      "Nguồn điện dự phòng"
    )
    expect(result.current.versions).toEqual([draft])
  })

  it("localizes an incomplete initial history page as a query error", async () => {
    rpc.listVersions.mockResolvedValue({
      data: [],
      total: 1,
      page: 1,
      page_size: 100,
    })
    const { result } = renderBaselineEditor()

    await waitFor(() => expect(result.current.queryError).toBe("Không thể tải cấu hình cơ sở."))
    expect(result.current.editorDraft).toBeNull()
  })

  it("does not select another version while the editor is dirty", async () => {
    rpc.listVersions.mockResolvedValue(baselineVersionsResponse([draft, locked]))
    const { result } = renderBaselineEditor()

    await waitFor(() => expect(result.current.editorDraft).not.toBeNull())
    const currentDraft = result.current.editorDraft
    if (!currentDraft) throw new Error("Expected loaded editor draft")
    act(() => {
      result.current.onEditorChange(editRequirement(currentDraft, "Thay đổi chưa lưu"))
    })
    await waitFor(() => expect(result.current.isDirty).toBe(true))
    act(() => {
      result.current.onSelectVersion(locked.id)
    })

    expect(result.current.selectedVersion?.id).toBe(draft.id)
    expect(result.current.editorDraft?.groups[0]?.criteria[0]?.requirementText).toBe(
      "Thay đổi chưa lưu"
    )
  })

  it("refreshes history without replacing dirty editor state", async () => {
    const refreshedDraft = {
      ...draft,
      revision: draft.revision + 1,
      groups: draft.groups.map((group) => ({
        ...group,
        criteria: group.criteria.map((criterion) => ({
          ...criterion,
          requirement_text: "Giá trị từ máy chủ",
        })),
      })),
    }
    rpc.listVersions
      .mockResolvedValueOnce(baselineVersionsResponse([draft]))
      .mockResolvedValueOnce(baselineVersionsResponse([refreshedDraft]))
    const { result } = renderBaselineEditor()

    await waitFor(() => expect(result.current.editorDraft).not.toBeNull())
    const currentDraft = result.current.editorDraft
    if (!currentDraft) throw new Error("Expected loaded editor draft")
    act(() => {
      result.current.onEditorChange(editRequirement(currentDraft, "Thay đổi chưa lưu"))
    })
    await act(async () => {
      await result.current.onRefreshVersions()
    })

    expect(result.current.versions[0]?.revision).toBe(refreshedDraft.revision)
    expect(result.current.baseDraft?.revision).toBe(draft.revision)
    expect(result.current.editorDraft?.groups[0]?.criteria[0]?.requirementText).toBe(
      "Thay đổi chưa lưu"
    )
  })

  it("does not lock a draft while the editor is dirty", async () => {
    rpc.lockVersion.mockResolvedValue({ data: locked })
    const { result } = renderBaselineEditor()

    await waitFor(() => expect(result.current.editorDraft).not.toBeNull())
    const currentDraft = result.current.editorDraft
    if (!currentDraft) throw new Error("Expected loaded editor draft")
    act(() => {
      result.current.onEditorChange(editRequirement(currentDraft, "Thay đổi chưa lưu"))
    })
    await act(async () => {
      await result.current.onLock()
    })

    expect(rpc.lockVersion).not.toHaveBeenCalled()
    expect(result.current.editorDraft?.groups[0]?.criteria[0]?.requirementText).toBe(
      "Thay đổi chưa lưu"
    )
  })

  it("does not replace the editor while external input is pending", async () => {
    rpc.listVersions.mockResolvedValue(baselineVersionsResponse([draft, locked]))
    const { result, rerender } = renderBaselineEditor()

    await waitFor(() => expect(result.current.selectedVersion?.id).toBe(draft.id))
    rerender({ replacementBlocked: true })
    act(() => {
      result.current.onSelectVersion(locked.id)
    })

    expect(result.current.selectedVersion?.id).toBe(draft.id)
    expect(result.current.editorDraft).not.toBeNull()
  })

  it("recovers a concurrent copy race by loading the existing draft", async () => {
    const existingDraft = {
      ...draft,
      id: "existing-draft",
      version_number: 3,
    }
    rpc.listVersions
      .mockResolvedValueOnce(baselineVersionsResponse([locked]))
      .mockResolvedValueOnce(baselineVersionsResponse([existingDraft, locked]))
    rpc.copyVersion.mockRejectedValue(
      new TechnicalConfigurationRpcError(409, { message: "draft_already_exists" })
    )
    rpc.getDossier.mockResolvedValue({ data: { ...dossier, revision: 4 } })
    rpc.lockVersion.mockResolvedValue({
      data: {
        ...existingDraft,
        status: "locked",
        locked_at: "2026-07-14T09:00:00.000Z",
        locked_by: 42,
      },
    })
    rpc.createDraft.mockResolvedValue({
      data: {
        ...draft,
        id: "next-draft",
        version_number: 4,
        dossier_revision: 5,
      },
    })
    const { result } = renderBaselineEditor()

    await waitFor(() => expect(result.current.selectedVersion?.id).toBe(locked.id))
    await act(async () => {
      await result.current.onCopy().catch(() => undefined)
    })

    await waitFor(() => expect(result.current.selectedVersion?.id).toBe(existingDraft.id))
    expect(result.current.editorDraft).not.toBeNull()
    expect(result.current.lifecycleError).toBeNull()
    expect(rpc.listVersions).toHaveBeenCalledTimes(2)

    await act(async () => {
      await result.current.onLock()
    })
    act(() => {
      result.current.onCreate()
    })

    await waitFor(() => expect(rpc.createDraft).toHaveBeenCalledTimes(1))
    expect(rpc.createDraft).toHaveBeenCalledWith({
      p_dossier_id: dossier.id,
      p_expected_revision: 4,
    })
  })
})
