import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { HierarchicalEditorSection } from "@/components/hierarchical-editor/HierarchicalEditorSection"
import { HierarchicalEditorStructureSidebar } from "@/components/hierarchical-editor/HierarchicalEditorStructureSidebar"
import { HierarchicalEditorToolbar } from "@/components/hierarchical-editor/HierarchicalEditorToolbar"
import { HierarchicalEditorWorkspace } from "@/components/hierarchical-editor/HierarchicalEditorWorkspace"

describe("hierarchical editor workspace primitives", () => {
  it("keeps the toolbar outside a fixed-height independently scrollable body", () => {
    render(
      <HierarchicalEditorWorkspace
        ariaLabel="Workspace"
        bodyAriaLabel="Editor body"
        toolbar={<HierarchicalEditorToolbar onSave={vi.fn()} saveDisabled={false} />}
        sidebar={<div>Structure</div>}
      >
        <div>Rows</div>
      </HierarchicalEditorWorkspace>
    )

    const workspace = screen.getByRole("region", { name: "Workspace" })
    const body = screen.getByTestId("hierarchical-editor-body")
    const toolbar = screen.getByTestId("hierarchical-editor-toolbar")

    expect(workspace).toHaveClass("h-[70dvh]", "min-h-[28rem]", "max-h-[52rem]")
    expect(body).toHaveClass("min-h-0", "overflow-hidden")
    expect(screen.getByRole("region", { name: "Editor body" })).toHaveClass(
      "min-h-0",
      "overflow-y-auto"
    )
    expect(body).not.toContainElement(toolbar)
  })

  it("renders ordered sections and scrolls the selected target into view", async () => {
    const user = userEvent.setup()
    const onSectionSelect = vi.fn()
    const firstTarget = { current: document.createElement("div") }
    const secondTarget = { current: document.createElement("div") }
    const firstScroll = vi.spyOn(firstTarget.current, "scrollIntoView")
    const secondScroll = vi.spyOn(secondTarget.current, "scrollIntoView")

    render(
      <HierarchicalEditorStructureSidebar
        activeKey="first"
        onSectionSelect={onSectionSelect}
        sections={[
          { key: "first", label: "First", ordinal: "I", targetRef: firstTarget },
          { key: "second", label: "Second", ordinal: "II", targetRef: secondTarget },
        ]}
      />
    )

    const items = within(screen.getByRole("list", { name: "Editor structure" })).getAllByRole(
      "listitem"
    )
    expect(items.map((item) => item.textContent)).toEqual(["IFirst", "IISecond"])
    expect(screen.getByRole("button", { name: "First" })).toHaveAttribute("aria-current", "true")

    await user.click(screen.getByRole("button", { name: "Second" }))

    expect(firstScroll).not.toHaveBeenCalled()
    expect(secondScroll).toHaveBeenCalledWith({ block: "nearest" })
    expect(onSectionSelect).toHaveBeenCalledWith("second")
  })

  it("toggles a controlled section without changing its row order", async () => {
    const user = userEvent.setup()

    function Harness(): React.JSX.Element {
      const [expanded, setExpanded] = React.useState(true)

      return (
        <HierarchicalEditorSection
          label="First section"
          expanded={expanded}
          onExpandedChange={setExpanded}
          header={({ disclosure }) => (
            <div>
              {disclosure}
              <span>First section</span>
            </div>
          )}
        >
          <div data-testid="rows">
            <span>Row A</span>
            <span>Row B</span>
          </div>
        </HierarchicalEditorSection>
      )
    }

    render(<Harness />)

    const disclosure = screen.getByRole("button", { name: "Thu gọn First section" })
    expect(
      within(screen.getByTestId("rows"))
        .getAllByText(/Row/)
        .map((row) => row.textContent)
    ).toEqual(["Row A", "Row B"])

    await user.click(disclosure)

    expect(screen.getByRole("button", { name: "Mở rộng First section" })).toBeInTheDocument()
    expect(screen.queryByTestId("rows")).not.toBeInTheDocument()
  })

  it("disables save while saving or while a pending input guard is active", () => {
    const { rerender } = render(
      <HierarchicalEditorToolbar
        onSave={vi.fn()}
        saveDisabled={false}
        isSaving
        pendingInputDescription="Finish the pending input first."
      />
    )

    expect(screen.getByRole("button", { name: "Đang lưu..." })).toBeDisabled()

    rerender(
      <HierarchicalEditorToolbar
        onSave={vi.fn()}
        saveDisabled={false}
        pendingInputDescription="Finish the pending input first."
      />
    )

    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled()
    expect(screen.getByText("Finish the pending input first.")).toBeInTheDocument()
  })

  it("does not treat a null pending description as an active input guard", () => {
    render(
      <HierarchicalEditorToolbar
        onSave={vi.fn()}
        saveDisabled={false}
        pendingInputDescription={null}
      />
    )

    expect(screen.getByRole("button", { name: "Lưu" })).toBeEnabled()
    expect(screen.queryByText("Finish the pending input first.")).not.toBeInTheDocument()
  })
})
