import "@testing-library/jest-dom"
import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationResultExportDialog } from "@/app/(app)/technical-configurations/_components/evaluation/TechnicalConfigurationResultExportDialog"
import {
  createTechnicalConfigurationResultExportState,
  getTechnicalConfigurationResultExportValidationError,
  transitionTechnicalConfigurationResultExport,
  type TechnicalConfigurationResultExportContext,
} from "@/app/(app)/technical-configurations/technical-configuration-result-export-state"

function createContext(
  overrides: Partial<TechnicalConfigurationResultExportContext> = {}
): TechnicalConfigurationResultExportContext {
  return {
    dossierId: "dossier-1",
    baselineVersionId: "baseline-1",
    options: {
      total: 126,
      page: {
        currentIds: ["option-1", "option-2", "option-3"],
        selectedIds: ["option-2", "option-3"],
      },
    },
    criteria: {
      total: 102,
      page: {
        currentIds: ["criterion-1", "criterion-2"],
      },
    },
    ...overrides,
  }
}

describe("technical configuration result export state", () => {
  it("opens every dialog session with the complete universe selected", () => {
    const initial = createTechnicalConfigurationResultExportState(createContext())

    const result = transitionTechnicalConfigurationResultExport(initial, { type: "open" })

    expect(result.request).toBeNull()
    expect(result.state).toMatchObject({
      open: true,
      mode: "full",
      optionScope: "all",
      criterionScope: "all",
    })
  })

  it("does not emit a request when confirm is sent to a closed state", () => {
    const initial = createTechnicalConfigurationResultExportState(createContext())

    const result = transitionTechnicalConfigurationResultExport(initial, { type: "confirm" })

    expect(result.request).toBeNull()
    expect(result.state).toBe(initial)
  })

  it("resets changed content and scope choices without closing the dialog", () => {
    let state = transitionTechnicalConfigurationResultExport(
      createTechnicalConfigurationResultExportState(createContext()),
      { type: "open" }
    ).state
    state = transitionTechnicalConfigurationResultExport(state, {
      type: "mode_changed",
      mode: "ranking_only",
    }).state
    state = transitionTechnicalConfigurationResultExport(state, {
      type: "option_scope_changed",
      scope: "selected",
    }).state
    state = transitionTechnicalConfigurationResultExport(state, {
      type: "criterion_scope_changed",
      scope: "current_page",
    }).state

    const result = transitionTechnicalConfigurationResultExport(state, { type: "reset" })

    expect(result.state).toMatchObject({
      open: true,
      mode: "full",
      optionScope: "all",
      criterionScope: "all",
    })
  })

  it("emits one validated request and closes after confirmation", () => {
    let state = transitionTechnicalConfigurationResultExport(
      createTechnicalConfigurationResultExportState(createContext()),
      { type: "open" }
    ).state
    state = transitionTechnicalConfigurationResultExport(state, {
      type: "mode_changed",
      mode: "detailed_matrix_only",
    }).state
    state = transitionTechnicalConfigurationResultExport(state, {
      type: "option_scope_changed",
      scope: "selected",
    }).state
    state = transitionTechnicalConfigurationResultExport(state, {
      type: "criterion_scope_changed",
      scope: "current_page",
    }).state

    const result = transitionTechnicalConfigurationResultExport(state, { type: "confirm" })

    expect(result.request).toEqual({
      mode: "detailed_matrix_only",
      dossierId: "dossier-1",
      baselineVersionId: "baseline-1",
      optionIds: ["option-2", "option-3"],
      criterionIds: ["criterion-1", "criterion-2"],
    })
    expect(result.state).toMatchObject({
      open: false,
      mode: "full",
      optionScope: "all",
      criterionScope: "all",
    })
  })

  it("rejects confirmation when an explicit selected scope is empty", () => {
    const context = createContext({
      options: {
        total: 126,
        page: {
          currentIds: ["option-1"],
          selectedIds: [],
        },
      },
    })
    let state = transitionTechnicalConfigurationResultExport(
      createTechnicalConfigurationResultExportState(context),
      { type: "open" }
    ).state
    state = transitionTechnicalConfigurationResultExport(state, {
      type: "option_scope_changed",
      scope: "selected",
    }).state

    expect(getTechnicalConfigurationResultExportValidationError(state)).toBe(
      "empty_selected_options"
    )

    const result = transitionTechnicalConfigurationResultExport(state, { type: "confirm" })
    expect(result.request).toBeNull()
    expect(result.state.open).toBe(true)
  })

  it("rejects a redundant current option page while preserving the selected scope", () => {
    const context = createContext({
      options: {
        total: 2,
        page: {
          currentIds: ["option-1", "option-2"],
          selectedIds: ["option-2"],
        },
      },
    })
    let state = transitionTechnicalConfigurationResultExport(
      createTechnicalConfigurationResultExportState(context),
      { type: "open" }
    ).state
    state = transitionTechnicalConfigurationResultExport(state, {
      type: "option_scope_changed",
      scope: "current_page",
    }).state

    expect(getTechnicalConfigurationResultExportValidationError(state)).toBe(
      "unavailable_option_scope"
    )

    state = transitionTechnicalConfigurationResultExport(state, {
      type: "option_scope_changed",
      scope: "selected",
    }).state
    const result = transitionTechnicalConfigurationResultExport(state, { type: "confirm" })

    expect(result.request?.optionIds).toEqual(["option-2"])
  })

  it("resets content and scope when dossier or baseline identity changes", () => {
    let state = transitionTechnicalConfigurationResultExport(
      createTechnicalConfigurationResultExportState(createContext()),
      { type: "open" }
    ).state
    state = transitionTechnicalConfigurationResultExport(state, {
      type: "mode_changed",
      mode: "ranking_only",
    }).state
    state = transitionTechnicalConfigurationResultExport(state, {
      type: "option_scope_changed",
      scope: "current_page",
    }).state

    const result = transitionTechnicalConfigurationResultExport(state, {
      type: "context_changed",
      context: createContext({
        dossierId: "dossier-2",
        baselineVersionId: "baseline-2",
      }),
    })

    expect(result.state).toMatchObject({
      open: true,
      mode: "full",
      optionScope: "all",
      criterionScope: "all",
      context: {
        dossierId: "dossier-2",
        baselineVersionId: "baseline-2",
      },
    })
  })

  it("cancels without a request and resets the next session", () => {
    let state = transitionTechnicalConfigurationResultExport(
      createTechnicalConfigurationResultExportState(createContext()),
      { type: "open" }
    ).state
    state = transitionTechnicalConfigurationResultExport(state, {
      type: "mode_changed",
      mode: "ranking_only",
    }).state

    const result = transitionTechnicalConfigurationResultExport(state, { type: "cancel" })

    expect(result.request).toBeNull()
    expect(result.state).toMatchObject({
      open: false,
      mode: "full",
      optionScope: "all",
      criterionScope: "all",
    })
  })
})

function DialogHarness({
  context,
  onConfirm,
}: Readonly<{
  context: TechnicalConfigurationResultExportContext
  onConfirm: React.ComponentProps<typeof TechnicalConfigurationResultExportDialog>["onConfirm"]
}>) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Mở xuất kết quả
      </button>
      <TechnicalConfigurationResultExportDialog
        open={open}
        context={context}
        onOpenChange={setOpen}
        onConfirm={onConfirm}
      />
    </>
  )
}

describe("TechnicalConfigurationResultExportDialog", () => {
  it("renders the approved choices, defaults to all scope and focuses the first mode", async () => {
    const user = userEvent.setup()
    render(<DialogHarness context={createContext()} onConfirm={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "Mở xuất kết quả" }))

    expect(screen.getByRole("dialog", { name: "Xuất kết quả Excel" })).toBeInTheDocument()
    const fullMode = screen.getByRole("radio", { name: /Đầy đủ/ })
    expect(fullMode).toBeChecked()
    expect(screen.getByRole("radio", { name: "Tất cả 126 phương án" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Tất cả 102 tiêu chí" })).toBeChecked()
    expect(screen.getByText("3 sheet hiển thị")).toBeInTheDocument()
    expect(fullMode).toHaveAccessibleDescription(/Tổng quan.*Khuyên dùng/)
    await waitFor(() => expect(fullMode).toHaveFocus())
  })

  it("confirms deliberate paginated scopes as one request object", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<DialogHarness context={createContext()} onConfirm={onConfirm} />)

    await user.click(screen.getByRole("button", { name: "Mở xuất kết quả" }))
    await user.click(screen.getByRole("radio", { name: /Chỉ ma trận chi tiết/ }))
    await user.click(screen.getByRole("radio", { name: "2 phương án đã chọn" }))
    await user.click(screen.getByRole("radio", { name: "Trang tiêu chí hiện tại · 2 tiêu chí" }))
    await user.click(screen.getByRole("button", { name: "Xuất file .xlsx" }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith({
      mode: "detailed_matrix_only",
      dossierId: "dossier-1",
      baselineVersionId: "baseline-1",
      optionIds: ["option-2", "option-3"],
      criterionIds: ["criterion-1", "criterion-2"],
    })
  })

  it("shows current and selected alternatives only for paginated surfaces", async () => {
    const user = userEvent.setup()
    render(
      <DialogHarness
        context={createContext({
          options: { total: 126 },
          criteria: { total: 102 },
        })}
        onConfirm={vi.fn()}
      />
    )

    await user.click(screen.getByRole("button", { name: "Mở xuất kết quả" }))

    expect(screen.queryByRole("radio", { name: /đang hiển thị/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: /đã chọn/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: /Trang tiêu chí hiện tại/ })).not.toBeInTheDocument()
  })

  it("hides a redundant current option page while keeping the active selected option", async () => {
    const user = userEvent.setup()
    render(
      <DialogHarness
        context={createContext({
          options: {
            total: 2,
            page: {
              currentIds: ["option-1", "option-2"],
              selectedIds: ["option-2"],
            },
          },
        })}
        onConfirm={vi.fn()}
      />
    )

    await user.click(screen.getByRole("button", { name: "Mở xuất kết quả" }))

    expect(screen.queryByRole("radio", { name: /đang hiển thị/ })).not.toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "1 phương án đã chọn" })).toBeInTheDocument()
  })

  it("disables confirmation and announces an empty selected scope", async () => {
    const user = userEvent.setup()
    render(
      <DialogHarness
        context={createContext({
          options: {
            total: 126,
            page: {
              currentIds: ["option-1"],
              selectedIds: [],
            },
          },
        })}
        onConfirm={vi.fn()}
      />
    )

    await user.click(screen.getByRole("button", { name: "Mở xuất kết quả" }))
    await user.click(screen.getByRole("radio", { name: "0 phương án đã chọn" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Chưa có phương án nào được chọn.")
    expect(screen.getByRole("button", { name: "Xuất file .xlsx" })).toBeDisabled()
  })

  it("tracks same-identity scope updates before confirmation", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const { rerender } = render(
      <TechnicalConfigurationResultExportDialog
        open
        context={createContext()}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    await user.click(screen.getByRole("radio", { name: "2 phương án đã chọn" }))

    rerender(
      <TechnicalConfigurationResultExportDialog
        open
        context={createContext({
          options: {
            total: 127,
            page: {
              currentIds: ["option-1", "option-4"],
              selectedIds: ["option-4"],
            },
          },
        })}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    expect(screen.getByRole("radio", { name: "1 phương án đã chọn" })).toBeChecked()
    expect(screen.getByText(/Sẽ xuất: 1 phương án x 102 tiêu chí/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Xuất file .xlsx" }))
    expect(onConfirm).toHaveBeenCalledWith({
      mode: "full",
      dossierId: "dossier-1",
      baselineVersionId: "baseline-1",
      optionIds: ["option-4"],
      criterionIds: null,
    })
  })

  it("resets choices and restores focus across cancellation paths", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<DialogHarness context={createContext()} onConfirm={onConfirm} />)

    const opener = screen.getByRole("button", { name: "Mở xuất kết quả" })
    await user.click(opener)
    await user.click(screen.getByRole("radio", { name: /Chỉ xếp hạng/ }))
    await user.click(screen.getByRole("radio", { name: "3 phương án đang hiển thị" }))
    await user.click(screen.getByRole("button", { name: "Hủy" }))
    await waitFor(() => expect(opener).toHaveFocus())

    await user.click(opener)
    expect(screen.getByRole("radio", { name: /Đầy đủ/ })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Tất cả 126 phương án" })).toBeChecked()

    await user.click(screen.getByRole("radio", { name: /Chỉ xếp hạng/ }))
    await user.click(screen.getByRole("button", { name: "Đóng" }))
    await waitFor(() => expect(opener).toHaveFocus())

    await user.click(opener)
    expect(screen.getByRole("radio", { name: /Đầy đủ/ })).toBeChecked()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("resets the mounted dialog when dossier and baseline identity change", async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const { rerender } = render(
      <TechnicalConfigurationResultExportDialog
        open
        context={createContext()}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    await user.click(screen.getByRole("radio", { name: /Chỉ xếp hạng/ }))
    await user.click(screen.getByRole("radio", { name: "2 phương án đã chọn" }))

    rerender(
      <TechnicalConfigurationResultExportDialog
        open
        context={createContext({
          dossierId: "dossier-2",
          baselineVersionId: "baseline-2",
        })}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    expect(screen.getByRole("radio", { name: /Đầy đủ/ })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Tất cả 126 phương án" })).toBeChecked()
  })
})
