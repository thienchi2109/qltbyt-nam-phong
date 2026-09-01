import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationBaselineEditor } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor"
import type { TechnicalConfigurationBaselineEditorDraft } from "@/app/(app)/technical-configurations/technical-configuration-baseline-editor"

const draft: TechnicalConfigurationBaselineEditorDraft = {
  id: "draft-1",
  dossierId: "dossier-1",
  status: "draft",
  revision: 1,
  groups: [
    { key: "group-a", id: "group-a", name: "Nhóm A", criteria: [] },
    { key: "group-b", id: "group-b", name: "Nhóm B", criteria: [] },
  ],
}

const scrollIntoView = vi.fn()
const originalScrollIntoView = Element.prototype.scrollIntoView

beforeEach(() => {
  scrollIntoView.mockClear()
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  })
})

afterAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: originalScrollIntoView,
  })
})

function renderEditor(): void {
  render(
    <TechnicalConfigurationBaselineEditor
      draft={draft}
      validation={{ groupErrors: {}, criterionErrors: {} }}
      summaryValidation={{ groupErrors: {}, criterionErrors: {} }}
      status={{
        dirty: true,
        saving: false,
        editingDisabled: false,
        conflict: false,
        saveStatus: "idle",
        hasPendingBulkInput: false,
      }}
      isFocusMode={false}
      activeValue=""
      entryMode="row"
      getBulkSession={() => ({ input: "", preview: null })}
      focusTarget={null}
      recentlyAcceptedCriterionKeys={new Set()}
      onGroupModeChange={vi.fn()}
      onAddGroup={vi.fn()}
      onGroupNameChange={vi.fn()}
      onMoveGroup={vi.fn()}
      onDeleteGroup={vi.fn()}
      onCriterionTextChange={vi.fn()}
      onMoveCriterion={vi.fn()}
      onDeleteCriterion={vi.fn()}
      onAddCriterion={vi.fn()}
      onBulkInputChange={vi.fn()}
      onBulkPreview={vi.fn()}
      onBulkCancel={vi.fn()}
      onBulkAccept={vi.fn()}
      onSave={vi.fn()}
    />
  )
}

describe("Technical Configurations shared hierarchical workspace", () => {
  it("scrolls a real baseline group when its shared structure item is selected", async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole("button", { name: "Nhóm B" }))

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" })
    expect(screen.getByRole("button", { name: "Nhóm B" })).toHaveAttribute("aria-current", "true")
  })
})
