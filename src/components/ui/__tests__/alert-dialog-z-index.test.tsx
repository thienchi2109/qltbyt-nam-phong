import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

describe("AlertDialog layering", () => {
  it("renders above the equipment detail dialog layer", () => {
    render(
      <AlertDialog open onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm delete</AlertDialogTitle>
          <AlertDialogDescription>Move this equipment to trash.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    )

    const content = screen.getByRole("alertdialog")
    const overlay = document.querySelector<HTMLElement>('div[class*="bg-black/80"]')

    // Equipment detail dialog content renders at z-[1000].
    expect(content.className).toContain("z-[1001]")
    expect(overlay?.className ?? "").toContain("z-[1000]")
  })
})
