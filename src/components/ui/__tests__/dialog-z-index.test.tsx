import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

describe("Dialog layering", () => {
  it("renders at the shared dialog overlay/content tiers", () => {
    render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent>
          <DialogTitle>Dialog title</DialogTitle>
          <DialogDescription>Dialog description</DialogDescription>
        </DialogContent>
      </Dialog>
    )

    const content = screen.getByRole("dialog")
    const overlay = document.querySelector<HTMLElement>('div[class*="z-[999]"]')

    expect(content.className).toContain("z-[1000]")
    expect(overlay?.className ?? "").toContain("z-[999]")
  })
})
