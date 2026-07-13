import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useTechnicalConfigurationBulkEntrySessions } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions"
import { useTechnicalConfigurationInlineEditor } from "@/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationInlineEditor"
import type { TechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

const clientDraft: TechnicalConfigurationBaselineEditorDraft = {
  id: "draft-1",
  dossierId: "dossier-1",
  status: "draft",
  revision: 4,
  groups: [
    {
      key: "client-group-1",
      id: null,
      name: "Nhóm mới",
      criteria: [],
    },
  ],
}

const serverDraft: TechnicalConfigurationBaselineEditorDraft = {
  ...clientDraft,
  revision: 5,
  groups: [
    {
      ...clientDraft.groups[0],
      key: "group-5",
      id: "group-5",
    },
  ],
}

describe("useTechnicalConfigurationInlineEditor", () => {
  it("clears a stale focus request when save reconciliation replaces the active group key", async () => {
    const onEditorChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ draft }: { draft: TechnicalConfigurationBaselineEditorDraft }) => {
        const bulkSessions = useTechnicalConfigurationBulkEntrySessions()
        return useTechnicalConfigurationInlineEditor({
          draft,
          validation: { groupErrors: {}, criterionErrors: {} },
          saveStatus: "idle",
          bulkSessions,
          onEditorChange,
        })
      },
      { initialProps: { draft: clientDraft } }
    )

    await waitFor(() => expect(result.current.activeValue).toBe("client-group-1"))
    act(() => result.current.changeMode("bulk"))
    expect(result.current.focusTarget).toMatchObject({ kind: "bulk-input" })

    rerender({ draft: serverDraft })

    await waitFor(() => expect(result.current.activeValue).toBe("group-5"))
    expect(result.current.focusTarget).toBeNull()
  })
})
