import * as React from "react"
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  useDeferredDropdownAction,
  useOverlayActionTransition,
} from "@/components/ui/use-deferred-dropdown-action"

describe("useOverlayActionTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.style.pointerEvents = ""
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    document.body.style.pointerEvents = ""
  })

  it("defers actions until after the source menu closes", () => {
    const onAction = vi.fn()

    function Harness() {
      const runOverlayAction = useOverlayActionTransition()
      const [sourceMenuOpen, setSourceMenuOpen] = React.useState(true)

      return (
        <div>
          {sourceMenuOpen ? (
            <button
              type="button"
              onClick={() => {
                document.body.style.pointerEvents = "none"
                runOverlayAction(() => {
                  document.body.style.pointerEvents = ""
                  onAction(document.body.style.pointerEvents)
                })
                setSourceMenuOpen(false)
              }}
            >
              Open follow-up overlay
            </button>
          ) : null}
          <span data-testid="source-state">{sourceMenuOpen ? "open" : "closed"}</span>
        </div>
      )
    }

    render(<Harness />)

    fireEvent.click(screen.getByRole("button", { name: "Open follow-up overlay" }))

    expect(screen.getByTestId("source-state")).toHaveTextContent("closed")
    expect(onAction).not.toHaveBeenCalled()
    expect(document.body.style.pointerEvents).toBe("none")

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(onAction).toHaveBeenCalledWith("")
    expect(document.body.style.pointerEvents).not.toBe("none")
  })

  it("cleans up pending action timers when the hook owner unmounts", () => {
    const onAction = vi.fn()
    const { result, unmount } = renderHook(() => useOverlayActionTransition())

    act(() => {
      result.current(onAction)
    })

    unmount()

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(onAction).not.toHaveBeenCalled()
  })

  it("keeps useDeferredDropdownAction as a compatibility export", () => {
    const { result } = renderHook(() => useDeferredDropdownAction())

    expect(result.current).toEqual(expect.any(Function))
  })
})
