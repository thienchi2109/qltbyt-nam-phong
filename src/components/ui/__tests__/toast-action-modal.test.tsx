import { createPortal } from "react-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { Toaster } from "@/components/ui/toaster"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

function SheetToastHarness({ onDiscard }: { onDiscard: () => void }) {
  const { toast } = useToast()
  const [actionTarget, setActionTarget] = useState<HTMLDivElement | null>(null)
  const action = actionTarget
    ? createPortal(
        <ToastAction altText="Discard changes" onClick={onDiscard}>
          Discard changes
        </ToastAction>,
        actionTarget
      )
    : undefined

  return (
    <>
      <button type="button" data-testid="background-control">
        Background control
      </button>
      <Sheet open onOpenChange={() => undefined}>
        <SheetContent>
          <SheetTitle>Temperature logbook</SheetTitle>
          <SheetDescription>Unsaved measurement</SheetDescription>
          <div ref={setActionTarget}>
            <button type="button" onClick={() => toast({ title: "Unsaved changes", action })}>
              Request close
            </button>
          </div>
        </SheetContent>
      </Sheet>
      <Toaster />
    </>
  )
}

describe("toast actions in a modal sheet", () => {
  it("keeps the sheet modal while the discard action remains keyboard and pointer accessible", async () => {
    const user = userEvent.setup()
    const onDiscard = vi.fn()
    render(<SheetToastHarness onDiscard={onDiscard} />)
    const dialog = screen.getByRole("dialog")
    const requestClose = screen.getByRole("button", { name: "Request close" })
    const backgroundControl = screen.getByTestId("background-control")
    await user.click(requestClose)

    const discard = await screen.findByRole("button", { name: "Discard changes" })
    expect(dialog).toContainElement(discard)
    expect(backgroundControl.closest('[aria-hidden="true"]')).not.toBeNull()
    for (let i = 0; i < 8 && !discard.matches(":focus"); i += 1) await user.tab()
    expect(discard).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    await user.click(requestClose)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Discard changes" })).toBeVisible()
    )
    const pointerDiscard = screen.getByRole("button", { name: "Discard changes" })
    expect(dialog).toContainElement(pointerDiscard)
    await user.click(pointerDiscard)
    expect(onDiscard).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: "Escape" })
  })
})
