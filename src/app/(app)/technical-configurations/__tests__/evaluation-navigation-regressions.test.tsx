import "@testing-library/jest-dom"
import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TechnicalConfigurationEvaluationMatrixToolbar } from "../_components/evaluation/TechnicalConfigurationEvaluationMatrixToolbar"
import { useTechnicalConfigurationEvaluationTransition } from "../_hooks/useTechnicalConfigurationEvaluationTransition"

type MatrixState = ReturnType<
  typeof import("../_hooks/useTechnicalConfigurationComparisonMatrix").useTechnicalConfigurationComparisonMatrix
>

vi.mock("../_components/comparison/TechnicalConfigurationMatrixToolbar", () => ({
  TechnicalConfigurationMatrixToolbar: ({ onExitFocus }: { onExitFocus: () => void }) => (
    <button type="button" onClick={onExitFocus}>
      Thoát chế độ tập trung
    </button>
  ),
}))

describe("technical configuration evaluation navigation regressions", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("logs a rejected transition and allows the same navigation to be retried", async () => {
    const transitionError = new Error("candidate load failed")
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const transition = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(transitionError)
      .mockResolvedValueOnce()
    const { result } = renderHook(() => useTechnicalConfigurationEvaluationTransition())

    await act(async () => {
      await result.current.startTransition(transition)
    })
    await act(async () => {
      await result.current.startTransition(transition)
    })

    expect(consoleError).toHaveBeenCalledWith(
      "Technical configuration evaluation transition failed.",
      transitionError
    )
    expect(transition).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(result.current.isTransitionPending).toBe(false))
  })

  it("guards focus exit when restoring columns would hide the active supplier", async () => {
    const user = userEvent.setup()
    const exitFocusMode = vi.fn()
    const runContextChange = vi.fn((change: () => void) => change())
    const matrix = {
      baselineVersionId: "baseline-1",
      versions: [],
      versionsQuery: {},
      options: [],
      optionsQuery: {},
      selectedOptions: [],
      visibleOptionIds: ["option-1"],
      pinnedOptionIds: [],
      focusedOptionId: "option-2",
      isSelectionLimitReached: false,
      exitFocusMode,
    } as unknown as MatrixState

    render(
      <TechnicalConfigurationEvaluationMatrixToolbar
        matrix={matrix}
        activeOptionId="option-2"
        navigationBlocked
        runContextChange={runContextChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Thoát chế độ tập trung" }))

    expect(runContextChange).toHaveBeenCalledTimes(1)
    expect(exitFocusMode).toHaveBeenCalledTimes(1)
  })
})
